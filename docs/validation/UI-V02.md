# UI v0.2 视觉实现记录

日期：2026-10-07。结果：已实现部分 PASS；Firefox 与 §9.3 新增提案 NOT RUN。

工作分支：ffang/ui-design，基于 main 的 51cae2e，仅本地提交，未推送、未合并。设计依据见 [design/README.md](../../design/README.md)。

## 范围

实现设计 §9.1（沿用）与 §9.2（视觉调整），不改变 Parser、Playback、导出数据与安全边界：

- 设计 token、Web 外壳与共享播放器样式重写（`src/styles.css`、`src/player.css`）；导出文件嵌入同一套样式。
- 预览区改为：状态提示 → 路径选择 + Focus 开关 → 图 → 讲解栏（类型、端点、`k / N` 与当前文本、播放控件）。
- 当前步骤：线条加粗变蓝、文字变蓝、步骤左侧显示路径内步号徽标；Note 改为蓝边浅蓝底；活跃参与者蓝边浅蓝底。
- 未选 case：区域斜纹底；文字、线条转浅色；Note 虚线边。
- 图外端点显示参与者标签（`API → Browser`、`Over Browser, API`），并显示 Message / Self call / Note 类型。
- stale / error 时旧图转灰度并标注 Last successful render；源码区增加状态徽章；错误诊断改为卡片样式。
- 窄屏播放控件加大到 44 px，Previous / Next / Reset 只显示图标（保留可访问名称）。
- 图区最大高度随视口高度变化，1280×720 及以上桌面视口无需滚动页面即可看到播放控件。

未实现，等待确认：设计 §9.3 的 P-1 行号、P-2 字符计数、P-3 进度条、P-4 窄屏讲解栏吸底、P-5 Mermaid 主题对齐。

## 实现约束

- 步号徽标与 case 斜纹绘制在 SVG 之外的 HTML 叠层，SVG 内只改颜色和线宽，不改字重或字形，因此 `getBBox` 几何在 Web、导出和切步之间保持一致。
- 适配层新增 `data-seq-shape`（步骤主图形）、`data-seq-frame` / `data-seq-divider`（alt 框线与分隔线）属性，只加属性，不改几何；播放器只读取这些 `data-seq-*` 标记，Mermaid 结构假设仍集中在适配层。
- 导出包体检查禁止任何 URL 字面量，图标的 SVG 命名空间改为运行时取自图本身。select 箭头改用 CSS 渐变，避免导出 CSP（`img-src 'none'`）拦截 `data:` 图片。
- 与样稿相比去掉了图内 OTHER PATH 标签：Mermaid 居中绘制 case 标题，窄 alt 框中标签会与标题重叠；该含义由斜纹底和路径选择器旁的 “Other path: …” 提供。

## 测试改动

- E01 / E04 增加步骤类型与步号徽标断言；E04 与中文离线 E12 的端点文本改为参与者标签。
- M0 harness 与 export.spec 的快照取图从 `root.querySelector('svg')` 改为 `[data-diagram] svg`：播放器按钮现在带图标，“播放器内第一个 SVG 就是图”的假设不再成立。

## 实际运行

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS，138 项 |
| `npm run test:e2e`（build + Chromium production） | PASS，33 项 |
| `npx playwright test --project=webkit --grep "production preview\|downloaded production\|E07 keyboard\|E08 Chinese layout at 390px\|E11/E12 login export\|all four limits"` | PASS，6 项（与 M5 相同的 WebKit 重点集） |
| `npm run test:m0` | PASS，Chromium 18 场景 / 27 路径 / 132 状态 / 14 负向，远程请求 0 |
| `node scripts/m0.mjs --browsers=webkit` | PASS，WebKit 18 场景 / 27 路径 / 132 状态 / 14 负向，远程请求 0 |

首轮运行发现并已修复：离线播放包因 SVG 命名空间字面量触发 URL 检查；1280×720 下播放控件低于首屏导致滚动测试失败（改为按视口高度限制图区）；M0 harness 取到按钮图标而非图。

Firefox 未运行：本机未安装 Playwright Firefox（M5 的 Firefox 结果来自 Linux）。

## 复查修复：长文本与多分支

用户复查发现两处首屏问题：450 字中文消息把讲解栏撑高，桌面 Next 落到首屏之外、手机讲解栏约 788 px；10 个 alt 时路径选择占满高度预算，挤出播放控件。原因是图区按固定的视口预算计算高度，没有考虑讲解栏与路径栏的实际内容。

修复：

- 桌面 Web 预览区（≥ 960 px）与导出面板（≥ 600 px）改为高度不超过视口的纵向 flex，只有图区收缩（最小 140 px、最大 720 px）。
- 路径栏最多两行，视口高度 ≤ 820 px 时一行，超出部分在内部滚动并以底部阴影提示。
- 步骤文本最多两行（高视口三行、手机四行），端点行最多两行，超出部分在内部滚动。完整文本仍在 `[data-status]` 中；只有真正溢出的区域才设 `tabindex=0`，状态 span 跨步骤复用，播放时焦点不丢失。
- 键盘提示缩短为 `← → step · Space play / pause · Home reset`。

新增回归（先在旧实现上运行确认失败，修复后通过）：

- `long step text and ten alt blocks keep desktop controls on the first screen`（Web，1280×720 与 390×844）
- `exported long step text and ten alt blocks keep controls on the first screen`（离线导出）

实测（同一组 450 字 + 10 alt 输入）：1280×720 时 Next 底边 625 px；1440×900 时 836 px；390×844 时讲解栏高 204 px；正常登录例 1280×800 不变。修复后 `npm run test:e2e` 为 35 项 Chromium 通过（含上述 2 项），Vitest 138 项、typecheck、lint 通过；WebKit 重点集加上述 2 项共 8 项通过；`node scripts/m0.mjs --browsers=chromium,webkit` 两个引擎各 18 场景 / 27 路径 / 132 状态 / 14 负向通过，远程请求 0。截图：[1280×720](ui-v02-crowded-1280x720.png)、[390](ui-v02-crowded-390.png)。

窄屏（< 960 px Web）为编辑器在上、预览在下的单列，本来就不承诺首屏可见播放控件；手机上路径栏不加滚动框，10 个 alt 时需滚动页面到达控件。

## 人工看图

在 production preview 与离线导出文件中截图检查（页面横向溢出均为 0，页面错误与控制台错误为 0）：

- [1280 自调用当前步](ui-v02-1280-self-call.png)
- [1280 失败路径第 5 步，成功 case 斜纹](ui-v02-1280-other-path.png)
- [1280 两个 alt 独立选择](ui-v02-1280-two-alts.png)
- [1280 错误：保留旧图、灰度与诊断卡片](ui-v02-1280-error.png)
- [390 Note 当前步](ui-v02-390-note.png)
- [离线导出 1280](ui-v02-export-offline-1280.png)

人工检查中修正：OTHER PATH 标签与 case 标题重叠（移除）、窄屏 Note 端点逗号前多出空隙、键盘提示文案过长。

已知观察：Mermaid 默认主题仍为紫色参与者框与生命线，与 UI 蓝色强调并存（P-5 待定）。箭头头部颜色使用 `context-stroke` 渐进增强，不支持的浏览器保持 Mermaid 默认深色箭头。屏幕阅读器实际朗读未测试。
