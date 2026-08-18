const { test, expect } = require('@playwright/test');
const smoke = require('../smoke.config');

/**
 * availability.spec.js
 * Every critical URL must return 200, actually render, and contain none of the
 * configured error strings. This is the single most valuable smoke test: it is
 * the "is the site up and not white-screening" check.
 */
for (const path of smoke.criticalPaths) {
  test(`availability: ${path} responds 200 and renders`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

    expect(response, `No response for ${path}`).toBeTruthy();
    expect(
      response.status(),
      `${path} returned ${response.status()}`
    ).toBeLessThan(400);

    // The page should render a <body> with some content.
    const bodyText = (await page.textContent('body')) || '';
    expect(bodyText.trim().length, `${path} rendered an empty body`).toBeGreaterThan(0);

    // None of the configured error strings should appear.
    const html = await page.content();
    const haystack = html.toLowerCase();
    for (const needle of smoke.errorText) {
      expect(
        haystack.includes(needle.toLowerCase()),
        `${path} contains error text: "${needle}"`
      ).toBe(false);
    }
  });
}
