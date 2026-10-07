# GPT-6 修复复核与 M3 联合合并

日期：2026-10-07。用户本次授权：“你看一下 gpt6 的修复，没问题的话就一起合并”。本次范围为 M3 和已发布的审查修复，不推进 M4/M5。

## 复核结论

复核分支 `kxw/code-review-parser`（`4783cf2`）的完整差异、原始规格、Parser 与 SVG 适配调用路径及新增测试，未发现阻止合并的问题。四个本地未提交审查文件与该远端提交一致；先保存为独立 stash，再将远端真实提交合入 `ffang/m3-review-integration`，保留原有历史。该整合分支同时包含 M3 的 `0310f81`。

修复符合原有受限语法承诺：完整消息优先于 alt/else 控制关键字，合法 ID 不再误判；分号后的第二条语句明确拒绝，同时普通分号文本和 URL 不跨段匹配；Mermaid 12.1.0 的单个 U+200B 占位符仅对空白模型标签放行，非空标签仍严格核验。没有放宽 SVG 元素、资源或脚本安全检查，没有依赖变更。

合并只在执行计划产生文本冲突，已保留 M3 和审核的真实历史证据，并将当前下一步维持为 M4。代码无冲突。既有 [M3 独立验收](M3.md) 和 [GPT-6 原始审核](REVIEW-2026-10-07.md) 是各自时间点的记录；本文件记录联合结果。

## 联合验证

环境：Windows、Node 22.14.0、Mermaid 12.1.0、Playwright 1.63.0。所有检查针对整合后的真实代码，不使用单独分支的通过数替代联合结果。

结果汇总与实际命令见 [联合报告](review-merge-report.json)。Vitest 135 项包括 M3 的 103 项和修复新增的 32 项；Chromium production 19 项覆盖编辑器、错误恢复、分支、响应式及真实下载/离线操作。M0 回归增加关键字参与者和空标签两个 fixture，覆盖其真实 Parser→SVG→共享播放→离线产物。

新增场景在全新 Chromium 的断网 `file://` 上下文打开并查看：[关键字参与者](merged-review-parsed-keyword-participants.png)、[空标签、self-call 与四种 Note](merged-review-parsed-empty-labels.png)。空标签依然保留箭头/Note、独立步骤和真实端点，不变成“无步骤”。

联合 WebKit 首次执行时键盘用例失败：模拟时钟安装后仍随真实时间前进，较慢的浏览器操作期间已播放到 Step 6，手动 `runFor(1500)` 后不能再断言 Step 2。修正在测试中安装固定时间并先 `pauseAt`，只由显式 `runFor` 推进；没有改动播放器、1500ms 间隔或断言。这次初始失败的 JSON 与 trace 保存在 `artifacts/review-merge/`，最终结果以修正后实际重跑为准。

Firefox 应用测试仍因既有 Windows 二进制启动问题未验证；本次不将其标为通过。WebKit 的真实离线文件采用远程请求拦截并观察尝试数量，不能把它表述为 Chromium 的 `setOffline` 方法。Mermaid 的大 chunk 构建提示仍保留。

## 合并边界

联合检查通过后，将上述整合分支快进合入并推送 main，不 force push，也不改变以后的 ffang 分支与逐次合并授权规则。M4/M5 完整导出及发布验收仍待执行。
