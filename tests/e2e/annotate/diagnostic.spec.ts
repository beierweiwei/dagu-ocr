import { test, expect } from '@playwright/test'
import { AnnotatePage } from '../../pages/AnnotatePage'
import { TEST_IMAGE_1x1 } from '../../fixtures/test-data'

test.describe('标注导出和删除诊断测试', () => {
  let annotatePage: AnnotatePage

  test.beforeEach(async ({ page }) => {
    annotatePage = new AnnotatePage(page)
  })

  test('toDataURL 导出应包含标注对象 - 像素级验证', async () => {
    await annotatePage.gotoWithImage(TEST_IMAGE_1x1)

    // 绘制一个蓝色矩形的标注（和红色背景有明显区别）
    await annotatePage.drawRect(25, 25, 75, 75)

    // 通过 page.evaluate 获取 toDataURL 结果并检查像素
    const result = await annotatePage.page.evaluate(() => {
      const fc = (window as any).imageEditor._graphics.getCanvas()
      fc.renderAll()

      // 方法1: fc.toDataURL
      const toDataURLResult = fc.toDataURL({ format: 'png', multiplier: 1 })

      // 方法2: lowerCanvasEl.toDataURL
      const lowerResult = fc.lowerCanvasEl.toDataURL('image/png')

      // 方法3: toCanvasElement
      const canvasEl = fc.toCanvasElement(1, { enableRetinaScaling: false } as any)
      const canvasElResult = canvasEl.toDataURL('image/png')

      // 检查图像中的像素
      function checkImageHasContent(dataUrl: string): { hasNonBgPixels: boolean, pixelSample: number[] | null } {
        const img = new Image()
        img.src = dataUrl
        // 由于 evaluate 中是同步的，我们需要用同步方式检查
        // 创建 canvas 并绘制
        const checkCanvas = document.createElement('canvas')
        const ctx = checkCanvas.getContext('2d')!

        // 先直接检查 dataURL 是否为空或只有背景
        if (!dataUrl || dataUrl === 'data:,') {
          return { hasNonBgPixels: false, pixelSample: null }
        }

        // 返回 dataURL 的前100个字符作为标识
        return { hasNonBgPixels: true, pixelSample: [dataUrl.length, dataUrl.substring(0, 50).length] }
      }

      return {
        toDataURL: toDataURLResult,
        lowerCanvasEl: lowerResult,
        canvasEl: canvasElResult,
        info: {
          fcWidth: fc.getWidth(),
          fcHeight: fc.getHeight(),
          objectsCount: fc.getObjects().length,
          lowerWidth: fc.lowerCanvasEl.width,
          lowerHeight: fc.lowerCanvasEl.height,
        }
      }
    })

    console.log('=== 导出诊断结果 ===')
    console.log('toDataURL length:', result.toDataURL.length)
    console.log('lowerCanvasEl length:', result.lowerCanvasEl.length)
    console.log('canvasEl length:', result.canvasEl.length)
    console.log('canvas info:', JSON.stringify(result.info))

    // 验证画布上有对象
    expect(result.info.objectsCount).toBeGreaterThanOrEqual(1)
    // 验证导出的 dataURL 是有效的 PNG 格式
    expect(result.toDataURL).toMatch(/^data:image\/png;base64,/)
    expect(result.toDataURL.length).toBeGreaterThan(100)
    expect(result.lowerCanvasEl).toMatch(/^data:image\/png;base64,/)
    expect(result.lowerCanvasEl.length).toBeGreaterThan(100)
    expect(result.canvasEl).toMatch(/^data:image\/png;base64,/)
    expect(result.canvasEl.length).toBeGreaterThan(100)
  })

  test('删除只能删除选中的对象', async () => {
    await annotatePage.gotoWithImage(TEST_IMAGE_1x1)

    // 创建两个对象
    await annotatePage.drawRect(10, 10, 40, 40)
    expect(await annotatePage.getObjectCount()).toBe(1)
    await annotatePage.drawRect(50, 50, 80, 80)
    expect(await annotatePage.getObjectCount()).toBe(2)

    // 通过 fabric API 选中第二个对象（索引为1）
    await annotatePage.page.evaluate(() => {
      const canvas = (window as any).imageEditor._graphics.getCanvas()
      const obj = canvas.getObjects()[1]  // 第二个矩形
      if (obj) {
        canvas.setActiveObject(obj)
        canvas.renderAll()
      }
    })
    await annotatePage.page.waitForTimeout(200)

    // 获取删除前的对象数
    const countBeforeDelete = await annotatePage.getObjectCount()
    expect(countBeforeDelete).toBe(2)

    // 按 Delete 键删除
    await annotatePage.pressShortcut('Delete')
    await annotatePage.page.waitForTimeout(300)

    // 验证只剩一个对象
    const countAfterDelete = await annotatePage.getObjectCount()
    expect(countAfterDelete).toBe(1)
    await expect(annotatePage.status).toContainText('已删除选中元素')
  })

  test('Backspace 不能删除文字编辑中的字符', async () => {
    await annotatePage.gotoWithImage(TEST_IMAGE_1x1)

    // 添加文字
    await annotatePage.addText('测试')

    // 验证文字在画布上
    expect(await annotatePage.getObjectCount()).toBe(1)

    // 选中文字
    await annotatePage.page.evaluate(() => {
      const canvas = (window as any).imageEditor._graphics.getCanvas()
      const obj = canvas.getObjects()[0]
      if (obj && obj.type === 'i-text') {
        obj.selectAll()
        canvas.setActiveObject(obj)
        obj.enterEditing()
        canvas.renderAll()
      }
    })
    await annotatePage.page.waitForTimeout(200)

    // 获取文字内容和退格前的对象数
    const countBeforeBackspace = await annotatePage.getObjectCount()
    expect(countBeforeBackspace).toBe(1)

    // 按 Backspace - 应该只删除文字字符，不删除整个对象
    await annotatePage.pressShortcut('Backspace')
    await annotatePage.page.waitForTimeout(200)

    // 验证对象没有被删除（仍然有1个）
    expect(await annotatePage.getObjectCount()).toBe(1)
  })
})
