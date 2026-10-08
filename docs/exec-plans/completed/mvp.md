# SeqShow MVP 执行计划

状态：D0、M0–M5 COMPLETE；技术 MVP 已验收，U0 NOT STARTED。工作分支尚未合并或公开发布。

更新日期：2026-10-07。工作目录：E:/PROJECT/scan-skill。不要创建第二层项目目录。

## 1. 计划依据与执行边界

本计划根据前五份文档生成：

1. [AGENTS.md](../../../AGENTS.md)：仓库规则、导航与完成证据。
2. [PRODUCT.md](../../PRODUCT.md)：P01–P10、语法子集、用户故事与 DoD。
3. [ARCHITECTURE.md](../../ARCHITECTURE.md)：Parser → Model → Playback → Renderer → Export 及共享播放器。
4. [DESIGN.md](../../DESIGN.md)：分支、稳定布局、Focus、控件和错误生命周期。
5. [TESTING.md](../../TESTING.md)：测试层次、E01–E12 与 production/离线验收。

最初授权是先建立规格和执行计划；D0 已完成。用户随后授权 M0、下一步 M1，并在 2026-10-07 要求继续 M2。用户明确要求“合并到 main 然后继续”后，将 M0–M2 合入 main（a705464），再完成 M3。随后按用户明确授权将 M3 与 GPT-6 修复一起合入 main（340110d）；M4 与 M5 已在工作分支完成验收，尚未取得本次合并或公开发布批准。技术 MVP 退出证据见 [M5](../../validation/M5.md)。

仓库已由用户创建为 https://github.com/KunxianWang/SeqShow.git。用户随后授权将当前内容首次上传到 main；完成这次上传后，所有更新使用 ffang 开头的工作分支，每次合入目标分支都必须先取得用户对本次合并的明确同意。具体规则见 AGENTS。

2026-10-07 代码审核追加授权：本次按用户指定使用 `kxw/code-review-parser` 分支修复并推送，明确不合并 main；此命名只用于本次任务。审核结果见 [审核记录](../../validation/REVIEW-2026-10-07.md)。

不提前运行用户试用、创建公开仓库、发布站点、在社区发帖或联系他人。自动测试通过、技术 MVP 完成、用户采用、100 stars 分开记录。

## 2. 核心交付链

```text
D0 文档基线
  ↓
M0 Mermaid 布局与步骤映射验证
  ↓
M1 单项目开发与检查工具
  ↓
M2 支持子集 Parser、Model、分支 Playback
  ↓
M3 编辑器、Focus、播放与错误恢复
  ↓
M4 单文件离线 HTML 导出
  ↓
M5 production、浏览器和发布准备验收
  ↓
U0 实际使用与 GitHub 传播验证（独立后续阶段）
```

按依赖顺序推进。一个里程碑可以先完成端到端的最小案例，再补该里程碑的边界；不能用 demo 的局部成功代替退出条件。当前没有要求并行代理工作，计划不自动委派子任务。

## 3. 状态总览

| 阶段 | 状态 | 主要交付 | 关联需求 |
| --- | --- | --- | --- |
| D0 | COMPLETE | 六份文档、交叉链接、统一语义 | 产品与工程基线 |
| M0 | COMPLETE | Mermaid 12.1.0、集中映射、稳定布局、离线证明与证据 | P02、P03、P05、P07、P09 |
| M1 | COMPLETE | Vite/TS、完整工程 scripts、单元/集成/E2E 基础检查、运行说明 | 工程基础 |
| M2 | COMPLETE | 子集 Parser、Model、纯 Playback | P02、P03、P04、P06、P09 |
| M3 | COMPLETE | 编辑器与共享播放器、案例、响应式 | P01、P04、P05、P06、P08、P10 |
| M4 | COMPLETE | 单文件导出与 file:// 离线验收 | P07、P09 |
| M5 | COMPLETE | 完整检查、真实视觉核验、README 与离线演示 | P01–P10 / DoD |
| U0 | NOT STARTED | 自带输入、真实采用、二次使用与 stars | 产品验证，不阻断代码 MVP |

状态仅使用 NOT STARTED / IN PROGRESS / IN REVIEW / COMPLETE / BLOCKED。里程碑未完成不能为了让计划好看标 COMPLETE。

