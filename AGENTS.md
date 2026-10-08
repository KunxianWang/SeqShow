# SeqShow：仓库规则与导航

## 项目与当前阶段

SeqShow 将 Mermaid 时序图转换为可逐步讲解、播放并离线分享的技术演示。

当前仓库处于 **M0–M5 技术 MVP 已完成、U0 发布前素材已准备、公开发布与真实使用验证未开始**的阶段。已存在受限 Parser、纯 Playback、Mermaid 适配层、共享播放器、源码编辑器、六案例、响应式布局、键盘、错误恢复及单文件离线导出。最终需求 / DoD、三种引擎的实际平台范围、输入上限与发布准备见 [M5 验收](docs/validation/M5.md)；素材见 [发布草稿](docs/release/launch.md) 与 [U0 准备记录](docs/validation/U0-PREP.md)。M4 / M5 与发布前准备仍在工作分支，未自动合入 main、部署站点或发布 Release。目录名 scan-skill 是现有工作目录名，产品名为 SeqShow，不要据此实现 skill 扫描工具。

## 先读什么

| 文档 | 负责的决定 |
| --- | --- |
| [docs/PRODUCT.md](docs/PRODUCT.md) | 用户、范围、语法子集、用户故事、需求编号、Definition of Done |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Parser → Model → Playback → Renderer → Export 的职责与约束 |
| [docs/DESIGN.md](docs/DESIGN.md) | 页面布局、步骤状态、分支选择、Focus Mode、错误和键盘行为 |
| [docs/TESTING.md](docs/TESTING.md) | 测试层次、验收场景、npm scripts 与完成证据 |
| [docs/exec-plans/completed/mvp.md](docs/exec-plans/completed/mvp.md) | 当前里程碑、状态、决策记录、验证结果、下一项任务 |
| docs/research/ | 历史调研与 star 快照，作为背景证据，不作为实现规格 |
| [docs/validation/M0.md](docs/validation/M0.md) | M0 版本、适配假设、复现命令、证据与浏览器限制 |
| [docs/validation/M1.md](docs/validation/M1.md) | 正式工具链、命令、production 验证与剩余范围 |
| [docs/validation/M2.md](docs/validation/M2.md) | Parser、纯 Playback、真实模型→SVG 与离线回归 |
| [docs/validation/M3.md](docs/validation/M3.md) | 编辑器、错误恢复、六案例、键盘与响应式验收 |
| [docs/validation/M4.md](docs/validation/M4.md) | 真实下载、分支保留、离线动作一致性与安全边界 |
| [docs/validation/M5.md](docs/validation/M5.md) | P01–P10 / DoD、浏览器平台、上限回归与发布准备 |
| [docs/exec-plans/active/u0.md](docs/exec-plans/active/u0.md) | 未开始的公开发布、真实使用和传播验证 |
| [docs/release/launch.md](docs/release/launch.md) | 已准备的真实 GIF、中英文介绍与 Release 草稿 |

阅读顺序：PRODUCT → ARCHITECTURE → 与任务相关的 DESIGN / TESTING → 当前执行计划。

## Git 分支与合并规则

- 远程仓库：https://github.com/KunxianWang/SeqShow.git；主分支为 main。
- 用户已明确授权本次将现有文档与调研资料上传到 main；此授权仅适用于本次初始内容上传。
- 本次上传之后，任何更新先切换或新建名称以 ffang 开头的工作分支，建议使用 ffang/<task-name>；不要直接在 main 提交或推送更新。
- 工作分支上的实现、验证、提交和推送可按已授权任务推进。每次将分支合入 main 或其他目标分支前，必须先向用户说明具体分支、变更与验证结果，并取得本次合并的明确同意。
- 合并确认适用于 merge、squash、rebase-and-merge 等合入方式；不自动合并、不开启 auto-merge、不用直接推送 main 绕过确认。
- 保留远程既有历史，不 force push，不重写 main。一次合并批准不能当作以后所有合并的批准。

## 工作规则

1. 在当前目录工作，保留现有研究资料和用户文件。不要另建一层 seqshow 项目目录。
2. 产品范围以 PRODUCT 为准；模块规则以 ARCHITECTURE 为准；交互以 DESIGN 为准；完成标准以 TESTING 为准。文档冲突先明确并同步相关文档，不能在实现中默默改承诺。
3. 首版是浏览器应用、一种主题、一层 alt/else、离线 HTML 导出。CLI、skill、云分享、AI、视频导出均后置。
4. M0 已选择 Mermaid 12.1.0 + 集中 SVG 适配路线；升级必须复验 fixture。M0–M5 技术验收已完成，后续修复遵守现有范围；公开发布与采用验证单独按 U0 和用户授权推进，不自写完整 Mermaid grammar、布局引擎或通用插件系统。
5. 复用标准平台能力和当前依赖。模块职责可以分离，不为未来多个 renderer、协作或后端引入接口、工厂或服务层。
6. 不支持的输入必须给出诊断，不能吞掉语法、静默删除消息或回退成看似成功的演示。
7. Parser / Model / Playback 不依赖页面 DOM；Mermaid 输出结构假设集中在适配模块；Web 与导出播放器复用同一播放语义。
8. 分支表示备选路径，默认第一条只是演示默认值，不代表条件成立。一次播放只经过所选路径。
9. 用户图源码和标签是数据，不作为 HTML、脚本或配置执行；不上传源码，不自动联网抓取外部资源。
10. 保留用户正在编辑的源码；加载示例覆盖非空修改需要明确的替换操作。构建、演示页和导出文件的状态不得混用。
11. 按里程碑推进并更新执行计划：做了什么、实际运行的命令、结果、未完成项和真实阻碍。普通可逆实现按用户授权继续，不为每个步骤重复请求确认。
12. 只运行与改动有关的检查；阶段完成时执行规定的完整验收。测试未运行、失败或环境不支持，要明确记录，不能标成通过。
13. 文档使用中文，代码标识符使用英文；示例文案覆盖英文与中文。依赖通过包管理器锁定，禁止用 latest CDN 代替可复现构建。

## 完成的含义

文档准备完成不等于产品完成。应用 MVP 必须满足 PRODUCT 的 DoD 和 TESTING 的检查门槛，尤其是分支播放、稳定布局、错误恢复以及离线导出。真实用户采用和 100 stars 属于后续验证目标，不作为代码测试的通过条件。

修改产品行为时，同步需求、交互、测试和计划；修复内部实现且不改变承诺时，不重写全部文档。只有里程碑验收完成才标记完成；只有应用 DoD 完成才把 mvp.md 从 active 移到 completed。

## graphify

保留用户提供的现有规则：

- **graphify** (`~/.Codex/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
- When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.

仅在明确触发时应用；技能路径若失效，按当前技能目录查找对应 SKILL.md。
