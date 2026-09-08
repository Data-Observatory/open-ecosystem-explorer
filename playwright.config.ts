import { defineConfig, devices } from '@playwright/test';

// Playwright wasn't wired up by any earlier phase (Phase 0 installed the
// dependency; no config file existed until Phase 7). Runs against a real
// production build+preview, not dev, per specs.md §11's "Rendering / e2e"
// and "Accessibility" rows — both are Blocking gates.
export default defineConfig({
  testDir: './tests',
  testMatch: ['a11y/**/*.spec.ts', 'e2e/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --port 4321',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
