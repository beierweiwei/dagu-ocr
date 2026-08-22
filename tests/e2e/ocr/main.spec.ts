import { test, expect, Page } from '@playwright/test'
import { OcrPage } from '../../pages/OcrPage'
import { TEST_IMAGE_1x1 } from '../../fixtures/test-data'

async function installMockZTools(page: Page) {
  await page.addInitScript(() => {
    ;(window as any).__ztoolsExpendHeights = []
    ;(window as any).ztools = {
      setExpendHeight: (height: number) => {
        ;(window as any).__ztoolsExpendHeights.push(height)
      },
      providers: {
        getProviders: async (type: string) => [{
          id: `mock-${type}`,
          label: type === 'ocr' ? '测试 OCR 节点' : '测试翻译节点'
        }],
        invokeProvider: async (type: string, input: { text?: string }) => (
          type === 'ocr' ? 'Mock OCR Result' : `Mock Translation: ${input.text || ''}`
        )
      },
      copyText: (value: string) => {
        ;(window as any).__copiedText = value
        return true
      }
    }
  })
}

async function installMicrosoftMockZTools(page: Page) {
  await page.addInitScript(() => {
    ;(window as any).ztools = {
      providers: {
        getProviders: async (type: string) => [{
          id: type === 'translation' ? 'plugin:f-provider:microsoft' : 'plugin:f-provider:ocr',
          type,
          key: type === 'translation' ? 'microsoft' : 'ocr',
          label: type === 'ocr' ? '测试 OCR 节点' : '微软翻译'
        }],
        invokeProvider: async (type: string, input: { text?: string, to?: string }) => {
          if (type === 'ocr') return 'Mock OCR Result'
          if (input.to !== 'zh-CN') {
            throw new Error(`微软翻译不支持目标语言: ${input.to}`)
          }
          return `Microsoft Translation: ${input.text || ''}`
        }
      },
      copyText: (value: string) => {
        ;(window as any).__copiedText = value
        return true
      }
    }
  })
}

