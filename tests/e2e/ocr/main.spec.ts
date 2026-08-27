import { test, expect, Page } from '@playwright/test'
import { OcrPage } from '../../pages/OcrPage'
import { TEST_IMAGE_1x1 } from '../../fixtures/test-data'

async function installMockZTools(page: Page) {
  await page.addInitScript(() => {
    ;(window as any).__ztoolsExpendHeights = []
    localStorage.setItem('dagu-ocr.preferences', JSON.stringify({
      ocrProviderId: 'ztools:mock-ocr',
      translationProviderId: 'ztools:mock-translation',
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      syncSecrets: false
    }))
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
    localStorage.setItem('dagu-ocr.preferences', JSON.stringify({
      ocrProviderId: 'ztools:mock-ocr',
      translationProviderId: 'ztools:mock-translation',
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      syncSecrets: false
    }))
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
    await expect(ocrPage.configBtn).toHaveText('配置')
    await expect(ocrPage.historyToggle).toBeVisible()
    await expect(ocrPage.historyToggle.locator('..')).toHaveClass(/section-actions/)
    await expect(ocrPage.page.locator('.history-section')).toBeVisible()
    await expect(ocrPage.page.locator('.app-header')).toHaveCount(0)
    await expect(ocrPage.status).toHaveText('')
  })

  test('主界面的“配置”入口直接打开配置页', async () => {
    await ocrPage.openConfig()

    await expect(ocrPage.configPanel).toBeVisible()
    await expect(ocrPage.page.locator('#configTitle')).toHaveText('配置')
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
    await expect(ocrPage.previewFrame).toBeHidden()
    await expect(ocrPage.editBtn).toBeVisible()
    await expect(ocrPage.togglePreviewBtn).toHaveText('展开预览')

    const sourceBox = await page.locator('#sourceTextPane').boundingBox()
    const translationBox = await page.locator('#translateResultArea').boundingBox()
    const resultBox = await ocrPage.resultArea.boundingBox()
    const workspaceBox = await page.locator('.workspace-grid.has-translation').boundingBox()
    expect(sourceBox).not.toBeNull()
    expect(translationBox).not.toBeNull()
    expect(resultBox).not.toBeNull()
    expect(workspaceBox).not.toBeNull()
    expect(translationBox!.x).toBeGreaterThan(sourceBox!.x)
    expect(translationBox!.height).toBeGreaterThanOrEqual(340)
    expect(Math.abs(translationBox!.height - sourceBox!.height)).toBeLessThanOrEqual(2)
    expect(resultBox!.width / workspaceBox!.width).toBeGreaterThan(.9)

    await ocrPage.togglePreviewBtn.click()
    await expect(ocrPage.previewFrame).toBeVisible()
    await expect(ocrPage.togglePreviewBtn).toHaveText('收起预览')
  })

  test('OCR 结果支持重新 OCR，并清除旧翻译', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })
    await ocrPage.translateBtn.click()
    await expect(ocrPage.translateResult).toHaveValue('Mock Translation: Mock OCR Result')

    await expect(ocrPage.ocrAgainBtn).toBeVisible()
    await ocrPage.ocrAgainBtn.click()

    await expect(ocrPage.resultText).toHaveValue('Mock OCR Result')
    await expect(ocrPage.translateResult).toBeHidden()
  })

  test('翻译结果页编辑图片后仍可直接翻译', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })
    await ocrPage.translateBtn.click()
    await expect(ocrPage.translateResult).toHaveValue('Mock Translation: Mock OCR Result')

    await expect(ocrPage.editBtn).toBeVisible()
    await ocrPage.editImage()
    await expect(page.locator('#screenshot-actions')).toBeVisible()

    await page.locator('#btn-translate').click()
    await page.waitForURL(/index\.html.*editorAction=translate/)
    await expect(page.locator('#translateResult')).toHaveValue('Mock Translation: Mock OCR Result')
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

  test('OCR 结果页编辑器可再次执行 OCR', async ({ page }) => {
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

    await expect(page.locator('#screenshot-actions')).toBeVisible()
    await page.locator('#btn-ocr').click()
    await page.waitForURL(/index\.html.*editorAction=ocr/)
    await expect(page.locator('#resultText')).toHaveValue('Mock OCR Result')
  })

  test('截图完成后按原图尺寸创建适配的编辑窗口', async ({ page }) => {
    await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 2400
      canvas.height = 400
      const context = canvas.getContext('2d')
      context?.fillRect(0, 0, canvas.width, canvas.height)

      ;(window as any).__editorWindowOptions = null
      ;(window as any).ztools.screenCapture = (callback: (image: string) => void) => callback(canvas.toDataURL('image/png'))
      ;(window as any).ztools.createBrowserWindow = (_url: string, options: Record<string, unknown>) => {
        ;(window as any).__editorWindowOptions = options
        return { show: () => {}, focus: () => {}, on: () => {} }
      }
    })

    await page.evaluate(() => (window as any).app.onPluginEnter({ code: 'screenshot' }))
    await expect.poll(() => page.evaluate(() => (window as any).__editorWindowOptions)).toMatchObject({
      width: 1400,
      height: 640
    })
  })

  test('结果页编辑窗口关闭后恢复主窗口', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showMainWindowCalls = 0
      ;(window as any).__editorClosed = null
      ;(window as any).ztools.showMainWindow = () => {
        ;(window as any).__showMainWindowCalls += 1
      }
      ;(window as any).ztools.createBrowserWindow = () => ({
        show: () => {},
        focus: () => {},
        close: () => {},
        on: (_event: string, callback: () => void) => {
          ;(window as any).__editorClosed = callback
        }
      })
    })

    await page.evaluate(() => (window as any).app.openEditor(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      { returnInput: true }
    ))
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__editorClosed))).toBe(true)

    await page.evaluate(() => window.postMessage({
      type: 'daguOcrEditorMessage',
      payload: { event: 'closed', returnToInput: true }
    }, '*'))
    await expect.poll(() => page.evaluate(() => (window as any).__showMainWindowCalls)).toBe(1)
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
