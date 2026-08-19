# 测试说明

## 环境准备

```bash
npm install
npx playwright install chromium
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

运行全部浏览器项目：

```bash
npm run test:e2e
```

报告和失败产物位于 `artifacts/`，该目录不会进入插件发布目录。
