import { test, expect, Page } from '@playwright/test'
import { OcrPage } from '../../pages/OcrPage'
import { CaptureOverlayPage } from '../../pages/CaptureOverlayPage'
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
      getThemeInfo: () => ({ isDark: true }),
      onThemeChange: () => {},
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

  test('ZTools 深色主题下主页面仍保持 Web 浅色配色', async ({ page }) => {
    const palette = await page.evaluate(() => ({
      dark: document.documentElement.classList.contains('dark'),
      bodyBackground: getComputedStyle(document.body).backgroundColor
    }))

    expect(palette.dark).toBe(false)
    expect(palette.bodyBackground).toBe('rgb(244, 244, 244)')
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

  test('所有页面请求统一高度（4:3）并保持操作可点击', async ({ page }) => {
    const requestedHeight = () => page.evaluate(() => (window as any).__ztoolsExpendHeights?.at(-1))

    await expect.poll(requestedHeight).toBe(600)

    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })

    await expect.poll(requestedHeight).toBe(600)

    const layout = await page.evaluate(() => ({
      actionsBottom: document.querySelector('.actions-row')?.getBoundingClientRect().bottom || 0,
      viewportHeight: window.innerHeight,
      utilityCount: document.querySelectorAll('.utility-bar').length
    }))
    expect(layout.actionsBottom).toBeLessThanOrEqual(layout.viewportHeight)
    expect(layout.utilityCount).toBe(0)

    // 翻译输入面板与配置弹窗同样保持统一高度
    await page.evaluate(async () => { await (window as any).app.onPluginEnter({ code: 'translate' }) })
    await expect.poll(requestedHeight).toBe(600)
    await expect(ocrPage.textInputPanel).toBeVisible()

    await ocrPage.confirmBtn.click().catch(() => {})
  })

  test('结果页复制结果后仍停留在页面继续操作', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })

    await ocrPage.confirmBtn.click()
    await expect(ocrPage.status).toHaveText('已复制到剪贴板')

    // 复制结果后结果与图片仍在，可继续翻译或重新识别
    await expect(ocrPage.resultText).toHaveValue('Mock OCR Result')
    await expect(ocrPage.editBtn).toBeVisible()
    await ocrPage.translateBtn.click()
    await expect(ocrPage.translateResult).toHaveValue('Mock Translation: Mock OCR Result')
  })

  test('主页面按钮与截图工具条使用同一套图标', async ({ page }) => {
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })

    for (const selector of ['#edit-image-btn', '#copy-image-btn', '#confirmBtn', '#copySourceBtn', '#ocrAgainBtn', '#translateBtn', '#clearBtn', '#historyToggle', '#configBtn']) {
      await expect(page.locator(`${selector} [data-icon] svg`)).toHaveCount(1)
    }

    await ocrPage.translateBtn.click()
    await expect(page.locator('#copyTranslateBtn [data-icon] svg')).toHaveCount(1)

    await ocrPage.openConfig()
    await expect(page.locator('#closeConfigBtn [data-icon] svg')).toHaveCount(1)
    await expect(page.locator('#saveConfigBtn [data-icon] svg')).toHaveCount(1)
    await ocrPage.closeConfig()
  })

  test('图片复制按钮把当前图片写入剪贴板', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__copiedImage = null
      ;(window as any).ztools.copyImage = (dataUrl: string) => {
        ;(window as any).__copiedImage = dataUrl
        return true
      }
    })
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })

    await expect(ocrPage.copyImageBtn).toHaveText('复制')
    await expect(ocrPage.copyImageBtn).toHaveAttribute('title', '复制图片')
    await ocrPage.copyImageBtn.click()

    await expect(ocrPage.status).toContainText('图片已复制到剪贴板')
    expect(await page.evaluate(() => (window as any).__copiedImage)).toMatch(/^data:image\/png;base64,/)
  })

  test('图片框与文字框等宽（1:1）', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })

    const layout = await page.evaluate(() => {
      const preview = document.querySelector('#preview')?.getBoundingClientRect()
      const frame = document.querySelector('.preview-frame')?.getBoundingClientRect()
      const result = document.querySelector('#resultArea')?.getBoundingClientRect()
      const image = document.querySelector('#previewImg')
      return {
        previewWidth: preview?.width || 0,
        frameWidth: frame?.width || 0,
        resultWidth: result?.width || 0,
        resultHeight: result?.height || 0,
        gap: Math.abs((preview?.right || 0) - (result?.left || 0)),
        topDelta: Math.abs((preview?.top || 0) - (result?.top || 0)),
        objectFit: image ? getComputedStyle(image).objectFit : ''
      }
    })

    expect(layout.frameWidth).toBeGreaterThan(0)
    expect(Math.abs(layout.frameWidth - layout.resultWidth)).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.previewWidth - layout.resultWidth)).toBeLessThanOrEqual(1)
    expect(layout.topDelta).toBeLessThanOrEqual(1)
    expect(layout.gap).toBeGreaterThan(0)
    expect(layout.resultHeight).toBeGreaterThan(180)
    expect(layout.objectFit).toBe('contain')
  })

  test('操作栏横跨两列贴在容器底部，图片容器与 OCR 输入框高度对齐', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })

    const layout = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect()
      const frame = box('.preview-frame')
      const source = box('#sourceTextPane')
      const preview = box('#preview')
      const result = box('#resultArea')
      const actions = box('.actions-row')
      return {
        frameTop: frame?.top || 0,
        frameHeight: frame?.height || 0,
        sourceTop: source?.top || 0,
        sourceHeight: source?.height || 0,
        previewLeft: preview?.left || 0,
        previewBottom: preview?.bottom || 0,
        resultRight: result?.right || 0,
        resultBottom: result?.bottom || 0,
        actionsLeft: actions?.left || 0,
        actionsRight: actions?.right || 0,
        actionsTop: actions?.top || 0,
        actionsBottom: actions?.bottom || 0,
        viewportHeight: window.innerHeight
      }
    })

    // 图片容器与 OCR 输入框容器顶部对齐、高度一致
    expect(Math.abs(layout.frameTop - layout.sourceTop)).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.frameHeight - layout.sourceHeight)).toBeLessThanOrEqual(1)
    // 操作栏横跨图片容器与结果容器整行，贴在两个容器下方，且不会溢出窗口
    expect(Math.abs(layout.actionsLeft - layout.previewLeft)).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.actionsRight - layout.resultRight)).toBeLessThanOrEqual(1)
    expect(layout.actionsTop).toBeGreaterThanOrEqual(Math.max(layout.previewBottom, layout.resultBottom) - 1)
    expect(layout.actionsBottom).toBeLessThanOrEqual(layout.viewportHeight)
  })

  test('次级入口与提示语使用次级字体色，主题色只留给主操作', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })
    await expect(ocrPage.resultArea).toBeVisible()

    const palette = await page.evaluate(() => {
      const resolveColor = (value: string) => {
        const probe = document.createElement('span')
        probe.style.color = value
        document.body.appendChild(probe)
        const resolved = getComputedStyle(probe).color
        probe.remove()
        return resolved
      }
      const colorOf = (selector: string) => {
        const element = document.querySelector(selector)
        return element ? getComputedStyle(element).color : ''
      }
      const root = getComputedStyle(document.documentElement)
      const confirm = document.querySelector('#confirmBtn')
      return {
        secondary: resolveColor(root.getPropertyValue('--text-secondary')),
        primary: resolveColor(root.getPropertyValue('--primary-color')),
        status: colorOf('#status'),
        history: colorOf('#historyToggle'),
        copyImage: colorOf('#copy-image-btn'),
        editImage: colorOf('#edit-image-btn'),
        copySource: colorOf('#copySourceBtn'),
        confirmBackground: confirm ? getComputedStyle(confirm).backgroundColor : ''
      }
    })

    // 提示语与历史、复制、编辑等次级入口统一用次级字体色，不再占用主题色
    for (const color of [palette.status, palette.history, palette.copyImage, palette.editImage, palette.copySource]) {
      expect(color).toBe(palette.secondary)
    }
    expect(palette.secondary).not.toBe(palette.primary)
    // 主题色只收敛在主操作「复制」按钮上
    expect(palette.confirmBackground).toBe(palette.primary)
  })

  test('翻译进行中状态栏不再显示“正在翻译”', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })
    await expect(ocrPage.status).toHaveText('识别完成，请编辑确认')

    // 挂起翻译节点，让翻译进行中的界面状态可被断言
    await page.evaluate(() => {
      const invokeProvider = (window as any).ztools.providers.invokeProvider
      ;(window as any).ztools.providers.invokeProvider = async (type: string, ...rest: unknown[]) => {
        if (type === 'translation') {
          await new Promise((resolve) => {
            ;(window as any).releaseTranslation = resolve
          })
        }
        return invokeProvider(type, ...rest)
      }
    })

    await ocrPage.translateBtn.click()
    // 进度只出现在底部浮动提示与原文框标记，状态栏保留上一步结果
    await expect(ocrPage.loading).toBeVisible()
    await expect(ocrPage.loading).toContainText('正在翻译')
    await expect(ocrPage.status).toHaveText('识别完成，请编辑确认')
    await expect(ocrPage.previewFrame).toBeHidden()
    await expect(page.locator('#sourceTextPane .busy-dot')).toHaveText('处理中')

    await page.evaluate(() => (window as any).releaseTranslation())
    await expect(ocrPage.status).toHaveText('翻译完成')
    await expect(ocrPage.translateResult).toHaveValue('Mock Translation: Mock OCR Result')
  })

  test('预览框内可滚轮放大、拖动平移，缩小后复位', async ({ page }) => {
    await ocrPage.configureMockProviders()
    await ocrPage.uploadCanvasImage(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const context = canvas.getContext('2d') as CanvasRenderingContext2D
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#d32f2f'
      context.fillRect(0, 0, 400, 300)
      return canvas.toDataURL('image/png')
    })

    const frame = await ocrPage.previewFrame.boundingBox()
    expect(frame).not.toBeNull()
    const centerX = frame!.x + frame!.width / 2
    const centerY = frame!.y + frame!.height / 2

    await page.mouse.move(centerX, centerY)
    await page.mouse.wheel(0, -500)
    await expect(ocrPage.previewImg).not.toHaveAttribute('style', /transform: none/)
    const zoomed = await ocrPage.previewImg.evaluate((element) => element.style.transform)
    expect(zoomed).toMatch(/translate\(-?\d+(\.\d+)?px, -?\d+(\.\d+)?px\) scale\([1-8](\.\d+)?\)/)
    expect(await ocrPage.previewFrame.evaluate((element) => getComputedStyle(element).cursor)).toBe('grab')

    await page.mouse.move(centerX, centerY)
    await page.mouse.down()
    await page.mouse.move(centerX + 60, centerY + 40, { steps: 5 })
    const dragged = await ocrPage.previewImg.evaluate((element) => element.style.transform)
    await page.mouse.up()

    expect(dragged).not.toBe(zoomed)
    expect(await ocrPage.previewFrame.evaluate((element) => element.classList.contains('is-dragging'))).toBe(false)

    await page.mouse.wheel(0, 4000)
    await expect.poll(() => ocrPage.previewImg.evaluate((element) => element.style.transform)).toBe('')
    expect(await ocrPage.previewFrame.evaluate((element) => element.classList.contains('is-zoomed'))).toBe(false)
  })

  test('结果页复制按钮分别复制原文与译文', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__copiedTextList = []
      ;(window as any).ztools.copyText = (value: string) => {
        ;(window as any).__copiedTextList.push(value)
        return true
      }
    })
    await ocrPage.configureMockProviders()
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })
    await ocrPage.translateBtn.click()
    await expect(ocrPage.translateResult).toHaveValue('Mock Translation: Mock OCR Result')

    await expect(ocrPage.copySourceBtn).toHaveText('复制')
    await expect(ocrPage.copySourceBtn).toHaveAttribute('title', '复制原文')
    await ocrPage.copySourceBtn.click()
    await expect(ocrPage.status).toContainText('已复制到剪贴板')

    await ocrPage.copyTranslateBtn.click()
    await expect(ocrPage.status).toContainText('翻译内容已复制到剪贴板')

    expect(await page.evaluate(() => (window as any).__copiedTextList)).toEqual([
      'Mock OCR Result',
      'Mock Translation: Mock OCR Result'
    ])
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
    await expect(ocrPage.editBtn).toHaveText('编辑')
    await expect(ocrPage.togglePreviewBtn).toHaveText('预览')
    await expect(ocrPage.togglePreviewBtn).toHaveAttribute('title', '展开图片预览')

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

    // 操作栏与 OCR 态一致：横跨整行并贴在结果容器下方
    const actionsBox = await page.locator('.actions-row').boundingBox()
    expect(actionsBox).not.toBeNull()
    expect(actionsBox!.y).toBeGreaterThanOrEqual(resultBox!.y + resultBox!.height)
    expect(actionsBox!.width).toBeGreaterThanOrEqual(resultBox!.width)

    await ocrPage.togglePreviewBtn.click()
    await expect(ocrPage.previewFrame).toBeVisible()
    await expect(ocrPage.togglePreviewBtn).toHaveText('预览')
    await expect(ocrPage.togglePreviewBtn).toHaveAttribute('title', '收起图片预览')
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
    await page.waitForURL(/overlay\.html.*mode=image/)
    const editor = new CaptureOverlayPage(page)
    await editor.waitForReady()
    await expect(page.locator('#capture-translate')).toBeVisible()

    await page.locator('#capture-translate').click()
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

    await ocrPage.editImage()
    await page.waitForURL(/overlay\.html.*mode=image/)
    const editor = new CaptureOverlayPage(page)
    await editor.waitForReady()
    await expect(page.locator('#capture-ocr')).toBeVisible()
    await page.locator('#capture-ocr').click()
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
      ;(window as any).__editorWindowBounds = []
      ;(window as any).ztools.screenCapture = (callback: (image: string) => void) => callback(canvas.toDataURL('image/png'))
      ;(window as any).ztools.createBrowserWindow = (_url: string, options: Record<string, unknown>) => {
        ;(window as any).__editorWindowOptions = options
        return {
          setBounds: (bounds: Record<string, unknown>) => {
            ;(window as any).__editorWindowBounds.push(bounds)
          },
          show: () => {},
          focus: () => {},
          on: () => {}
        }
      }
    })

    await page.evaluate(() => (window as any).app.onPluginEnter({ code: 'screenshot' }))
    await expect.poll(() => page.evaluate(() => (window as any).__editorWindowOptions)).toMatchObject({
      show: false,
      width: 960,
      height: 640
    })
    await expect.poll(() => page.evaluate(() => (window as any).__editorWindowBounds)).toMatchObject([
      { width: 1400, height: 640 }
    ])
  })

  test('截图入口隐藏主窗口后快速调用截图 API', async ({ page }) => {
    await page.evaluate(() => {
      const win = window as any
      win.__captureStartedAt = performance.now()
      win.__captureDelay = null
      win.ztools.hideMainWindow = () => {}
      win.ztools.screenCapture = (callback: (image: string) => void) => {
        win.__captureDelay = performance.now() - win.__captureStartedAt
        callback('')
      }
      win.app.onPluginEnter({ code: 'screenshot' })
    })

    await expect.poll(() => page.evaluate(() => (window as any).__captureDelay)).not.toBeNull()
    await expect(ocrPage.status).toContainText('已取消截图')
    await expect.poll(() => page.evaluate(() => (window as any).__captureDelay)).toBeLessThan(200)
  })

  test('结果页编辑窗口关闭后恢复主窗口', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showMainWindowCalls = 0
      ;(window as any).__editorWindowUrl = null
      ;(window as any).ztools.showMainWindow = () => {
        ;(window as any).__showMainWindowCalls += 1
      }
      ;(window as any).ztools.createBrowserWindow = (url: string) => {
        ;(window as any).__editorWindowUrl = url
        return {
          show: () => {},
          focus: () => {},
          close: () => {},
          setBounds: () => {},
          isVisible: () => true,
          moveTop: () => {}
        }
      }
    })

    await page.evaluate(() => (window as any).app.openEditor(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      { returnInput: true }
    ))
    await expect.poll(() => page.evaluate(() => (window as any).__editorWindowUrl)).toContain('overlay.html')
    expect(await page.evaluate(() => (window as any).__editorWindowUrl)).toContain('mode=image')
    expect(await page.evaluate(() => (window as any).__editorWindowUrl)).toContain('returnInput=1')

    await page.evaluate(() => window.postMessage({
      type: 'daguOcrEditorMessage',
      payload: { event: 'closed', returnInput: true }
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

    // 清空后再次上传，预览图仍然正常显示
    await ocrPage.uploadImage({
      name: 'again.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_1x1, 'base64')
    })
    await expect(ocrPage.previewImg).toHaveAttribute('src', /^data:image\/png;base64,/)
  })

  test('较矮的宿主窗口仍能看到结果操作，历史与配置并入操作行', async ({ page }) => {
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
        actionsTop: actions?.top || 0,
        actionsBottom: actions?.bottom || 0,
        historyTop: history?.top || 0,
        historyBottom: history?.bottom || 0,
        utilityCount: document.querySelectorAll('.utility-bar').length
      }
    })

    expect(layout.utilityCount).toBe(0)
    expect(layout.actionsTop).toBeGreaterThan(0)
    expect(layout.actionsBottom).toBeLessThanOrEqual(layout.viewportHeight)
    expect(layout.historyTop).toBeGreaterThanOrEqual(layout.actionsTop)
    expect(layout.historyBottom).toBeLessThanOrEqual(layout.actionsBottom)

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
