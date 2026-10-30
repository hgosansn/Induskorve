import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Each test owns a live Canvas scene. Bound concurrent renderers on local and CI hosts.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    channel: process.env.E2E_CHANNEL,
  },
  projects: [
    { name: 'product', testIgnore: '**/playtest.spec.ts' },
    {
      name: 'playtest',
      testMatch: '**/playtest.spec.ts',
      use: { baseURL: 'http://127.0.0.1:4175' },
    },
  ],
  webServer: [
    {
      command: 'npm run preview -- --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev -- --port 4175 --strictPort',
      url: 'http://127.0.0.1:4175/playtest.html',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
