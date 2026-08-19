import { test, expect } from '@playwright/test'
import { OcrPage } from '../../pages/OcrPage'
import { AnnotatePage } from '../../pages/AnnotatePage'
import { TEST_IMAGE_1x1, TEST_TEXT } from '../../fixtures/test-data'

test.describe('完整流程集成测试', () => {
  const testImageBuffer = Buffer.from(TEST_IMAGE_1x1, 'base64')

  test('OCR识别 -> 编辑图片 -> 复制结果 完整流程', async ({ page }) => {
    const ocrPage = new OcrPage(page)
    await ocrPage.goto()

    // 1. 上传图片
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: testImageBuffer
    })
    await expect(ocrPage.preview).toBeVisible()
    await ocrPage.closeConfig()

    // 2. 点击编辑按钮跳转到标注页面
    await Promise.all([
      page.waitForNavigation({ url: /annotate\.html/ }),
      ocrPage.editImage()
    ])

    // 3. 在标注页面进行编辑
    const annotatePage = new AnnotatePage(page)
    await annotatePage.waitForImageLoaded()

    // 添加一些标注
    await annotatePage.drawRect(10, 10, 50, 50)
    await annotatePage.addText(TEST_TEXT.SHORT)
    await annotatePage.drawArrow(10, 60, 90, 60)

    const objectCount = await annotatePage.getObjectCount()
    expect(objectCount).toBeGreaterThanOrEqual(3)

    // 4. 复制编辑后的图片
    await annotatePage.copy()
    await expect(annotatePage.status).toContainText('已复制到剪贴板')
  })

  test('直接访问标注页面，没有截图API时显示文件选择', async ({ page }) => {
    // Mock 没有截图API的环境
    await page.addInitScript(() => {
      delete window.ztools
      delete window.utools
      ;(window as Window & { __filePickerOpened?: boolean }).__filePickerOpened = false
      const inputClick = HTMLInputElement.prototype.click
      HTMLInputElement.prototype.click = function() {
        if (this.type === 'file') {
          ;(window as Window & { __filePickerOpened?: boolean }).__filePickerOpened = true
        }
        return inputClick.call(this)
      }
    })

    const annotatePage = new AnnotatePage(page)
    await page.goto('/annotate.html?code=screenshot-annotate')
    await page.waitForLoadState('networkidle')

    // 应该显示提示不支持截图功能，然后弹出文件选择框
    await expect(annotatePage.status).toContainText('当前环境不支持截图功能', { timeout: 5000 })

    expect(await page.locator('input[type="file"]').count()).toBe(1)
    expect(await page.evaluate(() => (window as Window & { __filePickerOpened?: boolean }).__filePickerOpened)).toBe(true)
  })

  test('配置保存后跳转编辑页面，配置不丢失', async ({ page }) => {
    const ocrPage = new OcrPage(page)
    await ocrPage.goto()

    // 保存配置
    await ocrPage.openConfig()
    const testAk = 'test-integration-ak-123'
    const testSk = 'test-integration-sk-456'
    await ocrPage.saveConfig(testAk, testSk)

    // 上传图片并跳转到编辑页面
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: testImageBuffer
    })

    await Promise.all([
      page.waitForNavigation({ url: /annotate\.html/ }),
      ocrPage.editImage()
    ])

    // 返回OCR页面，验证配置仍然存在
    await page.goBack()
    await ocrPage.openConfig()
    expect(await ocrPage.baiduAkInput.inputValue()).toBe(testAk)
    expect(await ocrPage.baiduSkInput.inputValue()).toBe(testSk)
  })
})