## 4. D0 — 文档基线

### 任务

- [x] 创建根 AGENTS.md，保留用户的 graphify 触发规则。
- [x] 创建 PRODUCT、ARCHITECTURE、DESIGN、TESTING。
- [x] 由前五份文档生成本计划。
- [x] 检查六文件路径、UTF-8 内容、文档链接、需求覆盖、术语与分支/导出约定。
- [x] 修复文档中的矛盾并记录核验结果。

### 退出条件

六份文件都在当前目录约定位置；P01–P10 有对应验收；一层 alt/else、步骤计数、Focus、输入诊断和离线导出在各文档中一致；实现状态明确为尚未开始。

## 5. M0 — 技术路线验证

### 目标

证明固定版本 Mermaid 的全图 SVG 可以可靠绑定到语义步骤，并在稳定布局下播放和离线使用。这个验证先于全面实现。

### 任务

- [x] 核验 Node/npm 与候选 Mermaid 的实际支持范围，记录具体版本。
- [x] 只建立验证必要的最小环境；M0 使用手写语义模型，没有完整 Parser 或产品 UI。
- [x] 渲染线性、登录分支、重复消息、自调用、Note、actor/alias、中文长文本与两个顶层 alt。
- [x] 为每个语义 ID 绑定箭头/标签/Note/参与者/case，验证数量和角色；无法确认时拒绝播放。
- [x] 验证 strict 配置、纯 SVG 文本、必要 defs/marker 与导出资源边界。
- [x] 点击或程序化切步、换分支、切 Focus，确认全图坐标与 viewBox 不变。
- [x] 验证最少播放器运行代码内联，在全新上下文 file:// 与断网状态下操作真实导出样例。
- [x] 保存 fixture、截图/报告与原始失败输入，记录采用 Mermaid + 集中适配的路线。

结果、版本、代码入口、适配假设与浏览器差异见 [M0 验证记录](../../validation/M0.md)。默认准入检查为 Chromium；WebKit 使用远程请求拦截，Firefox 测试浏览器不能启动，未标通过。跨浏览器完整发布验收仍属于 M5。

### 退出条件

上述关键类型映射可重现且无猜测，中文长文本和自调用可阅读，步骤不会重排，导出无必要远程依赖；Mermaid 精确版本和适配假设已记录。

### 验证失败时

保留失败输入与证据，评估受限子集的自有 SVG 布局路线。只在当前产品承诺内选择必要实现，更新 ARCHITECTURE 与此计划；不静默取消 alt/else、中文或离线导出，也不扩展成通用图引擎。例行可逆取舍在已授权范围内继续处理，真实依赖或产品冲突再明确告知用户。

M0 通过不代表整个 MVP 已完成；其示例可能尚未连接用户 Parser。

## 6. M1 — 开发环境与工程脚本

### 任务

- [x] 在当前目录建立 Vite + TypeScript + 原生 DOM/CSS 的单包项目，保留 docs/research。
- [x] 更新 npm lockfile，保留 M0 验证的 Mermaid 12.1.0；无 CDN/latest、后端或 monorepo。
- [x] 配置 typecheck、lint、非 watch test、test:e2e、build、dev、preview。
- [x] 安装并配置 Vitest / Playwright，保留三浏览器项目并记录实际范围。
- [x] 建立静态登录模型原型、测试入口及隔离 production preview 验证方式。
- [x] README 写清环境、安装/运行、检查命令与当前支持程度。

具体文件、版本、命令与证据见 [M1 记录](../../validation/M1.md)。M1 的通过范围为工程基础，用户 Parser、纯状态转换完整覆盖与编辑器仍属于后续里程碑。

### 退出条件

空白基础页面可运行，工具脚本可执行并返回真实退出码，build 可生成静态产物；检查结果逐项记录。尚未创建的 feature tests 不算已通过的产品验收。

## 7. M2 — Parser、Model、Playback

### 任务

