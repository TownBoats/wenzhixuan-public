# 当前交接

更新时间：2026-11-25。分支 `dev`，基准 `d512555`；`a18d017` 已推送 dev 与 main，Vercel success，
生产域名返回 200，未做页面功能验证。一期文档与历史事项清理已提交 dev；T1–T3 已提交 dev。
推送状态与哈希以 Git 为准。

## 1. 当前状态

- 主路径为 AgentChatPage：苏格拉底追问、三工具与候选答案闭环；本轮未改运行层协议。
- 历史列表每条记录可下载 `.txt`，含正文、问题、实际回答与已完成图示源码；不能还原会话状态。
- 设置提供完整 JSON 备份、预览和确认合并；默认含 API Key 且未加密，可取消勾选。
- 备份是文件手动同步：按 ID 合并、较新胜出，不传播删除、不合并分叉；无账户或云同步。
- 上下文占用为“最近实测 + 之后新增估算”，展示为输入框内圆环；用户已在本地查看并认可。
- 学习链路已于 2026-11-03 撤销；只兼容备份残留数据，不恢复运行与界面。
- 日常历史键与 schemaVersion 不变，没有批量迁移旧数据。
- 细节与边界见 [现行业务与架构](knowledge/agent-upgrade.md)。

## 2. 当前任务与下一动作

- 任务：[教学引擎一期](tasks/teaching-phase1/README.md)，范围为快速修复 + 教学打底。
- 用户已定：布局左讲解右问题（二期）；直接教学为卡上按钮 + 随时开关；链路撤销因提取质量与展示形式。
- [任务与判据](tasks/teaching-phase1/TASKS.md) T1–T6；ADR-003、ADR-004 为提议状态。
- 前一轮文档整理与重复归档删除已随 `a18d017` 发布，ARCHIVE-1/2 见
  [归档追加](archive/agent-upgrade-2026-11-01/ADDENDUM.md)。
- Q1–Q4 已定（2026-11-25）：直接讲解立即开始、其余题暂缓；plan 不打断且可调整；plan 为页头下常驻行；开关放二期。
- T1 公式渲染已实现、用户已验收并提交，证据见 [T1](tasks/teaching-phase1/TASKS.md)。
- T3 直接引导已实现、用户已验收并提交，证据见同页。
- T2 选项模型上下文与调试功能已实现、用户已验收并提交；引用内容等 T5。

下一动作：实现 T4；[探针](tasks/teaching-phase1/plan-probe-2026-11-25.md)已通过（deepseek-flash，8 轮），脚本与记录未提交。

## 3. 验证证据

文档整理轮（2026-11-24，`391499b` + 工作区，后提交为 `a18d017`，Windows）：单元测试 226/226 退出正常、两份源码 eslint 通过、
`session-loop` 17/17、`vite build` 成功（大 chunk 提示保留）、Markdown 相对链接无断链、
归档 30 项 SHA-256 一致；未跑浏览器或真实模型。

| 范围 | 结果 | 详情 |
| --- | --- | --- |
| 11-21 测试保活与上下文实测 | 当时完整回归 226/226、`session-loop` 17/17；真实端点未验 | [记录](tasks/context-usage-2026-11-21.md) |
| 11-14 文本导出 | 专项 26/26；已推送 main，Vercel success | [记录](tasks/conversation-text-export-2026-11-14.md) |
| 11-14 全量备份 | 本地独立存储恢复通过 | [记录](tasks/data-backup-2026-11-14.md) |

2026-11-25 清理（`a18d017` + 工作区）：单元测试 229/229、`session-loop` 17/17、构建成功；未跑浏览器。
一期文档阶段用 Node 探测过 remark-math 的货币误判与 `#ref:` 链接保留。
历史结果不代表当前工作区已验证。
最终文件落盘及真实设备/真实模型尚未验收；生产数据中未执行导入。

## 4. 未关闭事项

2026-11-25 已逐条核对。只列仍需动作的事项：

| ID | 事实与影响 | 下一动作 / 解除条件 |
| --- | --- | --- |
| B-01 用户验收 | 未在另一设备用真实备份恢复；TXT/JSON 最终落盘未核实（含原 B-04、G-02） | 用户导出、在另一设备导入并续聊，阅读一份 TXT |
| V-02/V-03/V-04 真实端点 | 三工具、副模型、上下文占用未在目标端点验证 | 并入一期 T6 |
| C-02 旧用户数据 | v1 历史、旧配置与学习记录键仍兼容读取或备份 | 保留；退役需单独产品决定 |
| C-03 清理余项 | LandingPage、闲置翻译键与依赖、DesignPreview 旧文案 | 见 [清理盘点](tasks/cleanup-2026-11-25.md)，按需处理 |

本轮关闭：P-01 文案已修、P-02 重试作废旧题、C-01 删除 28 个旧源码文件，均未做浏览器确认；G-01 本机产物无仓库动作。B-02、B-03、S-01 是已接受的
边界，不再列为待办，见 [现行知识](knowledge/agent-upgrade.md) §9、§10。
B-04 的 MutationObserver 错误：`src` 中无此调用，来源仍未定位；再次出现时重新立项。

## 5. 知识和历史入口

- [文档导航](README.md)、[Harness 方法](harness/README.md)
- [现行业务与架构](knowledge/agent-upgrade.md)、[阶段总结](knowledge/agent-upgrade-summary.md)
- [ADR-002：完整文件备份](decisions/ADR-002-data-backup.md)
- [ADR-003：教学状态与引用](decisions/ADR-003-teaching-state.md)、[ADR-004：直接引导](decisions/ADR-004-direct-guidance.md)（提议）、[ADR-005：重试作废旧题](decisions/ADR-005-retry-supersedes-questions.md)
- [改动点整理（2026-11-24）](tasks/improvement-points-2026-11-24.md)
- [测试保活与上下文实测验证](tasks/context-usage-2026-11-21.md)
- [文本导出验证](tasks/conversation-text-export-2026-11-14.md)、[旧单条 JSON 验证](tasks/single-conversation-export-2026-11-14.md)
- [全量备份验证](tasks/data-backup-2026-11-14.md)
- [上下文窗口历史报告](research_context_window/report.md)
- [A–G 历史索引](archive/agent-upgrade-2026-11-01/README.md)

学习链路 ADR 和当时实现证据保留在 `eab0f12` 历史中，已被 `11c0c63` 撤销取代。
本轮仅兼容备份残留数据，不改变撤销结论；历史测试和人工验收不等于当前提交已验证。

## 6. 维护方式

开始任务先核对本页和 Git，再按范围读现行知识；用户新授权优先于旧下一步。
稳定结论写知识/ADR，详细证据放任务记录，收尾覆盖当前交接，避免累积完整日志。
不要提交真实备份、密钥、完整本机配置或环境日志；实现、验证、验收和发布分别记录。
