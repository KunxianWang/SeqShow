# SeqShow 技术架构

状态：v0.1 设计基线，尚无应用代码或依赖安装。日期：2026-10-06。

产品范围以 [PRODUCT](PRODUCT.md) 为准；本文件负责模块与数据边界。M0 必须先验证 Mermaid 步骤映射路线，见 [执行计划](exec-plans/active/mvp.md)。

## 1. 架构目标与取舍

- 编辑、讲解和离线导出属于一个静态浏览器应用，无后端、账户或远程 API。
- 播放逻辑操作语义步骤，不操作“SVG 中第几个箭头”。DOM 结构假设只存在于一个 Mermaid 适配模块中。
- Web 与导出播放器使用相同路径选择、步骤派生及状态转换，不维护两套播放器。
- 优先复用 Mermaid 布局。只有 M0 证明适配不可行，才评估受限语法的自有 SVG 布局；不直接启动完整 Mermaid renderer 开发。
- 一种主题、一套渲染路线，不建立 renderer 插件接口、事件总线、服务容器或未来扩展框架。

## 2. 技术栈基线

| 部分 | 选择 | 原因与边界 |
| --- | --- | --- |
| Web 构建 | Vite + TypeScript | 静态产物、类型检查、可复现构建 |
| UI | 原生 DOM + CSS | 首版控件有限，使用原生 textarea/select/button；暂不引入 UI 框架、状态库和路由 |
| 图布局 | Mermaid，固定实际验证版本 | 复用参与者、消息、自调用、分支和 Note 的布局 |
| 单元/集成 | Vitest | 纯函数和时间控制测试；用户明确要求分层测试 |
| 浏览器验收 | Playwright | 真实 SVG 布局、键盘、响应式与离线导出 |
| 包管理 | npm + package-lock.json | 一个包，不建 monorepo；版本在 M0/M1 实际安装时核验并记录 |

这里不是安装命令或已存在依赖清单。Node、npm、Mermaid 等具体版本由 M0/M1 选择满足官方支持范围的组合，并写入执行计划、package.json 与 lockfile。Mermaid 使用精确版本，不通过远程 latest CDN 加载。

## 3. 总体数据流

```text
用户源码
  ↓
Parser：支持子集检查、源位置、语义节点
  ↓
Internal Model：参与者、Message/Note、alt cases
  ├──→ Playback：选择路径 → 步骤列表 → 播放状态
  └──→ Renderer：全图一次布局 → 验证绑定 → 带稳定 ID 的 SVG
                         ↓
                  共享 Player Controller
                   更新高亮、文本和控件
                         ↓
Export：SVG + 最少语义数据 + 共享播放器 + 内联 CSS/JS
                         ↓
                  单文件离线 HTML
```

逻辑上的 Parser → Model → Playback → Renderer → Export 不要求每次点击依次重新调用全部模块。Layout 与 Playback 在首次编译后分离：全图布局一次，切步只更新标记、说明和高亮。

## 4. 计划目录

下列 src/tests 文件是后续实现目标，目前不创建空实现文件。

```text
AGENTS.md
docs/
  PRODUCT.md
  ARCHITECTURE.md
  DESIGN.md
  TESTING.md
  exec-plans/active/mvp.md
  research/                  已有调研资料
src/
  main.ts                    Web 编辑、Render、案例选择、下载
  styles.css                 唯一默认主题与响应式布局
  core/
    model.ts                 数据类型、诊断、输入限额
    parser.ts                明确语法子集 → 模型
    playback.ts              路径派生与纯状态转换
  renderer/
    mermaid-adapter.ts       固定版本布局、绑定、SVG 规范化
  player.ts                  Web/导出复用的 DOM 播放器
  export.ts                  单文件 HTML 生成与安全序列化
  examples.ts                六个原创案例
tests/
  fixtures/                  有意义的支持/拒绝与视觉场景
  unit/                      parser、分支、播放状态
  integration/               模型与 SVG、导出序列化
  e2e/                       浏览器及导出产物
```

