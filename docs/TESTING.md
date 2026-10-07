# SeqShow 测试与验收策略

状态：验收策略基线；M0/M1 检查与 M2 核心验收已建立，完整产品验收尚未执行。更新：2026-10-07。

需求编号来自 [PRODUCT](PRODUCT.md)，模块边界来自 [ARCHITECTURE](ARCHITECTURE.md)，视觉与操作规则来自 [DESIGN](DESIGN.md)。真实执行证据写入 [mvp.md](exec-plans/active/mvp.md)。

## 1. 验证原则

- 用用户能够观察的语义结果作为断言：正确参与者、消息、路径、步数、布局和离线运行。不要用“调用了某个私有函数”或复制实现计算作为正确性证明。
- Parser/Playback 用小型纯逻辑测试；布局、SVG 映射、键盘、下载和离线使用必须在真实浏览器验证。
- 固定用时测试使用受控计时器；不靠任意 sleep 等待。浏览器布局等待可观察的准备状态和字体就绪。
- 只为有意义的边界写测试，不为每个薄包装制造重复套件，也不以覆盖率百分比代替验收。
- 截图和数值断言互补。不能只检查存在 SVG 或 step counter 就宣称图正确。
- 每个阶段只记录实际执行的范围；Parser/Playback 检查不代替编辑器、错误恢复与发布验收。

## 2. 测试分层

| 层次 | 主要对象 | 通过依据 |
| --- | --- | --- |
| Parser unit | 子集、结构、引用、诊断、限额 | 与独立手写期望模型/诊断一致 |
| Playback unit | 分支派生、边界、动作 | 只经过所选 case，index 和 playing 一致 |
| Integration | Parser → Model → Adapter、导出数据 | ID 绑定完整、规范化没有丢图、导出数据可重建 |
| Player integration | 控件与计时器生命周期 | 重复播放、重新 Render 和销毁后无泄漏或多次推进 |
| Playwright E2E | 完整用户路径和导出文件 | 自己的输入、分支、键盘、下载、file://、断网可用 |
| 视觉检查 | 图与页面 | 无裁切、重叠、错误连接、不可读弱化或全页溢出 |
| 工具检查 | 类型、lint、production build | 真实命令通过，记录版本和未覆盖浏览器 |

## 3. 公共 fixture

fixtures 放在 tests/fixtures，examples 的业务文本可复用，但期望步骤与路径独立写出，不能直接由待测函数生成 expected。

| fixture | 内容 | 必须证明 |
| --- | --- | --- |
| linear-two-messages | A→B hello，B→A world | 2 个参与者、2 步、实线/虚线区别 |
| login-branches | PRODUCT 的登录与两条 Note | 3 个参与者，任一所选路径 6 步，互不串播 |
| unequal-branches | 共同步骤 + 长度不同的两条 case | 切换后重算 N，不把 6 或其他常数写死 |
| repeated-messages | 同端点同文字的两条消息 | 两个唯一步骤，各自只高亮对应箭头和文本 |
| self-call-and-notes | A→A，left/right/over Note | 自调用完整绑定，Note 相关参与者正确 |
| aliases-and-unicode | 隐式 ID、actor、as、中文长标签 | 参与者顺序、中文与别名不丢失 |
| multiple-alternatives | 两个顶层 alt，各有两条 case | 各选择独立，四种组合顺序正确，无嵌套实现 |
| long-text | URL、冒号、&、长消息 | 文本完整、可阅读，不因折行拆成多个步骤 |

拒绝场景：空输入、flowchart、未闭合 alt、多余 end、第二个 else、嵌套 alt、opt/loop/par、autonumber、激活简写、frontmatter、%%{init...}、links/click、HTML 标签、未知 Note 引用、重复声明、超限输入。

安全相关文本还需分别覆盖：纯文本标点可正确显示；输入的 HTML/script 被支持范围检查拒绝；直接导出序列化的构造数据含引号、<、&、</script> 时不会逃出数据上下文。拒绝一类用户输入不免除 Export 自己的编码测试。

## 4. Parser unit tests

- 识别支持的声明、箭头、Note；显式声明、隐式参与者与别名顺序符合产品规则。
- 支持消息中的自调用、重复文字、中文与冒号；文本不错误 split 或 trim 掉需要保留的内部内容。
- 整行普通注释与空行不形成步骤；配置 directives 不按注释忽略。
- Message / Note 形成唯一 ID；每个引用合法；两条 case 正确分组；控制标记不计入步骤。
- 非支持的合法 Mermaid 语法返回 unsupported diagnostic；真正的结构错误返回结构诊断，不能全部笼统叫 invalid。
- 准确的行列位置；包含空行、CRLF、中文、前后空白时仍能定位问题。
- 对每项输入限额测试上限以内、正好上限和超过上限，不能截断后报告成功。
- 单有参与者而无 Message/Note 时给出无可播放步骤诊断。

只支持 PRODUCT 明确列出的子集。为了通过某个新的 fixture 擅自增加语法，需先同步产品范围，而不是在 Parser 中偷偷兼容。

## 5. Playback tests

