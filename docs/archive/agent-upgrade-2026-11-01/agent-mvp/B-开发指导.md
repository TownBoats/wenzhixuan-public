# 阶段 B 开发指导：运行层与提问工具

> 详细理由、决策点与监督办法见 `B-运行层与提问工具.md`；数据结构与协议以 `01-核心协议.md` 为唯一事实源。本文件是可直接照做的简版操作步骤。

**目标**：在 `src/agent/` 下做出一个**不依赖 React 的可测试执行单元**——输入「模式 + 配置快照 + 上下文消息 + `AbortSignal` + `onEvent`」，内部完成「模型 →（要求调用 `ask_question`）→ 程序执行副模型 → 结果回传 → 模型继续或停止」，输出**规范事件 + 清洗后的协议消息 + 结束原因**。先用 mock 测（B6），再用真实端点跑通一轮（B7）。

预计 3 小时。本阶段**只在 `src/agent/` 与 `scripts/` 里写文件**：不碰页面、不碰会话状态、不碰 localStorage。

---

## 开工前准备（约 15 分钟）

### 1. 先定四件事（`B-运行层与提问工具.md` 第 3 节，AI 不得自行拍板）

| 编号 | 要定什么 | 卡住哪个任务 | AI 倾向（仅供参考） |
| --- | --- | --- | --- |
| 决策 1 | `normal` / `socratic` 两份教学指令各保留什么 | B2 | ✅ 已拍板（`决策记录.md` **B-1**）：取消用户可见的模式控件，`socratic` 为唯一对用户可见的教学模式（代码层保留 tools 为空的无工具兜底模式）；保留导师角色/摸底/分层教学/排版建议，**删除全部 `〖…〗` 规则与单问号原则**；开场按初学者、之后按回答动态判断；「必须走工具」只在提示词留一句，参数规则放 `jsonSchema` / 工具 description；语言本期不处理 |
| 决策 2 | `ask_question` 的参数上限取值 | B4 | ✅ 已定（`决策记录.md` **B-5**）：采用 `question ≤ 500`、`context ≤ 2000`（跳过讨论、按方案默认值执行；D 阶段拿真实样例再调） |
| 决策 3 | 副模型用哪套配置 | B3（并影响 D5） | ✅ 已拍板（`决策记录.md` **B-4**）：副模型**单独配置**；缺副模型时必须有可读降级（`optionsStatus: 'unavailable'` + 手动作答），D5 覆盖该路径 |
| 小项 | B7 脚本的端点配置从哪读 | B7 | ✅ 已定（`决策记录.md` **B-7**）：沿用 A3 探针的 `PROBE_BASE_URL` / `PROBE_API_KEY` / `PROBE_MODEL`；密钥不进文件、不进对话 |

拍板后由 AI 把结论追加到 `决策记录.md`（B-1 起编号），并从 `HANDOFF.md` 第 4 节移除。

### 2. 带着 A 阶段的四条结论开工（`决策记录.md` A-5 / A-6，不得推翻）

1. **应用层去重是唯一防线**：探针实测 `parallelToolCalls: false` 被端点接受但**不生效**（第二步请求仍带两个 `tool` 消息）。所以「同一 `toolCallId` 只执行一次、只产生一张卡」必须写在 B4 / B5 的代码里，**不得依赖该参数**。（一轮可以问多个问题，见 `决策记录.md` B-3；去重针对的是「同一调用重复执行」和「同一文本重复提问」，不是「一轮只许有一个问题」。）
2. **思考模式默认保留，协议不变量 3 不动**：该端点上不回传 `reasoning_content` 的同轮多步与跨轮都是 200，且 SDK 组装的 assistant 消息里没有 reasoning。不要为了「回传 reasoning」去改协议或存储规则。
3. **`reasoning_effort` 的 `max` 必须注入请求体**：AI SDK 允许值只有 `none|minimal|low|medium|high|xhigh`，`max` 传不出去（原因在 SDK 不在端点）。`low/medium/high/xhigh` 走 `providerOptions.openai.reasoningEffort`；注入逻辑要与「内联开闸 fetch」共存、不互相覆盖请求体字段。
4. **provider 不要传 `compatibility`**：锁定的 `@ai-sdk/openai@3.0.63` 里该选项既无类型声明也无运行时处理（旧 `AgentModel` 传的是一个无效参数）。另外：思考模式下 `temperature` / `presence_penalty` / `frequency_penalty` 不生效，`top_p` 只 0.95–1.0 有效——**不要照抄旧 `AgentModel` 的 `temperature: 0.3` 假设**。

