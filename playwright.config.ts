import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3001',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node --import tsx server/index.ts', url: 'http://127.0.0.1:3001/api/status', reuseExistingServer: !process.env.CI,
    env: { STORAGE_BACKEND: '', GOOGLE_SHEET_ID: '', GOOGLE_SERVICE_ACCOUNT_EMAIL: '', GOOGLE_PRIVATE_KEY: '' },
    timeout: 90000,
  },
});
