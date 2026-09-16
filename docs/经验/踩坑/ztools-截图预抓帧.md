---
status: 有效
updated: 2026-09-16
---

# ZTools 截图要预抓帧，不能等窗口出来再采集

## 约束

触发截图的瞬间就要向宿主申请画面（`desktopCaptureSources()` 取 `thumbnail.toDataURL()`），与覆盖层窗口的创建、页面加载**并行**；覆盖层启动后优先取用这一帧，拿到即进入框选。窗口创建完成后再采集，用户必然多等一个窗口加载 + 采集的串行时长。

跨窗口交接用一个短命键（本项目：`localStorage` 的 `dagu-ocr-capture-<时间戳>-<随机数>`，30s TTL 兜底清理）：

1. 主窗口抓帧成功后写入 `{ dataUrl, pixelSize, captureMs }`；
2. 覆盖层读取到即 `removeItem`，不做二次采集；
3. 抓帧失败时写入 `{ failed: true }` 标记，覆盖层**立即**自行采集，不干等超时；
4. 覆盖层异常退出时由 TTL 超时清理，避免大图长期占用存储。

注意：主窗口隐藏后画面才会稳定，抓帧要延迟一小段（实测 60ms）再发，否则会把主窗口自己拍进冻帧。

## 原因与后果

本机实测耗时量级（2560×1440 虚拟屏，`desktopCapturer` 缩略图）：

- 抓帧 + PNG `toDataURL()` 编码：41–152ms；
- 覆盖层解码该 PNG（`Image.onload`）：约 27ms；
- 官方截图实现里，主进程用原生 `ScreenCapture.prime()` 预抓帧缓存，插件侧没有帧缓存可复用，等价优化只有"尽早抓帧 + 与窗口创建并行 + 数据就绪即显示"。

不这么做时，用户按下截图后要等 1–2 秒才看到冻结画面（本插件旧实现的体感），期间只能看到正在加载的空白全屏窗口。

## 来源

- ZTools 3.2.0 主进程：`ScreenCapture.prime()` / `desktopCapturer` 实现对照。
- 本项目实现：`plugin/src/capture/prime-frame.js`（含 11 条单测）、`plugin/src/capture/overlay.js`（`resolveStageImage()` 优先读预抓帧）、`plugin/src/main.js`（`startScreenshotFlow()` 在 `createOverlayWindow()` 之前发起抓帧）。
- 回归测试：`tests/e2e/capture/overlay.spec.ts`（取用预抓帧 / 失败标记两条）、`tests/e2e/integration/flow.spec.ts`（并行时序 + 键交接）。
