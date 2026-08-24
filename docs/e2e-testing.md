# E2E 测试指南

## 快速开始

### 1. 安装依赖
```bash
# 安装npm依赖
npm install

# E2E 使用系统安装的 Google Chrome，不下载 Playwright 浏览器
google-chrome --version  # Linux CI
# Windows 可通过 DAGU_OCR_PLAYWRIGHT_EXECUTABLE_PATH 指定 chrome.exe
```

### 2. 运行测试
```bash
# 运行所有测试（无头模式）
npm run test:e2e

# 运行所有测试（有头模式，可看到浏览器操作）
npm run test:e2e:headed

# 运行系统 Chrome 测试
npm run test:e2e:chromium

# 调试模式
npm run test:e2e:debug

# 查看测试报告
npm run test:e2e:report
```

## 测试结构

```
tests/
├── e2e/                      # E2E测试用例目录
│   ├── ocr/                  # OCR主页面测试
│   │   └── main.spec.ts      # 主页面核心功能
│   ├── annotate/             # 图片标注页面测试
│   │   ├── core.spec.ts      # 核心编辑功能
│   │   └── shortcuts.spec.ts # 快捷键功能
│   ├── demo/                 # 演示页面测试
│   │   └── editor.spec.ts    # 编辑器演示功能
│   └── integration/          # 集成测试
│       └── flow.spec.ts      # 完整流程测试
├── pages/                    # Page Object Model
│   ├── OcrPage.ts            # OCR主页面封装
│   ├── AnnotatePage.ts       # 标注页面封装
│   └── EditorDemoPage.ts     # 演示页面封装
├── fixtures/                 # 测试数据
│   └── test-data.ts          # 通用测试数据
└── playwright.config.ts      # Playwright配置
```

## Page Object 模式说明

我们使用Page Object模式来封装页面操作，提高测试代码的可维护性：

### 优点：
1. **复用性**：相同的页面操作可以在多个测试用例中复用
2. **可维护性**：页面元素变更时，只需要修改对应的POM类
3. **可读性**：测试用例更简洁，业务逻辑清晰
4. **隔离性**：测试逻辑与页面实现细节隔离

### 示例用法：
```typescript
test('测试上传图片', async ({ page }) => {
  const ocrPage = new OcrPage(page)
  await ocrPage.goto()
  await ocrPage.uploadImage('test.png')
  await expect(ocrPage.preview).toBeVisible()
})
```

## 最佳实践

### 1. 选择器最佳实践
- 优先使用`data-testid`属性作为选择器（稳定，不受UI变更影响）
- 其次使用ID、类名等
- 避免使用文本内容作为选择器（易变，多语言场景不适用）
- 避免使用复杂的CSS选择器链（脆弱，易受页面结构变更影响）

### 2. 等待最佳实践
- 优先使用Playwright的自动等待机制，不要手动`setTimeout`
- 等待特定的状态变化：`waitFor({ state: 'visible' })`、`waitFor({ state: 'hidden' })`
- 等待网络请求完成：`waitForResponse()`
- 等待导航完成：`waitForNavigation()`

### 3. 断言最佳实践
- 每个测试用例应该有明确的断言
- 断言应该验证用户可见的行为，而不是内部实现
- 使用合适的断言方法，避免模糊的断言

### 4. 测试用例最佳实践
- 每个测试用例应该独立，不依赖其他测试用例的执行结果
- 测试用例应该短小精悍，每个用例只验证一个功能点
- 测试用例描述清晰，能够明确表达测试的目的
- 避免重复的测试逻辑，通过POM和fixture复用

### 5. 错误处理最佳实践
- 为失败的测试自动保存截图、视频和追踪信息
- 提供清晰的错误信息，便于定位问题
- 对不稳定的测试用例标记为flaky，单独处理

## 常见问题

### 1. 测试运行失败，提示找不到浏览器
确保系统已安装 Google Chrome；必要时通过
`DAGU_OCR_PLAYWRIGHT_EXECUTABLE_PATH` 指定 Chrome 可执行文件路径。

### 2. 剪贴板权限错误
Playwright配置中已经默认授予了剪贴板权限，如果还有问题，可以检查浏览器的权限设置。

### 3. 图片加载超时
确保本地服务器已经正确启动，并且测试图片路径正确。

### 4. 测试不稳定（Flaky）
- 增加等待条件，确保元素完全加载后再操作
- 避免依赖时间的断言
- 使用`test.fixme()`或者`test.skip()`标记不稳定的测试
- 运行测试时增加重试次数：`playwright test --retries=2`

### 5. CI环境运行失败
- 确保CI环境安装了所有必要的依赖
- 在 CI 中使用系统已安装的 Google Chrome
- 增加超时时间，CI环境通常比本地慢
- 确保服务器在测试运行前已经完全启动

## 测试覆盖范围

### 已覆盖功能：
✅ OCR主页面加载和基础操作
✅ 图片上传和预览
✅ 配置保存和读取
✅ 历史记录功能
✅ 页面跳转和参数传递
✅ 图片编辑器初始化
✅ 矩形、箭头、文字、马赛克标注功能
✅ 撤销/重做功能
✅ 清空功能
✅ 图片复制功能
✅ 所有快捷键操作
✅ 错误处理和提示
✅ 完整流程集成测试
✅ 系统 Chrome 兼容性测试

### 待扩展功能：
🔲 实际OCR识别功能测试（需要配置真实密钥）
🔲 插件环境API测试（ZTools/uTools）
🔲 移动端触摸操作测试
🔲 国际化多语言测试
🔲 性能和压测
🔲 无障碍功能测试
