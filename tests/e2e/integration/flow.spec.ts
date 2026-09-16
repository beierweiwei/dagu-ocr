import { test, expect, Page } from '@playwright/test'
import { OcrPage } from '../../pages/OcrPage'
import { CaptureOverlayPage } from '../../pages/CaptureOverlayPage'
import { TEST_IMAGE_1x1 } from '../../fixtures/test-data'

async function installMockZTools(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('dagu-ocr.preferences', JSON.stringify({
      ocrProviderId: 'ztools:mock-ocr',
      translationProviderId: 'ztools:mock-translation',
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      syncSecrets: false
    }))
    ;(window as any).ztools = {
      providers: {
        getProviders: async (type: string) => [{ id: `mock-${type}`, label: `测试 ${type}` }],
        invokeProvider: async (type: string, input: { text?: string }) => (
          type === 'ocr' ? 'Mock OCR Result' : `Mock Translation: ${input.text || ''}`
        )
      },
      copyText: () => true
    }
  })
}

test.describe('完整流程集成测试', () => {
  const testImageBuffer = Buffer.from(TEST_IMAGE_1x1, 'base64')

  test.beforeEach(async ({ page }) => {
    await installMockZTools(page)
  })

  test('OCR识别 -> 编辑图片 -> 交给 OCR 的完整流程', async ({ page }) => {
    const ocrPage = new OcrPage(page)
    await ocrPage.goto()
    await ocrPage.configureMockProviders()

    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: testImageBuffer
    })
    await expect(ocrPage.preview).toBeVisible()
    await ocrPage.closeConfig()

    // 编辑图片与截图共用同一覆盖层：没有子窗口能力时在同一窗口打开图片编辑模式
    await ocrPage.editImage()
    await page.waitForURL(/overlay\.html.*mode=image/)

    const editor = new CaptureOverlayPage(page)
    await editor.waitForReady()
    expect((await editor.state()).mode).toBe('image')

    // 在图片上画标注：矩形 + 文字
    await editor.tool('shape').click()
    await editor.drag({ x: 12, y: 12 }, { x: 44, y: 44 })
    await editor.tool('text').click()
    await page.mouse.click(60, 60)
    await page.keyboard.type('标注文字')
    await page.keyboard.press('Enter')

    await expect.poll(async () => editor.annotationCount()).toBe(2)

    // 交给 OCR 节点：没有宿主窗口时退回同窗口跳转
    await Promise.all([
      page.waitForURL(/index\.html.*editorAction=ocr/),
      page.locator('#capture-ocr').click()
    ])
    await expect(page.locator('#resultText')).toHaveValue('Mock OCR Result')
  })

  test('图片编辑器可以把当前图片交给翻译节点', async ({ page }) => {
    const ocrPage = new OcrPage(page)
    await ocrPage.goto()
    await ocrPage.configureMockProviders()

    const editor = new CaptureOverlayPage(page)
    await editor.gotoImageEditor(TEST_IMAGE_1x1)
    await expect(page.locator('#capture-ocr')).toBeVisible()
    await expect(page.locator('#capture-translate')).toBeVisible()

    await page.locator('#capture-translate').click()
    await page.waitForURL(/index\.html.*editorAction=translate/)
    await expect(page.locator('#resultText')).toHaveValue('Mock OCR Result')
    await expect(page.locator('#translateResult')).toHaveValue('Mock Translation: Mock OCR Result')
  })

  test('配置保存后进入图片编辑器，配置不丢失', async ({ page }) => {
    const ocrPage = new OcrPage(page)
    await ocrPage.goto()

    await ocrPage.openConfig()
    await ocrPage.ocrProviderSelect.selectOption('ztools:mock-ocr')
    await ocrPage.translationProviderSelect.selectOption('ztools:mock-translation')
    const testAk = 'test-integration-ak-123'
    const testSk = 'test-integration-sk-456'
    await ocrPage.saveConfig(testAk, testSk)

    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: testImageBuffer
    })

    await ocrPage.editImage()
    await page.waitForURL(/overlay\.html.*mode=image/)
    const editor = new CaptureOverlayPage(page)
    await editor.waitForReady()

    // 返回 OCR 页面，验证配置仍然存在
    await page.goBack()
    await ocrPage.openConfig()
    expect(await ocrPage.baiduAkInput.inputValue()).toBe(testAk)
    expect(await ocrPage.baiduSkInput.inputValue()).toBe(testSk)
  })
})

