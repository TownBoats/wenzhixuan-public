# 阶段 B · 运行层与提问工具

估时 3 小时｜任务 B1–B7｜依赖 A3 通过｜产出：能在真实端点跑通"模型 → ask_question → 副模型 → 停止"的单轮执行，并有 mock 测试

## 1. 要解决什么

现状里"下一步做什么"由页面决定：`StreamingParser` 从正文里识别 `〖question〗` 标签，`onQuestionFound` 回调直接调副模型，问题回答完再由 `ChatPage` 的 effect 拼接摘要发起下一轮。

本阶段要把它改成一个**不依赖 React 的可测试执行单元**：

```text
用户/上下文消息 + 模式 + 配置快照 + AbortSignal
        ↓
   模型 →（可能要求调用 ask_question）→ 程序执行 → 结果回传 → 模型继续或停止
        ↓
   规范事件 + 清洗后的协议消息 + 结束原因
```

## 2. 为什么这样做

### 2.1 为什么新写 `modelAdapter`，而不是给 `AgentModel` 加工具能力

`AgentModel` 里有四处与工具循环直接冲突：

| 位置 | 现状 | 与工具循环的冲突 |
| --- | --- | --- |
| `getCompletion` 的 while 循环 | 失败后整轮重试最多 3 次，SDK 默认 `maxRetries` 再叠 2 次 | 有工具执行时，"重试"意味着重复副模型调用、重复卡片、重复的协议消息 |
| `_streamOnce` 内的 `setTimeout(...abort, 60000)` | 超时的 AbortController 在函数内部创建 | 外部拿不到它，无法实现"用户点取消"；方案的取消与迟到过滤都要靠它 |
| `typewriterDelay` | 把正文切成 10 字一块、每块延迟 10ms 再吐出 | 工具循环里的"步"结束时间被拖长，超时预算失真 |
| `maxTokens` 参数 | v6 已更名为 `maxOutputTokens`，当前写法被忽略 | 设置不生效，输出长度实际不可控 |
| `includeRawChunks` + 手动提取 reasoning | 思考内容只走回调，不进协议消息 | 需要工具时，这个设计是否可行取决于 A3 用例③ |

要复用它的收益是"保留现有 provider 配置和推理显示经验"，但代价是在一个同时要满足两种范式（单轮流式 / 多步工具）的类里做分支。新适配器约 150 行，边界清楚；改造 `AgentModel` 的改动面更大，且会波及正在使用的旧路径。

**结论**：新主路径用 `modelAdapter`，`AgentModel` 保留给旧路径和 B3 的副模型服务。等 F 阶段验收通过、旧路径下线后，再考虑清理。

### 2.2 为什么工具带执行逻辑（而不是由会话层补结果）

两种做法都能让模型"提问"，差别在协议完整性：

| | 带执行逻辑（推荐） | 不带执行逻辑 |
| --- | --- | --- |
| 运行结束时 | 每个 tool call 都有配对结果 | 存在未配对的 call，必须由会话层补写 |
| 学生回答的位置 | 下一轮的 user 消息 | 补写的工具结果容易被写成"学生的答案" |
| 副模型失败时 | 能在工具结果里表达降级（`optionsStatus: 'unavailable'`） | 补写逻辑要复制这套降级 |
| 刷新恢复 | 协议自洽，没有悬空调用 | 刷新正好发生在补写之前，就会留下悬空调用 |

第二种的风险都集中在"补写"这个动作上，而补写发生在页面交互和存储之间，是最容易出错的位置。多写一个 `stopWhen` 条件的成本小于它。

### 2.3 为什么停止条件不用 `hasToolCall`

见 `01-核心协议.md` 第 3 节。要点：`hasToolCall` 在参数非法时也会停，那样"允许修正一次"就做不成。

### 2.4 为什么副模型暂时保留五档标签协议

副模型的输出是 `〖none〗/〖heard〗/…` 形式的五档文本，现有 `ContentParser` 已在解析它，提示词也已调好。本次改造的重心是主模型的协议，"同时改主辅两套协议"会把风险叠在一起。所以本期只把副模型调用**收进一个服务里**（`generateAnswerOptions.js`），在服务内部解析和校验；将来要改成结构化输出，改动被限制在这一个文件内。

### 2.5 为什么必须清除开闸标记

