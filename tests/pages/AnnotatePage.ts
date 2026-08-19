import { Page, Locator, expect } from '@playwright/test'

export class AnnotatePage {
  readonly page: Page
  readonly toolbar: Locator
  readonly btnSelect: Locator
  readonly btnRect: Locator
  readonly btnArrow: Locator
  readonly btnText: Locator
  readonly btnMosaic: Locator
  readonly btnUndo: Locator
  readonly btnRedo: Locator
  readonly btnClear: Locator
  readonly btnCopy: Locator
  readonly btnCancel: Locator
  readonly btnOcr: Locator
  readonly btnTranslate: Locator
  readonly editorContainer: Locator
  readonly canvas: Locator
  readonly status: Locator
  readonly textInputDialog: Locator
  readonly textInput: Locator
  readonly confirmDialogBtn: Locator
  readonly cancelDialogBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.toolbar = page.locator('.toolbar')
    this.btnSelect = page.locator('#btn-select')
    this.btnRect = page.locator('#btn-rect')
    this.btnArrow = page.locator('#btn-arrow')
    this.btnText = page.locator('#btn-text')
    this.btnMosaic = page.locator('#btn-mosaic')
    this.btnUndo = page.locator('#btn-undo')
    this.btnRedo = page.locator('#btn-redo')
    this.btnClear = page.locator('#btn-clear')
    this.btnCopy = page.locator('#btn-copy')
    this.btnCancel = page.locator('#btn-cancel')
    this.btnOcr = page.locator('#btn-ocr')
    this.btnTranslate = page.locator('#btn-translate')
    this.editorContainer = page.locator('#editor-container')
    this.canvas = page.locator('.tui-image-editor-canvas-container canvas').first()
    this.status = page.locator('#status')
    this.textInputDialog = page.locator('.custom-dialog-overlay')
    this.textInput = page.locator('#dialog-input')
    this.confirmDialogBtn = page.locator('#dialog-confirm')
    this.cancelDialogBtn = page.locator('#dialog-cancel')
  }

  async gotoWithImage(imageBase64: string) {
    const params = new URLSearchParams()
    params.set('code', 'screenshot-annotate')
    params.set('type', 'img')
    params.set('payload', `data:image/png;base64,${imageBase64}`)
    await this.page.goto(`/annotate.html?${params.toString()}`)
    await this.page.waitForLoadState('networkidle')
    await this.waitForImageLoaded()
  }

  async gotoStandaloneWithImage(imageBase64: string, screenshotFlow = false) {
    const params = new URLSearchParams()
    params.set('image', `data:image/png;base64,${imageBase64}`)
    if (screenshotFlow) params.set('screenshotFlow', '1')
    await this.page.goto(`/annotate.html?${params.toString()}`)
    await this.page.waitForLoadState('networkidle')
    await this.waitForImageLoaded()
  }

  async goto() {
    await this.page.goto('/annotate.html')
    await this.page.waitForLoadState('networkidle')
  }

  async waitForImageLoaded() {
    await expect(this.status).toContainText('图片加载完成', { timeout: 10000 })
    await this.editorContainer.waitFor({ state: 'visible' })
    await this.canvas.waitFor({ state: 'visible' })
  }

  async switchMode(mode: 'select' | 'rect' | 'arrow' | 'text' | 'mosaic') {
    const btnMap = {
      select: this.btnSelect,
      rect: this.btnRect,
      arrow: this.btnArrow,
      text: this.btnText,
      mosaic: this.btnMosaic
    }

    const statusMap = {
      select: '选择模式',
      rect: '矩形标注模式',
      arrow: '箭头标注模式',
      text: '点击截图上的位置添加文字',
      mosaic: '马赛克模式'
    }

    await btnMap[mode].click()
    await expect(btnMap[mode]).toHaveClass(/active/)
    await expect(this.status).toHaveText(statusMap[mode])
  }

  async drawRect(startX: number, startY: number, endX: number, endY: number) {
    await this.switchMode('rect')
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    await this.page.mouse.move(box.x + startX, box.y + startY)
    await this.page.mouse.down()
    await this.page.mouse.move(box.x + endX, box.y + endY)
    await this.page.mouse.up()
  }

  async drawArrow(startX: number, startY: number, endX: number, endY: number) {
    await this.switchMode('arrow')
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    await this.page.mouse.move(box.x + startX, box.y + startY)
    await this.page.mouse.down()
    await this.page.mouse.move(box.x + endX, box.y + endY)
    await this.page.mouse.up()
  }

  async addText(text: string, position?: { x: number, y: number }) {
    await this.switchMode('text')

    // Click on canvas to place text at the desired position
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')
    const x = position?.x ?? box.width / 2
    const y = position?.y ?? box.height / 2
    await this.page.mouse.click(box.x + x, box.y + y)

    // Wait for text object to be placed on canvas
    await expect(this.status).toHaveText('已添加文字')

    // Type the text content
    await this.canvas.focus()
    await this.page.keyboard.type(text)

    // Finish editing by pressing Escape
    await this.page.keyboard.press('Escape')
  }

  async drawMosaic(startX: number, startY: number, endX: number, endY: number) {
    await this.switchMode('mosaic')
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    await this.page.mouse.move(box.x + startX, box.y + startY)
    await this.page.mouse.down()
    await this.page.mouse.move(box.x + endX, box.y + endY)
    await this.page.mouse.up()
  }

  async clear() {
    await this.btnClear.click()
    await expect(this.textInputDialog).toBeVisible()
    await this.confirmDialogBtn.click()
    await expect(this.status).toContainText('已清空所有标注')
    expect(await this.getObjectCount()).toBe(0)
  }

  async copy() {
    await this.btnCopy.click()
    await expect(this.status).toContainText('已复制到剪贴板')
  }

  async cancel() {
    await this.btnCancel.click()
  }

  async getObjectCount() {
    return await this.page.evaluate(() => {
      if (!window.imageEditor) return 0
      return window.imageEditor._graphics.getObjects().length
    })
  }

  async pressShortcut(key: string) {
    await this.page.keyboard.press(key)
  }

  async useCopyShortcut() {
    await this.pressShortcut('Control+Enter')
    await expect(this.status).toContainText('已复制到剪贴板')
  }

  async useEscapeShortcut() {
    await this.pressShortcut('Escape')
    await expect(this.btnSelect).toHaveClass(/active/)
  }
}
