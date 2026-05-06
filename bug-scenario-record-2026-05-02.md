# 将原始 HTTP/SSE 迁移至 Vercel AI SDK 并支持思考模式

> 生成时间：2026-05-06  
> 任务类型：库迁移  
> 技术栈：React 18、Vite 6、`ai@6.0.173`、`@ai-sdk/openai@3.0.57`、DeepSeek R1 / Qwen QwQ

---

## 前置上下文（粘贴到下次对话开头）

> 本节是本文件最重要的部分。在涉及 `@ai-sdk/openai` v3+ 或 `ai` v6+ 的任何任务开始前，将以下内容告知 AI。

```
使用 @ai-sdk/openai v3.x（ai@6.x）的必知事项：

1. 【端点路由】用 provider.chat(modelId) 而非 provider(modelId)。
   v3 的 provider() 默认走 OpenAI Responses API（/responses），
   第三方 OpenAI-compatible API（DeepSeek、Qwen 等）不支持该端点，返回 404。

2. 【字段名变更】fullStream part 字段在 v6 中已重命名：
   - 正文：part.textDelta → part.text（type 仍为 text-delta）
   - 思考：part.type === 'reasoning' → 'reasoning-delta'，内容同为 part.text

3. 【thinking 内容缺失】@ai-sdk/openai chat provider 的 schema 不包含
   delta.reasoning_content，直接丢弃。
   解决：streamText 传 includeRawChunks: true，在 part.type === 'raw' 时
   手动提取 part.rawValue?.choices?.[0]?.delta?.reasoning_content。

4. 【React hook 顺序】新增 hook 时，其返回值被已有 hook 消费的，
   必须在消费它的 hook 之前调用（const 时间死区）。

5. 【测试路径对齐】设置面板"连接测试"必须与实际调用完全一致：
   stream: true、相同参数集（frequency_penalty、presence_penalty、top_p）。
   stream: false 的测试可以通过但 stream: true 可能失败。
```

---

## 问题类型分布

| 类型 | 数量 | 占比 |
|---|---|---|
| 集成边界 | 4 | 80% |
| 状态 | 1 | 20% |
| 规格空白 | 0 | — |
| 环境 | 0 | — |

**主导类型：集成边界** — 库迁移任务中，外部依赖的版本行为是最大风险源。4/5 的 Bug 来自"AI 对 SDK 行为的假设与实际安装版本不符"。

---

## 可复用规律（L3）

### 规律 1：新版本 SDK 的默认入口不等于旧版本的入口
- **规律**：库的主版本升级（major version）后，默认调用方式可能路由到完全不同的端点。不要假设 `provider()` 的行为与旧版本一致。
- **触发条件**：引入新 major version 的 SDK，特别是带有多端点/多模式支持的库
- **验证方式**：读 `node_modules/<package>/dist/index.js`，搜索入口函数的 `url` 或 `path` 字段
- **本次实例**：`@ai-sdk/openai` v3 的 `provider()` → `/responses`；v2 → `/chat/completions`

### 规律 2：SDK 的 stream part 字段名须从源码确认，而非依赖文档
- **规律**：streaming API 的 part 结构（字段名、type 值）在 minor/major 版本间可能无声变更，文档滞后于代码。
- **触发条件**：使用任何 streaming SDK 时，迭代 `fullStream` 等异步迭代器
- **验证方式**：`grep -n "type.*delta\|textDelta\|\.text" node_modules/ai/dist/index.js`
- **本次实例**：`part.textDelta` → `part.text`；`'reasoning'` → `'reasoning-delta'`

### 规律 3：OpenAI-compatible SDK 不一定支持第三方模型的私有字段
- **规律**：为 OpenAI 设计的 SDK 只解析 OpenAI 规范字段。第三方模型的扩展字段（如 `reasoning_content`）会被 schema 直接丢弃，不会报错。
- **触发条件**：通过 OpenAI-compatible SDK 接入非 OpenAI 模型，且该模型有扩展字段
- **验证方式**：搜索 SDK 源码中的 schema 定义，确认目标字段是否在其中
- **本次实例**：`@ai-sdk/openai` chat provider schema 无 `reasoning_content`；需 `includeRawChunks` 绕过

### 规律 4：新 hook 的声明位置必须先于其消费者
- **规律**：`const { a } = useHookA()` 声明之后才能在 `useHookB({ a })` 中使用；`const` 不会提升。在已有复杂 hook 链的组件中插入新 hook，必须先画依赖关系再决定插入位置。
- **触发条件**：向已有多个 hook 的 React 组件中插入新 hook
- **验证方式**：画出 hook 调用顺序及参数依赖关系；或 ESLint `react-hooks/exhaustive-deps` 规则
- **本次实例**：`useRequestLogger` 插入底部，`useQuestionFlow` 在上方引用其返回值 → 白屏

### 规律 5：验证代码必须与生产代码走相同路径
- **规律**：测试用 `stream: false` 而生产用 `stream: true`，两者可能走完全不同的服务端逻辑，导致测试通过但生产失败。验证代码应与生产代码使用相同的参数集和模式。
- **触发条件**：为接口/配置新增"测试连接"类功能时
- **验证方式**：对比测试代码与生产调用代码的参数，逐一核对
- **本次实例**：设置面板测试用 `stream: false + max_tokens:1`，实际对话用 `stream: true + 全参数`

---

## Bug 记录（L1）

> 本节服务于溯源，不用于传递给 AI。

### Bug 1：白屏（React hook 时间死区）