`AgentModel.createStreamGateFetch` 会在每个 SSE 响应前面插入一个内容为零宽空格（U+200B）的文本块，用来让 provider 立刻放行思考内容（原因见 `AgentModel.js` 顶部注释）。现在它只在 UI 回调里被过滤掉，也就是**只清理了展示通道**。新路径要把 `response.messages` 存进历史并回传模型，于是这个空字符会进入：
- 每一轮发给模型的上下文；
- 存储的历史；
- 将来可能做的导出或统计。

所以适配器必须在两处清理：流事件里，以及最终收集的协议消息里。

## 3. 需要你决策的点

### 决策 1：教学模式的两份指令各写什么

`skills/normal.md` 和 `skills/socratic.md` 是本次唯一"产品内容"层面的产出，其余都是工程结构。需要你定：

- **normal（常规问答）**：旧路径里**不存在"常规模式"**——只有一个可编辑的主提示词（`localStorage.mainAgentPrompt || SYSTEM_PROMPTS.LEARNING_MODE`），且设置面板中的「随意闲聊」预设（`SYSTEM_PROMPTS.TEST_MODE`，`src/services/prompts.js:179-186`）其正文本身就是一份 `〖response〗`/`〖question〗` 标签格式要求。**本决策已拍板**：取消用户可见的模式控件，`socratic` 为唯一对用户可见的教学模式，代码层保留 tools 为空的无工具模式作兜底（用于端点不支持工具 / 未配置副模型）。结论见 `决策记录.md` **B-1**。
- **socratic（苏格拉底追问）**：现有 `LEARNING_MODE` 提示词里有大量标签格式规则（`〖response〗/〖question〗`、单一问号、禁止嵌套）。这些**必须删掉**，因为提问改走工具了。你需要确认：除了格式规则，哪些教学要求要保留？（例如"不能直接给答案""先摸底再讲解""用 1–3 个问题检验理解"。）

**倾向**：保留教学意图，删除所有输出格式规则，新增两条约束——"问题通过 `ask_question` 工具提出，不要在正文里写问题标签"、"学生选择'精通'只代表他的自评，不要视为已验证"。

### 决策 2：`ask_question` 的参数上限取值

方案给的首期值是 `question ≤ 500` 字符、`context ≤ 2000` 字符。这两个数字会直接影响模型行为：太紧会逼迫模型压缩问题描述，太松则可能让它把整段教学都塞进 `context`。

**倾向**：先用 500/2000，在 D 阶段用真实样例观察，再决定是否调整。它们是产品约束，不是技术约束。

**本决策已定**：采用 `question ≤ 500` / `context ≤ 2000`（用户 2026-10-16 决定跳过讨论、按方案默认值执行），D 阶段再按真实样例调整。见 `决策记录.md` **B-5**。

### 决策 3：副模型用什么

B3 需要一套副模型配置。现状是 `ChatPage` 里 `isModelConfigured` 要求主、副模型**都**配好才能开始对话。你需要定：

- 副模型复用主模型（同一端点和模型，靠提示词区分）还是单独配置？
- 若复用，D5 的"常规模式只要求主模型"会自然满足；若单独配置，就要在苏格拉底模式下给出"未配置副模型"的降级路径。

**倾向**：允许复用，但保留单独配置的能力。理由是本地演示时少一套配置要维护。

**本决策已拍板**：副模型**单独配置**（用户 2026-10-16 决定），沿用现有副模型配置通道；缺副模型时的降级路径（可读提示 + 手动作答）成为必需项。结论与后果见 `决策记录.md` **B-4**。

## 4. 任务清单

### B1 · `src/agent/modelAdapter.js`

**做法**：按配置快照创建 provider 并返回一个"跑一轮"的接口。

要点与理由：

- **每轮按快照新建 provider**，不复用 `useAgentsConfig` 里的可变单例。现状里 agent 实例用 `updateSettings` 原地修改，如果运行中用户改了模型，正在跑的这轮会被中途改变；快照让"这一轮用的是什么"有确定答案，也才能写进日志和决策记录。
- **`maxRetries: 0`**，并把重试策略留给上层。理由：传输层重试安全，业务动作重放不安全。工具一旦执行过（可能已经调过副模型），重放就不是幂等的。首期显式关掉，比留一个隐式的 2 次重试安全。
- **`maxOutputTokens`** 而非 `maxTokens`。
- **接收外部 `AbortSignal`**，与内部超时信号合并（用 `AbortSignal.any` 或自建转发）。理由：取消功能（F1）依赖它，而超时和取消的语义不同——超时是失败，取消是用户意图，两者要能分别上报。
- **`fullStream` → 规范事件**：`text-delta` / `reasoning-delta` / `tool-call` / `tool-result` / `error` 分别映射，`partId` 由适配器生成并保持稳定（同一段文本的后续 delta 必须落到同一 `partId`，否则界面会出现两段割裂的文字）。
- **开闸标记清除**：流事件里过滤；收集 `response.messages` 后，遍历文本块再过滤一次并断言结果为空字符串时丢弃该块。
- **内联开闸 fetch**：从 `AgentModel` 复制那段逻辑。理由：它解决的是 provider 层面的真实缺陷（思考内容被扣住直到首个正文 token 到达），新路径同样会遇到。但**不要 import `AgentModel`**，避免把整轮重试等行为带进来。