- [x] 实现 PRODUCT 的受限语法与 UTF-16 输入限额；保留诊断源位置。
- [x] 支持隐式参与者、as、actor、自调用、中文、重复消息和 Note。
- [x] 支持两个 case 的单层 alt/else，允许多个顶层 block；拒绝嵌套和其他后置语法。
- [x] 建立唯一语义 ID、引用检查与整图无可播放步骤错误。
- [x] 实现 deriveSteps 和 0..N 的纯状态转换，选择改变时重置与暂停。
- [x] 对长度不同的路径、多个分支组合、末尾/暂停/回退边界运行 TESTING 规定的测试。
- [x] 使用 M0 的渲染适配连接真实 Parser 结果，消除手写模型与实际模型的差异。

结果见 [M2 验证记录](../../validation/M2.md)：97 项单元/集成，Chromium/WebKit 各 16 场景 / 24 路径 / 119 状态，以及 production 和真实 file:// 下载检查。

### 退出条件

相关 Parser/Playback 单元与模型→SVG 集成验收通过；不支持输入不吞掉；所选路径步数正确；重复消息、自调用和 Note 的映射仍正确。

关联需求：P02、P03、P04 的纯逻辑部分、P06、P09 的输入边界。

## 8. M3 — 浏览器产品体验

### 任务

- [x] 建立编辑器 + Preview 页面，初始可用登录案例与 Render。
- [x] 接入共享 player：Previous/Next/Play/Pause/Reset、Step X/N、消息说明。
- [x] 实现所有 alt 的选择、互斥路径和条件未求值提示。
- [x] 实现 Focus、高亮相关参与者、Note/自调用，以及不重排布局的滚动。
- [x] 管理计时器、页面隐藏暂停、销毁和重渲染；防止重复推进。
- [x] 实现 dirty/stale、异步过期结果防护、错误定位、旧结果标识和恢复。
- [x] 实现示例替换保护、唯一主题、窄屏排列、键盘和减少动画。
- [x] 准备六个原创案例，运行对应 E2E，并查看真实布局截图。

### 退出条件

自己的输入可完成讲解流程，E01–E10 中相关路径通过；所有图形类型与焦点状态可读；编辑不丢失、误操作不会导出旧图；没有累积计时器和全页意外横向溢出。

关联需求：P01、P03–P06、P08、P10。

已在隔离 M2 基线上完成验收：103 项 Vitest、19 项 Chromium production E2E、4 项 WebKit 重点检查与 M0 回归；真实截图已查看。详情见 [M3 记录](../../validation/M3.md)。

## 9. M4 — 独立 HTML 导出

### 任务

- [x] 构建可内联的共享播放器运行包，不复制播放算法或依赖闭包 toString。
- [x] 内联规范化 SVG、必要语义数据、CSS/JS；不默认写入原始源码。
- [x] 保留导出时的 choices，从总览暂停开始；收件人可改变路径。
- [x] 正确编码 script 数据上下文，检查资源属性、SVG 内容与必要 defs。
- [x] 实现下载、busy/失败处理及 stale 导出禁用。
- [x] 下载真实 artifact，在全新浏览器上下文 file:// 打开、断网、观察网络尝试并播放/回退/换分支。
- [x] 对照 Web 与导出执行相同动作序列；核验移动宽度、中文和箭头。

### 退出条件

E11/E12 和导出安全/一致性检查通过；无网络资源尝试；单文件在实际浏览器可操作，不借助 Web 已加载资源或 http 服务。

关联需求：P07、P09，复验 P03–P05、P08。

退出条件已满足：138 项单元/集成、29 项 Chromium production、5 项 WebKit 导出重点检查与 Chromium M0 回归通过；真实离线截图已查看。详情见 [M4 记录](../../validation/M4.md)。

## 10. M5 — 完整验收与发布准备

### 任务

- [x] typecheck、lint、unit/integration、production build 全部通过。
- [x] Playwright 对 production preview 执行 E01–E12；执行 TESTING 的 Firefox/WebKit 最低范围并记录限制。
- [x] 人工查看关键布局、Focus、分支、错误和离线产物，保存证据位置。
- [x] README 中的环境、命令、语法范围、限制与实际实现一致。
- [x] 在公开发布前核验名称/包名/仓库地址与开源许可证，使用真实 demo 或预览素材；本阶段不自动发布。
- [x] 检查 P01–P10 与 PRODUCT DoD，处理所有影响范围的已知失败。
- [x] 更新 AGENTS 当前阶段及本计划摘要，记录剩余非 MVP 项。

