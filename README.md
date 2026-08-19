# 大古 OCR

ZTools OCR 插件，提供截图编辑、图片 OCR、文字翻译和普通图片编辑。

## 入口

- `截图`：截图后进入编辑器，可继续 OCR 或翻译。
- `图片 OCR`：图片输入直接识别；没有剪贴板图片时上传。
- `翻译文字`：输入文字后翻译。
- `编辑图片`：从 ZTools 图片输入或上传面板进入普通编辑器。

## Provider 与配置

OCR 和翻译分别选择一个 Provider，失败不会自动切换。插件会发现 ZTools 提供的同类型 Provider，也支持内置百度、阿里和 MyMemory。MyMemory key 必须由用户配置。

偏好保存到 ZTools `dbStorage`，密钥默认只保存在本机。开启“同步密钥”后，密钥才会写入可随备份同步的副本；历史记录始终保存在本机。

## 开发与测试

```bash
npm install
npm run dev
npm test
npm run test:e2e:chromium
npm run build
```

E2E 使用系统安装的 Chrome。可通过 `DAGU_OCR_PLAYWRIGHT_EXECUTABLE_PATH` 指定 Chrome 可执行文件路径；默认检测常见 Windows Chrome 安装路径，不下载 Playwright 浏览器。

构建产物位于 `plugin/dist/`，发布命令为：

```bash
npm run publish:plugin
```