**判据**
- 给定一段假 SSE 流，产出的事件序列符合 `01-核心协议.md` 第 4 节；
- 协议消息中不含 U+200B；
- 取消后不再产生任何事件；
- `maxRetries` 实际为 0（可通过观察请求次数验证，或在配置里显式断言）。

### B2 · `src/agent/modes.js` 与教学指令

**做法**：导出 `normal` / `socratic` 两个模式对象，每个包含：模式 ID、系统提示词（协议约束 + `?raw` 导入的教学指令）、允许注册的工具集合、是否允许提问。

**为什么用 `?raw` 导入 Markdown 而不是把提示词写成 JS 字符串**：提示词是可读的产品内容，会反复修改和讨论。放在 `.md` 里可以直接读、可以 diff；放在 JS 字符串里会被转义和换行拼接弄脏。Vite 的 `?raw` 是构建期导入，不增加运行时依赖。

**为什么把"允许的工具"也写进模式**：普通模式不注册 `ask_question`，是靠**不注册工具**实现，而不是靠提示词说"不要提问"。模型看不到工具，就不可能调用它——这是代码级保证，比提示词可靠。

**提示词拼接顺序**：程序协议约束 → 模式教学指令 → 会话内容。用户自定义提示词**不参与拼接**（原因见阶段 D 的决策 1）。

**判据**
- `normal` 模式下，传给模型的工具集合为空；
- `socratic` 模式下，工具集合只含 `ask_question`；
- 两份 `.md` 里不含任何 `〖…〗` 形式的输出格式规则。

### B3 · `src/agent/services/generateAnswerOptions.js`

**做法**：输入 `{ question, context, language, abortSignal, config, systemPrompt }`，用 B1 的 `modelAdapter` 跑一次副模型，用 `ContentParser` 解析档位，返回 `{ status:'ready', options }` 或 `{ status:'unavailable', errorCode, detail }`。

要点与理由：

- **用 `modelAdapter` 而不是 `AgentModel`**（`决策记录.md` **B-10**）：`AgentModel` 没有 `abortSignal` 入参、没有 `abort()`，内部 60 秒超时的 abort 还会被它自己的 3 次整轮重试当作普通错误继续重试——协议要求的「45 秒且不超过主运行剩余时间」「可取消」在它身上做不出来。`modelAdapter` 已有 `timeoutMs`、外部 `AbortSignal`、`maxRetries: 0`、无打字机延迟，恰好是副模型需要的。
- **配置与 system prompt 由上层传入**：运行层不读 localStorage。副模型提示词的三层覆盖（`optionAgentPrompt` > `option_ai_prompt` > `SYSTEM_PROMPTS.OPTION_AI_MODE`）留在页面/配置层，B3 只接收拼好的绝对 `endpoint`、`apiKey`、`model` 与提示词文本。
- **复用 `ContentParser`，但不复用 `StreamingParser` / `useQuestionFlow`**：前者是通用 `〖tag〗…〖/tag〗` 提取器（`tags` 是构造参数），无浏览器依赖；后两者一个是增量状态机、一个是 React hook，与新路径无关。
- **同档多条只留第一条、零档才算失败**（`决策记录.md` B-10）：缺档不再判失败，见 `01-核心协议.md` 2.3。
- **失败不抛异常，只返回白名单**：`detail ∈ { timeout, cancelled, request_failed, invalid_output, 'HTTP <三位数>' }`。`AgentModel` 的错误对象会带 `responseHeaders` / `responseBody` / `actualUrl`，这些**不得**透传（判据要求错误里没有密钥或请求头）。

**判据**（注入假 fetch 的 SSE 测试，不需要网络）
- 五档齐全 → `status: 'ready'`，5 条，顺序固定；
- 只有三档 → `status: 'ready'`，3 条（放宽后不再视为失败）；
- 同一档出现两条 → 只保留第一条；
- 零条可识别档位 → `status: 'unavailable'`、`errorCode: 'option_model_failed'`、`detail: 'invalid_output'`；
- 请求失败 → 同上，`detail` 为 `HTTP <状态码>` 或 `request_failed`，且不含端点、密钥、请求头；
- 未配置副模型 → `status: 'unavailable'`、`errorCode: 'option_model_not_configured'`，且**不发起任何网络请求**（`决策记录.md` B-6）。

