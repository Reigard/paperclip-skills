const { test, expect } = require('@playwright/test');
const smoke = require('../smoke.config');

/**
 * templates.spec.js
 * For each configured template, confirm the page loads and every expected
 * selector is present and visible. Catches "200 but the layout is broken".
 */
if (smoke.templates.length === 0) {
  test.skip('templates: no templates configured', () => {});
}

for (const tpl of smoke.templates) {
  test(`template: ${tpl.name} (${tpl.path}) renders expected elements`, async ({ page }) => {
    const response = await page.goto(tpl.path, { waitUntil: 'domcontentloaded' });
    expect(response.status(), `${tpl.path} returned ${response.status()}`).toBeLessThan(400);

    for (const selector of tpl.expect) {
      const locator = page.locator(selector).first();
      await expect(
        locator,
        `${tpl.name}: expected selector "${selector}" to be visible`
      ).toBeVisible();
    }
  });
}
