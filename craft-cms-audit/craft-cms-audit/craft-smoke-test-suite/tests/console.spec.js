const { test, expect } = require('@playwright/test');
const smoke = require('../smoke.config');

/**
 * console.spec.js
 * Load each configured page and fail if any JS console error or uncaught
 * exception fires. Known-noisy third-party errors can be ignored via
 * smoke.config.js -> console.ignore.
 */
function isIgnored(message) {
  return smoke.console.ignore.some((frag) => message.includes(frag));
}

for (const path of smoke.console.paths) {
  test(`console: ${path} has no JS errors`, async ({ page }) => {
    const errors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) {
        errors.push(`console.error: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      if (!isIgnored(err.message)) {
        errors.push(`uncaught: ${err.message}`);
      }
    });

    await page.goto(path, { waitUntil: 'networkidle' });

    expect(errors, `${path} logged console errors:\n${errors.join('\n')}`).toHaveLength(0);
  });
}
