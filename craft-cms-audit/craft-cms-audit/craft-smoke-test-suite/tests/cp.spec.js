const { test, expect } = require('@playwright/test');
const smoke = require('../smoke.config');

/**
 * cp.spec.js
 * Confirm the Craft control panel login page loads. If CP credentials are
 * provided via env (SMOKE_CP_USERNAME / SMOKE_CP_PASSWORD), also perform an
 * authenticated login and confirm the dashboard renders.
 *
 * Note on selectors: the CP login field name changed across Craft versions.
 *   Craft 3–4:  name="loginName"
 *   Craft 5–6:  name="username" (rendered with class .login-username)
 * We match every variant so the same test spans all supported Craft versions.
 * The password field has always been name="password" (class .login-password).
 */
const USERNAME_FIELD =
  'input[name="username"], input[name="loginName"], .login-username';
const PASSWORD_FIELD =
  'input[name="password"], .login-password';

test('cp: login page loads', async ({ page }) => {
  const response = await page.goto(smoke.cp.loginPath, { waitUntil: 'domcontentloaded' });
  expect(response.status(), `CP login returned ${response.status()}`).toBeLessThan(400);

  await expect(page.locator(USERNAME_FIELD).first()).toBeVisible();
  await expect(page.locator(PASSWORD_FIELD).first()).toBeVisible();
});

const hasCreds = smoke.cp.username && smoke.cp.password;

(hasCreds ? test : test.skip)('cp: authenticated dashboard loads', async ({ page }) => {
  await page.goto(smoke.cp.loginPath, { waitUntil: 'domcontentloaded' });

  await page.locator(USERNAME_FIELD).first().fill(smoke.cp.username);
  await page.locator(PASSWORD_FIELD).first().fill(smoke.cp.password);

  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.locator('button[type="submit"], #submit').first().click(),
  ]);

  const response = await page.goto(smoke.cp.dashboardPath, { waitUntil: 'domcontentloaded' });
  expect(response.status(), `CP dashboard returned ${response.status()}`).toBeLessThan(400);

  // If we got bounced back to login, the credentials failed.
  expect(
    page.url().includes(smoke.cp.loginPath),
    'CP login failed — redirected back to login page'
  ).toBe(false);
});
