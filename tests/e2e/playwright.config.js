import { defineConfig, devices } from '@playwright/test';

// The tests run against a deployed environment, so a silent default would test the wrong server
if (!process.env.BASE_URL) {
  throw new Error('BASE_URL is not set. Set it to the URL of the environment to test.');
}

export default defineConfig({
  testDir: './',
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
