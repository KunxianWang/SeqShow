# SeqShow UI 设计提案 v0.2

状态：§9.1 / §9.2 **已实现、复验并按当次用户授权合入 main**（见 [实现记录](../docs/validation/UI-V02.md)与[合并记录](../docs/validation/UI-V02-MERGE.md)）。本轮按用户美观与展示要求，在工作分支实施 P-5 的 base 主题路线与独立发布会式互动页；P-1–P-4 未实现。新展示见 [讲稿](../docs/release/showcase.md)，最新检查见 [展示验收](../docs/validation/SHOWCASE.md)。

实现与样稿的差异：图内 OTHER PATH 标签已去掉（窄 alt 框中会与 Mermaid 居中的 case 标题重叠），改由斜纹底与路径选择器旁的 “Other path: …” 表达；当前步骤文字只变色、不加粗（加粗会改变 SVG 文本几何，违反"切步不改布局"）；图区高度按视口计算，保证 1280×720 以上桌面不滚动页面即可看到播放控件。本轮将 Mermaid 改为受控 base 主题，Note 采用蓝底而非样稿黄底；字体、几何与共享播放语义保留。

本目录给出 SeqShow Web 编辑器与离线导出播放器的视觉与布局设计。它在 [DESIGN](../docs/DESIGN.md) 的交互基线内重新组织视觉层次，不改变 [PRODUCT](../docs/PRODUCT.md) 的范围、步骤语义和 DoD。少数超出现有文档的细节单列在 §9.3，需确认后才能同步到 DESIGN / TESTING 并实现。

## 1. 文件

| 文件 | 内容 |
| --- | --- |
| `mockup.html` | 可交互高保真样稿：登录示例可逐步播放，可切换视口、状态与导出视图 |
| `tokens.css` | 设计 token（颜色、字体、间距、圆角、阴影、动效），样稿直接引用 |
| `screenshots/` | 样稿在 1280 / 768 / 390 px 下的真实截图 |

## 2. 如何查看

直接双击 `design/mockup.html`（file:// 即可，无网络请求、无网络字体、无构建）。顶部深色条是**评审工具栏，不属于产品界面**：

- Viewport：Fluid / 1280 / 768 / 390。样稿用 container query 模拟断点，真实实现改为同阈值的 `@media`。
- State：Ready / Source changed / Error / Rendering。
- Surface：Web app / Exported file。
- Replace dialog：查看替换草稿的确认框。

样稿只手绘了登录示例的 SVG，切换其他案例只会替换源码文本，不会重画图。点击预览区后可用 ← → Space Home 操作；在源码中加入 `opt` 行再点 Render 会进入错误状态。

## 3. 设计目标

1. **讲解者先看到"现在讲到哪"**。当前步骤在图内有颜色、线宽、编号徽标三重标记；图下的 Presenter dock 用大号计数和完整文本复述当前步骤。
2. **路径语义比装饰更重要**。未选 case 用斜纹底和 `OTHER PATH` 标签表示，不只是变淡；"条件未求值"的说明始终紧贴路径选择器。
3. **状态一眼可辨**。Rendered / Source changed / Error / Rendering 在源码区徽章、预览区横幅和图上标签三处一致；旧图降为灰度并标注 Last successful render，不会被误认为新结果。
4. **克制**。单一浅色主题、系统字体、无粒子和飞行动画；动效只用于颜色和开关的 160 ms 过渡，减少动画时全部关闭。
5. **Web 与导出同一套播放器外观**。导出文件只去掉编辑器、Export 按钮和状态横幅。

## 4. 视觉基础

### 4.1 颜色与对比度

对比度按 WCAG 2.x 相对亮度公式计算（[tokens.css](tokens.css) 注释中同样标注）。

