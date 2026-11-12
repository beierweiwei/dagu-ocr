---
status: 有效
updated: 2026-11-12
---

# ZTools 插件窗口显示与尺寸补偿

## 约束

用 `ztools.createBrowserWindow()` 创建独立窗口（尤其是全屏截图覆盖层）时，必须做四处补偿：

1. 新建窗口的高度会被系统压到显示器**工作区**尺寸，显示前再调一次 `setBounds()` 指定目标边界；
2. `show()` 返回正常不代表窗口已可见，需要用轮询式的 `isMinimized()` / `restore()` / `show()` / `focus()` / `moveTop()` 补偿，并在超时后走降级路径；
3. 创建参数里的 `alwaysOnTop: true` 可能没有落到 Windows `WS_EX_TOPMOST` 状态，创建后还要显式调用 `child.setAlwaysOnTop(true)`，否则钉图会被后续激活的普通窗口盖住；
4. 插件主视图已退出但仍有子窗口时，关闭最后一个子窗口可能触发宿主回收插件进程；若子窗口动作要触发主视图异步 Provider 调用，必须等主视图 Promise 完成后再关闭该子窗口。

## 原因与后果

- 实测：请求 `1920×1080` 的窗口，页面里 `window.innerHeight` 只有 `1032`（差了任务栏的 48px）；`setBounds()` 之后才是 1080。
- 实测：`show()` 后立刻 `isVisible()` 仍可能是 `false`，同一窗口在稍后查询才变 `true`；只调用一次 `show()` 会留下"窗口已创建但用户看不到"的空档。
- 2026-11-11 实测：固定截图窗口创建参数含 `alwaysOnTop: true`，但 Win32 `GetWindowLong(..., GWL_EXSTYLE)` 未带 `WS_EX_TOPMOST`；创建后调用 `setAlwaysOnTop(true)` 补偿。
- 2026-11-12 实测：固定图右键 OCR 立即关闭最后一个钉图子窗口时，ZTools 日志只记录子窗口销毁，没有 Provider 调用；保留子窗口到 `handleEditedImage()` 完成后，识别结果正常回填。
- 若不补偿：全屏覆盖层出现黑边/图像被缩放而非 1:1；截图流程可能静默卡住，用户以为功能失效。

## 来源

- 本项目实现：`plugin/src/main.js`（`showOverlayWindow()` / `ensureOverlayVisible()` / `overlayWindowOptions()`）。
- 生态参考：同生态插件在收到消息后同样会 `isMinimized() && restore()`、`isVisible() || show()` 再 `focus()`。
- 补充：用户按 Esc 或窗口被系统关闭时，子窗口可能来不及回传消息；父窗口不能只依赖 `on('closed')`（该 API 不在插件窗口白名单内），要靠结构化消息 + 兜底超时。
- 固定截图修复：`plugin/src/main.js`（创建后重新置顶）与 `plugin/src/capture/pin.js`（禁用图片原生拖拽）。
- OCR / 翻译生命周期修复：`plugin/src/main.js` 的 `pinAction` 处理。
