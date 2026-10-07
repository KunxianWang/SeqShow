# SeqShow

Present Mermaid sequence diagrams, step by step.

把已有 Mermaid 时序图转换为可以逐步讲解、选择分支、聚焦并离线分享的技术演示。

**当前状态：M0–M2 已完成。** 受限 Mermaid Parser、源位置诊断、引用/限额检查与纯播放状态已实现。Vite 原型现在从真实 Mermaid 源码生成登录演示并下载独立 HTML；可编辑源码、Render 和错误恢复将在 M3 接入，当前尚不是完整 MVP。

## 开发与生产预览

使用 Node 22（>=22.13）、Node 24 或 Node >=26，以及 npm。实测 Node 22.14.0 / npm 10.9.2；所有依赖固定在 package-lock.json。

```sh
npm ci
npm run dev
```

开发地址：http://127.0.0.1:5173。生产预览：

```sh
npm run build
npm run preview
```

预览地址：http://127.0.0.1:4173。端口采用严格模式，启动前先停止旧预览。开发与 production 均从共享源码生成内联播放器；修改播放器后，页面和导出运行包一起更新。生产构建输出 dist/ 静态文件与独立的 dist/export-player.js。

## 检查

```sh
npx playwright install chromium
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

npm test 为非 watch 的 Vitest 检查。test:e2e 先构建 production，再在隔离的 4174 预览上执行 Chromium 基础检查；尚未覆盖完整 E01–E12。Firefox/WebKit 项目仍保留：

```sh
npx playwright install firefox webkit
npm run build
npx playwright test --project=webkit
npx playwright test --project=firefox
```

Windows WebKit 的 production 登录页与下载文件检查已通过，离线文件使用远程请求拦截。Firefox 测试浏览器在本机无法启动，未验证。M2 扩展场景、版本、截图与限制见 [M2 验证](docs/validation/M2.md)。

## M0 验证页面

验证器保留 M0 场景并加入 M2 的真实解析场景，使用同一套已安装依赖：

```sh
npm run m0:preview
npm run test:m0
```

M0 页面也使用 4173，不能和生产预览同时启动。可选择 fixture、播放所选路径、切换 Focus 和下载 HTML，暂不接受用户 Mermaid 输入。

当前检查覆盖 16 个 fixture、24 条路径、119 个状态，包含不等长/空分支、特殊参与者 ID、语义绑定、稳定布局、计时器清理，以及在全新 Chromium 上下文中用 file:// 打开真实离线文件。HTML、截图与报告生成在 artifacts/m0/。

可选扩展命令：`node scripts/m0.mjs --browsers=chromium,webkit`（PowerShell 中给参数加引号）。具体浏览器差异见 [M0 记录](docs/validation/M0.md)；它不代表发布兼容性认证。

## 项目文档

| 文档 | 职责 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 仓库规则、导航与开发流程 |
| [产品定义](docs/PRODUCT.md) | 用户、MVP 范围、语法与完成标准 |
| [技术架构](docs/ARCHITECTURE.md) | Parser、模型、播放、渲染与导出边界 |
| [交互设计](docs/DESIGN.md) | 编辑器、预览、Focus、控件与错误状态 |
| [测试策略](docs/TESTING.md) | 单元、集成、浏览器与离线验收 |
| [MVP 执行计划](docs/exec-plans/active/mvp.md) | 里程碑、决策、进度与验证记录 |
| [M0 验证](docs/validation/M0.md) | 渲染/离线证明、截图与浏览器限制 |
| [M1 验证](docs/validation/M1.md) | 工具链、清洁安装与 production 证据 |
| [M2 验证](docs/validation/M2.md) | 子集解析、纯状态、双浏览器与真实离线文件 |
| [项目调研](docs/research/2026-10-06-github-project-opportunities.md) | 项目方向与竞品快照 |

MVP 目标是浏览器应用、一种默认主题、单层 alt/else、稳定布局、Focus 和独立 HTML 导出。CLI、Agent skill、AI 生成、云分享与视频导出后置。

## 开发流程

初始文档在 main。后续更新使用 ffang 开头的分支；ffang/m2-parser-playback 从尚未合并的 M1 分支继续开发，包含 M0/M1 历史。每次合并均须仓库所有者明确批准。

## 许可证

[MIT](LICENSE)，copyright 2026 Kunxian Wang。