| Token | 值 | 用途 | 对比度 |
| --- | --- | --- | --- |
| `--ss-bg` | #F8FAFC | 页面背景、编辑器底色 | — |
| `--ss-surface` | #FFFFFF | 面板 | — |
| `--ss-text` | #0F172A | 主文字 | 17.85:1（白底） |
| `--ss-text-2` | #475569 | 次要文字 | 7.58:1 |
| `--ss-text-3` | #64748B | 最弱文字，仅元信息 | 4.76:1（白）/ 4.55:1（#F8FAFC） |
| `--ss-accent` | #2563EB | 主按钮、当前步骤、焦点环 | 5.17:1；白字在其上 5.17:1 |
| `--ss-accent-strong` | #1D4ED8 | 链接、当前步骤文字 | 6.70:1；在 accent-soft 上 6.16:1 |
| `--ss-info` | #1E40AF | 信息横幅文字 | 8.01:1（#EFF6FF） |
| `--ss-warning` | #9A3412 | Source changed | 6.88:1（#FFF7ED） |
| `--ss-danger` | #B91C1C | 错误 | 5.91:1（#FEF2F2） |
| `--ss-success` | #15803D | Rendered | 4.79:1（#F0FDF4） |

图内线条（非文字图形按 3:1 要求）：

| Token | 值 | 状态 | 对比度 |
| --- | --- | --- | --- |
| `--ss-d-line` | #334155 | 正常（总览或 Focus 关） | 10.35:1 |
| `--ss-d-current` | #2563EB | 当前步骤 | 5.17:1 |
| `--ss-d-past` | #475569 | 已讲 | 7.58:1 |
| `--ss-d-future` | #8796AC | 未讲（所选路径） | 3.00:1 |
| `--ss-d-inactive` | #B4C0D0 | 未选 case | 1.84:1，**有意低于 3:1**；靠斜纹底与 OTHER PATH 标签表达，文字仍为 #64748B（4.76:1） |

DESIGN §8 的建议值（#F8FAFC、#0F172A、#475569、#2563EB、#B91C1C）全部保留。

### 4.2 字体

- UI：`system-ui, -apple-system, "Segoe UI", Roboto, …, "PingFang SC", "Microsoft YaHei", sans-serif`，不下载网络字体。
- 代码：`ui-monospace, "Cascadia Mono", Consolas, "SF Mono", Menlo, monospace`。
- 图内：保持 `Arial, sans-serif`，与 `mermaid-adapter.ts` 当前的 `fontFamily` 一致。改字体会改变 Mermaid 的文本测量与布局，必须复验 fixture。
- 字号：12 / 13 / 14 / 15（正文）/ 18 / 22；当前步骤计数 28（窄屏 22）。

### 4.3 间距、形状、动效

- 4 px 网格：4 / 8 / 12 / 16 / 20 / 24 / 32。面板内距 20（窄屏 16），栏间距 20。
- 圆角：控件 6、卡片 8、面板 12、徽章胶囊。
- 控件高度：桌面 36 px，< 600 px 为 44 px 触控尺寸。
- 焦点：2 px `--ss-accent` 实线，偏移 2 px（播放器区域偏移 3 px）。
- 动效：160 ms `cubic-bezier(.2,0,0,1)`，仅用于颜色、线宽和开关滑块；`prefers-reduced-motion` 时为 0，Rendering 图标停止旋转，图内滚动为 instant。

## 5. 布局

### 5.1 桌面 ≥ 960 px（编辑 36% / 预览 64%，编辑最小 280 px）