### 5.1 步骤和路径

- 线性图 index=0 时无当前步骤；NEXT 后 hello 当前；再 NEXT 后 world 当前。
- 登录成功路径只含 Session 与成功 Note；失败路径只含 401 与失败 Note。
- 多个 alt 的选择独立；每条派生路径顺序等于共同节点与所选节点的手写预期。
- 改变任一选择后 playing=false、index=0、N 重新派生。
- 不合法的 case ID 被验证或规范化处理，不跳入未定义路径；策略固定后有明确测试。

### 5.2 状态边界

- index=0 的 PREVIOUS 保持 0；index=N 的 NEXT 保持 N；RESET 保留 choices。
- PLAY 在 0 或 N 时进入 1；中途 PAUSE 再 PLAY 保留当前步。
- TICK 到 N 后停止并保留最后步；暂停时 TICK 不推进。
- 手动 NEXT/PREVIOUS 暂停；Focus 不改变 index、choices 或 playing。
- 步骤列表为 0 时 Play 禁用，计时器不启动；不得产生 -1、NaN 或超范围 index。

### 5.3 计时器与生命周期

共享播放器测试用 fake timers 或浏览器可控时钟：两次连续点击 Play 仍只存在一次推进；PAUSE、CHOOSE_BRANCH、RESET、页面隐藏、重新 Render 和 destroy 均清理计时器；被销毁实例不更新新图。

## 6. Renderer integration tests

以下是 M0 的路线准入项，也是版本升级后的回归项：

1. 固定 Mermaid 实际版本，对每个支持 fixture 得到 SVG 与手写语义模型绑定。
2. 每个 Message / Note ID 对应完整、正确的元素集合；自调用多段路径不遗漏；同文字消息不混淆。
3. 参与者 actor/矩形/别名对应正确；分支 case、Note 框与说明不被误算成消息。
4. 缺失或数量不一致的映射明确失败；不得因为 step counter 正确而接受错配。
5. before/after 比较 SVG viewBox 与图内坐标；切步、Focus 和分支变更不得重新布局。浏览器滚动带来的屏幕坐标变化要与图内几何变化分开。
6. 必要 defs/marker、虚线、箭头和 Note 在规范化后仍存在且可见；清理重复镜像或外部资源不破坏信息。
7. 长文本、中文和移动视口实际渲染无重叠与裁切；不能只使用短英文 fixture。

Mermaid 版本升级必须跑这些检查。API 调用成功或 SVG 字符串非空不算路线通过。

## 7. Export integration tests

- 产物为一个完整 HTML 文档，CSS/JS/语义数据/SVG 都内联；没有外置 import、脚本、stylesheet、图片或字体依赖。
- 初始 index=0、暂停、Focus 开启；保留导出时的 branchChoices，允许之后切换。
- 使用共同播放模块；同输入、同选择、同动作在 Web 与导出结果一致。
- 数据序列化不会因 </script>、引号、< 或 & 改变文档结构或插入可执行内容；不依赖宽松 innerHTML 插入用户标签。
- SVG 没有事件处理属性、script、foreignObject、外部资源 href；内部 marker/clip 的 #id 引用仍有效。
- 不默认包含原始源码；语义标签本身仍属于导出内容，不把“没带源码”描述为不含信息。
- 导出失败保留成功预览；stale、busy 或无结果时不能导出旧图冒充新图。

## 8. Playwright E2E 用户路径

| 场景 | 用户操作 | 预期结果 | 关联需求 |
| --- | --- | --- | --- |
| E01 自带输入 | 粘贴 linear-two-messages → Render → Next 两次 → Previous | 0/2→1/2→2/2→1/2，正确消息与端点高亮 | P01、P02、P04、P05 |
| E02 成功/失败分支 | 登录例 → Play → 换 unauthorized → Next | 换分支即暂停并回 0/6，路径中无 Session | P03、P04、P05 |
| E03 不同步数 | unequal-branches 两路径切换 | N 不同且计数更新，不保留旧 index | P03、P04 |
| E04 Note / 自调用 / 重复 | 对应 fixture，逐步 Next | 映射正确，无遗漏或同时错误高亮 | P02、P05 |
| E05 编辑和错误恢复 | 成功图 → 编辑 opt 或非法语句 → Render → 修正 | 草稿保留，旧结果标识，导出禁用，修正后从总览恢复 | P06 |
| E06 快速输入与渲染 | 编辑期间 Render 完成、过期渲染完成 | 不覆盖新草稿，不误报最新输入成功 | P01、P06 |
| E07 键盘和动画偏好 | Tab、Left/Right/Space/Home；编辑器中按相同键 | 播放器可控，编辑器不被全局 handler 劫持 | P08 |
| E08 窄屏与长文本 | 360、390、768、1280 px；中文长图 | 控件可用，图内滚动，全页无意外溢出 | P02、P08 |
| E09 加载案例 | 编辑草稿后选择其他示例，取消/替换 | 取消保留草稿；替换才加载新例 | P01、P10 |
| E10 恶意/超限输入 | directives、HTML、外链、超限 | 明确拒绝、不执行、不发送请求，可继续正常输入 | P06、P09 |
| E11 文件导出 | 选择失败分支 → Export → 保存文件 → file:// 打开 | 首次 0/6，失败路径保留，可播放/回退/切换 | P07 |
| E12 真正离线 | 在新浏览器上下文断网，再打开导出文件并执行 E11 操作 | 无 HTTP(S)/WS 资源尝试，操作与高亮仍正确 | P07、P09 |