player.ts 若为了导出打包需要一个很小的入口，可增加 export-player.ts。仅为实际构建需要增加文件，不为假设中的公共 SDK 拆包。

## 5. Parser 的输入、输出与失败方式

### 输入

原始字符串、PRODUCT 固定的限额和支持范围。源码始终保留在 Web 编辑器状态中；Parser 不修改它。

### 输出

成功返回一个 SequenceDocument；失败返回有源位置的 diagnostics。诊断最低包括 code、message、line、column、可选 hint。line/column 面向用户从 1 开始，列按 UTF-16 code units 计数；跨行范围仅在确有必要时提供。

诊断分类：空输入、非时序图、语法错误、支持范围外、未知参与者、重复声明、分支结构错误、超限。Renderer 的映射失败和 Export 的导出失败是不同阶段的诊断，不假装成用户语法错误。

### 受限解析策略

- 先核对长度与图类型；识别整行注释并拒绝配置指令/frontmatter。
- 声明和消息形成参与者表；显式声明以声明顺序登记，其他消息 ID 按首次出现补充。Note 引用必须能在整个文档的参与者表中解析。
- 将 Message、Note 和顶层 Alternative 分开建模；禁止嵌套 block、第二个 else 和不闭合 block。
- 普通文本在消息/Note 的第一个语法冒号后整体保留，不全局 split 冒号，不以消息文字作为唯一标识。
- 对不识别的非空语句报错。Mermaid 接受不等于 SeqShow 支持，不能先渲染再忽略缺失步骤。
- 可用 Mermaid 公开 parse/render 检查一致性；业务事件模型来自明确子集，不宣称 parse() 返回了可复用 AST。

M0 可以先验证渲染和模型绑定，之后实现仅满足 PRODUCT 的小型 Parser。不扩展到完整 grammar。语法识别使用明确规则，不能用一条宽松正则吞掉所有输入。

## 6. Internal Model

类型草案用于约定数据语义，不是已实现代码：

```ts
type SourcePosition = { line: number; column: number };
type Participant = {
  id: string;
  label: string;
  kind: 'participant' | 'actor';
};
type Message = {
  kind: 'message';
  id: string;
  from: string;
  to: string;
  arrow: 'solid' | 'dashed';
  text: string;
  source: SourcePosition;
};
type Note = {
  kind: 'note';
  id: string;
  placement: 'left' | 'right' | 'over';
  participants: string[];
  text: string;
  source: SourcePosition;
};
type Step = Message | Note;
type Alternative = {
  kind: 'alternative';
  id: string;
  cases: [
    { id: string; label: string; steps: Step[] },
    { id: string; label: string; steps: Step[] }
  ];
  source: SourcePosition;
};
type SequenceDocument = {
  participants: Participant[];
  nodes: (Step | Alternative)[];
};
```

数据约束：ID 在一次编译内唯一；重复文字生成不同步骤 ID；每个引用都指向已登记参与者；一个 Alternative 只有两条 case；steps 不允许再嵌套 Alternative。ID 可使用按源顺序生成的 m1/n1/b1 等，无需 UUID 或持久化数据库。

原始源码、SVG DOM、计时器、按钮和浏览器元素不进入这个模型。结构控制符不作为播放步骤，避免把 alt/else/end 算进 Step X/N。

## 7. Playback

纯逻辑输入：SequenceDocument、branchChoices、当前状态和 action。纯逻辑输出：下一状态、派生步骤和当前步骤；不访问 DOM、Date、网络或全局计时器。

最低状态：index、playing、branchChoices。Focus 是显示选项，由播放器控制，不影响纯播放顺序。

- branchChoices 为每个 Alternative 指定一个合法 case，缺省选第一条。
- deriveSteps 按源顺序展开共同步骤和所选 case；其他 case 保留在全图模型，不进入播放路径。
- index=0 为总览，index=k 对应 steps[k-1]。index 始终在 0..N。
- NEXT / PREVIOUS / RESET / PLAY / PAUSE / TICK / CHOOSE_BRANCH 的规则见 PRODUCT；越界动作保持合法状态。
- PLAY 在总览或末尾立即进入 Step 1 并开始计时；中途 PAUSE 后 PLAY 在当前步恢复，下一次 tick 推进一步。
- NEXT/PREVIOUS/RESET/CHOOSE_BRANCH 都暂停。到末尾停播。Focus 切换不重置状态。