### 3. 环境与基线

- 端点与密钥只用环境变量传入，**不进文件、不进对话、不进测试**。
- 对照基线（A-2）：`npx eslint .` 目前 15 错误 / 3 警告（既有，只记录不修），`npx vite build` 通过。本阶段结束时要对比：**改动文件必须干净、全量错误数不得增加**。
- 会话切分（HANDOFF 第 0 节）：**B1–B3 一段会话，B4–B7 一段会话**。
- 固定的交付格式（每完成一个任务编号）：改动文件清单 → 逐条判据自检 → 协议不变量 1–8 自检 → 可直接复制的命令与原始输出 → 更新 `HANDOFF.md`。

---

## 分步操作

### 第 1 步：B1 · `src/agent/modelAdapter.js`

**做法要点**

- 按**配置快照**每轮新建 provider，不复用可变的单例（运行中改模型不得影响已开始的一轮）。
- `maxRetries: 0`；重试策略留给上层。
- 用 `maxOutputTokens`（不是 `maxTokens`）。
- 接收外部 `AbortSignal`，与内部超时信号合并（`AbortSignal.any` 或自建转发），超时与取消要能分别上报。
- `fullStream` → 规范事件映射；`partId` 由适配器生成且**同一段文本的后续 delta 必须落到同一 `partId`**。
- **开闸标记（U+200B）清理两处**：流事件里、收集 `response.messages` 后（文本块过滤后为空则丢弃该块）。
- 内联开闸 fetch：从 `AgentModel` **复制**这段逻辑，**不要 import `AgentModel`**。

**你检查**

| 看什么 | 期望 |
| --- | --- |
| 事件序列 | 与 `01-核心协议.md` 第 4 节一致，每个事件都带 `runId` |
| `response.messages` | 不含 U+200B |
| 取消 | `abort` 之后不再产生任何事件 |
| 重试 | 能证明只请求了一次（`maxRetries: 0` 生效） |
| 分段 | 同一段文本的多个 delta 共用一个 `partId` |

**追问 AI**：「适配器在几个地方清理了开闸标记？」——答案必须是两处。

### 第 2 步：B2 · `src/agent/modes.js` + 两份教学指令

**做法要点**

- `src/agent/skills/normal.md`、`socratic.md` 是可读的产品内容，用 Vite `?raw` 导入，不写成 JS 字符串。
- 模式对象包含：模式 ID、系统提示词、**允许注册的工具集合**、是否允许提问。
- 「普通模式不提问」靠**不注册工具**实现，不靠提示词里写「不要提问」。
- 拼接顺序：程序协议约束 → 模式教学指令 → 会话内容；用户自定义提示词不参与。
- **约束（规则第 7 节）**：被 `node --test` 导入的模块不能依赖 `?raw` / `@/` 别名 / JSX。所以模式的可测部分是纯函数（教学指令文本作为参数注入），`?raw` 只出现在模式装配的入口文件里。

**你检查**

| 看什么 | 期望 |
| --- | --- |
| `normal` 的工具集合 | 空 |
| `socratic` 的工具集合 | 只有 `ask_question` |
| 两份 `.md` | 不含任何 `〖…〗` 输出格式规则 |
| 提示词里 | 不再出现「不要提问」这类靠建议实现的约束 |

### 第 3 步：B3 · `src/agent/services/generateAnswerOptions.js`

**做法要点**

- 输入 `{ question, context, language, abortSignal, config, systemPrompt }`，输出 `{ status, options }` 或 `{ status:'unavailable', errorCode, detail }`（结构化，不抛异常）。
- **用 B1 的 `modelAdapter` 跑副模型，不用 `AgentModel`**（`决策记录.md` B-10：`AgentModel` 无 `abortSignal`、无 `abort()`，内部超时还会触发 3 次重试）。`timeoutMs = min(45s, 主运行剩余时间)`，`maxRetries: 0`。
- 配置与提示词由上层传入（运行层不读 localStorage）；`config` 只需 `{ endpoint, apiKey, model }`，endpoint 必须是绝对地址。
- 档位解析用 `src/utils/ContentParser.js`（`new ContentParser(['none','heard','basic','familiar','expert'])`，返回**对象**、每档是数组）。取 `parsed[level]?.[0]?.content`，**同档多条只留第一条**。
- **放宽口径**：≥1 条可识别档位即 `ready`；零条才算 `unavailable` + `detail: 'invalid_output'`。
- 失败只返回白名单 `detail`（`timeout` / `cancelled` / `request_failed` / `invalid_output` / `HTTP <三位数>`），不得透传 `responseHeaders`、`responseBody`、`actualUrl`。

