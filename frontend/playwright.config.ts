import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Testing Configuration
 *
 * Run tests: npx playwright test
 * Show report: npx playwright show-report
 * UI mode: npx playwright test --ui
 * Debug mode: npx playwright test --debug
 */
const includeCrossBrowserProjects = process.env.PW_CROSS_BROWSER === '1';
const includeMobileProjects = process.env.PW_MOBILE === '1';
const useStaticServer = process.env.PW_STATIC_SERVER !== '0';
const e2ePort = process.env.PW_PORT || '4301';
const e2eBaseUrl = `http://localhost:${e2ePort}`;
const defaultRetries = process.env.CI ? 2 : 2;
const defaultWorkers = process.env.CI ? 1 : 1;
const e2eServerCommand = useStaticServer
  ? `node scripts/e2e-static-server.cjs ${e2ePort}`
  : `cross-env NODE_OPTIONS=--max_old_space_size=4096 ng serve --configuration development --proxy-config proxy.conf.json --port ${e2ePort} --open=false --live-reload=false --hmr=false`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: defaultRetries,
  workers: defaultWorkers,
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  use: {
    baseURL: e2eBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(includeCrossBrowserProjects
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),

    ...(includeMobileProjects
      ? [
          {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
          },
          ...(includeCrossBrowserProjects
            ? [
                {
                  name: 'Mobile Safari',
                  use: { ...devices['iPhone 12'] },
                },
              ]
            : []),
        ]
      : []),
  ],

  /* Run dev server before starting tests */
  webServer: {
    command: e2eServerCommand,
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 300000,
  },
});
