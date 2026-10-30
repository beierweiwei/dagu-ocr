---
status: 待审核
updated: 2026-10-30
---

# fabric toDataURL 裁剪选项是视口坐标

## 约束

`canvas.toDataURL({ left, top, width, height })` 的裁剪选项是**视口（画布渲染）坐标**，不是图像（对象）坐标；且输出尺寸 = 选项尺寸 × `multiplier`。要在任意缩放下按图像空间导出选区，必须先换算：`left/top = imageToViewport(选区左上)`，`width/height = 选区宽高 × zoom`，`multiplier = 1 / zoom`。

## 原因与后果

fabric 4.x 的 `toCanvasElement` 内部用 `newVp = [zoom*m, 0, 0, zoom*m, (vp[4]-left)*m, (vp[5]-top)*m]` 渲染，`left` 被当作视口偏移减去。若直接传图像坐标（本项目 `stage.exportDataUrl` 旧实现），导出区域会偏移 `rect.left × (1 - zoom) / zoom`：

- **zoom = 1 时偏差恰为 0**——普通屏整屏 fit 恰好 1:1，完全掩盖问题；
- 高分屏 fit 缩放 = 1/dpr（如 1.5 屏为 2/3），导出内容明显错位，即"只有高分屏错位"的假象。

排查时容易误怀疑 dpr/retina 缩放（本项目实测 dpr=1 但缩放 2/3 时同样复现，从而排除 retina）。

## 来源

- fabric 4.6.0 `StaticCanvas.toCanvasElement` 反混淆源码（`plugin/public/assets/fabric.min.js`）。
- 本项目修复：`plugin/src/capture/stage.js` 的 `exportDataUrl()`。
- 回归测试：`tests/e2e/capture/overlay-dpi.spec.ts`（高分屏 dpr 1.5 / 普通屏 dpr 1 双场景，逐像素比对导出与源图）。
