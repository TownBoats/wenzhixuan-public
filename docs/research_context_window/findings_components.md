# 上下文窗口组件调研

查阅日期：2026-11-03。范围：React 18 / Tailwind 3 现有项目可用的上下文占用组件；只调研，未安装依赖。共 5 条搜索查询，补充直接查阅官方文档和源码。

## 已核实事实

### AI Elements Context

- [官方 Context 文档](https://elements.ai-sdk.dev/components/context)：`Context` 接收 `usedTokens`、`maxTokens`、`usage`、`modelId`，提供小型环形百分比和悬浮详情；可拆分显示输入、输出、reasoning 与缓存计数，价格展示使用 tokenlens。组件没有自动为本应用组装模型上下文。
- [官方源码](https://raw.githubusercontent.com/vercel/ai-elements/main/packages/elements/src/context.tsx)：直接依赖 shadcn Button / HoverCard / Progress、React Context、tokenlens，未使用 Recharts。占用按传入的 `usedTokens / maxTokens` 计算；组件不会判定分子究竟是单次请求还是多轮累计。源码没有对未知或为零的容量统一防护，调用方需先区分未知状态。SDK usage 只是详情数据，分子由调用方另外提供。
- [安装要求](https://elements.ai-sdk.dev/docs)：当前版本面向 React 19 与 Tailwind CSS 4，默认围绕 Next.js、AI SDK、shadcn 配置。CLI 会向项目复制组件源码并加入依赖，而不是只装一个独立计量器。
- [官方仓库](https://github.com/vercel/ai-elements)：当前公告计划在 2026 年 11 月底弃用原项目，迁往 shadcn/ui。不要基于旧安装命令贸然引入新体系。
- [AI Elements LICENSE](https://github.com/vercel/ai-elements/blob/main/LICENSE)：Apache-2.0；若复制或修改其源码，须按许可保留相应声明。这里只参考设计与 API，未复制实现。

### 新 shadcn Context 配方

- [官方 Radix Context 文档](https://ui.shadcn.com/docs/ai-elements/radix/context)：以 Hover Card、Progress 和 Button 组合，触发器显示百分比，详情显示 used / limit 与进度条。文档示例以输入加输出作为 used，并明确模型窗口上限不由 AI SDK 发送，应用须自行提供。
- 同页的迁移配方保留 `usedTokens`、`maxTokens`、`usage`、`modelId` API，替换内部渲染。对于存在多步工具循环的项目，示例使用的 `totalUsage` 是否能代表当前窗口，仍须由应用根据本身上下文语义核实；不能直接把所有请求输入累计数当窗口占用。
- [shadcn LICENSE](https://raw.githubusercontent.com/shadcn-ui/ui/main/LICENSE.md)：MIT。源码复用应保留许可与版权声明。

### Radix、图表依赖与无障碍

- [Radix Hover Card package.json](https://raw.githubusercontent.com/radix-ui/primitives/main/packages/react/hover-card/package.json)：MIT，React peer 范围包含 React 18。它本身能服务本项目，但会引入定位、Portal、焦点等多个 primitive 依赖；这与直接采用当前 AI Elements 整套版本不同。
- [Radix Hover Card 文档](https://www.radix-ui.com/primitives/docs/components/hover-card)：支持开关控制、延迟和碰撞处理；官方明确 HoverCard 面向视觉预览，屏幕阅读器忽略其内容。因此当前占用和总容量不能只放在 hover 详情里。触屏和键盘操作也需独立考虑。
- 这次核实的官方 Context 配方不需要 Recharts。单一占比可用 SVG 环或原生进度元素；为它额外引入图表库没有已证明的必要性。

### 备选：assistant-ui ContextBreakdown

- [官方 Context breakdown 文档](https://www.assistant-ui.com/elements/context-breakdown)：有不需要 runtime/provider 的 props 模式，传入 `segments` 和 `limit`，绘制各段占用与余量，容量来源仍由应用提供。它适合已有可信分类计数时的分段展示。
- 文档说明提供方通常只给整体输入/输出，系统提示、工具、附件等分类需应用自己计量。该项目本轮只要当前占用与总量，无须先制造没有数据依据的分类。其示例遍历每条消息累计 usage 的口径，不可未经检查迁入本项目当前窗口指标。

## 本项目建议（基于上述事实的判断）

优先复用“小型进度标识 + 当前 / 总量 + 可展开说明”的成熟交互，沿用现有 React、Tailwind tokens 与 PropTypes 实现一个小组件，不升级 React/Tailwind、不安装 AI Elements、tokenlens 或 Recharts。若项目未来系统采用 Radix/shadcn，再考虑复用 primitive。

组件应只消费已计算的只读用量投影；运行层提供 SDK 实测，数据缺失时明确标为估算或未知。总容量应有可核对来源或用户配置，不能把 `max_tokens`（输出预算）当总上下文窗口。容量未知时显示“总容量未设置”，不计算百分比；估算时明确标识。关键数值常驻可见，详情可通过点击与键盘访问，并适配移动端。

这个建议不等于验证了任何 provider 的真实 token 行为，也不替代本地多步运行、取消、恢复与模型切换的实现测试。
