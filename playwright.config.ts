import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT_API = process.env.E2E_API_PORT ?? '4010';
const PORT_UI = process.env.E2E_UI_PORT ?? '5174';

const candidateBrowsers = [
  process.env.PLAYWRIGHT_CHROMIUM_PATH,
  '/Users/administrador/Library/Caches/ms-playwright/chromium-1161/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter((p): p is string => !!p && fs.existsSync(p));

const executablePath = candidateBrowsers[0];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT_UI}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `npm run dev -w server`,
      url: `http://127.0.0.1:${PORT_API}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: PORT_API,
        CLIENT_ORIGIN: `http://127.0.0.1:${PORT_UI}`,
      },
    },
    {
      command: `npm run dev -w client -- --host 127.0.0.1 --port ${PORT_UI}`,
      url: `http://127.0.0.1:${PORT_UI}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_PROXY: `http://127.0.0.1:${PORT_API}`,
      },
    },
  ],
});