### B4 · `src/agent/tools/askQuestion.js`

**做法**：`jsonSchema` 声明输入 + 显式校验函数 + `execute`。工具实例**每轮一个**（B5 创建），两张"记忆表"（`toolCallId → 上次结果`、本轮已问文本）放在闭包里，随轮销毁。

**为什么 schema 之外还要手写校验**：`jsonSchema` 声明形状，不保证范围。长度上限、去空白、拒绝未知字段、模式是否允许、本轮是否已问过——这些都是业务规则，必须写在 `execute` 里。把约束只写在 schema 或提示词里，等于把执行权交给模型。注意：`additionalProperties: false` 会让 SDK 在进入 `execute` 之前就拒绝未知字段（表现为 `tool-error`），所以 `execute` 内的未知字段校验是**第二层防御**，也是唯一可被单测覆盖的那层。

**为什么拒绝时必须返回合法结果**：见 `01-核心协议.md` 2.3。每个调用都要有配对结果。

**为什么 `toolCallId` 去重排在最前**：重放的那一次如果先走校验，它的文本已在"本轮已问"集合里，会先被判 `duplicate_question`，永远拿不到"上次结果"，幂等失效（`决策记录.md` B-11）。

**为什么程序错误也要返回 `rejected` 而不是抛异常**：抛异常会让 SDK 生成 `tool-error`，模型看到异常而非结构化结果；但异常原文可能含端点/请求头，`message` 只能用固定文案。

**判据**
- 正常输入 → `ready`，且问题 ID 由程序生成（`q_` + 12 位十六进制）；
- `question` 为空、超长（>500）、`context` 超长（>2000）、含未知字段、类型不对 → `rejected('invalid_input')`；
- 同一 `toolCallId` 重复执行 → 返回上次结果，不产生第二张卡，且**不再调副模型**；重放时即使传了非法参数也返回上次结果；
- 本轮已问过相同文本的问题 → `rejected('duplicate_question')`（按去空白后的文本比对，只判完全相同）；
- 模式为 `normal` → `rejected('mode_not_allowed')`，且不调副模型；
- 未配置副模型 → `ready` + `optionsStatus:'unavailable'` + `option_model_not_configured`，且零请求；
- 副模型失败 → 问题仍就绪，`optionsStatus:'unavailable'` + `option_model_failed`，结束原因仍是 `awaiting_user`；
- 程序异常 → `rejected('internal_error')`，且结果里不含异常原文、端点、密钥。

### B5 · `src/agent/runTeachingAgent.js`

**做法**：组合 B1–B4，管理预算与结束原因。

要点与理由：

- **预算**：最多 3 步、副模型并发上限 4、主运行 120 秒。**为什么这样定**：步数防模型反复试探；问题数量**不设硬上限**（探针式教学要一次问多个，由教学指令软引导 2–3 个），硬上限会把本可一次问清的内容逼成多轮；并发上限防端点限流、也防主运行预算被摊薄。协议细节见 `01-核心协议.md` 第 2.2 节与 `决策记录.md` B-3。
- **多个调用全部执行**：同一响应里出现多个 `ask_question` 时，每个都执行并返回配对结果，一个都不丢弃；同一 `toolCallId` 只执行一次；同一文本不重复提问（`rejected('duplicate_question')`）。**为什么不是只取第一个**：探针要一次拿到多个维度的回答，逐个提问太慢；丢弃其余调用则会在协议里留下没有结果的调用，下一轮请求时上下文不完整。
- **结束原因**：`completed`（模型自然说完）/ `awaiting_user`（问题已就绪）/ `limit_reached` / `failed` / `cancelled`。**为什么区分 `completed` 与 `awaiting_user`**：前者表示这轮结束、界面进入可输入状态；后者表示界面要进入等待作答状态并显示问题卡。合并成一个状态，界面只能靠"有没有问题数据"来猜。
- **`responseMessages` 从 SDK 提供的结果收集**，不要手工拼装同一批消息。理由：手工追加容易与 SDK 内部记录重复，产生重复的 tool 消息。

**判据**：见 B6。

### B6 · 测试（`src/agent/__tests__/`）

**做法**：`node --test` + `ai/test` 的 `MockLanguageModelV3`。

