const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const smoke = require('./smoke.config');

const artifactDir = process.env.SMOKE_ARTIFACT_DIR
  ? path.resolve(process.env.SMOKE_ARTIFACT_DIR)
  : path.resolve(__dirname, 'artifacts');

module.exports = defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  retries: smoke.retries,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  timeout: smoke.timeouts.test,
  expect: {
    timeout: smoke.timeouts.action,
  },
  outputDir: path.join(artifactDir, 'test-results'),
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.join(artifactDir, 'playwright-report') }],
    ['json', { outputFile: process.env.SMOKE_RESULTS_JSON || path.join(artifactDir, 'results.json') }],
  ],
  use: {
    baseURL: smoke.baseUrl,
    actionTimeout: smoke.timeouts.action,
    navigationTimeout: smoke.timeouts.action,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: false,
    userAgent: `DIT-Craft-Smoke-Suite (+${smoke.siteName})`,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
