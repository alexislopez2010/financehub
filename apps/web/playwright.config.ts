import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'anonymous',
      testMatch: ['smoke.spec.ts', 'auth-flow.spec.ts'],
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'authenticated',
      testMatch: ['authenticated.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json'
      }
    }
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe'
  }
})