### 退出条件

应用 DoD 满足，验收证据可复核，没有用 NOT RUN 伪装 PASS。若某浏览器范围尚未满足，不自动完成验收，明确保留未验证状态与原因。

只有上述完成后，才把本计划移到 docs/exec-plans/completed/mvp.md 并更新导航。用户访谈与 star 目标进入独立后续计划，不阻塞或冒充技术 MVP 完成。

## 11. U0 — 发布后验证（不属于本轮实施）

找约 10 位目标开发者使用自己的图，观察真实导出与内容采用；建议信号为 3 位采用、2 位再次使用。分别记录实际使用、仓库访问和 stars。不刷星、不机械群发，不未经授权联系他人或发帖。

若主要反馈为静态图已够用，重新审视讲解场景；若工具可用但曝光不足，先验证发布入口。试验数据不足时不声称已证明市场。

## 12. 已确定的设计决策

| 编号 | 日期 | 决定 | 理由 / 关联文件 |
| --- | --- | --- | --- |
| DEC01 | 2026-10-06 | 先建立六份文档，应用从 M0 开始 | 本轮用户要求先搭框架 |
| DEC02 | 2026-10-06 | Web-only、唯一主题、独立 HTML 唯一导出 | 优先验证核心用途；PRODUCT non-goals |
| DEC03 | 2026-10-06 | 一层 alt/else 纳入 MVP；opt/loop/par 后置 | 首次就验证复杂流程的讲解价值 |
| DEC04 | 2026-10-06 | 一次只播选中 case，切换后暂停并总览 | 避免把互斥路径讲成连续执行 |
| DEC05 | 2026-10-06 | Message 与 Note 各占一步，控制标记不计数 | PRODUCT Step 0..N 规则 |
| DEC06 | 2026-10-06 | Mermaid 固定版本 + 集中适配为待验证首选 | 复用布局，M0 实证决定，不先重写 renderer |
| DEC07 | 2026-10-06 | 原生 DOM/CSS、纯 Playback、共享 player | 控件有限；Web/导出语义保持一致 |
| DEC08 | 2026-10-06 | 测试进入真实 file:// 与断网新上下文 | 避免将在线可用误当作独立导出 |
| DEC09 | 2026-10-06 | 当前内容首次上传 main；后续 ffang 工作分支，每次合并先问用户 | 用户指定的仓库与工作流，见 AGENTS |
| DEC10 | 2026-10-06 | M0 采用 Mermaid 12.1.0 + 集中 SVG 适配；关闭 Mermaid 自动折行，先折行纯文本再编码 | 语义属性可校验映射；实测自动折行会拆开字符实体，见 M0 失败 fixture |
| DEC11 | 2026-10-07 | Web、M0 与生产导出复用一个 esbuild 运行包构建函数；Vite 虚拟模块跟踪实际源码依赖 | 防止开发修改播放器后导出仍使用旧脚本；无需 CDN 或额外生成目录 |
| DEC12 | 2026-10-07 | Mermaid 布局使用内部参与者 ID，语义模型与绑定保留原始 ID | 实测 end 与尾部连字符存在 lexer 冲突；不缩减产品 ID 范围，见 M2 |

新增决定只记录改变实现路线、范围或验收的事项，不将每次普通编辑写成架构决策。

## 13. 风险与处理

| 风险 | 何时检查 | 处理方向 |
| --- | --- | --- |
| SVG 结构无法可靠映射 | M0 | 固定版本、明确校验；失败则评估子集 renderer |
| 中文/长文本需要 foreignObject | M0 | 优先纯 SVG 文本与可读折行；不直接放宽导出执行边界 |
| Mermaid 更新导致映射漂移 | 版本升级 | 精确 pin、fixture 回归、记录适配假设 |
| 分支只有源码描述，不能执行条件 | 全阶段 | 明确演示路径；不宣称真实程序执行 |
| 输出 file:// 浏览器兼容不同 | M0/M4/M5 | 内联运行包与资源；实际跨浏览器验证 |
| 范围逐渐增加为平台 | 每里程碑 | 对照 PRODUCT non-goals，新增功能另列后续 |
| 只有好看、没有实际采用 | U0 | 观察自己的图和真实内容使用，不用主题数量代替价值 |

