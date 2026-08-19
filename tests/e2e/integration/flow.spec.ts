import { test, expect, Page } from '@playwright/test'
import { OcrPage } from '../../pages/OcrPage'
import { AnnotatePage } from '../../pages/AnnotatePage'
import { TEST_IMAGE_1x1, TEST_TEXT } from '../../fixtures/test-data'

async function installMockZTools(page: Page) {
  await page.addInitScript(() => {
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

  test('OCR识别 -> 编辑图片 -> 复制结果 完整流程', async ({ page }) => {
    const ocrPage = new OcrPage(page)
    await ocrPage.goto()
    await ocrPage.configureMockProviders()

    // 1. 上传图片
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: testImageBuffer
    })
    await expect(ocrPage.preview).toBeVisible()
    await ocrPage.closeConfig()

    // 2. 点击编辑按钮跳转到标注页面
    await Promise.all([
      page.waitForNavigation({ url: /annotate\.html/ }),
      ocrPage.editImage()
    ])

    // 3. 在标注页面进行编辑
    const annotatePage = new AnnotatePage(page)
    await annotatePage.waitForImageLoaded()

    // 添加一些标注
    await annotatePage.drawRect(10, 10, 50, 50)
    await annotatePage.addText(TEST_TEXT.SHORT)
    await annotatePage.drawArrow(10, 60, 90, 60)

    const objectCount = await annotatePage.getObjectCount()
    expect(objectCount).toBeGreaterThanOrEqual(3)

    // 4. 复制编辑后的图片
    await annotatePage.copy()
    await expect(annotatePage.status).toContainText('已复制到剪贴板')
  })

  test('直接访问标注页面，没有截图API时显示文件选择', async ({ page }) => {
    // Mock 没有截图API的环境
    await page.addInitScript(() => {
      delete window.ztools
      delete window.utools
      ;(window as Window & { __filePickerOpened?: boolean }).__filePickerOpened = false
      const inputClick = HTMLInputElement.prototype.click
      HTMLInputElement.prototype.click = function() {
        if (this.type === 'file') {
          ;(window as Window & { __filePickerOpened?: boolean }).__filePickerOpened = true
        }
        return inputClick.call(this)
      }
    })

    const annotatePage = new AnnotatePage(page)
    await page.goto('/annotate.html?code=screenshot-annotate')
    await page.waitForLoadState('networkidle')

    // 应该显示提示不支持截图功能，然后弹出文件选择框
    await expect(annotatePage.status).toContainText('当前环境不支持截图功能', { timeout: 5000 })

    expect(await page.locator('input[type="file"]').count()).toBe(1)
    expect(await page.evaluate(() => (window as Window & { __filePickerOpened?: boolean }).__filePickerOpened)).toBe(true)
  })

  test('截图编辑器可以把当前图片交给 OCR 或翻译节点', async ({ page }) => {
    const ocrPage = new OcrPage(page)
    await ocrPage.goto()
    await ocrPage.configureMockProviders()

    const annotatePage = new AnnotatePage(page)
    await annotatePage.gotoStandaloneWithImage(TEST_IMAGE_1x1, true)

    await expect(annotatePage.btnOcr).toBeVisible()
    await expect(annotatePage.btnTranslate).toBeVisible()

    await annotatePage.btnTranslate.click()
    await page.waitForURL(/index\.html.*editorAction=translate/)
    await expect(page.locator('#resultText')).toHaveValue('Mock OCR Result')
    await expect(page.locator('#translateResult')).toHaveValue('Mock Translation: Mock OCR Result')
  })

  test('配置保存后跳转编辑页面，配置不丢失', async ({ page }) => {
    const ocrPage = new OcrPage(page)
    await ocrPage.goto()

    // 保存配置
    await ocrPage.openConfig()
    await ocrPage.ocrProviderSelect.selectOption('ztools:mock-ocr')
    await ocrPage.translationProviderSelect.selectOption('ztools:mock-translation')
    const testAk = 'test-integration-ak-123'
    const testSk = 'test-integration-sk-456'
    await ocrPage.saveConfig(testAk, testSk)

    // 上传图片并跳转到编辑页面
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: testImageBuffer
    })

    await Promise.all([
      page.waitForNavigation({ url: /annotate\.html/ }),
      ocrPage.editImage()
    ])

    // 返回OCR页面，验证配置仍然存在
    await page.goBack()
    await ocrPage.openConfig()
    expect(await ocrPage.baiduAkInput.inputValue()).toBe(testAk)
    expect(await ocrPage.baiduSkInput.inputValue()).toBe(testSk)
  })
})

test.describe('截图子窗口回传流程', () => {
  test('点击 OCR 后不重新显示已隐藏的原主窗口', async ({ page }) => {
    const captureImage = `data:image/png;base64,${TEST_IMAGE_1x1}`
    const showMainWindowKey = '__daguOcrShowMainWindowCalls'
    const createWindowKey = '__daguOcrCreateBrowserWindowCalls'

    await page.context().addInitScript(({ captureImage, showMainWindowKey, createWindowKey }) => {
      if (localStorage.getItem(showMainWindowKey) === null) localStorage.setItem(showMainWindowKey, '0')
      if (localStorage.getItem(createWindowKey) === null) localStorage.setItem(createWindowKey, '0')
      localStorage.setItem('dagu-ocr.preferences', JSON.stringify({
        ocrProviderId: 'ztools:mock-ocr',
        translationProviderId: 'ztools:mock-translation',
        sourceLang: 'auto',
        targetLang: 'zh',
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
        createBrowserWindow: (url) => {
          const count = Number(localStorage.getItem(createWindowKey) || '0') + 1
          localStorage.setItem(createWindowKey, String(count))
          const child = window.open(url, '_blank', 'noopener,width=800,height=600')
          if (!child) throw new Error('截图编辑子窗口未创建')
          return { show: () => {} }
        }
      }
    }, { captureImage, showMainWindowKey, createWindowKey })

    await page.goto('/index.html')
    await page.waitForLoadState('networkidle')

    const childPromise = page.waitForEvent('popup')
    await page.evaluate(() => window.app.onPluginEnter({ code: 'screenshot' }))
    const child = await childPromise
    await child.waitForLoadState('networkidle')
    await expect(child.locator('#btn-ocr')).toBeVisible()
    expect(await child.evaluate(() => window.opener === null)).toBe(true)
    expect(await page.evaluate((key) => localStorage.getItem(key), createWindowKey)).toBe('1')

    await child.locator('#btn-ocr').click()
    await child.waitForURL(/index\.html.*editorAction=ocr/)
    await expect(child.locator('#resultText')).toHaveValue('Mock OCR Result')

    expect(await page.evaluate((key) => localStorage.getItem(key), showMainWindowKey)).toBe('0')
  })
})