```text
┌──────────────────────────────────────────────────────────────────────┐
│ [■] SeqShow │ Turn sequence diagrams into …                GitHub ↗ │
├──────────────────────────┬───────────────────────────────────────────┤
│ Source          ● Rendered│ Preview                     [⤓ Export HTML]│
│ Example  [Login ▾]        │ ✓ Ready to present · choose a path …      │
│ Mermaid source  15 lines… │ PATH 1 · alt        Other path: unauth.   │
│ ┌──┬───────────────────┐ │ [authenticated ▾]                  (●Focus)│
│ │ 1│sequenceDiagram     │ │ ⓘ This is a presentation path; …          │
│ │ 2│  actor U as …      │ │ ┌───────────────────────────────────────┐ │
│ │ …│                    │ │ │  图舞台（内部滚动，最高 720 px）      │ │
│ └──┴───────────────────┘ │ │  当前步骤：蓝色粗线 + 编号徽标         │ │
│ [Render]  Rendered        │ └───────────────────────────────────────┘ │
│ ┌ 诊断卡片（错误时）────┐ │ ┌ Presenter dock ───────────────────────┐ │
│ › Supported syntax        │ │ 4 / 6 │ SELF CALL  API → API           │ │
│ › Unsupported syntax      │ │       │ Verify password                │ │
│ 🔒 Processed in browser…  │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░░░░░░         │ │
│                           │ │ [‹ Previous][▶ Play][Next ›] ⟲ Reset  ←→│ │
│                           │ └───────────────────────────────────────┘ │
└──────────────────────────┴───────────────────────────────────────────┘
```

DESIGN §2 的线框把路径/Focus 放在图上方、步骤说明与播放控件放在图下方。本设计沿用这个顺序（当前实现把控件放在图上方）。舞台限高并在内部滚动，所以桌面上 dock 始终在首屏内。

### 5.2 平板 600–959 px

单列：编辑器在上（高 340 px），预览在下。路径选择与 Focus 同行，宽图在舞台内部横向滚动。

### 5.3 手机 < 600 px（验收宽度 360 / 390）

- App bar 中标语换到第二行。
- 控件 44 px 高；Previous / Next / Reset 只显示图标（保留 `aria-label`），Play 显示文字并占双倍宽度。
- 隐藏键盘提示。
- Presenter dock 设为 `position: sticky; bottom: 0`，滚动时计数、文本和播放控件仍可见（§9.3 提案 P-4）。
- 图保持自然宽度（≥ 720 px），只在舞台内部横向滚动，页面本身无横向溢出（样稿截图实测溢出 0 px）。

## 6. 组件规格

| 组件 | 规格 | 对应 DESIGN |
| --- | --- | --- |
| App bar | 28 px 标志 + SeqShow（18/700）+ 竖线分隔的标语 + 右侧 GitHub ↗ 文字链接；高 64 px | §1 只保留名称、用途、GitHub |
| 状态徽章 | 源码区标题右侧胶囊：● Rendered（绿）/ Source changed（橙）/ Error（红）/ Rendering（蓝） | §3 Source changed |
| 源码编辑器 | 原生 textarea + 只读行号栏（`aria-hidden`，与 textarea 同步滚动）；可纵向拉伸；右上角显示行数与 UTF-16 长度 / 50,000 | §3 原生 textarea；P-1、P-2 |
| Render | 主按钮；busy 时文案 Rendering… 并禁用；首次加载为 Preparing example…，首次失败为 Retry | §6、§7 |
| 诊断卡片 | 左侧 4 px 红条；标题区分 Unsupported syntax / Syntax error + 行列；引用原语句并波浪线标出问题词；修复提示；"Go to line N" 定位源码 | §7 |
| 语法说明 | 两个 `<details>`，自绘箭头，内容不变 | §3 |
| 隐私说明 | 灰底小卡片 + 锁图标 | §3 |
| 状态横幅 | 图标 + 一句话，颜色随状态变化，`role="status"` | §7 |
| 路径选择器 | 每个 alt 一个原生 select；上方一行"PATH n · alt"与"Other path: …"；下方常驻"conditions are not evaluated" | §5 |
| Focus 开关 | 胶囊按钮内含滑块，仍是 `button[aria-pressed]` | §4、§6 |
| 图舞台 | 白底 1 px 边框，内部双向滚动，限高 `clamp(420px, 70vh, 720px)`（窄屏 420）；stale / error 时图转灰度 60% 不透明并在左上角标注 Last successful render；busy 时 35% 不透明 + Rendering… | §4、§7 |
| Presenter dock | 左：大号 `k / N`；右：类型胶囊（MESSAGE / SELF CALL / NOTE / OVERVIEW）+ 端点芯片（`API → Browser` 或 `Over Browser, API`）+ 完整文本（18/600，任意断行）；下：分段进度条；最下：播放控件 + 键盘提示 | §4 图外说明、§6 |
| 分段进度条 | 每步一段：已讲灰、当前蓝、未讲浅灰；`aria-hidden`，计数文本承担可访问信息；**不可点击** | P-3 |
| 播放控件 | Previous / Play·Pause（主色，最小宽 104）/ Next / Reset（幽灵按钮，降低误触权重） | §6 顺序与禁用条件 |
| Replace 对话框 | 原生 `<dialog>`；Cancel 在前（默认焦点）、Replace current source 为主按钮 | §3 |
| 导出视图 | 标志旁显示"Offline presentation"胶囊；隐藏编辑器、GitHub、Export、状态横幅；单列最大 1120 px；底部注明离线且无网络请求 | §9 |

