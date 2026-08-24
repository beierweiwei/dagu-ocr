import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const e2ePort = process.env.DAGU_OCR_E2E_PORT || '4173'
const e2eServerUrl = `http://127.0.0.1:${e2ePort}`

type SystemChrome = {
  browserName: 'chromium'
  executablePath?: string
  channel?: 'chrome'
  browserLabel: string
}

function systemChrome(): SystemChrome {
  const configuredPath = process.env.DAGU_OCR_PLAYWRIGHT_EXECUTABLE_PATH
  if (configuredPath && existsSync(configuredPath)) {
    return {
      browserName: 'chromium',
      executablePath: configuredPath,
      browserLabel: `Google Chrome (${configuredPath})`
    }
  }

  const candidates = process.platform === 'win32'
    ? [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`
    ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/google-chrome']
  const executablePath = candidates.find((candidate) => existsSync(candidate))
  if (executablePath) {
    return {
      browserName: 'chromium',
      executablePath,
      browserLabel: `Google Chrome (${executablePath})`
    }
  }

  return {
    browserName: 'chromium',
    channel: 'chrome',
    browserLabel: 'Google Chrome (Playwright chrome channel)'
  }
}

const defaultBrowser = systemChrome()
console.log(`[E2E] Browser: ${defaultBrowser.browserLabel}`)

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
  metadata: {
    browser: defaultBrowser.browserLabel
  },
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
        browserName: defaultBrowser.browserName,
        ...(defaultBrowser.channel ? { channel: defaultBrowser.channel } : {}),
        permissions: ['clipboard-read', 'clipboard-write'], // 授予剪贴板权限
        launchOptions: {
          ...(defaultBrowser.executablePath ? { executablePath: defaultBrowser.executablePath } : {}),
          ...(defaultBrowser.browserName === 'chromium' ? {
            args: [
              '--allow-file-access-from-files',
              '--use-fake-ui-for-media-stream', // 模拟媒体流权限，用于截图测试
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage'
            ]
          } : {})
        }
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
