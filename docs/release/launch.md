# SeqShow 发布材料

状态：DRAFT / 未发布。日期：2026-10-07。所有者审阅后可直接修改下方草稿；本文件没有触发部署、Release、社区发帖或用户联系。

## 已有素材

| 素材 | 内容与用途 |
| --- | --- |
| [17 秒演示 GIF](../../demo/seqshow.gif) | 真实 production 界面的逐步消息、自调用、成功 / 失败路径、Focus 与离线 HTML |
| [静态截图](../validation/showcase-login.png) | 本轮配色下实际捕获的登录失败路径预览；不能使用 GIF 的场合可替代 |
| [离线登录演示](../../demo/login.html) | 下载为 HTML 并直接打开；GitHub 文件页本身不执行播放器 |
| [M5 验收](../validation/M5.md) | 实际浏览器平台、支持子集、输入限额、已知限制与验证证据 |
| [后续修复联合复核](../validation/REVIEW-M5-MERGE-2026-10-07.md) | 宽图和长消息修复、独立复验与最终合并范围 |
| [UI 合并记录](../validation/UI-V02-MERGE.md) | UI v0.2、长正文 / 多分支修复及更新后的 GIF / 离线示例 |
| [仓库](https://github.com/KunxianWang/SeqShow) | 技术 MVP 与 UI v0.2 已合入 main；新展示与配色在 ffang/showcase，未合并 |
| [发布会式互动展示讲稿](showcase.md) | 五章节、六服务复杂案例、20 秒动图与真实离线文件 |

目前没有公开托管演示 URL。草稿不填写虚构的在线入口，也不宣传下载文件页能直接在线运行。合并和发布必须按 AGENTS 取得本次批准；准备阶段不改仓库设置或创建 Release / tag。

## 项目简介草稿

中文：把 Mermaid 时序图变成可逐步讲解、选择分支、聚焦当前消息并离线分享的技术演示。

英文：Present Mermaid sequence diagrams step by step, choose a branch, and share one offline HTML file.

适合展示的具体场景：向同事讲解登录成功 / 失败路径、请求响应、自调用及 Note。强调“使用已有图”与“单文件分享”，不要写成支持全部 Mermaid 语法，也不要声称会执行或判断业务条件。

## 中文社区介绍草稿

标题：SeqShow：让 Mermaid 时序图可以逐步讲解，并导出离线 HTML

我做了一个浏览器工具 SeqShow，用来逐步讲解已有的 Mermaid 时序图。粘贴源码后，可以前进、回退或自动播放；选择 alt/else 路径，只播放那一条路径。Focus 会突出当前消息、Note 和相关参与者，图的布局保持不变。

演示完成后，下载一个 HTML 文件发给同事，对方直接用浏览器打开，断网也可以播放和切换分支。无需账号或 AI API，输入在浏览器中处理。

目前支持时序图子集：participant / actor、别名、两种箭头、自调用、Note、中文长文本和单层 alt/else；暂不支持 loop / par、嵌套分支或其他图类型。仓库有六个示例、真实演示和 MIT 许可证。

仓库：https://github.com/KunxianWang/SeqShow

如果你写技术文档或讲解 API 流程，欢迎拿自己的图试一下。我最想了解的是：它是否真的帮助你讲清楚流程，以及哪个输入或操作让你停下来了。

## 英文社区介绍草稿

标题：SeqShow — present Mermaid sequence diagrams step by step and share them offline

I built SeqShow to walk through existing Mermaid sequence diagrams. Paste a diagram, move forward or backward, or play it automatically. Choose an alt/else path and present only that path. Focus highlights the current message or note and its participants without rearranging the diagram.

Export one HTML file and send it to a teammate. They can open it in a browser, play it, and switch branches offline. No account or AI API is required; diagram input is processed in the browser.

The first version supports a sequence-diagram subset: participants and actors, aliases, solid and dashed message arrows, self calls, notes, Chinese labels, and single-level alt/else branches. It does not yet support loops, parallel blocks, nested branches, or other diagram types.

Repository: https://github.com/KunxianWang/SeqShow

If you write technical docs or explain API flows, I'd like to hear whether it helps with your own diagrams, and where the workflow breaks down.

## GitHub Release 草稿

建议名称：SeqShow MVP — 逐步讲解与离线分享。版本 / tag 由所有者确定；尚未创建。

本版将 Mermaid 时序图转换为可控制播放的演示，提供源码编辑与诊断、六个示例、Previous / Next / Play / Reset、Focus、单层 alt/else 的独立路径选择，以及单文件 HTML 下载。

可以先下载随附的 login.html，再用浏览器本地打开；想使用自己的图时，从源码运行应用：

```sh
npm ci
npm run build
npm run preview
```

使用支持范围内的 Node 22（>=22.13）、Node 24 或 Node >=26。运行后打开 http://127.0.0.1:4173/。这不是公开托管站点地址。

发布附件候选：demo/login.html。静态站点产物需从批准的最终提交重新构建；本准备分支未创建或上传 Release 附件。

完整兼容边界见 M5 与后续联合复核：M5 时 Windows Chromium 与 Linux Firefox 各 30 项 production E2E、Windows WebKit 6 项重点检查；后续修复的最终代码独立通过 Windows Chromium 全部 33 项，以及 Linux Firefox / Windows WebKit 各 9 项重点复验。Windows Firefox 测试二进制仍有启动问题，真实 Safari / iOS 设备未验证。刷新编辑器不会保存草稿；原始源码和注释不默认写入导出文件，但图的标签会包含在文件中。

以上是 UI 改版前的历史范围。UI v0.2 最终代码独立通过 Windows Chromium 全部 35 项与 WebKit 新增布局回归 2 项，实现阶段另有 WebKit 8 项重点检查记录。当前工作分支新增复杂展示与 base 配色，GIF 和 demo/login.html 已重新捕获；最新范围见[展示验收](../validation/SHOWCASE.md)。新版展示尚未复验 Firefox，不能沿用旧版 Firefox 结果声称新版已通过。

## 试用反馈模板

下列为所有者可用于自愿反馈的模板，未向任何人发送邀请。源码和身份信息都不是必填项。

1. 你准备用哪种技术内容或讲解场景使用它？
2. 用了内置示例，还是自己的图？是否成功 Render / 导出？
3. 哪一步有用，哪一步让你停下来？可选附最小复现样例。
4. 是否把 HTML 用于真实讲解 / 内容？是否后来再次使用？
5. 操作系统、浏览器，以及你愿意补充的兼容问题。

真实采用与再次使用按 U0 单独记录。试用反馈不等同于 stars；没有数据时不声称验证了市场需求。

## 演示素材复现

只使用现有 Node / Playwright 依赖，截图与 HTML 来自实际构建；GIF 合成使用本机已有的 Python + Pillow 10.4.0，不是应用运行依赖。其他环境需要时可用 `python -m pip install Pillow==10.4.0` 安装固定版本。

```sh
npm run build
node scripts/capture-demo.mjs
python scripts/assemble-demo.py
```

capture-demo 使用独立的 4176 preview，串行操作真实控件，对每个状态做断言；它不会关闭用户的 4173 / 5173 预览。结束后关闭自己创建的浏览器和服务器。原始帧、下载文件和断网请求记录位于忽略目录 artifacts/launch；最终 GIF 位于 demo/seqshow.gif。

生成的是截图状态动画，10 帧 / 17.4 秒，不是实时屏幕录像，也不是为产品增加 GIF / 视频导出功能。变更应用后，应重新捕获并检查编码后的全部 GIF 帧，避免展示旧版本。
