import { Page, Locator, expect } from '@playwright/test'

export class OcrPage {
  readonly page: Page
  readonly dropArea: Locator
  readonly fileInput: Locator
  readonly preview: Locator
  readonly previewImg: Locator
  readonly previewFrame: Locator
  readonly togglePreviewBtn: Locator
  readonly loading: Locator
  readonly resultArea: Locator
  readonly resultText: Locator
  readonly confirmBtn: Locator
  readonly copyImageBtn: Locator
  readonly copySourceBtn: Locator
  readonly copyTranslateBtn: Locator
  readonly translateBtn: Locator
  readonly ocrAgainBtn: Locator
  readonly translateResult: Locator
  readonly clearBtn: Locator
  readonly editBtn: Locator
  readonly status: Locator
  readonly configBtn: Locator
  readonly configPanel: Locator
  readonly closeConfigBtn: Locator
  readonly ocrProviderSelect: Locator
  readonly translationProviderSelect: Locator
  readonly baiduAkInput: Locator
  readonly baiduSkInput: Locator
  readonly saveConfigBtn: Locator
  readonly textInputPanel: Locator
  readonly textInput: Locator
  readonly translateInputBtn: Locator
  readonly historyToggle: Locator
  readonly historyList: Locator

  constructor(page: Page) {
    this.page = page
    this.dropArea = page.locator('#dropArea')
    this.fileInput = page.locator('#fileInput')
    this.preview = page.locator('.preview')
    this.previewImg = page.locator('#previewImg')
    this.previewFrame = page.locator('.preview-frame')
    this.togglePreviewBtn = page.locator('#togglePreviewBtn')
    this.loading = page.locator('.loading')
    this.resultArea = page.locator('.result-area')
    this.resultText = page.locator('#resultText')
    this.confirmBtn = page.locator('#confirmBtn')
    this.copyImageBtn = page.locator('#copy-image-btn')
    this.copySourceBtn = page.locator('#copySourceBtn')
    this.copyTranslateBtn = page.locator('#copyTranslateBtn')
    this.translateBtn = page.locator('#translateBtn')
    this.ocrAgainBtn = page.locator('#ocrAgainBtn')
    this.translateResult = page.locator('#translateResult')
    this.clearBtn = page.locator('#clearBtn')
    this.editBtn = page.locator('#edit-image-btn')
    this.status = page.locator('.status')
    this.configBtn = page.locator('#configBtn')
    this.configPanel = page.locator('#configPanel')
    this.closeConfigBtn = page.locator('#closeConfigBtn')
    this.ocrProviderSelect = page.locator('#ocrProviderSelect')
    this.translationProviderSelect = page.locator('#translationProviderSelect')
    this.baiduAkInput = page.locator('#baiduAk')
    this.baiduSkInput = page.locator('#baiduSk')
    this.saveConfigBtn = page.locator('#saveConfigBtn')
    this.textInputPanel = page.locator('#textInputPanel')
    this.textInput = page.locator('#textInput')
    this.translateInputBtn = page.locator('#translateInputBtn')
    this.historyToggle = page.locator('#historyToggle')
    this.historyList = page.locator('#historyList')
  }

  async goto() {
    await this.page.goto('/index.html')
    await this.page.waitForLoadState('networkidle')
  }

  async uploadImage(filePath: string | Buffer) {
    await this.dropArea.click()
    await this.fileInput.setInputFiles(filePath)
    await this.preview.waitFor({ state: 'visible' })
  }

  async uploadImageFromBase64(base64: string, filename = 'test.png') {
    const buffer = Buffer.from(base64, 'base64')
    await this.uploadImage({
      name: filename,
      mimeType: 'image/png',
      buffer: buffer
    })
  }

  // 预览缩放/拖动需要用大图，1x1 的测试图看不出差异。
  async uploadCanvasImage(generate: string, filename = 'canvas.png') {
    const dataUrl: string = await this.page.evaluate(generate)
    await this.uploadImageFromBase64(dataUrl.split(',')[1], filename)
  }

  async waitForRecognition() {
    await this.loading.waitFor({ state: 'visible' })
    await this.loading.waitFor({ state: 'hidden', timeout: 30000 })
    await this.resultArea.waitFor({ state: 'visible' })
  }

  async getResultText() {
    return await this.resultText.inputValue()
  }

  async copyResult() {
    await this.copySourceBtn.click()
    await expect(this.status).toContainText('已复制')
  }

  async editImage() {
    await this.editBtn.click()
  }

  async closeConfig() {
    if (await this.configPanel.isVisible()) {
      await this.closeConfigBtn.click()
      await this.configPanel.waitFor({ state: 'hidden' })
    }
  }

  async openConfig() {
    await this.configBtn.click()
    await this.configPanel.waitFor({ state: 'visible' })
  }

  async saveConfig(baiduAk?: string, baiduSk?: string) {
    if (baiduAk) {
      await this.baiduAkInput.fill(baiduAk)
    }
    if (baiduSk) {
      await this.baiduSkInput.fill(baiduSk)
    }
    await this.saveConfigBtn.click()
    await expect(this.status).toContainText('配置保存成功')
    await this.configPanel.waitFor({ state: 'hidden' })
  }

  async configureMockProviders() {
    await this.openConfig()
    await this.ocrProviderSelect.selectOption('ztools:mock-ocr')
    await this.translationProviderSelect.selectOption('ztools:mock-translation')
    await this.saveConfig()
  }

  async copyHistoryItem(index: number) {
    const items = this.historyList.locator('.history-item')
    await items.nth(index).click()
    await expect(this.status).toContainText('已复制')
  }
}