test.describe('OCR 主页面功能测试', () => {
  let ocrPage: OcrPage

  test.beforeEach(async ({ page }) => {
    await installMockZTools(page)
    ocrPage = new OcrPage(page)
    await ocrPage.goto()
  })

  test('页面加载成功，显示所有核心元素', async () => {
    await expect(ocrPage.dropArea).toBeVisible()
    await expect(ocrPage.configBtn).toBeVisible()
    await expect(ocrPage.historyToggle).toBeVisible()
    await expect(ocrPage.historyToggle.locator('..')).toHaveClass(/section-heading/)
    await expect(ocrPage.historyToggle.locator('xpath=../..')).toHaveClass(/history-section/)
    await expect(ocrPage.status).toHaveText('')
  })

  test('图片 OCR 会从上传开始，显示预览和可编辑结果', async () => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })

    await expect(ocrPage.preview).toBeVisible()
    await expect(ocrPage.previewImg).toBeVisible()
    await expect(ocrPage.resultArea).toBeVisible()
    await expect(ocrPage.resultText).toHaveValue('Mock OCR Result')
    await expect(ocrPage.editBtn).toBeVisible()
  })

  test('OCR 结果渲染后会同步 ZTools 插件窗口高度并保持操作可点击', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })

    await expect.poll(() => page.evaluate(() => (
      (window as any).__ztoolsExpendHeights?.length || 0
    ))).toBeGreaterThan(0)

    const layout = await page.evaluate(() => ({
      requestedHeight: (window as any).__ztoolsExpendHeights.at(-1),
      contentHeight: document.querySelector('.app-shell')?.scrollHeight || 0,
      actionsBottom: document.querySelector('.actions-row')?.getBoundingClientRect().bottom || 0
    }))
    expect(layout.requestedHeight).toBeGreaterThanOrEqual(layout.contentHeight)
    expect(layout.requestedHeight).toBeGreaterThanOrEqual(layout.actionsBottom)

    await ocrPage.confirmBtn.click()
    await expect(ocrPage.status).toHaveText('已复制到剪贴板')
  })

  test('图片 OCR 没有剪贴板图片时显示上传面板', async ({ page }) => {
    await page.evaluate(async () => {
      ;(window as any).app.readClipboardImage = async () => null
      await (window as any).app.onPluginEnter({ code: 'ocr' })
    })

    await expect(ocrPage.dropArea).toBeVisible()
    await expect(ocrPage.preview).toBeHidden()
  })

  test('剪贴板图片会直接进入 OCR', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await page.evaluate(async () => {
      const blob = new Blob(['clipboard-image'], { type: 'image/png' })
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          read: async () => [{
            types: ['image/png'],
            getType: async () => blob
          }]
        }
      })
      await (window as any).app.onPluginEnter({ code: 'ocr' })
    })

    await expect(ocrPage.resultText).toHaveValue('Mock OCR Result')
  })

  test('OCR 结果可以调用已选择的翻译节点', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })
    await ocrPage.translateBtn.click()

    await expect(ocrPage.translateResult).toHaveValue('Mock Translation: Mock OCR Result')
    await expect(page.locator('.text-comparison.with-translation')).toBeVisible()

    const sourceBox = await page.locator('#sourceTextPane').boundingBox()
    const translationBox = await page.locator('#translateResultArea').boundingBox()
    expect(sourceBox).not.toBeNull()
    expect(translationBox).not.toBeNull()
    expect(translationBox!.x).toBeGreaterThan(sourceBox!.x)
    expect(translationBox!.height).toBeGreaterThanOrEqual(240)
    expect(Math.abs(translationBox!.height - sourceBox!.height)).toBeLessThanOrEqual(2)
  })

  test('翻译指令无图片时显示文字输入面板并展示结果', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await page.evaluate(async () => {
      await (window as any).app.onPluginEnter({ code: 'translate' })
    })

    await expect(ocrPage.textInputPanel).toBeVisible()
    await expect(ocrPage.dropArea).toBeHidden()
    await ocrPage.textInput.fill('hello')
    await ocrPage.translateInputBtn.click()

    await expect(ocrPage.translateResult).toHaveValue('Mock Translation: hello')
  })

  test('翻译语言列表包含常用语种和中性中文码', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await page.evaluate(async () => {
      await (window as any).app.onPluginEnter({ code: 'translate' })
    })

    await expect(page.locator('#sourceLangText option[value="ko"]')).toHaveCount(1)
    await expect(page.locator('#targetLangText option[value="zh-CN"]')).toHaveCount(1)
    await expect(page.locator('#targetLangText option[value="de"]')).toHaveCount(1)
    await expect(page.locator('#targetLangText option[value="ru"]')).toHaveCount(1)
  })

  test('配置可以保存 Provider、密钥和语言偏好', async () => {
    await ocrPage.openConfig()
    await ocrPage.ocrProviderSelect.selectOption('ztools:mock-ocr')
    await ocrPage.translationProviderSelect.selectOption('ztools:mock-translation')
    await ocrPage.baiduAkInput.fill('test-ak')
    await ocrPage.baiduSkInput.fill('test-sk')
    await ocrPage.saveConfigBtn.click()
    await expect(ocrPage.status).toContainText('配置保存成功')

    await ocrPage.openConfig()
    await expect(ocrPage.ocrProviderSelect).toHaveValue('ztools:mock-ocr')
    await expect(ocrPage.translationProviderSelect).toHaveValue('ztools:mock-translation')
    await expect(ocrPage.baiduAkInput).toHaveValue('test-ak')
    await expect(ocrPage.baiduSkInput).toHaveValue('test-sk')
  })

  test('编辑按钮进入普通图片编辑器，截图动作按钮不显示', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })

    await Promise.all([
      page.waitForNavigation({ url: /annotate\.html/ }),
      ocrPage.editImage()
    ])

    await expect(page.locator('#screenshot-actions')).toBeHidden()
  })

  test('非图片文件上传显示状态错误', async () => {
    await ocrPage.fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image')
    })

    await expect(ocrPage.status).toContainText('请选择图片文件')
  })

  test('清空按钮可以清除当前图片和结果', async () => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })
    await ocrPage.clearBtn.click()

    await expect(ocrPage.preview).toBeHidden()
    await expect(ocrPage.resultArea).toBeHidden()
    await expect(ocrPage.dropArea).toBeVisible()
  })

  test('较矮的宿主窗口仍能看到结果操作，历史从底部入口弹出', async ({ page }) => {
    await page.setViewportSize({ width: 780, height: 520 })
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })

    const layout = await page.evaluate(() => {
      const actions = document.querySelector('.actions-row')?.getBoundingClientRect()
      const history = document.querySelector('#historyToggle')?.getBoundingClientRect()
      return {
        viewportHeight: window.innerHeight,
        actionsBottom: actions?.bottom || 0,
        historyTop: history?.top || 0,
        historySectionTop: document.querySelector('.history-section')?.getBoundingClientRect().top || 0
      }
    })

    expect(layout.actionsBottom).toBeLessThanOrEqual(layout.viewportHeight)
    expect(layout.historyTop).toBeGreaterThan(layout.actionsBottom)
    expect(layout.historyTop).toBeGreaterThan(layout.historySectionTop)

    await ocrPage.confirmBtn.click()
    await ocrPage.historyToggle.click()
    await expect(page.locator('#historyPanel')).toBeVisible()
    await expect(page.locator('#historyPanel')).toHaveAttribute('role', 'dialog')
    expect(await page.locator('#historyPanel').evaluate((element) => getComputedStyle(element).position)).toBe('fixed')
  })
})

test.describe('微软翻译语言兼容', () => {
  let ocrPage: OcrPage

  test.beforeEach(async ({ page }) => {
    await installMicrosoftMockZTools(page)
    ocrPage = new OcrPage(page)
    await ocrPage.goto()
  })

  test('中文目标语言使用 Provider 中性语言码', async ({ page }) => {
    await ocrPage.openConfig()
    await ocrPage.translationProviderSelect.selectOption('ztools:plugin:f-provider:microsoft')
    await ocrPage.saveConfigBtn.click()
    await expect(ocrPage.status).toContainText('配置保存成功')

    await page.evaluate(async () => {
      await (window as any).app.onPluginEnter({ code: 'translate' })
    })
    await ocrPage.textInput.fill('hello')
    await ocrPage.translateInputBtn.click()

    await expect(ocrPage.translateResult).toHaveValue('Microsoft Translation: hello')
    await expect(ocrPage.status).toHaveText('翻译完成')
  })
})
