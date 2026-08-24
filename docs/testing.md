# 测试说明

## 环境准备

```bash
npm install
# E2E 使用系统安装的 Google Chrome，不下载 Playwright 浏览器
```

## 单元测试

```bash
npm test
```

## E2E 测试

运行 Chromium 测试：

```bash
npm run test:e2e:chromium
```

测试配置会记录实际使用的系统 Chrome 路径或 `chrome` channel。

报告和失败产物位于 `artifacts/`，该目录不会进入插件发布目录。
