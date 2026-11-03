# 主流编码 Agent 上下文展示调研

查阅日期：2026-11-03。只用官方文档与官方发布，不验证实际安装版本；总计 5 个搜索查询，随后直接读取来源。范围：Cursor、Claude Code、Cline；未另扩展 Roo。

| 产品 | 位置与交互 | 数据含义与限制 |
| --- | --- | --- |
| Cursor | 输入区旁有上下文圆环；点击打开分类明细，悬停分类联动高亮 | 展示本会话已占 tokens；分类包含系统指令、工具、规则、技能、MCP、子代理、压缩摘要、对话。文档未给计数实现和具体模型容量来源，不能据此声称精确计数 |
| Claude Code | 可定制终端底部 status line，官方示例为模型名、进度条和百分比；`/context` 可另看分布 | status line 的当前值来自最近一次 API 响应；官方区分当前窗口统计与费用。输入包含新输入、cache read 和 cache write；当前 `used_percentage` 仅以这些输入 tokens 除窗口容量，不含输出。`/context` 会估算最近响应后新增消息，因此可更高 |
| Cline | 官方发布介绍 Context Window Progress Bar，并同时列输入、输出 token 统计及模型总容量 | 进度条表示窗口占用，输入/输出箭头是另一组统计；2025 博客中的模型容量和截断阈值只作为历史示例，不能硬编码为 2026 模型元数据。未从此博客确认当前实现计数方式 |

## 可借鉴的设计判断

1. 紧贴输入区的小型圆环/进度条加数字，持续让用户看到 `当前占用 / 总容量`；点击可展开来源和明细，触屏也可操作。这是对 Cursor 与 Claude Code 模式的设计综合，并非对其源码复用。
2. 当前窗口占用与整段会话累计计费 tokens 分开。每轮多步调用的 inputTokens 不能直接相加充当上下文大小；若用最近一次请求实测值，须写明“上次请求”，不能冒充包含后续新消息的实时总量。
3. 需要纳入系统提示词、工具定义、实际发往模型的合格历史。模型上下文投影不能从 UI 文本直接统计。缓存命中仍占上下文，不能扣掉 cache tokens。
4. 没有实测时可展示明确标识的估算值；总窗口未知时应显示未知/待设置，不应默认填通用 128k。窗口容量应来自当前提供商和准确模型元数据，或用户可配置值。
5. 无响应、无 usage、切换模型/会话、修改系统提示词时需要处理无效或过期统计。Claude Code 官方也明确要求处理 null / 缺字段。
6. 自动压缩是独立功能；单做用量显示不应自动改写或丢弃会话。

## 官方来源

- [Cursor：Prompting agents / Context usage](https://cursor.com/docs/agent/prompting#context-usage)：输入区圆环与点击分类明细的当前官方描述。
- [Claude Code：Customize your status line](https://code.claude.com/docs/en/statusline#context-window-fields)：窗口容量、最近响应、缓存口径、null 状态、百分比公式；同页故障排查说明 `/context` 与 status line 的估算差别。
- [Claude Code cheatsheet](https://support.claude.com/en/articles/14553413-claude-code-cheatsheet)：`/context` 显示当前窗口内容；`/usage` 是套餐限制与限流，不能混同。
- [Cline：Context Window Progress Bar 发布介绍，2025-01-30](https://cline.bot/blog/understanding-the-new-context-window-progress-bar-in-cline)：进度条、输入输出统计及模型总容量。
- [Cline：Tasks / Context Window](https://docs.cline.bot/core-workflows/task-management)：会话、文件、命令/工具输出和系统指令填充上下文，接近容量时压缩。

## 版本差异

Cursor 官方论坛 2026-04 与 2026-07 有显示位置及常驻百分比变化记录，但当前官方文档已明确输入区圆环。实现以当前文档可借鉴的交互为主，不承诺所有 Cursor 布局或版本完全一致。官方文档未披露的 token 统计/模型识别细节在本次调研中保留未知。