test.describe('截图窗口回退流程', () => {
  test('截图触发瞬间并行抓帧，并把预抓帧键交给覆盖层', async ({ page }) => {
    const captureImage = `data:image/png;base64,${TEST_IMAGE_1x1}`

    await page.addInitScript((imageUrl) => {
      const calls: string[] = []
      ;(window as any).__flowCalls = calls
      ;(window as any).__overlayWindowUrl = null
      localStorage.setItem('dagu-ocr.preferences', JSON.stringify({
        ocrProviderId: 'ztools:mock-ocr',
        translationProviderId: 'ztools:mock-translation',
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        syncSecrets: false
      }))

      window.ztools = {
        providers: {
          getProviders: async (type) => [{ id: `mock-${type}`, label: `测试 ${type}` }],
          invokeProvider: async (type, input) => (
            type === 'ocr' ? 'Mock OCR Result' : `Mock Translation: ${input.text || ''}`
          )
        },
        copyText: () => true,
        hideMainWindow: () => {},
        showMainWindow: () => {},
        getCursorScreenPoint: () => ({ x: 640, y: 360 }),
        screenToDipPoint: (point) => point,
        getDisplayNearestPoint: () => ({
          id: 1,
          bounds: { x: 0, y: 0, width: 1280, height: 720 },
          scaleFactor: 1
        }),
        desktopCaptureSources: async () => {
          calls.push('desktopCaptureSources')
          return [{
            id: 'screen:0:0',
            display_id: 1,
            thumbnail: {
              getSize: () => ({ width: 1280, height: 720 }),
              toDataURL: () => imageUrl
            }
          }]
        },
        createBrowserWindow: (url: string) => {
          calls.push('createBrowserWindow')
          ;(window as any).__overlayWindowUrl = url
          return {
            close: () => {},
            show: () => {},
            focus: () => {},
            isVisible: () => true,
            setBounds: () => {},
            moveTop: () => {}
          }
        }
      }
    }, captureImage)

    await page.goto('/index.html')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => window.app.onPluginEnter({ code: 'screenshot' }))

    // 抓帧与窗口创建并行：覆盖层窗口不等抓帧结果就创建
    await expect.poll(() => page.evaluate(() => (window as any).__flowCalls)).toEqual([
      'createBrowserWindow',
      'desktopCaptureSources'
    ])

    const overlayUrl = await page.evaluate(() => (window as any).__overlayWindowUrl)
    expect(overlayUrl).toContain('overlay.html')
    expect(overlayUrl).toContain('mode=screen')
    const primeKey = decodeURIComponent(String(overlayUrl).match(/primeKey=([^&]+)/)?.[1] || '')
    expect(primeKey).toMatch(/^dagu-ocr-capture-/)

    // 抓帧在覆盖层加载期间完成，画面已写入预抓帧键
    await expect.poll(() => page.evaluate(
      (key) => localStorage.getItem(key),
      primeKey
    )).toContain('data:image/png')
  })

  test('子窗口创建失败时回退到同一窗口且操作可点击', async ({ page }) => {
    const captureImage = `data:image/png;base64,${TEST_IMAGE_1x1}`
    const createWindowKey = '__daguOcrCreateBrowserWindowCalls'
    const showMainWindowKey = '__daguOcrShowMainWindowCalls'

    await page.context().addInitScript(({ captureImage, showMainWindowKey, createWindowKey }) => {
      if (localStorage.getItem(showMainWindowKey) === null) localStorage.setItem(showMainWindowKey, '0')
      if (localStorage.getItem(createWindowKey) === null) localStorage.setItem(createWindowKey, '0')
      localStorage.setItem('dagu-ocr.preferences', JSON.stringify({
        ocrProviderId: 'ztools:mock-ocr',
        translationProviderId: 'ztools:mock-translation',
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        syncSecrets: false
      }))

      window.ztools = {
        providers: {
          getProviders: async (type) => [{ id: `mock-${type}`, label: `测试 ${type}` }],
          invokeProvider: async (type, input) => (
            type === 'ocr' ? 'Mock OCR Result' : `Mock Translation: ${input.text || ''}`
          )
        },
        copyText: () => true,
        hideMainWindow: () => {},
        showMainWindow: () => {
          const count = Number(localStorage.getItem(showMainWindowKey) || '0') + 1
          localStorage.setItem(showMainWindowKey, String(count))
        },
        screenCapture: (callback) => callback(captureImage),
        createBrowserWindow: () => {
          const count = Number(localStorage.getItem(createWindowKey) || '0') + 1
          localStorage.setItem(createWindowKey, String(count))
          throw new Error('不应创建截图编辑子窗口')
        }
      }
    }, { captureImage, showMainWindowKey, createWindowKey })

    await page.goto('/index.html')
    await page.waitForLoadState('networkidle')

    // 覆盖层窗口创建失败 → 回退系统截图 → 编辑窗口创建失败 → 同一窗口打开图片编辑模式
    await Promise.all([
      page.waitForURL(/overlay\.html.*mode=image/),
      page.evaluate(() => window.app.onPluginEnter({ code: 'screenshot' }))
    ])
    const editor = new CaptureOverlayPage(page)
    await editor.waitForReady()
    await expect(page.locator('#capture-ocr')).toBeVisible()
    expect(await page.evaluate(() => window.opener === null)).toBe(true)
    // 覆盖层窗口与编辑窗口各尝试创建一次，都被拒绝后回退到同窗口编辑
    expect(await page.evaluate((key) => localStorage.getItem(key), createWindowKey)).toBe('2')

    await Promise.all([
      page.waitForURL(/index\.html.*editorAction=ocr/),
      page.locator('#capture-ocr').click()
    ])
    await expect(page.locator('#resultText')).toHaveValue('Mock OCR Result')
    await page.locator('#confirmBtn').click()
    await expect(page.locator('#status')).toHaveText('已复制到剪贴板')

    expect(await page.evaluate((key) => localStorage.getItem(key), showMainWindowKey)).toBe('1')
  })
})
