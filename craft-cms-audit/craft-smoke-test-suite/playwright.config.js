/**
 * playwright.config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * You should rarely need to edit this. It reads its important values from
 * smoke.config.js so that members only ever touch one file.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const { defineConfig, devices } = require('@playwright/test');
const smoke = require('./smoke.config');

module.exports = defineConfig({
  testDir: './tests',
  // Fail the build on CI if you left test.only in the source.
  forbidOnly: !!process.env.CI,
  // Retries come from smoke.config.js (defaults to 1 on CI).
  retries: smoke.retries,
  // Opt out of parallelism inside a file; keep files parallel.
  fullyParallel: true,
  // One worker on CI keeps output readable and avoids hammering the target.
  workers: process.env.CI ? 2 : undefined,
  timeout: smoke.timeouts.test,
  expect: {
    timeout: smoke.timeouts.action,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'results.json' }],
  ],
  use: {
    baseURL: smoke.baseUrl,
    actionTimeout: smoke.timeouts.action,
    navigationTimeout: smoke.timeouts.action,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: false,
    userAgent: `CraftQuest-Smoke-Suite (+${smoke.siteName})`,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
