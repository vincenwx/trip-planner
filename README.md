# 行程助手

亲子行程规划助手：**行前 AI 自动规划，行中随身助手**。单文件 HTML 应用，手机可添加到主屏幕当 App 用（PWA，离线可开）。

线上版：https://vincenwx.github.io/trip-planner/

## 功能

- **行前规划**：告诉它目的地、天数、孩子年龄、交通方式（自驾/高铁/飞机/混合），AI 自动产出完整行程——逐天安排、沿途点位、给孩子看的讲解（背景故事/看点/冷知识/想一想）、预约提醒、天气决策、机动备选方案。生成后自动验证每个地点的真实性与坐标，拿不准的交你拍板
- **行中使用**：行程时间轴打卡、真实道路地图（自驾段）、文史地雷达（附近 100km 有什么值得看）、AI 现场讲解、天气与方案建议、临时改行程（大白话说一句就换方案，随时还原）
- 多行程管理：行程库存储、导出/导入数据包换设备

## 快速开始

1. 打开线上版，或下载本仓库后双击 `行程助手.html`
2. 首次使用粘贴一次 DeepSeek API Key（只存在本机浏览器 localStorage，不进任何文件）
3. 点「新建行程」跟向导走；或点「导入行程包」加载示例 `trips/sanxia.trip.json`（长江三峡·成都亲子自驾 16 天）

## 仓库结构

| 路径 | 说明 |
|---|---|
| `行程助手.html` | 全部功能（引擎 + 规划器 + UI），单文件 |
| `trips/*.trip.json` | 行程数据包（TripPack schema v1） |
| `tools/` | TripPack 校验器、三峡数据提取脚本、puppeteer 截图验收脚本 |
| `test/` | 零依赖 Node 测试（stub-DOM，无 npm 包） |
| `设计方案.md`、`plans/` | 设计方案与 M1–M4 实施计划 |
| `manifest.webmanifest`、`sw.js`、`icons/`、`index.html` | PWA 与 GitHub Pages 配套 |

## 开发

```bash
node test/validate.test.js      # TripPack 校验器
node test/smoke.test.js         # 壳全量冒烟（stub-DOM）
node test/pipeline.test.js      # 规划流水线（mock DeepSeek）
node test/unwrap.test.js        # JSON 剥壳
node test/pwa.test.js           # PWA 配套
node tools/validate-trip.js trips/sanxia.trip.json   # 校验行程包

# 真浏览器截图验收（需全局 puppeteer）：
NODE_PATH=D:/npm-global/node_modules node tools/shot.js
```

部署：`git push` 即发布（GitHub Pages，根目录，1–2 分钟生效）。
