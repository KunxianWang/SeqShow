# UI v0.2 合并与当前进度

日期：2026-10-07。用户明确授权“合并回main并汇报一下当前进度，详细汇报”。本次由 `ffang/ui-design` 合入 main，保留原历史；公开部署、Release、发帖和联系用户尚未执行。

## 本次范围

main 合并前为 `51cae2e`。累计应用变更为设计提案 `30fdc12`、UI 实现 `5543be0`、长正文 / 十个 alt 布局修复 `d4ad48fc7c1c2658efd77fe3e1eeb25decacc62c`，加上本次文档同步和演示素材更新。素材更新不改变应用源码。

界面已接入真实 Parser、Playback、Mermaid SVG 与离线下载：Web 外壳、状态徽章、Focus 开关、路径选择、讲解栏、步号徽标、斜纹和错误卡片已完成。长正文、端点和桌面路径区域限制高度并可内部滚动，完整内容保留。图不重新布局，Web / 导出复用同一播放逻辑。

## 独立复验与证据

合并复用紧邻本次授权、针对 d4ad48f 执行的独立复验；已核对 HEAD 和远端，无应用源码新增变化，不重复运行同一完整检查。

| 实际检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm run typecheck`、`npm run lint`、`npm test` | PASS，138 项单元 / 集成 | 独立复验终端输出 |
| `npm run test:e2e`（production build + Chromium） | PASS，35 项；失败、跳过、flaky 均 0 | `artifacts/ui-v02-fix-review/chromium-e2e.json` |
| `npx playwright test --project=webkit --grep 'long step text and ten alt blocks'` | PASS，2 项 Web / 实际下载离线回归；失败、跳过、flaky 均 0 | `artifacts/ui-v02-fix-review/webkit-e2e.json` |
| 独立生产测量：长消息、多 alt、390px、真实下载后断网打开 | PASS，1280×720 的 Next 底边约 625px；手机长消息讲解栏约 204px；页面横向溢出 0 | `artifacts/ui-v02-fix-review/measurements.json` |
| `node scripts/capture-demo.mjs`、`python scripts/assemble-demo.py` | PASS，10 个真实状态 / 17.4 秒，独立上下文离线远程请求 0；编码后全部帧已查看 | `artifacts/launch/frames.json`、`contact-sheet.png` |
| demo/login.html 内联运行包与 dist/export-player.js 比对；修改文档本地链接、`git diff --check` | PASS | 本次终端输出 |

版本化摘要见 [JSON](ui-v02-merge-report.json)。实现者的 8 项 WebKit、两引擎 M0 和历史 UI 检查保留在 [实现记录](UI-V02.md)，不把它们算成本次独立重跑；独立完整 Chromium 35 项已包含新布局、旧宽图 / 箭头、编辑恢复和导出安全检查。

## 素材同步

- demo/seqshow.gif 已替换为当前 UI，10 帧，17.4 秒，668,118 字节。
- demo/login.html 来自当前生产页面的真实下载；失败路径、初始总览 / 暂停，允许改选和离线播放。
- README 静态截图入口切换至本次捕获的 [失败路径播放器](ui-v02-merged-failure-player.png)，并更新 Chromium 当前检查数量为 35。
- AGENTS、设计提案、U0、发布草稿与完成计划同步当前状态；历史验证报告与原截图不改写。

## 当前阶段与剩余项

M0–M5 技术 MVP 与 UI v0.2 已完成；公开发布前素材已准备。用户可在本地运行应用并使用真实独立 HTML。公开演示站点、GitHub Release、真实用户采用 / 再次使用、访问与 stars 尚未验证，100 stars 仍是传播目标。

设计增补 P-1 行号、P-2 行数 / 字符计数、P-3 分段进度条、P-4 手机讲解栏吸底、P-5 Mermaid 主题颜色对齐未实现；样稿中的这些内容不代表正式应用已经具备。

新版 UI 尚未复验 Firefox，M5 的 Linux Firefox 结果是历史结果；Windows Firefox 已知 mozglue 启动问题仍在。Playwright WebKit 不等于真实 Safari / iOS，真实设备、软键盘和屏幕阅读器朗读未验证。手机 Web 单列需要滚动到预览，不承诺初始首屏即可看到全部控件。Mermaid 大 chunk 提示及浏览器刷新后草稿不持久保存仍如实保留。

后续实施继续用 ffang 前缀分支，每次合并须当次明确批准；公开入口与真实使用验证按 [U0](../exec-plans/active/u0.md) 推进。