## 7. 图内 Focus 视觉

全部通过 CSS 作用于适配层已有的 `data-phase` / `data-active` / `data-selected` / `data-focus` 属性，**不改变几何位置**。

| 状态 | 线条 | 文字 | 额外标记 |
| --- | --- | --- | --- |
| Step 0 / Focus 关 | #334155，1.5 px | #0F172A | — |
| current | #2563EB，2.75 px，加大箭头 | #1D4ED8 粗体 | 起点旁 20 px 蓝色编号徽标（数字为路径内步号）；Note 底色改为 accent-soft、2.5 px 蓝边 |
| past（Focus 开） | #475569 | 不变 | — |
| future（Focus 开） | #8796AC，1.25 px | #475569（仍 ≥ 4.5:1） | Note 边框同色 |
| inactive（未选 case，始终生效） | #B4C0D0 | #64748B | case 区域斜纹底；case 标签旁 `OTHER PATH` 胶囊；Note 虚线边 |
| 活跃参与者 | 头框 accent-soft 底 + 2 px 蓝边；actor 小人描蓝；生命线 #93C5FD 2 px | 粗体蓝 | — |

实线 / 虚线保持源码语义（`->>` / `-->>`），状态只改颜色和线宽，不改线型。Focus 关闭时保留 current 与活跃参与者的标记，只恢复 past / future 的正常样式（DESIGN §4）。

## 8. 状态矩阵

| 状态 | 源码徽章 | 横幅 | 图 | 播放控件 / 路径 | Focus | Export |
| --- | --- | --- | --- | --- | --- | --- |
| Ready | Rendered | 蓝：Ready to present… | 正常 | 按 index 启用 | 可用 | 可用 |
| Source changed | Source changed | 橙：Source changed — render to update… | 灰度 + Last successful render | 禁用 | 可用 | 禁用 |
| Error（有旧图） | Error | 红：Last successful render — … | 同上 | 禁用 | 可用 | 禁用 |
| Rendering | Rendering | 蓝 + 旋转图标：Rendering… | 35% 不透明 + Rendering… | 禁用 | 禁用 | 禁用 |
| 导出中 | — | — | — | 不变 | 不变 | Exporting… + `aria-busy` |

以上与 `main.ts` 的 `update()` 及 `player.setEnabled(!stale && !busy, !busy)` 的现有逻辑一一对应，不新增状态。

## 9. 与现有规格的关系

### 9.1 完全沿用

布局断点（960 / 600）、36/64 分栏、编辑器最小 280 px；所有控件、禁用条件、文案和键盘规则；1500 ms 自动播放；分支默认第一条和"条件未求值"提示；错误恢复与 Last successful render；单一浅色主题；系统字体；不使用持续闪烁、粒子、3D 和音效；导出文件结构。

