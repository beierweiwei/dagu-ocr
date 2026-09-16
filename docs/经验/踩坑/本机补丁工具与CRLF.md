---
status: 有效
updated: 2026-09-15
---

# 本机补丁工具与 CRLF 行尾

## 约束

在本机用 `apply_patch` 改文件时：

1. 必须直接调用 `codex.exe --codex-run-as-apply-patch $patch`（`.bat` 包装会截断多行补丁的换行）；
2. 目标文件若是 CRLF 或混合行尾，补丁的上下文行会匹配不上；
3. 大批量或多处替换时，用脚本按"精确字符串 + 命中数校验"改文件更稳。

## 原因与后果

补丁工具按行匹配上下文。文件混入 `\r` 后，形如 `xxx }\r` 的行与补丁里的 `xxx }` 不相等，报错是 `Failed to find expected lines`，但肉眼看文件内容完全一致，容易误以为补丁语法写错。

后果与绕法：

- 报错定位到"明明存在的那一行"时，先排查行尾：`[IO.File]::ReadAllText($p).IndexOf("`r")`；
- 统一行尾（`$t -replace "`r`n", "`n"`）后再打补丁，或直接用 Node 脚本替换；
- `rg` / PowerShell 直接改文件时，注意别把 `\r` 当成可见字符打出来，否则会误判（例如把 `\r` 显示成 `<CR>` 后才发现原来是管道引入的）。
