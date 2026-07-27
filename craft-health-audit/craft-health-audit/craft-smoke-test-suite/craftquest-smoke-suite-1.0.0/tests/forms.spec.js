const { test, expect } = require('@playwright/test');
const smoke = require('../smoke.config');

/**
 * forms.spec.js
 * Load each configured form, fill it out, and submit. The honeypot field is
 * deliberately left blank so a well-behaved form treats us as human. Success is
 * confirmed by looking for `successText` on the resulting page.
 *
 * Note: only enable this against forms that tolerate test submissions (or point
 * it at staging). Set successText to something that ONLY appears on success.
 */
if (smoke.forms.length === 0) {
  test.skip('forms: no forms configured', () => {});
}

for (const form of smoke.forms) {
  test(`form: ${form.name} submits successfully`, async ({ page }) => {
    await page.goto(form.path, { waitUntil: 'domcontentloaded' });

    const root = page.locator(form.formSelector);
    await expect(root, `${form.name}: form ${form.formSelector} not found`).toBeVisible();

    // Fill the real fields.
    for (const [name, value] of Object.entries(form.fields)) {
      await root.locator(`[name="${name}"]`).first().fill(String(value));
    }

    // Explicitly leave the honeypot blank (some builders pre-fill; clear it).
    if (form.honeypot) {
      const hp = root.locator(`[name="${form.honeypot}"]`);
      if (await hp.count()) {
        await hp.first().fill('');
      }
    }

    await Promise.all([
      page.waitForLoadState('networkidle'),
      root.locator(form.submitSelector).first().click(),
    ]);

    const body = (await page.textContent('body')) || '';
    expect(
      body.includes(form.successText),
      `${form.name}: expected success text "${form.successText}" not found`
    ).toBe(true);
  });
}
