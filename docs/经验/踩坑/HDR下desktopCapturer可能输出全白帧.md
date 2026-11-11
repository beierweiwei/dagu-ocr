---
status: 待审核
updated: 2026-11-11
---

# HDR 下 desktopCapturer 可能输出全白帧

## 约束

ZTools 的 `desktopCaptureSources()` 只是转发 Electron `desktopCapturer.getSources()`。Windows 开启 HDR 时，底层 DXGI Desktop Duplication 可能把 HDR/scRGB 帧截断成 8-bit BGRA，高光全部夹到白色；插件拿到的 PNG 已经丢失暗部/色彩信息，不能通过后处理还原。

对这类帧要在采集边界识别“整帧纯白”并视为采集失败，复用既有 `captureFailed -> screenCapture` 系统截图回退；不要把全白帧当正常冻帧交给标注器。

## 原因与后果

HDR 模式下 DWM 使用 scRGB 组合空间，值可超出 1.0。DXGI 以 `B8G8R8A8_UNORM` 采集时会发生过夹持，常见表现是过曝、发灰甚至全白。Chromium/WebRTC 相关生态的修复方向是改用 Windows Graphics Capture 并请求 SDR BGRA 输出，让系统先完成 HDR→SDR 色调映射；插件侧无法切换宿主采集后端。

若不检测，用户会在 HDR 显示器上看到全屏白色覆盖层；误判为页面渲染问题会继续追查 fabric/遮罩，方向错误。

## 来源

- 用户反馈：Windows HDR 下截图直接全白。
- ZTools 3.2.0 主进程实现：`desktopCaptureSources` 直接调用 `electron.desktopCapturer.getSources()`。
- DXGI HDR 过夹持与 WGC 修复方向：https://github.com/flutter-webrtc/flutter-webrtc/issues/2205
- 本项目修复：`plugin/src/capture/desktop-capture.js` 的纯白帧检测与失败抛出。
- 回归测试：`tests/e2e/capture/overlay.spec.ts`（HDR 全白帧触发 `captureFailed`）、`tests/e2e/integration/flow.spec.ts`（覆盖层失败后回退 ZTools 系统截图）。
