# 归档交付记录

日期：2026-11-01。归档源码基准：`347a6a44f44356102b3e7cd7d6ef393f4c784b2e`。本记录描述本轮资料整理，不是产品发布或当前源码回归报告。

## 本轮范围

1. 完整复制原 `docs/agent-mvp/` 27 文件、总纲1份、旧规则2份，共30原件，保存来源/字节数/SHA-256清单。
2. 建立 `docs/harness/` 方法、模板、过程复盘和提取依据。
3. 建立 `docs/knowledge/` 现行业务架构与整个升级阶段总结。
   - 材料覆盖：16份总纲/阶段方案/指导/基线/F验收共2701行由独立审阅完整读取；决策台账1284行由主流程逐段读取；长HANDOFF按关键章节与日志交叉核对。读取后补充了F验收证据混合边界、一次性冒烟空窗、v1未续聊数据清理风险及长任务证据回收规则。
4. 建立根 `AGENTS.md` 和两个短工具规则入口，替代重复阶段规则正文。
5. 建立短 `docs/HANDOFF.md`，原交接及工作包README改为兼容导航；旧协议、架构图和总纲注明历史边界。
6. 原决策记录只追加 ARCHIVE-1 归档选择；根README增加入口和版本说明。

## 完整性和结构检查

归档复制时逐文件字节与源文件相等，后续再次按manifest核对：

```text
Archive files: 30
Archive SHA-256 / bytes: 30/30 OK
Archive bytes: 1,194,105
Source HEAD: 347a6a44f44356102b3e7cd7d6ef393f4c784b2e
Active documents checked: 13
Local Markdown targets checked: 107
Local targets exist: OK
Current HANDOFF: 60 lines
Legacy HANDOFF pointer: 13 lines
Shared AGENTS: 44 lines
Tool rule entries: 16 / 14 lines
IDE diagnostics in checked documents/rules: 0
```

校验方法：Node内置fs读取 `manifest.json` 指向的每个快照，比较字节数并以crypto计算SHA-256；活动文档抽取本地Markdown链接，按所在文件目录解析目标并检查存在。只检查文件目标，不证明Markdown锚点、外部URL或历史原件内的旧链接全部有效。哈希不能证明历史内容真实；相关勘误见归档README。

`git diff --check` 对已跟踪变更未报告新增空白错误。新资料的基础格式检查发现根README两处原有行尾空白，未扩展修改旧介绍；IDE诊断未报告本轮文档错误。

## Git 和产品边界

- `.gitignore` 已改为跟踪 `docs/` 与两个短规则入口，`.codebuddy/teams` 等本机状态继续忽略。
- 根AGENTS、根README、原两份设计文档删除已随阶段提交入库；文档引用已修正。
- 没有修改src业务逻辑、scripts、package.json或锁文件，没有删除旧业务源码或清空浏览器数据。
- 已提交并推送 dev，再以快进方式同步 main；未部署或请求真实模型，具体哈希见 Git 日志。
- 未运行产品测试、ESLint全量或Vite构建；现有自动验证缺口与人工验收结论分别保留在新HANDOFF。

## 接手入口

从 [当前交接](../../HANDOFF.md) 和 [资料导航](../../README.md) 开始。若要公开提交本归档，先选择资料跟踪范围并复核历史中的个人信息、端点和本机路径，再执行暂存/提交；不把本轮本地归档记录当作远端提交证明。
