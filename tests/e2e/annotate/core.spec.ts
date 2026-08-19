import { test, expect } from '@playwright/test'
import { AnnotatePage } from '../../pages/AnnotatePage'
import { TEST_IMAGE_1x1, TEST_TEXT, TEST_COORDS } from '../../fixtures/test-data'

test.describe('图片标注页面核心功能测试', () => {
  let annotatePage: AnnotatePage

  test.beforeEach(async ({ page }) => {
    annotatePage = new AnnotatePage(page)
  })

  test('页面加载成功，工具栏元素完整', async () => {
    await annotatePage.goto()
    await expect(annotatePage.toolbar).toBeVisible()
    await expect(annotatePage.btnSelect).toBeVisible()
    await expect(annotatePage.btnRect).toBeVisible()
    await expect(annotatePage.btnArrow).toBeVisible()
    await expect(annotatePage.btnText).toBeVisible()
    await expect(annotatePage.btnMosaic).toBeVisible()
    await expect(annotatePage.btnUndo).toBeVisible()
    await expect(annotatePage.btnRedo).toBeVisible()
    await expect(annotatePage.btnClear).toBeVisible()
    await expect(annotatePage.btnCopy).toBeVisible()
    await expect(annotatePage.btnCancel).toBeVisible()
  })

  test('样式控件折叠在菜单中，颜色和线宽仍可调整', async () => {
    await annotatePage.gotoStandaloneWithImage(TEST_IMAGE_1x1, true)

    await expect(annotatePage.styleMenu).toBeVisible()
    await expect(annotatePage.colorButtons.first()).toBeHidden()

    await annotatePage.styleMenuTrigger.click()
    await expect(annotatePage.colorButtons.first()).toBeVisible()
    await annotatePage.blueColorButton.click()
    await expect(annotatePage.blueColorButton).toHaveClass(/active/)

    await annotatePage.lineWidthRange.evaluate((element) => {
      const input = element as HTMLInputElement
      input.value = '7'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect(annotatePage.lineWidthValue).toHaveText('7')
  })

  test('720px 窄窗口工具栏不产生横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 560 })
    await annotatePage.gotoStandaloneWithImage(TEST_IMAGE_1x1, true)

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      toolbarWidth: document.querySelector('#toolbar')?.getBoundingClientRect().width || 0
    }))

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
    expect(dimensions.toolbarWidth).toBe(dimensions.clientWidth)
  })

  test('更窄的截图窗口不会裁切底部操作按钮', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 500 })
    await annotatePage.gotoStandaloneWithImage(TEST_IMAGE_1x1, true)

    const layout = await page.evaluate(() => {
      const selectors = ['#style-menu-trigger', '#btn-ocr', '#btn-translate', '#btn-cancel', '#btn-copy']
      return selectors.map((selector) => {
        const element = document.querySelector(selector)
        const box = element?.getBoundingClientRect()
        const hit = box ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null
        return {
          selector,
          right: box?.right || 0,
          hit: hit?.closest(selector)?.id || hit?.id || ''
        }
      })
    })

    for (const item of layout) {
      expect(item.right, item.selector).toBeLessThanOrEqual(600)
      expect(item.hit, item.selector).toBe(item.selector.slice(1))
    }
  })

  test('通过URL参数加载图片成功', async () => {
    await annotatePage.gotoWithImage(TEST_IMAGE_1x1)
    await expect(annotatePage.editorContainer).toBeVisible()
    await expect(annotatePage.canvas).toBeVisible()
    await expect(annotatePage.status).toContainText('图片加载完成')
  })

  test('矩形标注功能正常', async () => {
    await annotatePage.gotoWithImage(TEST_IMAGE_1x1)
    const countBefore = await annotatePage.getObjectCount()

    await annotatePage.drawRect(
      TEST_COORDS.TOP_LEFT.x,
      TEST_COORDS.TOP_LEFT.y,
      TEST_COORDS.BOTTOM_RIGHT.x,
      TEST_COORDS.BOTTOM_RIGHT.y
    )

    const countAfter = await annotatePage.getObjectCount()
    expect(countAfter).toBe(countBefore + 1)
  })

  test('箭头标注功能正常', async () => {
    await annotatePage.gotoWithImage(TEST_IMAGE_1x1)
    const countBefore = await annotatePage.getObjectCount()

    await annotatePage.drawArrow(
      TEST_COORDS.TOP_LEFT.x,
      TEST_COORDS.TOP_LEFT.y,
      TEST_COORDS.BOTTOM_RIGHT.x,
      TEST_COORDS.BOTTOM_RIGHT.y
    )

    const countAfter = await annotatePage.getObjectCount()
    expect(countAfter).toBe(countBefore + 1)
  })

  test('文字标注功能正常', async () => {
    await annotatePage.gotoWithImage(TEST_IMAGE_1x1)
    const countBefore = await annotatePage.getObjectCount()

    await annotatePage.addText(TEST_TEXT.SHORT)

    const countAfter = await annotatePage.getObjectCount()
    expect(countAfter).toBe(countBefore + 1)
  })

  test('马赛克功能正常', async () => {
    await annotatePage.gotoWithImage(TEST_IMAGE_1x1)
    const countBefore = await annotatePage.getObjectCount()

    await annotatePage.drawMosaic(
      TEST_COORDS.TOP_LEFT.x,
      TEST_COORDS.TOP_LEFT.y,
      TEST_COORDS.BOTTOM_RIGHT.x,
      TEST_COORDS.BOTTOM_RIGHT.y
    )

    const countAfter = await annotatePage.getObjectCount()
    expect(countAfter).toBeGreaterThan(countBefore)
  })

  test('清空功能正常', async () => {
    await annotatePage.gotoWithImage(TEST_IMAGE_1x1)

    await annotatePage.drawRect(10, 10, 50, 50)
    await annotatePage.addText('测试')

    expect(await annotatePage.getObjectCount()).toBeGreaterThanOrEqual(2)

    await annotatePage.clear()
    expect(await annotatePage.getObjectCount()).toBe(0)
  })

  test('复制功能正常', async () => {
    await annotatePage.gotoWithImage(TEST_IMAGE_1x1)
    await annotatePage.addText('测试复制')
    await annotatePage.copy()
    await expect(annotatePage.status).toContainText('已复制到剪贴板')
  })

  test('删除选中元素功能正常', async () => {
    await annotatePage.gotoWithImage(TEST_IMAGE_1x1)
    await annotatePage.drawRect(10, 10, 50, 50)
    expect(await annotatePage.getObjectCount()).toBe(1)

    // 选中对象
    await annotatePage.page.evaluate(() => {
      const canvas = window.imageEditor._graphics.getCanvas()
      const obj = canvas.getObjects()[0]
      if (obj) {
        canvas.setActiveObject(obj)
        canvas.renderAll()
      }
    })
    await annotatePage.page.waitForTimeout(200)

    // 删除
    await annotatePage.page.evaluate(() => {
      const canvas = window.imageEditor._graphics.getCanvas()
      const active = canvas.getActiveObject()
      if (active) {
        canvas.remove(active)
        canvas.discardActiveObject()
        canvas.renderAll()
      }
    })
    expect(await annotatePage.getObjectCount()).toBe(0)
  })
})
