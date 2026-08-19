import { test, expect } from '@playwright/test'
import { OcrPage } from '../../pages/OcrPage'
import { TEST_IMAGE_1x1, TEST_CONFIG } from '../../fixtures/test-data'

test.describe('OCR 主页面功能测试', () => {
  let ocrPage: OcrPage
  const testImageBuffer = Buffer.from(TEST_IMAGE_1x1, 'base64')

  test.beforeEach(async ({ page }) => {
    ocrPage = new OcrPage(page)
    await ocrPage.goto()
  })

  test('页面加载成功，显示所有核心元素', async () => {
    await expect(ocrPage.dropArea).toBeVisible()
    await expect(ocrPage.configBtn).toBeVisible()
    await expect(ocrPage.historyToggle).toBeVisible()
    await expect(ocrPage.status).toHaveText('')
  })

  test('图片上传功能正常，预览正确显示', async () => {
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: testImageBuffer
    })

    await expect(ocrPage.preview).toBeVisible()
    await expect(ocrPage.previewImg).toBeVisible()
    await expect(ocrPage.editBtn).toBeVisible() // 编辑按钮应该显示
  })

  test('识别结果支持翻译', async ({ page }) => {
    await page.route('https://api.mymemory.translated.net/get**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          responseStatus: 200,
          responseData: { translatedText: '你好' }
        })
      })
    })

    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: testImageBuffer
    })
    await ocrPage.closeConfig()
    await ocrPage.resultText.fill('hello')

    await expect(ocrPage.translateBtn).toBeVisible()
    await ocrPage.translateBtn.click()
    await expect(ocrPage.translateResult).toHaveValue('你好')
  })

  test('配置页面功能正常，可以保存配置', async () => {
    await ocrPage.openConfig()
    await expect(ocrPage.configPanel).toBeVisible()

    await ocrPage.saveConfig(TEST_CONFIG.baiduAk, TEST_CONFIG.baiduSk)

    // 重新打开配置页面，验证值是否正确保存
    await ocrPage.openConfig()
    expect(await ocrPage.baiduAkInput.inputValue()).toBe(TEST_CONFIG.baiduAk)
    expect(await ocrPage.baiduSkInput.inputValue()).toBe(TEST_CONFIG.baiduSk)
  })

  test('编辑按钮点击后跳转到标注页面', async ({ page }) => {
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: testImageBuffer
    })
    await ocrPage.closeConfig()

    await Promise.all([
      page.waitForNavigation({ url: /annotate\.html/ }),
      ocrPage.editImage()
    ])

    expect(page.url()).toContain('annotate.html')
    expect(new URL(page.url()).searchParams.get('payload')).toContain('data:image')
  })

  test('非图片文件上传显示错误提示', async ({ page }) => {
    // 监听alert事件
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('请选择图片文件')
      dialog.accept()
    })

    await ocrPage.dropArea.click()
    await ocrPage.fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image')
    })

    await expect(ocrPage.status).toContainText('请选择图片文件')
  })

  test('清空按钮可以清除当前内容', async () => {
    await ocrPage.uploadImage({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: testImageBuffer
    })
    await ocrPage.closeConfig()

    await ocrPage.clearBtn.click()
    await expect(ocrPage.preview).toBeHidden()
    await expect(ocrPage.resultArea).toBeHidden()
    expect(await ocrPage.resultText.inputValue()).toBe('')
  })
})
