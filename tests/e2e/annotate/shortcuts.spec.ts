import { test, expect } from '@playwright/test'
import { AnnotatePage } from '../../pages/AnnotatePage'
import { TEST_IMAGE_1x1 } from '../../fixtures/test-data'

test.describe('图片标注页面快捷键测试', () => {
  let annotatePage: AnnotatePage

  test.beforeEach(async ({ page }) => {
    annotatePage = new AnnotatePage(page)
    await annotatePage.gotoWithImage(TEST_IMAGE_1x1)
  })

  test('Ctrl+Enter 复制功能正常', async () => {
    await annotatePage.useCopyShortcut()
    await expect(annotatePage.status).toContainText('已复制到剪贴板')
  })

  test('ESC 键返回选择模式', async () => {
    await annotatePage.switchMode('rect')
    await expect(annotatePage.btnRect).toHaveClass(/active/)

    await annotatePage.useEscapeShortcut()
    await expect(annotatePage.btnSelect).toHaveClass(/active/)
    await expect(annotatePage.status).toHaveText('选择模式')
  })

  test('Delete 键删除选中元素', async () => {
    await annotatePage.drawRect(10, 10, 50, 50)
    expect(await annotatePage.getObjectCount()).toBe(1)

    // 通过fabric API选中对象
    await annotatePage.page.evaluate(() => {
      const canvas = window.imageEditor._graphics.getCanvas()
      const obj = canvas.getObjects()[0]
      if (obj) {
        canvas.setActiveObject(obj)
        canvas.renderAll()
      }
    })
    await annotatePage.page.waitForTimeout(200)

    // 按 Delete 键删除
    await annotatePage.pressShortcut('Delete')
    expect(await annotatePage.getObjectCount()).toBe(0)
    await expect(annotatePage.status).toContainText('已删除选中元素')
  })
})
