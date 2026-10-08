# U0 发布前准备记录

日期：2026-10-07。结果：发布前素材 PASS；公开发布 / 联系用户 / 采用与 stars 验证 NOT RUN。U0 整体保持 IN PROGRESS。

工作分支：ffang/u0-launch-assets，基于 M5 的 16fb6e1，包含尚未合并的 M4 / M5。main 保持 340110d；本次“继续”用于推进独立的发布前准备，没有将其视作上一条合并问题的明确回答。

## 交付

- [真实演示 GIF](../../demo/seqshow.gif)：10 个实际界面状态、784×1152、17.4 秒、530,197 bytes。
- README 使用 GIF，同时保留静态截图与离线登录演示链接。
- [发布材料](../release/launch.md)：项目简介、中英文社区介绍、Release 草稿、自愿试用反馈模板及素材复现命令。
- 更新 U0 进度与仓库导航，修正 PRODUCT / ARCHITECTURE 顶部仍写 M5 未完成的过期状态；未变更产品需求或应用行为。

## 实际验证

| 命令 / 操作 | 结果 | 证据 |
| --- | --- | --- |
| npm run build | PASS | production 成功；Mermaid 大 chunk 提示保留，日志 artifacts/launch-build.log |
| node scripts/capture-demo.mjs | PASS | Chromium 153.0.8010.12，真实 Render / Next / 分支 / Focus / 下载 / file://；10 个状态断言通过 |
| 新上下文断网打开实际下载 | PASS | 保留失败分支，总览 0/6，Next 至 401 和失败 Note，远程请求尝试 0 |
| python scripts/assemble-demo.py | PASS | Pillow 10.4.0，编码 GIF 后逐帧解码，10 帧存在，时长与图片尺寸核验 |
| 打开编码 GIF 的全部帧缩略图和完整离线帧 | PASS | 文字、箭头、Note、自调用、选中路径及 Focus 状态可读，合成没有裁掉内容 |
| npm run lint | PASS | 捕获脚本与现有 JS / TS 检查无错误或警告 |

Markdown 相对链接、UTF-8 与 git diff --check 在提交前核验。应用源码、package.json / lockfile 与播放器运行包的输入未改动，因此不重复 M5 全套应用验收；本记录不把 M5 通过数说成本轮重跑结果。

原始帧、帧清单、真实下载、编码后缩略图存放 artifacts/launch，按仓库规则忽略。GIF 是原创内置登录案例的状态截图动画，英文字幕用于项目展示；不是生成虚构 UI，也没有新增面向用户的 GIF / 视频导出功能。

## 待所有者决定

合并具体分支、部署公开入口、创建 Release 与发送 / 发布文案均未执行。先审阅工作分支与草稿，再取得对应行动的明确授权。试用人数、采用、再次使用、访问与 stars 保持未验证，不用素材准备完成冒充市场验证。
