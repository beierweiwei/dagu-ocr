---
status: 有效
updated: 2026-09-15
---

# ZTools 主色解析只认 custom 主题

## 约束

读取宿主主题色时必须按 ZTools 的规则解析，不能"看到 `customColor` 就用"：

1. `primaryColor === 'custom'` 且 `customColor` 是合法 `#rrggbb` 时，主色取 `customColor`；
2. 其余命名主题（blue / purple / green / orange / red / pink）按色阶取色，**忽略设置里残留的 `customColor`**；
3. 宿主会给插件窗口注入 `:root { --plugin-primary-color: <最终主色> !important }`，它已经包含上述判定，优先直接采用。

## 原因与后果

ZTools 主进程的 `resolvePluginPrimaryColor()` 只在主题为 `custom` 时使用 `customColor`，命名主题走 `PRIMARY_COLOR_MAP`；而 `getThemeInfo()` 仍会返回 `customColor` 字段。

后果：用户把主题从"自定义"切到"蓝色"后，`customColor`（旧值 `#db2777`）仍留在设置里。插件若无条件使用它，就会出现"主题选了蓝色、界面却是玫红"的错位，且与 ZTools 自身界面不一致。

另一个相关坑：主题类与自定义色要挂在同一个元素上。曾把 `theme-*` 类挂 `body`、自定义色内联在 `html`，导致默认色取自定义色、`hover` 取主题色——同一次点击出现两种色系。

## 来源

- ZTools 3.2.0 主进程：`resolvePluginPrimaryColor()` / `PRIMARY_COLOR_MAP` / `buildPluginThemeCSS()`。
- 本项目实现：`plugin/src/theme.js`（含 8 条单测，覆盖"命名主题必须忽略残留自定义色"）。
