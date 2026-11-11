# 发布流程（ZTools 插件中心）

发布命令：`npm run publish:plugin`（= `npm run build && cd plugin && ztools publish`）。

## 前置条件（ztools publish 会校验，不满足直接失败）

- 工作区干净：先提交或处理所有未跟踪/未提交改动
- `plugin/plugin.json` 的 `version` 已按语义化版本升级
- `plugin/CHANGELOG.md` 含当前版本节（缺失会交互式录入）

## 关键约定

- **从 `plugin/` 源码根发布，不要从 `plugin/dist` 发布。** 插件中心仓库保存的是插件源码，release 由中心 CI（`.github/workflows`）构建打包；所以 `vite.config.js` / `src/` / `package.json` / `scripts/` 必须保留在官方文件夹里。只提交 dist 产物会把构建文件删掉，中心 CI 无法打包（已踩过坑）。
- 本地发布状态：OAuth token 在 `~/.config/ztools/cli-config.json`，fork 缓存克隆在 `~/.config/ztools/ZTools-plugins`，每次发布在本地 HEAD 打 `ztools-last-publish` 标签。
- 增量发布：再次 `ztools publish` 在同一个 PR 分支 fast-forward 追加 commit，PR 链接不变；中心仓库无 `plugins/<id>/` 目录 = Add，已有 = Update。
- 审核者直推过 PR 分支后推送会被拒，用 `ztools pull-contributions` 三方合并回本地。

## 本机网络故障排查（ztools publish 失败时按序核对）

本机直连 GitHub 间歇性 RST，且本地代理（127.0.0.1:7890）为唯一通道。CLI 的 API 调用走裸 `https` 模块（不吃任何代理环境变量），git 走 fork 克隆（`~/.config/ztools/ZTools-plugins`）。任一环节失败都会以「发布失败」结尾，按报错对号入座：

1. **认证报 ECONNRESET /「现有token已失效」**：后者是 CLI 把网络错误误判为 token 失效并清空 `~/.config/ztools/cli-config.json`。不要走 Device Flow（`github.com/login/device` 直连必超时）；恢复 token 后让 API 走代理：`NODE_OPTIONS='--require "$PWD/scripts/ztools-proxy-preload.cjs"' DAGU_CLI_PROXY=http://127.0.0.1:7890 npm run publish:plugin`（预注入脚本给 `https.request` 套 CONNECT 隧道，无 `DAGU_CLI_PROXY` 时完全惰性）。代理上游对 api.github.com 成簇丢包，失败就等几十秒重试。
2. **git fetch 上游报 bad pack header / could not fetch … from promisor remote**：fork 克隆是 `blob:none` partial clone，upload-pack 服务路径拿不到代理。先在克隆里回填缺失对象（需代理，注意用 `socks5h://` 由代理端解析域名，`socks5://` 本地解析会 schannel 握手失败）：`git -C ~/.config/ztools/ZTools-plugins config http.proxy socks5h://127.0.0.1:7890 && git -C … merge --ff-only upstream/main && git -C … backfill`。
3. **fetch PR 分支被拒（non-fast-forward）**：PR 分支与克隆里的跟踪 ref 分叉（同一版本重发布到不同 main 基线会造成兄弟提交）。确认 `git diff <本地ref> <远程tip> -- plugins/<id>/` 为空（内容一致）后强制对齐：`git fetch origin "+refs/heads/plugin/<分支>:refs/remotes/origin/plugin/<分支>"`。
4. **自动 sync-upstream 冲突或试图倒灌旧版**：上游 main 的插件目录落后于本地重写时，三方合并只会倒退，且 read-tree 会污染外层仓库索引（本项目 `plugin/` 不是独立仓库）。处理：`git reset` 清索引 → 把 `.git/ztools-upstream-sync.json` 的 `status` 改为 `synced`（`upstreamSha` 保持当前值）跳过本次同步，真正合并交给 PR 评审。上游再次前进后会重试同步，同样处理。

## 发布后收尾（gh 代劳网页操作）

PR 默认 draft。CLI 无法自动完成的点：

1. **截图**：PR 描述「截图/演示」嵌图，可用 fork 分支 raw URL 写进 body 前端：
   `https://raw.githubusercontent.com/<fork>/ZTools-plugins/plugin/<id>/plugins/<id>/docs/screenshots/<file>.png`
2. **自检清单**：先核实（无调试日志 / 无硬编码密钥 / diff 仅限 `plugins/<id>/`），再 `gh pr edit <n> -R ZToolsCenter/ZTools-plugins --body-file <file>`（正文先 `Write` 到临时文件再提交）。「已在本地 ZTools 客户端实测」只能作者本人确认，不要代勾。
3. **Ready for review**：`gh pr ready <n> -R ZToolsCenter/ZTools-plugins`。

## README 与截图位置

- 面向使用者的 README 放 `plugin/README.md`（随插件提交进官方仓库）。
- 界面截图唯一来源在 `plugin/docs/screenshots/`；根目录 `README.md` 用 `./plugin/docs/screenshots/...` 引用；`plugin/scripts/copy-plugin-files.mjs` 把 README 与三张界面截图复制进 `dist`（仅本地测试产物用，不发布）。
