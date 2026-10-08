# M5 后修复联合复核与合并

日期：2026-10-07（America/Los_Angeles；原始报告使用 UTC）。用户明确要求“gpt6做了一次核查，你看一下，没问题就合并”，授权本次通过复核后合入 main；不作为后续合并或公开发布的授权。

## 范围与结论

复核基线为 GPT-6 的 `kxw/m5-code-review`，提交 `f49d7172fd9d41e066560b3eaf307d9931edd2b8`。该分支包含 M4 `4cd6b42`、M5 `16fb6e1`、U0 素材 `b24b6a2`；目标 main 原为 `340110d`。本轮在 `ffang/m5-review-integration` 整理合并证据，保留既有提交历史。

代码复核没有发现阻碍合并的问题，两处修复与现有模块边界一致：

- SVG 自然宽度由集中适配层写入 min-width，避免 20 个参与者被压缩成不可读小字。该样式随 SVG 导出，页面和离线文件共用；未放宽 SVG 安全校验。
- 播放器按当前步骤全部绑定元素的几何范围定位，过高的消息优先显示底部箭头。仍只滚动图内，不重新布局，也不在播放器依赖 Mermaid 的 class 或 DOM 顺序。空路径没有当前步骤，不进入定位逻辑。

新增三项浏览器回归直接验证文字尺寸、可见箭头、页面位置与 viewBox，且实际下载后在新上下文用 file:// 检查。原始问题、修复和 GPT-6 的检查见 [审核记录](REVIEW-M5-2026-10-07.md)，历史 M5 数量保留，不改写成新结果。

## 独立复验

应用源码保持 `f49d717`，无依赖更新。Windows 使用 Node 22.14.0、Mermaid 12.1.0、Playwright 1.63.0；Linux Firefox 使用 WSL Ubuntu 24.04、同版本 Node、同一 lockfile 与本地中文字体。Linux 副本更新了本次两处源码及新增测试，源码经过 cmp 核对并重新生产构建。

| 实际命令 | 结果 | 本地原始证据 |
| --- | --- | --- |
| `npm run typecheck`、`npm run lint` | PASS | 本轮终端输出 |
| Vitest 非 watch 运行并输出 JSON | PASS，138 项单元/集成 | `artifacts/review-m5-integration/unit.json` |
| `npm run test:e2e`（包含 production build） | PASS，Windows Chromium 全部 33 项，失败/跳过/flaky 均为 0 | `chromium.log`、`chromium-e2e.json` |
| Linux `npm run build`；Firefox 重点用例 | PASS，9 项，失败/跳过/flaky 均为 0 | `linux-build.log`、`firefox.log`、`firefox-e2e.json` |
| Windows WebKit 重点用例 | PASS，9 项，失败/跳过/flaky 均为 0 | `webkit-e2e.json` |
| `npm run test:m0` | PASS，Chromium 18 场景 / 27 路径 / 132 状态 / 14 负向；离线远程请求 0 | `m0.log`、`m0-report.json` |
| `node scripts/capture-demo.mjs`；`python scripts/assemble-demo.py` | PASS，10 个真实状态；新上下文离线远程请求 0，编码后全部帧已查看 | `artifacts/launch/frames.json`、`contact-sheet.png` |
| `git diff --check`；本轮修改文档的本地链接检查 | PASS | 本轮终端输出 |

表中未写完整路径的原始报告均位于忽略目录 `artifacts/review-m5-integration/`；版本化的摘要见 [JSON](review-m5-merge-report.json)。

Firefox/WebKit 的九项选择范围相同：新增宽图两种宽度、长消息定位、基础生产播放与离线下载、键盘隔离、390px 中文布局、登录导出动作对照、四项输入上限。复现命令（先生产构建）：

```sh
npx playwright test --project=webkit --grep 'wide diagrams|wrapped message|production preview|downloaded production|E07 keyboard|E08 Chinese layout at 390px|E11/E12 login export|all four limits'
```

Firefox 在已安装系统依赖和中文字体的 Linux 环境把 project 改为 firefox；本机实际执行脚本为 `artifacts/review-m5-integration/linux-test.sh`。本轮没有执行 Firefox/WebKit 全部 33 项，也没有把 M5 的 Linux Firefox 30 项历史结果计入本次九项。

## 素材与限制

已查看 GPT-6 的 390px 宽图和长消息定位截图；本轮重新捕获最终生产代码并检查 GIF 编码后的全部十帧。登录场景的 GIF 与原提交字节一致，修复不改变该场景的可见状态；离线登录示例已由 GPT-6 用最终播放器更新，本轮再次核对其内联运行包与最终 dist/export-player.js 完全一致。

Windows Firefox 仍有已记录的 mozglue 启动限制，本轮通过的是 Linux Firefox。WebKit 的 file:// 检查拒绝远程请求，不冒充 setOffline 或真实 Safari/iOS 设备验证。Mermaid 现有大 chunk 提示保留。公开站点、Release、社区发布和真实用户采用均未执行。

## 本次合并

本次合入范围为上述累计提交及此复核文档，使用 `ffang/m5-review-integration` 合入 main；不改写历史、不 force push。后续实现继续使用 ffang 前缀分支，每次合并仍需取得当次明确批准。公开发布和采用验证继续按 [U0](../exec-plans/active/u0.md) 推进。