## 14. 检查与活动记录

| 日期 | 阶段 | 操作 / 命令 | 结果 | 证据 / 限制 |
| --- | --- | --- | --- | --- |
| 2026-10-06 | D0 | 读取用户建议、截图与当前目录 | PASS | 当前目录只有历史研究资料，无既有应用与根 AGENTS |
| 2026-10-06 | D0 | 核对 Mermaid API/sequence/securityLevel、Vite 与 Playwright 官方说明 | PASS | 官方链接在 ARCHITECTURE/TESTING；尚未实测固定依赖版本 |
| 2026-10-06 | D0 | 创建六份规格与执行计划 | PASS | 文档路径如第 1 节，保留 docs/research |
| 2026-10-06 | D0 | Python 文档检查：UTF-8、文件与绝对链接、代码块、P01–P10、E01–E12、M0–M5、graphify 规则 | PASS | 六文件存在、链接目标存在、覆盖完整；确认未创建 package.json |
| 2026-10-06 | D0 | 人工核对范围、步骤、Note 引用、模型/渲染顺序与离线规则 | PASS | 补充整文档 Note 引用定义、从模型生成标准渲染输入；统一一层分支与离线播放承诺 |
| 2026-10-06 | D0 | 当时应用、依赖与 npm 检查 | NOT RUN | D0 只搭文档框架；该记录不代表后续 M0 状态 |
| 2026-10-06 | M0 | Node/npm 与 registry 版本核验；npm install；安装 Chromium/Firefox/WebKit | PASS | Node 22.14.0、npm 10.9.2、Mermaid 12.1.0、Playwright 1.63.0、esbuild 0.28.2；安装成功不等于浏览器启动成功 |
| 2026-10-06 | M0 | 初次 npm run test:m0 | FAIL → FIXED | 补充允许安全同文件引用的 symbol/use；检测到长文本实体拆分，保存原始失败输入并修复折行顺序 |
| 2026-10-06 | M0 | npm run test:m0 | PASS | 8 个 fixture、独立期望路径、全图稳定、共享播放、真实 file:// 断网与 14 个负向检查，见报告 |
| 2026-10-06 | M0 | node scripts/m0.mjs '--browsers=chromium,webkit' | PASS，WebKit 方法有差异 | WebKit 的 setOffline 阻断 file://；改为拒绝 HTTP(S)/WS(S)，观察请求尝试为 0，不声称 setOffline 模式通过 |
| 2026-10-06 | M0 | Firefox 启动、Windows SideBySide 日志、重新安装官方同版本包 | NOT RUN | mozglue 从属程序集缺失，重新安装后仍无法启动；M5 兼容验收保留此缺口 |
| 2026-10-06 | M0 | npm audit --json | PASS | KaTeX override 0.18.2 后 0 个已知漏洞；没有强制降级 Mermaid |
| 2026-10-06 | M0 | npm ci --no-fund --no-audit；npm run test:m0 | PASS | 从 lockfile 重装 122 个包；最后 Chromium 复验通过，固定报告为 m0-clean-install-report.json |
| 2026-10-06 | M0 | 人工查看登录、中文长文本、390px Note 截图 | PASS | 文字/箭头/Note/self-call 可读；窄屏图内滚动，固定证据在 docs/validation/ |
| 2026-10-06 | M0 时点 | 正式工具链检查与完整 E01–E12 | NOT RUN | 当时仅 M0；后续 M1 工具链已实际运行，完整产品 E01–E12 仍未执行 |
| 2026-10-07 | M1 | 核验 registry engines/peerDependencies，安装并精确锁定工具链 | PASS | Node 22.14.0；TS 6.0.3 处于 typescript-eslint 支持范围，不强装当前不受支持的 TS 7 |
| 2026-10-07 | M1 | 首次 lint、修正 M0 的显式 any 与无效转义 | FAIL → FIXED | M0 暴露 API 添加实际推导类型；不关闭规则或忽略整个文件 |
| 2026-10-07 | M1 | npm ci、typecheck、lint、npm test、production build、npm run test:e2e | PASS | 干净重装后 10 项单元/集成与 2 项 Chromium production E2E，见 M1 报告 |
| 2026-10-07 | M1 | 清洁安装的 Windows esbuild 文件占用 | FAIL → FIXED | 停止本项目旧 M0 预览后重装成功；没有改为管理员运行或删除无关文件 |
| 2026-10-07 | M1 | 开发页、虚拟运行包更新与源码恢复 | PASS | 临时改变共享播放器按钮文本后，两者同步更新；按原始字节恢复源码 |
| 2026-10-07 | M1 | npm run test:m0 | PASS | 8 个 fixture / 12 路径 / 66 状态，14 个负向检查；复用新构建函数后无回归 |
| 2026-10-07 | M1 | WebKit production / 下载 / 离线 E2E | FAIL → FIXED | 默认并行/30 秒测试超时；trace 显示 Windows 驱动操作较慢，串行与 90 秒上限后两项通过 |
| 2026-10-07 | M1 | Firefox 启动复核 | NOT RUN | 官方测试二进制仍 spawn UNKNOWN；应用用例未运行，保留项目 |
| 2026-10-07 | M1 | npm audit | PASS | 0 个已知漏洞，保留 KaTeX 0.18.2 override |
| 2026-10-07 | M1 | 查看 production 登录页、共享播放器脚本与截图 | PASS | 4173 正式预览可操作；固定截图 docs/validation/m1-login.png |
| 2026-10-07 | M1 时点 | 当时 Parser、完整编辑器和完整 E01–E12 | NOT RUN | 历史记录；后续 M2 已实现 Parser/Playback |
| 2026-10-07 | M2 | 首次 Parser 单元检查 | FAIL → FIXED | 检出贪婪 ID 将虚线箭头解析为连字符 ID；新增独立模型/连字符用例 |
| 2026-10-07 | M2 | 特殊 ID → Mermaid → SVG | FAIL → FIXED | end 触发 Mermaid 关键字错误；改用内部布局 ID 并校验端点，不禁用合法 ID |
| 2026-10-07 | M2 | typecheck、lint、Vitest | PASS | 4 文件 / 97 项；限额、UTF-16 源位置、四种分支组合与状态边界 |
| 2026-10-07 | M2 | production build 与 Chromium/WebKit 基础 E2E | PASS | 两浏览器各 2 项；真实下载文件在全新 file:// 离线上下文可操作 |
| 2026-10-07 | M2 | M0 + 真实 Parser fixture 回归 | PASS | 两浏览器各 16 场景 / 24 路径 / 119 状态，14 负向检查；远程请求 0 |
| 2026-10-07 | M2 | Play/Pause、RESET、页面隐藏、重新 Render、destroy | PASS | 可控时钟验证不会累积计时器或推进新图 |
| 2026-10-07 | M2 | 查看 production、中文长文本与特殊 ID 离线截图 | PASS | 固定证据在 docs/validation；4173 预览初始 0/6 |
| 2026-10-07 | M2 时点 | 当时编辑器与完整发布验收 | NOT RUN | 历史记录；编辑器后续已在 M3 实现 |
| 2026-10-07 | Git | 用户批准后快进合并 M0–M2 并推送 main | PASS | main=a705464；后续 M3 分支 ffang/m3-editor，未批准也未执行 M3 合并 |
| 2026-10-07 | M3 | typecheck、lint、Vitest、production build、Chromium E2E | PASS | 隔离 M2 基线 + M3 文件：103 项单元/集成、19 项 production E2E；不包含另一会话四个审查文件 |
| 2026-10-07 | M3 | npm run test:m0；WebKit 重点 E2E | PASS | Chromium 16 场景/24 路径/119 状态/14 负向，远程请求 0；WebKit 登录、键盘、390px 中文、下载离线 4 项 |
| 2026-10-07 | M3 | 查看桌面、分支末步、Note/自调用、错误、替换与四种中文宽度截图；颜色对比与 reduced-motion | PASS | 固定证据见 M3.md；图内滚动不移动页面，不重排 SVG |
| 2026-10-07 | M4/M5 | 完整导出一致性与发布验收、Firefox 应用用例 | NOT RUN | M4/M5 尚未开始；Firefox 已知启动限制保留，不标通过 |
| 2026-10-07 | M2 审核 | 复现关键字参与者、分号误接收/误拒绝、空标签 SVG 映射错误 | FAIL → FIXED | 新增 Parser 回归和两项浏览器 fixture，见审核记录 |
| 2026-10-07 | M2 审核 | 独立副本 typecheck、lint、npm test、test:m0、test:e2e、git diff --check | PASS | 129 项单元/集成；Chromium 18 场景 / 27 路径 / 132 状态；2 项 production E2E，未混入并行 M3 改动 |
| 2026-10-07 | 联合复核 | M3 + GPT-6 修复：typecheck、lint、Vitest、production Chromium/WebKit | PASS | 135 项单元/集成、19 项 Chromium、4 项 WebKit 重点 E2E；代码无冲突，保留执行计划的两边历史 |
| 2026-10-07 | 联合复核 | node scripts/m0.mjs --browsers=chromium,webkit；查看新增场景断网 file:// 截图 | PASS | 两浏览器各 18 场景/27 路径/132 状态/14 负向；远程请求 0，见联合复核报告 |
| 2026-10-07 | M4 | typecheck、lint、npm test、production build + Chromium E2E | PASS | 6 文件/138 项单元与集成、29 项 production 用户路径；SVG 安全边界共用、保存选择校验、下载失败 URL 清理 |
| 2026-10-07 | M4 | WebKit 导出五项；npm run test:m0 | PASS | WebKit 动作对照、多/空路径、390px 中文、构造数据通过；Chromium M0 18 场景/27 路径/132 状态/14 负向，远程请求 0 |
| 2026-10-07 | M4 | 查看真实下载文件与六份离线布局截图 | PASS | 初始总览/暂停/Focus、URL 文本、箭头/自调用/Note 保留，窄屏控件和长图仅内部滚动；见 M4.md |