**为什么用 `ai/test` 而不是自建 mock**：它模拟的是 SDK 的模型接口，测的是我们的事件映射和停止条件，而不是我们自己写的 mock 的行为。自建 mock 很容易把"实现细节"当成规范固化下来，测试全绿但真实端点仍然不通。

**用例**

| 用例 | 断言 |
| --- | --- |
| 提问后停止 | 收到 `tool-completed` 后立刻 `run-finished{ awaiting_user }`，不再有第二步生成 |
| 副模型失败降级 | 工具结果是 `optionsStatus: 'unavailable'`，问题文本仍在，结束原因仍是 `awaiting_user` |
| 一轮多个问题 | 三个 `ask_question`（两个不同文本、一个与前者重复）→ 两条 `ready` + 一条 `rejected('duplicate_question')`，卡片两张，问题顺序＝模型调用顺序 |
| 无效参数修正一次 | 第一次参数非法 → 有后续生成（未立即停止）；第二次合法 → 停止 |
| 超步数 | 模型持续调用工具 → `run-finished{ limit_reached }`，已完成内容保留 |
| 取消 | `abort` 后不再产生事件，结束原因是 `cancelled` |

**判据**：6 个用例全绿，`node --test` 输出可贴。测试文件里不得出现真实的端点地址或密钥。

**额外必须覆盖**（`决策记录.md` **B-8**：B1 未自带单测，证据只存在于 HANDOFF 的一次性冒烟里）：① 同一段文本的多个 delta 共用同一个 `partId`；② 开闸标记**两处**都清（事件与 `responseMessages`），且清理后为空的文本块被丢弃；③ 取消后事件数不再增长；④ 请求次数 = 步数（`maxRetries: 0`，工具多步场景应为 2 次）。

### B7 · `scripts/run-socratic-once.mjs`

**做法**：用真实端点跑一轮 socratic，输入一个固定的教学主题（例如"闭包"），打印问题和五档答案。端点、模型与密钥沿用 A3 探针的环境变量（`PROBE_BASE_URL` / `PROBE_API_KEY` / `PROBE_MODEL`，见 `决策记录.md` B-7）；缺少变量时应打印明确提示并退出，不静默失败。

**为什么在只有运行层时就要跑真实端点**：这是"闭环能跑"的第一个可验证证据，早于任何界面工作。如果这里就不通，D 阶段做界面等于在错误的地基上装修。这也是本阶段唯一能证明 A3 结论成立的证据。

**判据**：打印出真实的问题文本和五档答案；`response.messages` 中调用与结果配对；不含开闸标记。

## 5. 验收证据

1. `node --test` 的完整输出（6 个用例）。
2. B7 的原始打印：问题、五档、步数、`response.messages` 的结构摘要。
3. `grep` 结果：代码中没有 `hasToolCall`，没有 `maxTokens`，模式里没有 `〖`。
4. 改动文件清单，确认都在允许范围内（`src/agent/` 与 `scripts/`），旧 `ChatPage`/`AgentModel` 未被改写。

## 6. 监督与反问

- "B7 那一次运行里，模型总共生成了几步？请贴出步数。"——用来验证停止条件真的在工具成功后生效，而不是碰巧模型只说了一句话。
- "副模型失败的那个用例，是通过注入假对象测的，还是真的把网络断了？"——两者都可以，但要说明清楚，别混为一谈。
- "适配器在几个地方清理了开闸标记？"——答案必须是两处（流事件、协议消息）。只做一处是本项目最容易漏的坑。
- "同一段文本被切成多个 delta 时，`partId` 会变吗？"——变了会导致界面上出现两段割裂的话，这是流式渲染的经典 bug。
- "预算里的三个限制，哪一条在代码里是真正生效的？请指给我看。"——要求指出具体判断语句，不接受"已经考虑了"。

**识别偷工减料**：如果 B6 的用例都是"调用某函数返回某值"这种形式，而不是"给定一串模拟模型输出，断言事件序列"，那它测的是实现细节。如果 B7 没跑或没贴输出，这一阶段不算完成。

## 7. 遗留风险

- 副模型仍走五档标签解析，解析失败率未知；D 阶段用真实样例观察，必要时在 F 阶段改为结构化输出。
- 端点的工具调用行为差异（是否支持 `parallelToolCalls: false`、是否要求回传 reasoning）只能在真实端点验证，A3 的结论未必覆盖将来换用的端点。
- 运行层的超时预算（120s / 45s）是工程初值，没有实测数据支撑。