### 9.2 视觉调整（不改变承诺，实现后需按 TESTING 重新截图）

- 播放控件与步骤说明从图上方移到图下方，组成 Presenter dock，与 DESIGN §2 线框一致。
- 当前步骤加编号徽标，未选 case 加斜纹和 OTHER PATH 标签。这是 DESIGN §4 "不仅靠颜色表达状态"的具体做法。
- stale / error 时旧图转灰度。
- 图外端点显示参与者**标签**（`API → Browser`）而不是 ID（`API → U`），更贴近听众看到的图。若需同时保留 ID，可在标签与 ID 不同时显示为 `Browser (U)`。

### 9.3 新增提案（需你确认后同步 DESIGN / TESTING 再实现）

| 编号 | 提案 | 理由 | 风险 / 注意 |
| --- | --- | --- | --- |
| P-1 | 源码行号栏（被动显示，错误行高亮） | 诊断以行号定位，行号让"Line 9"可直接对照 | 不引入编辑器依赖；需保证与 textarea 同步滚动、字体行高一致 |
| P-2 | 显示行数与 UTF-16 长度 / 50,000 | 让输入上限可见，减少超限意外 | 只是计数显示，超限诊断不变 |
| P-3 | 分段进度条 | 讲解时快速感知位置 | 设计为不可点击；若以后可点击跳步，需要新增交互与测试（Playback 已有 SEEK 动作） |
| P-4 | 窄屏 Presenter dock 吸底 | 手机上滚动长图时控件仍可达 | 需确认 iOS Safari 软键盘与 sticky 的表现 |
| P-5 | Mermaid `theme: 'base'` + `themeVariables` 对齐 token（参与者白底灰边、Note 淡黄底 #FFFBEB / 边 #A16207、alt 框 #94A3B8） | 去掉默认紫色，与 UI 统一 | 只改颜色变量、不改 fontFamily，仍需按 AGENTS 规则 4 复验 M0 fixture 与截图 |

## 10. 落地建议

建议按以下顺序推进，每步都保持 `player.ts` 被 Web 与导出复用：

1. **Token 与外观**：引入 `tokens.css` 内容，重写 `styles.css`（Web 外壳）和 `player.css`（共享播放器，同时进入导出文件）。只改 CSS，不改 DOM，先完成 App bar、面板、按钮、横幅、诊断卡片。
2. **播放器 DOM**：调整 `player.ts` 生成的控件结构（dock、计数、类型胶囊、端点芯片、进度条、图标按钮），保留 `data-action`、`data-branch`、`data-status`、`data-step-details` 等测试依赖的钩子，或同步修改 E2E 选择器。
3. **图内状态 CSS**：把 §7 的规则写入 `player.css`。编号徽标需要在 `mermaid-adapter.ts` 或播放器中按当前步骤的包围盒定位；Mermaid 输出结构假设必须集中在适配层。
4. **§9.3 提案**：逐项确认后先改 DESIGN / TESTING，再实现。

完成判定沿用 TESTING：typecheck、lint、unit / integration、Playwright E2E、build，并补齐 DESIGN §10 列出的人工看图场景（360 / 390 / 768 / 1280、错误恢复、导出断网打开、减少动画）。

## 11. 本次实际验证

- 用项目自带的 Playwright Chromium 打开 `file:///…/design/mockup.html`，在 1280 / 768 / 390 宽度下截取 9 个状态（总览、自调用、未选路径、Source changed、Error、Rendering、导出视图、平板、手机）。页面错误与控制台错误为 0，frame 横向溢出均为 0 px。保留的截图见 `screenshots/`。
- 对比度数值由脚本按 WCAG 公式计算。
- **未验证**：Firefox / Safari 外观、真实屏幕阅读器朗读、真实 Mermaid 输出套用本样式后的效果。这些在实现阶段完成。