| 字段 | 内容 |
|---|---|
| 症状 | 页面完全空白，无报错输出 |
| L2 类型 | 状态（初始化顺序） |
| 根本原因 | `useRequestLogger()` 被插在组件底部（第 570 行），但第 143 行的 `useQuestionFlow` 已经在参数里引用了 `startLog` 等变量。`const` 时间死区导致 ReferenceError，React 捕获后渲染空白页 |
| 修复方式 | 将 `useRequestLogger()` 移到 `useAgentsConfig` 之后、`useQuestionFlow` 之前 |
| 提前发现方式 | 在插入新 hook 前，检查该 hook 的返回值是否被现有 hook 消费 |
| 是否可自动化防御 | ✅ 是（自定义 ESLint 规则检查 hook 引用顺序，或 TypeScript 严格模式） |

### Bug 2：设置面板测试通过但实际对话 404

| 字段 | 内容 |
|---|---|
| 症状 | 设置面板"连接测试"返回成功，但实际发起对话时 404 |
| L2 类型 | 规格空白（测试路径与生产路径参数不一致） |
| 根本原因 | 测试使用 `stream: false + max_tokens:1`，生产使用 `stream: true + frequency_penalty + presence_penalty`，部分 API 对两者校验逻辑不同 |
| 修复方式 | 重写测试逻辑：`stream: true`，读取第一个 SSE chunk 后 cancel，使用与生产相同的完整参数集 |
| 提前发现方式 | 对比测试代码与生产代码的 request body |
| 是否可自动化防御 | ✅ 是（抽取公共的请求参数构建函数，测试和生产共用） |

### Bug 3：HTTP 404 — 请求打到 `/responses` 而非 `/chat/completions`

| 字段 | 内容 |
|---|---|
| 症状 | HTTP 404，调试面板"实际 URL"显示 `…/v1/responses` |
| L2 类型 | 集成边界（SDK major 版本行为变更） |
| 根本原因 | `@ai-sdk/openai` v3.x 中 `provider(modelId)` 默认调用 `createResponsesModel`，路由到 OpenAI Responses API（`/responses`）；v2 路由到 `/chat/completions` |
| 修复方式 | `provider(model)` → `provider.chat(model)` |
| 提前发现方式 | 读源码：`grep "url.*path\|createLanguageModel\|createResponsesModel" node_modules/@ai-sdk/openai/dist/index.js` |
| 是否可自动化防御 | ✅ 是（封装 provider 创建逻辑，明确指定 `.chat()`） |

### Bug 4：`Cannot read properties of undefined (reading 'length')`

| 字段 | 内容 |
|---|---|
| 症状 | 流式响应开始后崩溃，错误为 `undefined.length` |
| L2 类型 | 集成边界（SDK API shape 变更） |
| 根本原因 | `ai` v6 中 `fullStream` text-delta part 的内容字段从 `part.textDelta` 改为 `part.text`；reasoning 类型从 `'reasoning'` 改为 `'reasoning-delta'`。代码仍读 `part.textDelta`（undefined），触发 `undefined.length` |
| 修复方式 | 全局替换：`part.textDelta` → `part.text ?? ''`；`'reasoning'` → `'reasoning-delta'`；加 `if (!text) continue` 防空串 |
| 提前发现方式 | `grep -n "textDelta\|text-delta\|reasoning" node_modules/ai/dist/index.js` |
| 是否可自动化防御 | ✅ 是（用 TypeScript 严格类型，SDK 提供类型定义时会在编译期报错） |

### Bug 5：思考内容无法显示

| 字段 | 内容 |
|---|---|
| 症状 | 使用 DeepSeek R1 / Qwen QwQ，`ThinkingBlock` 组件始终为空 |
| L2 类型 | 集成边界（库功能缺口） |
| 根本原因 | `@ai-sdk/openai` chat provider 的 `openaiChatChunkSchema` 中完全没有 `reasoning_content` 字段，SSE 中的 `delta.reasoning_content` 被 schema 静默丢弃，不产生任何事件 |
| 修复方式 | `streamText` 开启 `includeRawChunks: true`；在 `fullStream` 中处理 `part.type === 'raw'`，手动提取 `part.rawValue?.choices?.[0]?.delta?.reasoning_content` |
| 提前发现方式 | 搜索 SDK schema：`grep -n "reasoning_content" node_modules/@ai-sdk/openai/dist/index.js` 结果为空即确认不支持 |
| 是否可自动化防御 | ❌ 否（需要运行时验证；可加日志：若模型支持 reasoning 但 `currThinking` 持续为空，输出警告） |

---

## 知识状态对比

| 假设 | 实现前以为 | 实现后确认 |
|---|---|---|
| `provider(modelId)` 行为 | 与 v2 一样，调用 `/chat/completions` | v3 默认调用 `/responses`，需用 `provider.chat()` |
| `fullStream` part 字段名 | `part.textDelta`、type `'reasoning'` | `part.text`、type `'reasoning-delta'` |
| SDK 对 `reasoning_content` 的处理 | 会提取并发出 reasoning 事件 | schema 中无此字段，静默丢弃 |
| 设置面板测试的可靠性 | `stream: false` 通过 = 生产可用 | 两者走不同服务端逻辑，需用相同参数测试 |
| hook 插入位置 | 插在组件末尾即可 | 必须在所有消费其返回值的 hook 之前 |

> 本表共 5 行——说明本次迁移任务有大量规格盲区，AI 不宜自主完成，需人工在关键路径上测试介入。