计时器在 player.ts 中统一管理：1500 ms 一个 tick；重复点击 Play 不增加计时器；重渲染、分支切换、暂停、页面隐藏和销毁时清理。测试中使用可控时间，不用 sleep 模拟业务逻辑。

## 8. Renderer 与 Mermaid 适配

### 输出契约

一次渲染返回全图 SVG、步骤及参与者的语义绑定、可读取的布局边界。绑定只包含可序列化 ID/token，不返回 CSS 的第 N 个选择器作为产品契约。

适配模块根据已验证模型生成受限的标准 Mermaid 输入，先输出模型顺序中的参与者声明，再按节点顺序输出消息、Note 和分支；不把用户的原始配置或未识别语句直接传入渲染器。这样布局顺序与模型一致，原始源位置仍由 Parser 保存。标签转义在此处集中处理并验证，不通过文本替换向消息内容插入跟踪标记。

Message 的绑定覆盖完整箭头、标签和自调用所需的线段；Note 覆盖文字与背景；参与者覆盖 actor 图形/标签；Alternative/case 保留分支标签和框架。defs/marker 等图形资源不能错误计为步骤或被透明度处理破坏。

### M0 必须证明的内容

1. 固定 Mermaid 版本和外观配置，全图只布局一次，优先关闭重复底部参与者镜像，减少不必要映射。
2. 模型 ID 与 SVG 元素一一绑定；重复消息、自调用、多元素箭头、Note 和 case 都能对应。
3. 在适配阶段增加 SeqShow 自己的 data 标记，播放器只读取这些稳定标记。
4. 验证数量、结构和角色对应；只要无法确认就报告映射失败，不能猜测后继续播放。
5. 修改 index 或 branchChoices 只更新样式，viewBox、消息位置和参与者位置不变；Render 新源码才重新布局。

Mermaid 的 SVG 不是稳定业务数据 API。若必须依赖内部 class 或元素顺序，这些假设集中在一个文件，配固定版本 fixture 和升级检查；禁止在 UI、Playback 和 Export 中复制选择器。

### 路线决策

M0 通过：采用固定版本的 Mermaid + 薄适配层。

M0 失败：记录失败输入、失败原因与可重现证据，评估“对子集自有 SVG 渲染”是否更小且可完成 P01–P10；更新本文件与计划后再推进。既有产品范围内的例行实现取舍不需要每次询问用户，但不能悄悄删除分支、中文或离线导出承诺。

## 9. Web 控制与渲染生命周期

Web 状态只保留：源码草稿、当前成功编译结果、是否 stale、是否 busy、diagnostics、当前播放器实例。无需引入通用状态管理库。

- 用户编辑成功图的源码时：停止播放、标记预览为旧结果、禁用导出；输入不自动触发每次重布局。
- Render 新输入：暂停旧播放器，开始一个有递增请求 ID 的编译；期间禁用重复 Render 和导出。
- 只有最新请求成功且源草稿仍匹配时替换结果；过期异步回调不能覆盖新输入或新结果。
- 失败：保留源码和最后一个可见预览，标注“上次成功结果”；播放与导出禁用，修正后可再次 Render。
- 新结果成功：清理旧监听器/计时器，初始化默认分支、index=0、暂停、Focus 开启。

## 10. 共享播放器

player.ts 消费 SequenceDocument、规范化 SVG、语义绑定和初始分支选择，创建播放器控件并应用 Playback 输出。它不提供编辑器、不加载 Mermaid、不解析用户源码、不访问远程服务。

同一播放器用于 Web 预览和导出 HTML。DOM 更新限定在它自己的根节点，CSS 使用 SeqShow 前缀，避免页面其他控件与 SVG ID 冲突。