| 2026-10-07 | M5 | typecheck、lint、Vitest、production build + Chromium E2E | PASS | 最终修复后 138 项单元/集成、30 项 Chromium production；没有失败、跳过或 flaky |
| 2026-10-07 | M5 | Windows Firefox 启动与 SideBySide 日志 | NOT RUN（应用用例） | spawn UNKNOWN、mozglue 程序集缺失；没有修改 Windows 系统或删除 Firefox 项目 |
| 2026-10-07 | M5 | WSL Node 22.14 官方包哈希、npm ci、Firefox 安装、补系统库与中文字体、production E2E | PASS | Linux Firefox 155.0，最终 30 项；首轮缺中文字体的截图没有作为合格证据 |
| 2026-10-07 | M5 | 原始 46,085 字符长标签图及四项输入上限检查 | FAIL → FIXED | 序列化长度超过 Mermaid 默认限额，适配层 maxTextSize 改用生成长度；不放宽原始限额或 SVG 安全边界 |
| 2026-10-07 | M5 | WebKit 最低范围 + 上限；node scripts/m0.mjs --browsers=chromium,webkit | PASS | WebKit production 6 项；两引擎各 18 场景/27 路径/132 状态/14 负向，远程尝试 0 |
| 2026-10-07 | M5 | 200 步两组实测、真实截图、重新断网打开 demo/login.html、P01–P10/DoD/README/许可证核验 | PASS | 长标签 Render 约 1.56 秒；六份已查看截图、离线演示初始失败路径与 0/6→6/6；见 M5 与 JSON 摘要 |

后续记录真实命令、环境、失败原因和证据路径；不把未来动作复制成已执行记录。

## 15. 当前下一步与剩余任务

当前：M0–M3 与 GPT-6 修复已按上次明确授权合入并推送 main（340110d）；M4 在 ffang/m4-offline-export 完成，尚未合并。后续合并仍须单独批准。

M5 已在 ffang/m5-release-validation 完成，包含未合并的 M4；P01–P10 / DoD、浏览器最低范围、性能采样、文档与素材均有实际证据。技术 MVP 计划移至 completed，不代表已经合并或公开发布。

剩余：所有者审阅并明确批准本次合并；公开入口、Release、真实用户采用和传播进入 [U0](../active/u0.md)，尚未开始。Windows Firefox 启动失败、WebKit setOffline/file:// 差异、Windows 驱动延迟与 Mermaid 大 chunk 已如实记录；Linux Firefox 已实测通过，真实 Safari / iOS 仍不属于已验证平台。
