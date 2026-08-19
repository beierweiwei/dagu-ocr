# 大古 OCR

ZTools OCR 插件，支持图片识别、截图识别、截图标注和 OCR 结果翻译。

## 目录结构

- `plugin/`：唯一的插件源码与构建目录。
- `plugin/dist/`：唯一的插件发布目录，只包含构建后的运行时文件。
- `tests/`：Vitest 单元测试、Playwright E2E 测试和测试页面对象。
- `docs/`：需求、测试和修复记录。
- `.github/`：持续集成配置。

## 翻译

识别完成后可以选择源语言和目标语言，点击“翻译”查看翻译结果。插件支持三层回退：

- 配置百度翻译 APP ID 和密钥时优先使用百度翻译。
- 配置阿里云 OCR 的 AccessKey ID 和 Secret 后可复用阿里云机器翻译。
- 未配置上述服务或服务失败时使用 MyMemory 免费翻译。

“截图翻译”和图片右键菜单的“翻译图片”会在 OCR 完成后自动翻译。

## 开发与测试

```bash
npm install
npm run dev
npm test
npm run test:e2e:chromium
```

构建插件：

```bash
npm run build
```

构建产物位于 `plugin/dist/`。该目录被 Git 忽略，不提交到源码仓库。

## 发布

```bash
npm run publish:plugin
```

该命令会先构建插件，再从 `plugin/dist/` 执行 `ztools publish`。因此发布到插件中心的内容只包括
`plugin/dist/` 中的 HTML、JS、CSS、静态资源、`plugin.json`、`preload.js`、图标和许可证；根目录的测试、文档、CI、源码和开发依赖不会进入插件目录。
