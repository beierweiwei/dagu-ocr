import { Page, Locator, expect } from '@playwright/test'

export type StubCall = { name: string; payload?: any }

const VIEWPORT = { width: 1280, height: 720 }

export function installZtoolsStub(viewport = VIEWPORT) {
  return (options: { viewport?: { width: number; height: number } } = {}) => {
    const size = options?.viewport || viewport
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d') as CanvasRenderingContext2D
    context.fillStyle = '#123456'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#d32f2f'
    context.fillRect(0, 0, Math.floor(canvas.width / 2), Math.floor(canvas.height / 2))

    const calls: StubCall[] = []
    const record = (name: string, payload?: any) => { calls.push({ name, payload }) }
    ;(window as any).__ztoolsCalls = calls
    ;(window as any).ztools = {
      getCursorScreenPoint: () => ({ x: size.width / 2, y: size.height / 2 }),
      screenToDipPoint: (point: any) => point,
      getDisplayNearestPoint: () => ({
        id: 1,
        bounds: { x: 0, y: 0, width: size.width, height: size.height },
        scaleFactor: 1
      }),
      desktopCaptureSources: async (captureOptions: any) => {
        const width = captureOptions?.thumbnailSize?.width || size.width
        const height = captureOptions?.thumbnailSize?.height || size.height
        const source = document.createElement('canvas')
        source.width = width
        source.height = height
        const sourceContext = source.getContext('2d') as CanvasRenderingContext2D
        sourceContext.fillStyle = '#123456'
        sourceContext.fillRect(0, 0, width, height)
        sourceContext.fillStyle = '#d32f2f'
        sourceContext.fillRect(0, 0, Math.floor(width / 2), Math.floor(height / 2))
        const url = source.toDataURL('image/png')
        return [{
          id: 'screen:0:0',
          name: '整个屏幕',
          display_id: '1',
          thumbnail: {
            getSize: () => ({ width, height }),
            toDataURL: () => url
          }
        }]
      },
      copyImage: (dataUrl: string) => {
        record('copyImage', { prefix: String(dataUrl).slice(0, 22), length: String(dataUrl).length })
        return true
      },
      sendToParent: (_channel: string, payload: any) => { record('sendToParent', payload) },
      showSaveDialog: () => {
        record('showSaveDialog')
        return (window as any).__stubSavePath || ''
      },
      createBrowserWindow: (url: string, windowOptions: any) => {
        record('createBrowserWindow', { url, options: windowOptions })
        return { id: 1 }
      }
    }
    ;(window as any).__daguOcrWriteFile = (filePath: string, base64: string) => {
      record('writeFile', { filePath, length: String(base64).length })
      return true
    }
  }
}

export function overlayUrl(query: Record<string, string | number> = {}) {
  const params = new URLSearchParams({
    displayId: '1',
    displayX: '0',
    displayY: '0',
    displayWidth: String(VIEWPORT.width),
    displayHeight: String(VIEWPORT.height),
    scaleFactor: '1',
    ...Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)]))
  })
  return `/overlay.html?${params.toString()}`
}

export class CaptureOverlayPage {
  readonly page: Page
  readonly toolbar: Locator
  readonly mask: Locator
  readonly badge: Locator
  readonly hint: Locator
  readonly copyButton: Locator
  readonly saveButton: Locator
  readonly pinButton: Locator
  readonly closeButton: Locator
  readonly ocrButton: Locator
  readonly translateButton: Locator
  readonly undoButton: Locator
  readonly redoButton: Locator
  readonly subtoolbar: Locator

  constructor(page: Page) {
    this.page = page
    this.toolbar = page.locator('#capture-toolbar')
    this.mask = page.locator('#capture-mask')
    this.badge = page.locator('#capture-badge')
    this.hint = page.locator('#capture-hint')
    this.copyButton = page.locator('#capture-copy')
    this.saveButton = page.locator('#capture-save')
    this.pinButton = page.locator('#capture-pin')
    this.closeButton = page.locator('#capture-close')
    this.ocrButton = page.locator('#capture-ocr')
    this.translateButton = page.locator('#capture-translate')
    this.undoButton = page.locator('#capture-undo')
    this.redoButton = page.locator('#capture-redo')
    this.subtoolbar = page.locator('#capture-subtoolbar')
  }

  tool(id: string) {
    return this.page.locator(`.capture-tool[data-tool="${id}"]`)
  }

  // 图片模式：编辑图片与截图兜底共用同一页面。
  async gotoImageEditor(imageBase64: string, extra: Record<string, string | number> = {}) {
    const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
    // 大图不放 URL，走与生产一致的 localStorage 交接。
    const key = `capture-test-image-${Date.now()}-${Math.random().toString(36).slice(2)}`
    if (this.page.url().startsWith('http://')) {
      await this.page.evaluate(({ storageKey, value }) => localStorage.setItem(storageKey, value), { storageKey: key, value: imageUrl })
    } else {
      await this.page.goto('/index.html')
      await this.page.evaluate(({ storageKey, value }) => localStorage.setItem(storageKey, value), { storageKey: key, value: imageUrl })
    }
    const params = new URLSearchParams({
      mode: 'image',
      imageKey: key,
      ...Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, String(value)]))
    })
    await this.page.goto(`/overlay.html?${params.toString()}`)
    await this.waitForReady()
  }

  async waitForReady() {
    await this.page.waitForFunction(() => (window as any).__captureOverlay?.state?.ready === true)
  }

  async goto(query: Record<string, string | number> = {}) {
    await this.page.goto(overlayUrl(query))
    await this.waitForReady()
  }

  async drag(from: { x: number; y: number }, to: { x: number; y: number }) {
    await this.page.mouse.move(from.x, from.y)
    await this.page.mouse.down()
    await this.page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 })
    await this.page.mouse.move(to.x, to.y, { steps: 4 })
    await this.page.mouse.up()
  }

  async selectRegion(from = { x: 100, y: 80 }, to = { x: 460, y: 320 }) {
    await this.drag(from, to)
    await expect(this.badge).toBeVisible()
  }

  state() {
    return this.page.evaluate(() => (window as any).__captureOverlay.state)
  }

  async annotationCount() {
    return (await this.state()).annotations
  }

  calls() {
    return this.page.evaluate(() => (window as any).__ztoolsCalls || [])
  }

  async action(name: string) {
    await this.page.evaluate((actionName) => (window as any).__captureOverlay.handleAction(actionName), name)
  }

  sentEvents(event: string) {
    return this.page.evaluate((eventName) => {
      const calls = (window as any).__ztoolsCalls || []
      return calls
        .filter((call: StubCall) => call.name === 'sendToParent' && call.payload?.event === eventName)
        .map((call: StubCall) => call.payload)
    }, event)
  }
}
