# 行程助手 — AI 工作约定

通用亲子行程规划 App（M1–M4 于 2026-08-20 完成并上线）。全貌见 `设计方案.md`（含里程碑表）与 `plans/`（各里程碑实施计划）。

## 结构约定

- `行程助手.html`：唯一应用文件。**纯 CRLF**、原生 JS、无框架；Leaflet 1.9.4 走 CDN。行程数据一律不得写死进壳——只能来自 TripPack（`mountTrip(pack)` 挂载，存储 key `ta-<tripId>-*` 隔离）
- `trips/*.trip.json`：TripPack schema v1。**契约以 `tools/validate-trip.js` 为准**；改 schema 要三处同步：校验器、壳内 `validatePack`、相关测试 fixture
- `test/`：零依赖 Node 测试。`boot.js` 的 stub-DOM 启动器 `boot(htmlPath,seed)→{ctx,document,localStorage}`，**seed 值必须 JSON 编码**
- `tools/`：只用 Node 内置模块（截图脚本例外，需全局 puppeteer，`NODE_PATH=D:/npm-global/node_modules`）
- PWA 配套（`manifest.webmanifest`/`sw.js`/`icons/`/`index.html`）：增删静态文件时同步 `sw.js` 的 SHELL 列表

## 红线

- 编辑 `行程助手.html` 用内容匹配 Edit（CRLF 文件，Read 显示 LF 是正常的）
- **测试全绿才算完成**：`validate / unwrap / smoke / pipeline / pwa` 五个测试 + 两个 trip 包过校验器。mock 测不出的格式问题，真实 API 验收才算数
- DeepSeek：现役模型只有 `deepseek-v4-flash` / `deepseek-v4-pro`（`deepseek-chat` 已下线）。新调用一律走壳内 `dsJSON`/`bakeCall`（已处理 thinking 关闭、数组剥壳、模型回退），不要新造裸 fetch
- API key 只存 localStorage，绝不写进任何文件（本仓库公开）
- 这个项目不引入任何 npm 依赖

## 部署

`git push` 即发布（GitHub Pages 根目录，1–2 分钟生效）。线上 https://vincenwx.github.io/trip-planner/

## commit 风格

`feat(Mx): / fix(Mx): / test(Mx): / docs(Mx): / chore:` + 中文描述