**你检查**（注入假 fetch 的 SSE，不需要网络）

| 输入 | 期望 |
| --- | --- |
| 五档齐全 | `status: 'ready'`，5 条，顺序 `none → heard → basic → familiar → expert` |
| 只有三档 | `status: 'ready'`，3 条（缺档不再算失败） |
| 同一档两条 | 只保留第一条 |
| 零条可识别档位 | `status: 'unavailable'` + `errorCode: 'option_model_failed'` + `detail: 'invalid_output'` |
| 请求失败 | `status: 'unavailable'` + `errorCode: 'option_model_failed'`，`detail` 为 `HTTP <码>` 或 `request_failed`，且不含密钥、请求头、端点 |
| 超时 | `detail: 'timeout'` |
| 未配置副模型 | `status: 'unavailable'` + `errorCode: 'option_model_not_configured'`，且**不发起任何请求** |

**追问 AI**：「副模型失败那个用例，是注入假对象还是真的断网？」——两者都可以，但必须说清是哪种。

### 第 4 步：B4 · `src/agent/tools/askQuestion.js`

**做法要点**

- `jsonSchema()` 声明形状（`additionalProperties: false`）+ **`execute` 内显式校验函数**（长度、去空白、拒绝未知字段、模式是否允许、本轮是否已问过）。
- **工具实例每轮一个**；`toolCallId → 上次结果` 与"本轮已问文本"两张表放闭包，随轮销毁。
- **`toolCallId` 去重排在最前**（幂等优先）：否则重放会先被判 `duplicate_question`（`决策记录.md` B-11）。
- 问题 ID 由程序生成，模型不能传：`q_` + 12 位十六进制。
- 拒绝也返回**合法结果**：`{ status:'rejected', reason, message? }`，reason ∈ `invalid_input | duplicate_question | mode_not_allowed | internal_error`。
- 程序异常 → `internal_error` + 固定文案，**不回传异常原文**（可能含端点/密钥）。
- 未配置副模型先判 `isOptionConfigReady`，不 ready 时零请求。
- `execute` 内**绝不等待学生**：立即返回 `{ status:'ready', …, nextAction:'await_user' }`。
- 测试注入 `generateOptions` 假函数（B3 的行为已由它自己的 11 条测试覆盖）。

**你检查**

| 输入 | 期望 |
| --- | --- |
| 正常输入 | `ready`，问题 ID 由程序生成，带完整 `options` |
| 空 / 超长 / `context` 超长 / 含未知字段 / 类型不对 | `rejected('invalid_input')` |
| 同 `toolCallId` 再执行 | 返回上次结果，不产生第二张卡，且不再调副模型 |
| 同 `toolCallId` 重放且传非法参数 | 仍返回第一次的结果（证明去重在校验之前） |
| 本轮已问过相同文本的问题 | `rejected('duplicate_question')`（只判完全相同） |
| 模式为 `normal` | `rejected('mode_not_allowed')`，且不调副模型 |
| 未配置副模型 | `ready` + `unavailable` + `not_configured`，且零请求 |
| 副模型失败 | 问题仍在，`unavailable` + `option_model_failed` |
| 副模型抛错 | `rejected('internal_error')`，结果里无异常原文/端点/密钥 |

### 第 5 步：B5 · `src/agent/runTeachingAgent.js`

**做法要点**

- 预算：**最多 3 步**、主运行 **120 秒**、副模型**并发上限 4**（超出排队、失败隔离）；问题数量**不设硬上限**（教学指令软引导 2–3 个，见 `决策记录.md` B-3）。
- 停止条件：`stopWhen: [stepCountIs(3), askQuestionReady]`；`askQuestionReady` 检查**最后一步的 `toolResults` 中有没有 `nextAction === 'await_user'`**（**任一**命中即可），**不用 `hasToolCall`**。
- 同一响应里多个 `ask_question`：**全部执行**、每个都返回配对结果（一个都不丢弃）；同一文本重复提问返回 `rejected('duplicate_question')`。
- 结束原因五选一且不可合并：`completed | awaiting_user | failed | cancelled | limit_reached`。
- `responseMessages` 从 SDK 结果收集，**不手工拼装**。

