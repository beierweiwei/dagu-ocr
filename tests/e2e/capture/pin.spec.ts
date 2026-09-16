import { test, expect } from '@playwright/test'

function stubPinZtools() {
  const calls: any[] = []
  ;(window as any).__ztoolsCalls = calls
  ;(window as any).ztools = {
    sendToParent: (channel: string, payload: any) => { calls.push({ channel, payload }) },
    getWindowType: () => 'browser'
  }
  const canvas = document.createElement('canvas')
  canvas.width = 240
  canvas.height = 120
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.fillStyle = '#0ea5e9'
  context.fillRect(0, 0, 240, 120)
  localStorage.setItem('pin-test-key', canvas.toDataURL('image/png'))
}

test.describe('固定到屏幕的图片窗口', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(stubPinZtools)
  })

  test('加载固定图片并显示操作提示', async ({ page }) => {
    await page.goto('/pin.html?pinId=p1&pinKey=pin-test-key')

    const image = page.locator('#pin-image')
    await expect(image).toBeVisible()
    await expect.poll(async () => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(240)
    await expect(page.locator('#pin-hint')).toContainText('滚轮缩放')
  })

  test('滚轮缩放与拖动移动都会回传父窗口', async ({ page }) => {
    await page.goto('/pin.html?pinId=p1&pinKey=pin-test-key')
    await expect(page.locator('#pin-image')).toBeVisible()

    await page.mouse.move(120, 60)
    await page.mouse.wheel(0, -120)
    await expect.poll(async () => page.evaluate(() => (window as any).__ztoolsCalls.length)).toBeGreaterThan(0)

    await page.mouse.move(60, 40)
    await page.mouse.down()
    await page.mouse.move(140, 100, { steps: 4 })
    await page.mouse.up()

    const events = await page.evaluate(() => (window as any).__ztoolsCalls.map((call: any) => call.payload.event))
    expect(events).toContain('pinZoom')
    expect(events).toContain('pinMove')

    const zoomCall = await page.evaluate(() => (window as any).__ztoolsCalls.find((call: any) => call.payload.event === 'pinZoom'))
    expect(zoomCall.payload).toMatchObject({ pinId: 'p1', source: 'pin' })
    expect(zoomCall.payload.factor).toBeGreaterThan(1)
  })

  test('双击与 Esc 关闭固定窗口', async ({ page }) => {
    await page.goto('/pin.html?pinId=p1&pinKey=pin-test-key')
    await expect(page.locator('#pin-image')).toBeVisible()

    await page.mouse.dblclick(120, 60)
    await expect.poll(async () => (await page.evaluate(() => (window as any).__ztoolsCalls))
      .filter((call: any) => call.payload.event === 'pinClose').length).toBe(1)

    await page.keyboard.press('Escape')
    await expect.poll(async () => (await page.evaluate(() => (window as any).__ztoolsCalls))
      .filter((call: any) => call.payload.event === 'pinClose').length).toBe(2)
  })
})
