# 复杂案例与产品展示验收

范围：`ffang/showcase` 从 main 的 `0ecb0e7` 开始；按用户“演示太简单、不够美观，希望发布会式展示”的要求实施。此记录不表示合入 main 或公开发布。

## 交付

- 第七个 checkout 示例：六个服务、全图 30 条消息 / Note、两个独立顶层 alt、四种组合，所选路径 20 / 24 步；支付拒绝后重新授权成功，才进入共同履约流程。
- 固定 Mermaid 12.1.0，base 配色对齐蓝色 UI；关闭渐变，保留 Arial、经典 SVG、几何、既有安全检查与纯播放核心。
- `showcase.html` 五章互动展示，复用 Parser / Adapter / Player / Export；真实步骤、分支、Focus、全屏、编辑器入口与下载。
- [复杂案例动图](../../demo/showcase.gif)、[真实离线文件](../../demo/checkout.html)、[90 秒讲稿](../release/showcase.md)、[总览](showcase-overview.png)和[支付恢复](showcase-recovery.png)。原有登录动图和离线样本也按新配色重新捕获。

## 实际检查

Windows，Node 22.14.0，固定锁文件，无新依赖。时间以原始报告中的 UTC 时间为准。

| 命令 / 操作 | 结果 | 实际范围 |
| --- | --- | --- |
| `npm run typecheck` | PASS | 应用、测试、Vite 配置 |
| `npm run lint` | PASS | 应用、测试与素材脚本 |
| `npm test` | PASS | 140 项，包含新增案例和恢复顺序检查 |
| `npm run test:e2e` | PASS | production build + 全套 40 项 Chromium，失败 / 跳过 / flaky 均为 0 |
| `npx playwright test tests/e2e/showcase.spec.ts --project=webkit` | PASS | 5 项展示流程、真实断网文件、编辑器入口、360 / 768 / 1280 布局；不声称完整 40 项 WebKit |
| `npx playwright test tests/e2e/editor.spec.ts --project=chromium --grep 'seven examples'` | PASS | 增加第七案例的编辑器切换覆盖后，独立复验 1 项 |
| `npm run test:m0` | PASS | Chromium：18 fixtures / 27 paths / 132 states / 14 negative，远程请求 0 |
| `node scripts/m0.mjs --browsers=webkit` | PASS（独立重跑） | WebKit：18 fixtures / 27 paths / 132 states / 14 negative，远程请求 0；首次在 file:// repeated fixture 等待 load 超时，原始失败记录保留 |
| `node scripts/capture-showcase.mjs` | PASS | 8 个真实状态、全屏进入 / 退出、真正下载的 HTML 在新 context 断网播放并切路径；页面错误和远程请求 0 |
| `python scripts/assemble-demo.py --captures artifacts/showcase --output demo/showcase.gif --width 1040 --height 850` | PASS | 8 帧，20 秒，826,379 bytes；已查看编码后的 contact-sheet |
| `node scripts/capture-demo.mjs` + `python scripts/assemble-demo.py` | PASS | 登录素材同步新配色，10 帧 / 17.4 秒；真实离线文件远程请求 0 |

原始报告：`artifacts/showcase/chromium-e2e.json`、`webkit-e2e.json`、`m0-chromium.json`、`m0-webkit.json`；首次 WebKit 超时单独保留在 `m0-webkit-first-attempt.json`。这些本地产物目录由 .gitignore 忽略，不作为远程可下载链接；仓库保留本记录、[检查摘要](showcase-report.json)与下面的截图。

主题首次切为 base 时，Mermaid 的默认渐变样式产生不存在的 `#seqshow_1-gradient` 引用，现有安全检查正确拒绝。已在主题配置中禁用 useGradient，没有放宽安全边界；上述通过均来自修复后的代码。全屏捕获等待 Fullscreen API 完成后再断言。

## 已查看的实际效果

- Chromium：桌面总览 / 自调用 / 支付恢复 / Focus 开关 / 已发货 / 离线文件，1440×1080；另看 1440×900、1280×720、768×844、360×844。桌面播放按钮可见，手机控件可操作，无全页横向溢出。
- SVG 保留自然宽度；长图使用内部滚动，当前步骤自动定位。不会把六个服务全部缩到一张小图里；服务概览条和步骤端点维持上下文。
- 两条支付路径切换和 Focus 对比的 SVG viewBox / shape bbox 未改变；导出保留两个所选分支，总览暂停开始，延迟履约路径实际播放到对应消息。
- GIF 是选定状态的截图动画；产品未新增视频或 GIF 导出。

## 剩余范围

Firefox 本轮 NOT RUN；真实 Safari / iOS、屏幕阅读器与软键盘 NOT RUN。WebKit 通过不等于这些设备通过。设计 P-1–P-4 后置；P-5 按本轮授权实现固定 base 路线，Note 配色采用淡蓝而非原提案黄色。

展示页本身需要应用静态资源，离线保证是导出的单文件。无站点部署、Release、社区发布、用户采用或 stars 验证；main 合并仍需用户当次授权。