**你检查**

| 看什么 | 期望 |
| --- | --- |
| 预算 | 能指到具体判断语句：步数上限、副模型并发上限 4（不接受「已经考虑了」） |
| 悬空调用 | 运行结束时每个 tool call 都有配对结果 |
| 结束原因 | `awaiting_user` 只在问题就绪时出现，与 `completed` 不混 |
| 事件归属 | 不属于当前 `runId` 的事件被丢弃 |

### 第 6 步：B6 · `src/agent/__tests__/`（6 个用例）

**做法要点**：`node --test` + `ai/test` 的 `MockLanguageModelV3`，**不自建模型 mock**（注入假副模型对象做服务层测试是允许的）。断言形式必须是「给定一串模拟模型输出 → 事件序列 / 状态」，不是「某函数返回某值」。测试文件里不得出现真实端点地址或密钥。

| 用例 | 断言 |
| --- | --- |
| 提问后停止 | 收到 `tool-completed` 后立刻 `run-finished{ awaiting_user }`，不再有第二步生成 |
| 副模型失败降级 | 工具结果 `optionsStatus: 'unavailable'`，问题文本仍在，结束原因仍是 `awaiting_user` |
| 一轮多个问题 | 三个 `ask_question`（两个不同文本、一个与前者重复）→ 两条 `ready` + 一条 `rejected('duplicate_question')`，卡片两张 |
| 无效参数修正一次 | 第一次非法 → 未立即停止；第二次合法 → 停止 |
| 超步数 | 模型持续调用工具 → `run-finished{ limit_reached }`，已完成内容保留 |
| 取消 | `abort` 后不再产生事件，结束原因是 `cancelled` |

**命令**

```bash
node --test src/agent/__tests__/ src/utils/__tests__/
npx eslint src/agent/
```

**你检查**：6 个用例全绿；失败项与计数贴出来；测试不依赖 `?raw` / `@/` 别名 / JSX。

### 第 7 步：B7 · `scripts/run-socratic-once.mjs`（真实端点）

**做法要点**：用真实端点跑一轮 socratic，固定一个教学主题（例如「闭包」），打印问题文本、五档答案、**总步数**、`response.messages` 的结构摘要。端点、模型与密钥沿用 A3 探针的环境变量（`PROBE_BASE_URL` / `PROBE_API_KEY` / `PROBE_MODEL`，见 `决策记录.md` B-7）；缺少变量时打印明确提示并退出，不静默失败。

**你检查**

| 看什么 | 期望 |
| --- | --- |
| 问题与五档 | 真实打印出来，不是占位文本 |
| 步数 | 打印出来，且停止发生在工具成功之后 |
| `response.messages` | 调用与结果配对，无悬空调用 |
| U+200B | 没有 |

**追问 AI**：「这一步总共生成了几步？请贴步数。」——没跑或没贴输出，本阶段不算完成。

---

## 通过标准

- B1–B7 逐条判据通过，`node --test` 6 个用例全绿（贴原始输出）。
- B7 有真实端点的原始打印（问题、五档、步数、`response.messages` 摘要）。
- `grep` 结果：代码里没有 `hasToolCall`、没有 `maxTokens`，两份 `.md` 里没有 `〖`。
- `npx eslint <改动文件>` 干净；`npx eslint .` 与 A-2 基线对比**不增加**错误（基线 15 错误 / 3 警告）。
- 改动文件全部落在允许清单内（`src/agent/`、`scripts/`、两份文档），**旧 `ChatPage` / `AgentModel` 未被改写**，依赖文件无改动。
- 协议不变量 1–8 逐条自检有结论。

## 本阶段不要做

- 不碰 `src/pages/`、`src/components/`、`useChatSession`、`conversationState`、localStorage（C/D/E 阶段）。
- 不改旧路径（`ChatPage`、`AgentModel`、`useStreaming`、`StreamingParser`），不升级依赖、不加依赖。
- 不用 `hasToolCall('ask_question')` 作停止条件，不用 `maxTokens`，不让 UI 事后补 tool result，不在 `execute` 里等学生作答。
- 不做取消按钮、重试、错误映射界面（F 阶段），不做 UI、存储、提示词迁移（D/E 阶段）。
- 不接受只用 mock 得出的「验证通过」；不把密钥写进脚本、日志、测试或文档。
- 不在 `src/agent/` 里引入 React / localStorage / JSX（运行层硬约束）。
