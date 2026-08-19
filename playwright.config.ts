import { defineConfig, devices } from '@playwright/test'

const e2ePort = process.env.DAGU_OCR_E2E_PORT || '4173'
const e2eServerUrl = `http://127.0.0.1:${e2ePort}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'artifacts/playwright-report' }],
    ['junit', { outputFile: 'artifacts/playwright-results.xml' }],
    ['json', { outputFile: 'artifacts/playwright-results.json' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || e2eServerUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['clipboard-read', 'clipboard-write'], // 授予剪贴板权限
        launchOptions: {
          ...(process.env.DAGU_OCR_PLAYWRIGHT_EXECUTABLE_PATH
            ? { executablePath: process.env.DAGU_OCR_PLAYWRIGHT_EXECUTABLE_PATH }
            : {}),
          args: [
            '--allow-file-access-from-files',
            '--use-fake-ui-for-media-stream', // 模拟媒体流权限，用于截图测试
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ]
        }
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        firefoxUserPrefs: {
          'dom.events.testing.asyncClipboard': true, // 启用异步剪贴板API
          'media.navigator.permission.disabled': true, // 禁用媒体权限弹窗
        }
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
  ],
  webServer: {
    command: `npx vite --config plugin/vite.config.js --host 127.0.0.1 --port ${e2ePort}`,
    url: e2eServerUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
