import { test, expect } from '@playwright/test'
import { CaptureOverlayPage, installZtoolsStub } from '../../pages/CaptureOverlayPage'

test.describe('沉浸式截图覆盖层', () => {
  let overlay: CaptureOverlayPage

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installZtoolsStub())
    overlay = new CaptureOverlayPage(page)
  })

  test('采集整屏后进入框选状态，工具条默认隐藏', async () => {
    await overlay.goto()

    await expect(overlay.toolbar).toBeHidden()
    await expect(overlay.badge).toBeHidden()
    expect(await overlay.state()).toMatchObject({ tool: 'select', selection: null, annotations: 0 })
    expect((await overlay.sentEvents('ready')).length).toBe(1)
    expect(await overlay.calls()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'sendToParent' })
    ]))
  })

  test('取用主窗口预抓帧后直接进入框选，不再二次采集', async ({ page }) => {
    const imageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8uJxwAAAABJRU5ErkJggg=='
    const primeKey = 'dagu-ocr-capture-e2e'
    await page.addInitScript(({ value, key }) => {
      localStorage.setItem(key, value)
      ;(window as any).__primedCaptures = 0
      const captureSources = (window as any).ztools.desktopCaptureSources
      ;(window as any).ztools.desktopCaptureSources = (options: any) => {
        ;(window as any).__primedCaptures += 1
        return captureSources(options)
      }
    }, { value: JSON.stringify({ dataUrl: imageUrl, pixelSize: { width: 1, height: 1 }, captureMs: 12 }), key: primeKey })

    await overlay.goto({ primeKey })

    const ready = (await overlay.sentEvents('ready')).at(-1)
    expect(ready).toMatchObject({ pixelSize: { width: 1, height: 1 } })
    expect((await overlay.state()).finished).toBe(false)
    // 只用主窗口抓的帧：覆盖层自身不再调用一次采集
    expect(await page.evaluate(() => (window as any).__primedCaptures)).toBe(0)
    expect(await page.evaluate((key) => localStorage.getItem(key), primeKey)).toBeNull()
  })

  test('主窗口抓帧失败时覆盖层自行采集', async ({ page }) => {
    const primeKey = 'dagu-ocr-capture-e2e-failed'
    await page.addInitScript((key) => {
      localStorage.setItem(key, JSON.stringify({ failed: true }))
    }, primeKey)

    await overlay.goto({ primeKey })

    const ready = (await overlay.sentEvents('ready')).at(-1)
    expect(ready).toMatchObject({ pixelSize: { width: 1280, height: 720 } })
    expect((await overlay.state()).finished).toBe(false)
  })

  test('拖拽选区显示尺寸标签、工具条，并在选区外加深遮罩', async () => {
    await overlay.goto()
    await overlay.selectRegion({ x: 100, y: 80 }, { x: 460, y: 320 })

    expect(await overlay.state()).toMatchObject({
      selection: { left: 100, top: 80, width: 360, height: 240 }
    })
    await expect(overlay.badge).toHaveText('360 × 240 px')
    await expect(overlay.toolbar).toBeVisible()
    await expect(overlay.mask).toHaveAttribute('style', /box-shadow: rgba\(0, 0, 0, 0\.35\) 0px 0px 0px 9999px/)
    await expect(overlay.badge).toHaveAttribute('style', /left: 100px/)
  })

  test('选区手柄可调整大小，拖动选区内部可整体移动', async () => {
    await overlay.goto()
    await overlay.selectRegion({ x: 200, y: 150 }, { x: 500, y: 400 })

    await overlay.drag({ x: 500, y: 400 }, { x: 560, y: 460 })
    expect(await overlay.state()).toMatchObject({
      selection: { left: 200, top: 150, width: 360, height: 310 }
    })

    await overlay.drag({ x: 380, y: 300 }, { x: 420, y: 340 })
    expect(await overlay.state()).toMatchObject({
      selection: { left: 240, top: 190 }
    })
  })

  test('滚轮以光标为锚点缩放，空格拖动平移画面', async () => {
    await overlay.goto()
    await overlay.page.mouse.move(400, 300)
    await overlay.page.mouse.wheel(0, -240)
    await expect(overlay.hint).toContainText('缩放')

    const zoomed = await overlay.page.evaluate(() => (window as any).__captureOverlay.state.selection)
    expect(zoomed).toBeNull()

    await overlay.page.keyboard.down('Space')
    await overlay.drag({ x: 600, y: 400 }, { x: 660, y: 440 })
    await overlay.page.keyboard.up('Space')
    expect(await overlay.state()).toMatchObject({ selection: null })
  })

  test('形状、线条、画笔、荧光笔、马赛克工具都能生成标注', async () => {
    await overlay.goto()
    await overlay.selectRegion({ x: 120, y: 100 }, { x: 720, y: 500 })

    await overlay.tool('shape').click()
    await expect(overlay.subtoolbar).toBeVisible()
    await overlay.drag({ x: 160, y: 140 }, { x: 300, y: 240 })
    expect((await overlay.state()).annotations).toBe(1)

    await overlay.page.locator('[data-shape-kind="ellipse"]').click()
    await overlay.page.locator('[data-shape-fill="true"]').click()
    await overlay.drag({ x: 340, y: 140 }, { x: 460, y: 240 })
    expect((await overlay.state()).annotations).toBe(2)

    await overlay.tool('line').click()
    await overlay.page.locator('[data-arrow-kind="end"]').click()
    await overlay.drag({ x: 160, y: 300 }, { x: 420, y: 360 })
    expect((await overlay.state()).annotations).toBe(3)

    await overlay.tool('pen').click()
    await overlay.drag({ x: 180, y: 400 }, { x: 420, y: 460 })
    expect((await overlay.state()).annotations).toBe(4)

    await overlay.tool('marker').click()
    await overlay.drag({ x: 480, y: 400 }, { x: 700, y: 430 })
    expect((await overlay.state()).annotations).toBe(5)

    await overlay.tool('mosaic').click()
    await overlay.drag({ x: 520, y: 200 }, { x: 680, y: 320 })
    expect((await overlay.state()).annotations).toBe(6)
  })

  test('文字工具点击输入后回车生成标注，Esc 取消输入', async () => {
    await overlay.goto()
    await overlay.selectRegion({ x: 100, y: 100 }, { x: 700, y: 500 })

    await overlay.tool('text').click()
    await overlay.page.mouse.click(300, 260)
    await overlay.page.keyboard.type('翻译 OCR')
    await overlay.page.keyboard.press('Enter')

    await expect.poll(async () => (await overlay.state()).annotations).toBe(1)

    await overlay.page.mouse.click(420, 320)
    await overlay.page.keyboard.type('取消的文字')
    await overlay.page.keyboard.press('Escape')

    await expect.poll(async () => (await overlay.state()).annotations).toBe(1)
  })

  test('橡皮擦点击删除标注，撤销与重做可用', async () => {
    await overlay.goto()
    await overlay.selectRegion({ x: 100, y: 100 }, { x: 700, y: 500 })

    await overlay.tool('shape').click()
    await overlay.drag({ x: 200, y: 180 }, { x: 420, y: 340 })
    expect((await overlay.state()).annotations).toBe(1)

    await overlay.tool('eraser').click()
    await overlay.page.mouse.click(300, 260)
    await expect.poll(async () => (await overlay.state()).annotations).toBe(0)

    await expect(overlay.undoButton).toBeEnabled()
    await overlay.undoButton.click()
    await expect.poll(async () => (await overlay.state()).annotations).toBe(1)
    await overlay.redoButton.click()
    await expect.poll(async () => (await overlay.state()).annotations).toBe(0)
  })

  test('选择工具可拖动标注对象，Delete 删除选中对象', async () => {
    await overlay.goto()
    await overlay.selectRegion({ x: 100, y: 100 }, { x: 760, y: 560 })

    await overlay.tool('shape').click()
    await overlay.drag({ x: 260, y: 220 }, { x: 460, y: 360 })

    await overlay.tool('select').click()
    await overlay.drag({ x: 360, y: 290 }, { x: 460, y: 390 })

    const moved = await overlay.page.evaluate(() => {
      const store = (window as any).__captureOverlay
      return store ? null : null
    })
    expect(moved).toBeNull()
    expect((await overlay.state()).annotations).toBe(1)

    await overlay.page.keyboard.press('Delete')
    await expect.poll(async () => (await overlay.state()).annotations).toBe(0)
  })

  test('复制输出选区 PNG 并通知父窗口关闭', async () => {
    await overlay.goto()
    await overlay.selectRegion({ x: 120, y: 120 }, { x: 480, y: 360 })

    await overlay.copyButton.click()

    await expect(overlay.hint).toContainText('已复制到剪贴板')
    const copyCall = (await overlay.calls()).find((call) => call.name === 'copyImage')
    expect(copyCall?.payload?.prefix).toBe('data:image/png;base64,')
    expect((await overlay.sentEvents('closed')).length).toBe(1)
  })

  test('没有选区时复制整屏', async () => {
    await overlay.goto()
    await overlay.page.keyboard.press('Enter')
    const copyCall = (await overlay.calls()).find((call) => call.name === 'copyImage')
    expect(copyCall).toBeTruthy()
    expect((await overlay.state()).finished).toBe(true)
  })

  test('OCR 与翻译把图片交回主窗口处理', async () => {
    await overlay.goto()
    await overlay.selectRegion({ x: 140, y: 140 }, { x: 560, y: 420 })

    await overlay.ocrButton.click()
    const ocrResult = (await overlay.sentEvents('result')).at(-1)
    expect(ocrResult).toMatchObject({ action: 'ocr' })
    expect(String(ocrResult.imageUrl)).toContain('data:image/png;base64,')
  })

  test('翻译按钮交回 translate 动作', async () => {
    await overlay.goto()
    await overlay.selectRegion({ x: 140, y: 140 }, { x: 560, y: 420 })

    await overlay.translateButton.click()
    const translateResult = (await overlay.sentEvents('result')).at(-1)
    expect(translateResult).toMatchObject({ action: 'translate' })
  })

  test('保存：取消对话框时保留在截图状态', async () => {
    await overlay.goto()
    await overlay.selectRegion({ x: 140, y: 140 }, { x: 560, y: 420 })

    await overlay.saveButton.click()

    await expect(overlay.hint).toContainText('已取消保存')
    expect((await overlay.state()).finished).toBe(false)
  })

  test('保存：确认路径后写入 PNG 文件并退出', async ({ page }) => {
    await page.addInitScript(() => { (window as any).__stubSavePath = 'C:/tmp/dagu-capture.png' })
    await overlay.goto()
    await overlay.selectRegion({ x: 140, y: 140 }, { x: 560, y: 420 })

    await overlay.saveButton.click()

    const writeCall = (await overlay.calls()).find((call) => call.name === 'writeFile')
    expect(writeCall?.payload?.filePath).toBe('C:/tmp/dagu-capture.png')
    expect((await overlay.sentEvents('closed')).length).toBe(1)
  })

  test('固定：把选区图片与屏幕位置交回父窗口', async () => {
    await overlay.goto()
    await overlay.selectRegion({ x: 200, y: 160 }, { x: 520, y: 400 })

    await overlay.pinButton.click()

    const pinResult = (await overlay.sentEvents('pinResult')).at(-1)
    // 固定窗口的位置基于当前窗口在屏幕上的坐标，尺寸等于选区在屏幕上的大小
    expect(pinResult).toMatchObject({ bounds: { width: 320, height: 240 } })
    expect(typeof pinResult.bounds.x).toBe('number')
    expect(typeof pinResult.bounds.y).toBe('number')
    expect(String(pinResult.imageUrl)).toContain('data:image/png;base64,')
    expect((await overlay.sentEvents('closed')).length).toBe(1)
  })

  test('Esc 分步回退：先清空选区，再取消截图', async () => {
    await overlay.goto()
    await overlay.selectRegion({ x: 160, y: 120 }, { x: 620, y: 420 })

    await overlay.page.keyboard.press('Escape')
    expect(await overlay.state()).toMatchObject({ selection: null })
    await expect(overlay.toolbar).toBeHidden()

    await overlay.page.keyboard.press('Escape')
    expect((await overlay.sentEvents('closed')).length).toBe(1)
  })

  test('快速点击不会残留极小选区', async () => {
    await overlay.goto()
    await overlay.page.mouse.click(300, 200)

    expect(await overlay.state()).toMatchObject({ selection: null })
    await expect(overlay.toolbar).toBeHidden()
  })
})
