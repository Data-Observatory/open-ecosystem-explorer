import { defineConfig, devices } from '@playwright/test';

// Runs against the real static build served by `vite preview`, as the sister sites do. Build
// first (`npm run build`); the web server only serves build/. The port is configurable because
// 4321 is reserved for the owner's dev server.
const port = Number(process.env.PW_PORT ?? 4173);

// Machines without Playwright's bundled browser can point at a system Chrome.
const executablePath = process.env.PLAYWRIGHT_CHROME_PATH;

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: [['list']],
	webServer: {
		command: `node node_modules/vite/bin/vite.js preview --port ${port} --strictPort --host 127.0.0.1`,
		url: `http://127.0.0.1:${port}/es/`,
		timeout: 120_000,
		reuseExistingServer: !process.env.CI
	},
	use: {
		baseURL: `http://127.0.0.1:${port}`,
		trace: 'retain-on-failure',
		// layout.css disables transitions under prefers-reduced-motion: axe never samples colours
		// mid-transition.
		reducedMotion: 'reduce'
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				...(executablePath ? { launchOptions: { executablePath, args: ['--no-sandbox'] } } : {})
			}
		}
	]
});