销毁时移除事件监听并清理计时器。键盘只在播放器控制范围且非编辑/表单输入时生效，不能拦截编辑器的空格与方向键。

## 11. Export

### 输入

当前成功且非 stale 的编译结果、当前 branchChoices、唯一主题。导出从 Step 0 暂停开始，保留所选路径；不序列化正在运行的计时器或依赖当前 DOM 高亮残留。

### 产物

一个 .html：内联 CSS、已经渲染且规范化的 SVG、最少可序列化语义数据、构建时生成的共享播放器 JS。打开后无需重新解析 Mermaid，也无需网络、模块 import、外置文件或在线字体。

播放器运行包由构建阶段生成并内联，不能用函数 toString() 拼接含闭包的运行时，也不能复制一份容易漂移的播放算法。开发与 production build 都要能获取同样的运行包。

### 数据处理边界

- 从可信模块生成脚本与 CSS；用户文本通过 textContent 或明确转义的属性传入，不拼进可执行 JS。
- JSON 数据安全序列化，处理 </script>、<、& 等边界，不能仅凭 JSON.stringify 就认为 script 标签上下文安全。
- 输入拒绝可执行链接、配置指令、frontmatter 和 HTML 标签；Mermaid 使用 strict 配置。strict 不能代替对导出 SVG、URL 属性和数据嵌入的检查。
- 输出 SVG 不包含 script、事件处理属性、foreignObject 或外部资源引用；必要的 marker/clip 引用只允许同文件的 #id。若 M0 渲染路线依赖 foreignObject，先核验是否能使用纯 SVG 文本配置满足长文本，不能直接放宽导出边界。
- 保留已生成 SVG 的必要内联样式与 defs，避免净化后文字、虚线和箭头丢失。采用可验证的净化策略；如果需要 sanitizer 依赖，在实际选型时记录原因，不自行做通用 HTML 净化库。
- 标签不注入网络字体、外部图片、tracking、fetch、CDN、远程脚本或远程 stylesheet。

导出与下载失败给用户可恢复的错误，不删除源码或已编译结果。

## 12. 状态与验证映射

| 边界 | 主要责任 | 对应需求 |
| --- | --- | --- |
| Parser | 不静默兼容、准确诊断、限额 | P02、P06、P09 |
| Model | 引用、顺序、唯一 ID、两分支 | P02、P03 |
| Playback | 路径互斥、步数、边界、计时规则 | P03、P04 |
| Adapter / Player | 正确映射、稳定布局、聚焦 | P05、P08 |
| Web | 编辑不丢失、旧结果标识、错误恢复 | P01、P06、P10 |
| Export | 离线、语义一致、数据与代码分离 | P07、P09 |

## 13. 官方资料与已核验边界

核验日期：2026-10-06。具体安装版本仍待 M0。

- Mermaid 的公开 parse 返回语法检查结果，内部 mermaidAPI 标为 Internal/Deprecated，不能把其数据库当稳定 AST 接口：[官方 API](https://mermaid.js.org/config/setup/mermaid/interfaces/Mermaid.html)。
- Mermaid 支持隐式参与者、别名、自调用和备选路径；SeqShow 只承诺 PRODUCT 的子集：[官方时序图语法](https://mermaid.js.org/syntax/sequenceDiagram.html)。
- Mermaid strict 的安全行为以配置文档为准，导出仍有自己的数据嵌入边界：[securityLevel](https://mermaid.js.org/config/schema-docs/config-properties-securitylevel.html)。
- 应用 production build 生成静态产物，preview 用于本地核验：[Vite 静态部署说明](https://vite.dev/guide/static-deploy.html)。本阶段不发布站点。

## 14. 尚未完成的技术验证

- Mermaid 具体版本、SVG 元素结构、稳定映射和长文本表现。
- strict 设置与纯 SVG 文本配置能否满足全部范围。
- 单文件运行包在 file://、Chromium、Firefox、WebKit 的兼容性。

这些待验证项不等于产品范围待定。M0 与后续真实检查必须把结果、截图路径和取舍写入执行计划。
