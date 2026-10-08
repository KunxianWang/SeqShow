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

## 视觉重做（ffang/showcase-redesign）

按用户“现有展示一般，需要更美观的”要求，在 `ffang/showcase-redesign`（基于 `ffang/showcase` 的 6da2413）重做展示页视觉；旧版保留在 `ffang/showcase` 便于对比。章节内容、播放器、案例、导出和所有测试钩子不变。

问题：原版左侧 340 px 讲解栏与多层标题、统计、说明挤占空间，1440×900 下图区仅约 310 px 高，“看见全貌”只露出 3.5 个服务；整页白底细边框，层次弱。

改动：

- 发布会式深色外框（`#0A1020`，细网格与蓝色光晕），播放器保留浅色主题，作为白色舞台占满剩余高度；桌面一屏完成。
- 五章节改为顶部进度条（当前章白底、已完成章蓝色编号）；讲解改为一条横向讲解带：标题单行、渐变强调、说明与唯一主操作。
- 服务条改为“服务雷达”：按当前步骤标出 FROM / TO / SELF / NOTE，总览清空；通过监听 `[data-status]` 变化，用 `deriveSteps` 与播放器快照计算，不改共享播放器。
- 播放控件与步骤说明合并为一行；路径标题单行、Other path 过长时截断，两个选择框对齐。
- 外框文字对比度：主文字 18.1:1、说明 12.8:1、弱文字 7.4:1、强调色 8.8:1（均在 `#0A1020` 上）；`#64748B` 不用于深色背景。

实测图区高度（chapter 2 起点）：1440×900 为 410 px（原约 310 px），1920×1080 为 608 px 且六个服务按自然宽度全部可见，1280×720 为 338 px、Next 底边 655 px；768 / 390 无全页横向溢出。

检查：

| 命令 / 操作 | 结果 |
| --- | --- |
| `npm run typecheck`、`npm run lint` | PASS |
| `npm test` | PASS，140 项 |
| `npm run test:e2e` | PASS，40 项 Chromium（showcase 套件新增服务雷达断言后单独复跑 5 项 PASS） |
| `npx playwright test tests/e2e/showcase.spec.ts --project=webkit` | PASS，5 项（含服务雷达断言） |
| `node scripts/capture-showcase.mjs` | PASS，8 个状态、全屏进入 / 退出、真实离线文件、远程请求 0 |
| `python scripts/assemble-demo.py --captures artifacts/showcase --output demo/showcase.gif --width 1040 --height 850` | PASS，8 帧，1,466,889 bytes（深色渐变使体积由 826,379 增大）；已查看 contact-sheet |

`capture-showcase.mjs` 首次运行超时：本会话环境设置了 `FORCE_COLOR=3`，Vite 给端口加了 ANSI 颜色，脚本按 `127.0.0.1:4177` 子串匹配失败。改为先用 `util.stripVTControlCharacters` 去掉控制字符再匹配；超时期间没有用旧帧冒充新素材，GIF 在新帧捕获后重新生成。

新增截图：[1280×720](showcase-1280x720.png)、[1920×1080 Focus](showcase-1920-focus.png)、[390 支付恢复](showcase-390.png)；[总览](showcase-overview.png)与[支付恢复](showcase-recovery.png)由捕获脚本更新。

## 英文界面与流程图美化

按用户要求，展示页界面（章节、说明、按钮、提示、错误、`lang`）全部改为英文；仓库文档仍为中文。

流程图改进全产品生效（编辑器、导出、展示页一致），只用 Mermaid 渲染时一次确定的配置与静态样式，切步不改几何：

- 标签折行宽度 220 → 260 px，`POST /orders + idempotency key` 等常见 API 标签不再断行；messageMargin 42、actorMargin 60、boxMargin / noteMargin 12。
- 参与者白底、600 字重、8 px 圆角、轻投影；Note 淡蓝底深蓝 600 字重；消息与 case 文字白色描边光晕，生命线浅色虚线，线条不再穿过文字。
- 试用 `rightAngles` 直角自调用：回环过扁且与标签重叠，已撤回，保留曲线。
- 字体仍为 Arial：导出文件在收件人机器上离线打开，换系统字体会导致字宽与布局不符；若要更现代的字体需内嵌字体，待用户决定。
- 代价：checkout 图宽 1524.5 → 1730（高 2086 → 1986），1440 宽下最后一个服务需图内横向滚动，服务雷达仍列出全部六个。

| 命令 / 操作 | 结果 |
| --- | --- |
| `npm run typecheck`、`npm run lint` | PASS |
| `npm test` | PASS，140 项 |
| `npm run test:e2e` | PASS，40 项 Chromium |
| `node scripts/m0.mjs --browsers=chromium,webkit` | PASS，两个引擎各 18 场景 / 27 路径 / 132 状态 / 14 负向，远程请求 0 |
| `npx playwright test tests/e2e/showcase.spec.ts --project=webkit` | PASS，5 项 |
| `node scripts/capture-showcase.mjs` + 组装 GIF | PASS，8 帧，1,534,206 bytes；已查看 contact-sheet |
| `node scripts/capture-demo.mjs` + `python scripts/assemble-demo.py` | PASS，登录动图 10 帧，713,725 bytes；`demo/login.html` 由本次真实下载的离线文件更新 |

`capture-demo.mjs` 与 `capture-showcase.mjs` 同样在 `FORCE_COLOR` 下无法识别 Vite 端口，已用 `stripVTControlCharacters` 修复。人工查看：展示页 1440×900 第 1 / 2 / 3 章、1280×720、390；编辑器登录、中文订单、校验案例。

## 剩余范围

Firefox 本轮 NOT RUN；真实 Safari / iOS、屏幕阅读器与软键盘 NOT RUN。WebKit 通过不等于这些设备通过。设计 P-1–P-4 后置；P-5 按本轮授权实现固定 base 路线，Note 配色采用淡蓝而非原提案黄色。

展示页本身需要应用静态资源，离线保证是导出的单文件。无站点部署、Release、社区发布、用户采用或 stars 验证；main 合并仍需用户当次授权。