E12 不能只阻断请求后忽略错误；还要记录是否尝试发起网络资源请求。测试导出内容时检查资源节点与真实请求，不能因为标签中含 https:// 的纯文本就误判为外部依赖。

跨平台 file:// URL 通过标准路径转 URL 方法生成，不手拼 Windows 反斜线。测试同时覆盖下载 artifact 保存和新上下文打开，不能复用 Web 页加载过的资源证明离线能力。

## 9. 浏览器与 production 验证范围

开发基线为现代 Chromium。发布前 E01–E12 的主流程在 Chromium 执行；Firefox、WebKit 至少执行登录分支、键盘、中文布局、下载产物与离线播放，并记录差异。

未能安装或启动某浏览器时记录未验证，不标作通过，不静默删除该浏览器项目。公开兼容说明以实际通过范围为准；无法满足计划范围的已知问题保留在执行计划中，不能自动完成发布验收。

最终 E2E 针对 production build 的 preview 服务，避免只证明 dev 模式可用。preview 是本地验证服务器，不是生产托管服务。

## 10. 已建立的 npm scripts 与当前范围

M1 已建立以下正式命令。M2 将 Web 登录示例改为 Parser 输出；Vitest 有 79 项 Parser、17 项路径/状态与 1 项运行包集成检查；E2E 仍为生产登录页和真实下载/离线文件两项。M0 验证器保留 8 个原始场景，新增 8 个真实解析场景，覆盖多个不等长分支、空路径、特殊 ID 与计时器生命周期。具体结果见 [M2 记录](validation/M2.md)。随着 M3–M5 实现补齐完整覆盖，不用已有通过数代替未来的功能验收。

| 命令 | 必须实现的行为 |
| --- | --- |
| npm run dev | 启动 Vite 开发环境；当前为登录原型，编辑器在 M3 接入 |
| npm run typecheck | TypeScript 无输出检查，含应用与测试相关类型 |
| npm run lint | 应用、测试和构建配置的合理静态检查，不强推格式噪声 |
| npm test | 非 watch 单元与集成测试，退出码能用于验收 |
| npm run test:e2e | 先 production build，再对隔离 preview 运行 Chromium 基础用例，保存报告与失败 trace |
| npm run build | production 静态产物及可内联的离线播放器运行包 |
| npm run preview | 对已构建产物启动本地 preview |

M1 的 npm ci、版本、初始化与浏览器命令已在 README 核验。Firefox/WebKit 项目均保留；扩展运行先 build，再使用 `npx playwright test --project=webkit` 或 `--project=firefox`。默认 E2E 使用 Chromium，不声称执行了所有浏览器或 E01–E12。Windows WebKit 使用串行 worker 与 90 秒用例上限，其断网文件验证延续 M0 的远程请求拦截；Firefox 启动失败仍未验证。

typecheck 覆盖 src、tests 的 TypeScript 与 Vite/Vitest/Playwright 配置；Node .mjs 构建/验证脚本通过 lint 和真实运行核验，不开启 checkJs。构建成功不能代替类型检查。

最终顺序：typecheck → lint → npm test → build → production preview 的 E2E → 人工查看关键截图与导出文件。修复后重跑受影响检查；最终状态有新改动时再补必要完整门槛。

## 11. 视觉证据

截图保存在执行时创建的 artifacts/qa 目录或 Playwright 配置的产物目录；名称应包括 fixture、viewport、branch 和 step，例如 login-390-unauthorized-step5.png。失败保留截图、错误和可用时的 trace，不要求成功用例全部录视频。

人工检查：标签完整、箭头端点、Note 背景、self-call、case 边界、当前/历史/未来层次、图内滚动、控件焦点、窄屏排列与错误可见性。颜色对比与减少动画至少核验一次。

不可用占位截图充当证据。检查记录需说明看过哪些真实产物、发现什么、是否已修复。

## 12. 执行计划的记录格式

每次检查记录：里程碑、命令或操作、时间、实际运行环境、结果、产物路径、剩余限制。结果只使用 PASS / FAIL / NOT RUN / BLOCKED，不把“计划运行”写成 PASS。

阶段退出条件：相关需求验收通过；与范围有关的失败已修复；技术取舍已记录。MVP 完成条件：PRODUCT DoD 全部满足。用户试用、真实内容采用与 stars 在独立的发布后验证中记录，不混进自动测试通过数。

## 13. 官方参考

[Playwright 网络控制](https://playwright.dev/docs/network)用于配置请求观察与拦截；[Mermaid 时序图语法](https://mermaid.js.org/syntax/sequenceDiagram.html)用于核对支持与拒绝样例。具体行为以项目固定版本实测为准。
