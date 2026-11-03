# 对话上下文窗口：调研与实施

日期：2026-11-03。源码基准：`dev` 的 `11c0c63` + 本轮工作区；Windows / Node v22.22.1 / pnpm 10.9.0。

## 调研结论

[Cursor](https://cursor.com/docs/agent/prompting#context-usage) 在输入区显示圆环，点击查看分类；[Claude Code](https://code.claude.com/docs/en/statusline#context-window-fields) 提供底部状态行，区分最近请求的上下文和累计消耗；[Cline](https://cline.bot/blog/understanding-the-new-context-window-progress-bar-in-cline) 提供窗口进度条和总容量。各自统计口径不同，不能据界面相似断言计数方式相同。详细查阅记录见 [Agent 调研](findings_agents.md)。

可用组件包括 [AI Elements Context](https://elements.ai-sdk.dev/components/context) 与 [shadcn Context](https://ui.shadcn.com/docs/ai-elements/radix/context)。它们接收应用传入的占用和容量，不会替应用判定当前模型窗口。现版 AI Elements 的 React 19 / Tailwind 4 要求与本项目 React 18 / Tailwind 3 不一致；本轮参考交互，使用现有 tokens、React、PropTypes、SVG 自行实现，未复制第三方源码，未安装依赖。许可、替代项与无障碍限制见 [组件调研](findings_components.md)。

## 实施与计数边界

- 输入框下常驻 `≈ 当前占用 / 总容量 tokens · 百分比`，圆环表示占比；点击查看分类、精确数字、来源和容量设置入口，支持触屏、键盘、Escape 和外部点击关闭。
- 当前数值是粗略字符估算：ASCII 每字符约 0.25 token，非 ASCII 码点约 1.5 token，另含消息开销。它不是模型 tokenizer，不承诺误差范围。
- 系统指令取当前模式；工具定义直接复用三个工具的真实 description/schema；历史由 `buildModelContext` 筛选，计入可发送的 user/assistant/tool、生成中的可见文本/已完成工具及输入草稿。
- 不统计 reasoning、失败/取消/中断历史、旧运行片段、临时参数预览；估算不写存储或模型消息。生成中未完成工具与不可见开销可能使估算偏低。
- 接口实测作为另一组数字单列：运行层取 `steps.at(-1).usage` 的 input/output，经 hook、reducer 传给 UI；不取多步累加的 totalUsage，不把缓存命中从 input 中扣掉。SDK 区别见 [streamText 官方文档](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)。
- usage 缺字段/非法时不伪造 0；重试清空旧值，迟到结果沿用原 runId/状态守卫。仅在最后一轮已完成/待作答且模型名匹配时显示实测。
- 总容量优先主模型 `contextWindow` 手动值；仅对 HTTPS `api.deepseek.com` 与准确模型名 `deepseek-flash` / `deepseek-v4-pro` 提供 1,048,576 tokens 默认。来源：[DeepSeek 官方元数据](https://api-docs.deepseek.com/api/list-models/)，本次查阅示例明确 context_window 包含输入与输出。
- 其他模型/端点显示“总量未设置”，不计算比例。没有使用 max_tokens 当总窗口，没有额外请求远端模型目录；静态资料可能过期，用户可覆盖。
- 主模型或端点变更时清除手动容量，避免把旧模型容量沿用到新模型。此功能不压缩、不截断、不阻止发送。

## 存储与回退

v2 turn 可选增加 `contextUsage: {inputTokens, outputTokens}` 与 `usageModel`；只保存有限非负整数和模型名，不保存 raw usage、端点、headers、密钥或 reasoning。旧记录缺字段时为 null，不批量迁移；旧版本会忽略这些新增字段。主模型配置可选增加 `contextWindow`，旧配置继续可读；原会话键和 schemaVersion 均未改变。

## 本轮证据

- 完整命令：`node --test "src/agent/__tests__/*.test.js" "src/utils/__tests__/*.test.js"`（执行时加 spec reporter，仅改变输出）。195 项：188 通过、0 断言失败、7 取消，退出码 1。取消原因是 `11c0c63` 已记录的候选服务超时测试进程保活问题，未作为本轮修复范围。
- 新增 6 项行为验证：提供商/模型容量识别与未知、真实 schema/历史估算边界、流式重试排除、usage 白名单/存储恢复/迟到守卫、多步只取最后请求、无 usage 不伪造零值。均通过；SDK 运行测试使用 MockLanguageModelV3。
- 改动及新增 14 个 JS/JSX 文件 ESLint 通过；`node scripts/session-loop.mjs` 17/17。ConfigManager 原有两个未使用 catch 变量在改动文件内移除，行为未改变。
- `pnpm exec vite build` 最终成功 14.93s。Browserslist 数据陈旧与大 chunk 提示保留，不升级依赖。
- Chrome 本地 Vite 5175：桌面、390×844，详情展开、Escape、草稿增减、手动容量 32768 与恢复自动识别通过；390px 时文档宽度 390、面板左右边界 16/368，无横向溢出。测试草稿已清空、容量已恢复、视口 override 已 reset，没有发送真实模型请求。
- 截图只保存在本机 visualization 目录，未纳入公共仓库；没有记录浏览器配置和会话原文。
- 未执行用户人工验收、真实端点 usage 验证、发布；本轮未提交、推送或集成分支。
