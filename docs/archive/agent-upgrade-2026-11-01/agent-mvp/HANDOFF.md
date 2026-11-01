# HANDOFF · 开发进度交接

> 每轮对话（无论人还是 AI）**开始时先读本文件，结束前必须更新本文件**。
> 本文件只记录"现在在哪、下一步做什么、有什么没收尾"；决定的理由写进 `决策记录.md`，协议写进 `01-核心协议.md`，不在这里重复。

**为什么需要它**：每个阶段会开一轮新对话，新对话里的 AI 不记得上一轮做到哪里。没有交接文件，它会重新探索、重复已做的工作，甚至推翻已经拍板的决定。决策记录回答"为什么"，这个文件回答"到哪了"。

## 0. 新会话开工清单（省上下文的固定做法）

> 150k 窗口装不下 A–F 全程，**一个阶段（或半个阶段）开一个会话**。本节的数字是估算值（中文 Markdown 约 1 KB ≈ 250–330 token）。

每轮开始**只读**：本文件第 1、2、3 节 + 本节。第 7 节日志只在需要回溯某条证据时才翻。

| 会话 | 除 HANDOFF 外必读 | 预计总消耗 |
| --- | --- | --- |
| A3 + A4 | `A-开发指导.md`、`A-基线与端点验证.md`、`A-基线存档.md` | 25–45k |
| B1–B3（运行层骨架） | `01-核心协议.md`、`B-运行层与提问工具.md` | 40–70k |
| B4–B7（工具与测试） | `01-核心协议.md`、`B-运行层与提问工具.md` | 40–80k |
| B5–B7（组装、mock 测试、真实端点） | `01-核心协议.md` §3/§4、`B-运行层与提问工具.md` B5/B6/B7、本文件第 3 节 | 40–70k |
| C（会话状态层） | `C-开发指导.md`、`C-会话状态层.md`、`01-核心协议.md` | 40–70k |
| D（页面与模式） | `D-开发指导.md`、`D-页面与模式.md`、`01-核心协议.md` §4–§6、`决策记录.md` C-3 | 60–100k |
| E（存储与恢复） | `E-开发指导.md`、`E-历史存储与恢复.md`、`01-核心协议.md` §7 | 30–50k |
| F（取消重试与验收） | `F-取消重试与验收.md`、`docs/AGENT_MVP_PLAN.md` 的验收清单 | 40–70k |

必须换会话的三个信号：① 需要重新解释已写在 HANDOFF 或 `决策记录.md` 里的结论；② 单个任务要读 5 个以上既有文件（说明任务该拆）；③ 单次工具输出超过约 5k token（该落盘、只回贴摘要）。

固定的省上下文做法：只读文件局部区段；长输出落盘只回贴摘要；lint / build 用聚合计数而非全量文本；测试只贴失败项与计数；一次只做一个任务编号。

## 1. 当前状态

| 项 | 值 |
| --- | --- |
| 最后更新 | 2026-11-01（提交前清理梳理：A–G 验收状态不变；已核实 Git 边界、规则入口及旧代码引用；本轮仅交付清理方案，未删除代码、替换规则或执行提交） |
| 本轮源码基准 | `git status --short --branch` → `## dev...origin/dev`；HEAD 为 `347a6a4`。`archive/pre-agent-upgrade` 已推送到 `origin`，远端 `refs/heads/archive/pre-agent-upgrade` 指向 `8b06bc877fe446d777e2890f116cfbced467a0e0`。 |
| 阶段提交 | 三个提交：`8b06bc8`（仓库清理/忽略规则）、`5b7ed03`（Agent 架构主体，40 文件）、`c489d88`（`scripts/*.mjs` 三个验证脚本）。**已快进合并进 `main` 并 push**（`bbd11f4..c489d88`，`--ff-only`，无合并提交），`origin/main` 与本地同步；`origin/refactor/agent-architecture` 仍保留在同一提交 |
| 当前阶段 | **G · 投递后改进（已收尾）**：G-1、G-2 均 **2026-11-01 用户人工验收 ✅**；阶段结论见 `决策记录.md` **G 阶段收尾（2026-11-01）** |
| 当前任务 | **无进行中开发任务**。下一步按第 3 节：先修依赖布局补自动基线，再处理投递后待办（第 1 项＝真端点走查配置面板） | 
| 整体状态 | **A/B/C/D/E/F 全部 ✅**（A1–A4、B1–B7、C1–C4、D1/D3–D8、E1–E5、F1–F4 + 各阶段收尾；D2 按 B-1 裁剪）。测试基线 utils **108/108** + agent 47/47、`session-loop.mjs` 17/17、`npx eslint .` 18 problems（15/3）、`vite build` 通过（G-2 后主包 **2,806,491 B ≈ 2.81 MB**） |
| `agent_runtime` 开关 | **已移除（G-1）**：`App.jsx` 直接渲染 `AgentChatPage`，旧路径成死代码（文件仍在仓库，删除待拍板） |
| 18 日投递版本 | **新路径**（唯一路径）；回退手段只剩 `git revert` |

## 2. 阶段进度

2026-11-01 提交前清理梳理：A–G 已验收，状态不变。`git status --short --branch` → `## dev...origin/dev`，仅 `docs/REDESIGN_KARE.md` 与 `docs/REDESIGN_KARE_FEASIBILITY.md` 两个已跟踪文件删除未暂存；`git diff --cached --stat` 无输出；`git diff --stat main..dev` → 35 files changed, 2745 insertions(+), 232 deletions(-)，`git rev-list --count main..dev` → 9。`.codebuddy/rules/agent-mvp/RULE.mdc` 与 `.agent/rules/agent-mvp/RULE.mdc` 各 247 行、正文相同、均声明 alwaysApply；源码静态引用清理结论见本轮第 7 节日志。未复跑测试、lint、构建。

2026-11-01 进度核对：A–F 全部 ✅，G-1/G-2 保持 🔵；当前 HEAD `347a6a4`，`src/App.jsx` 直接渲染 AgentChatPage。仅查询状态，未重新执行测试、lint、构建或浏览器验收。

2026-10-30 本轮按用户指令复核 G-2 验收项。浏览器静态走查通过：现有 `dist/` 由 `python -m http.server 5189 -d dist` 提供，注入 v2 演示数据后核对页头/Markdown/工具卡/问题磁贴/错误区/作答浮层，390px 下 `documentElement.scrollWidth=clientWidth=390`，console 0 error / 0 warning（仅 2 条 prompts 普通 log）。自动命令复验阻塞：`node --test "src/agent/__tests__/*.test.js" "src/utils/__tests__/*.test.js"` 报 `ERR_MODULE_NOT_FOUND`（`ai` / `react`），`npx eslint ...` 报缺 `debug`，`npx vite build` 报缺 `picomatch`；`pnpm install --frozen-lockfile` 报 `UNKNOWN ... cookie/package.json`，`pnpm install --force --frozen-lockfile` 被 IDE safe-delete 守卫拦在 `SAFE_DELETE_BULK_CONFIRM_REQUIRED`。因此 G-2 **不改 ✅，仍保持 🔵 待验收**。

2026-10-30 本轮是 Git 节点定位、本地保护分支创建与远端推送，不是开发或验收：既有任务状态全部保持不变。证据：`git --no-pager show --no-patch --pretty="format:%H%n%P%n%s" 5b7ed03` 显示 `5b7ed03` 的父提交为 `8b06bc8`；`git push origin archive/pre-agent-upgrade` 成功创建远端分支；`git ls-remote --heads origin archive/pre-agent-upgrade` 显示远端指向 `8b06bc877fe446d777e2890f116cfbced467a0e0`。

2026-10-21 本轮是源码讲解与图表推荐，不是开发或验收：既有任务状态全部保持不变。当前实现证据见第 7 节同日记录（主运行三工具、副模型结构化输出、工具参数流式展示、会话/上下文边界）；历史测试计数不作为当前 HEAD 的复验结果。

状态：⬜ 未开始｜🟡 进行中｜🔵 待验收（AI 已交付证据，等你确认）｜✅ 完成（仅在你验收后标记）｜❌ 阻塞｜✂️ 已裁剪

| 阶段 | 任务 | 状态 | 证据位置 / 备注 |
| --- | --- | --- | --- |
| 方案 | 复核 + 工作包 | ✅ | `决策记录.md` P-1 ~ P-3 |
| A | A1 依赖对齐 | ✅ | 用户 2026-10-16 确认通过。删除 node_modules 后重装（用户终端执行）；`ai 6.0.177`、`@ai-sdk/openai 3.0.63`、`zod` 仅以 `.pnpm/zod@4.4.3` 存在；类型声明 API 全部命中；`git status` 依赖文件无改动；残留目录 0、无 `.package-lock.json`。逐条证据见第 7 节 2026-10-16 的第三、四条日志 |
| A | A2 基线存档 | ✅ | 用户 2026-10-16 确认通过。证据在 `docs/agent-mvp/A-基线存档.md`：`vite build` ok（20385ms，主包 2732.6 KB 超 500 KB 阈值）；`eslint .` 67 个文件 → 9 个文件 15 错误 / 3 警告；旧路径 6 项走查＝用户实测（**一轮出现 3 张问题卡**、作答后自动发起下一轮、重试目标为最后一条） |
| A | A3 端点探针 | ✅ | 两轮共 12 个用例全部成功（原始数据 `scripts/probe-tools.output.json`，`when=2026-10-16T11:32:27Z` 与 `11:35:12Z`）：① 工具名 `get_weather`、参数为对象；② 2 步且第二步有文本（**A 阶段通过标准满足**）；③a/③b/③c/⑥a/⑥b 全部 200 且 `原生assistant含reasoning=0`；④ 未见 U+200B；⑤b/⑤c 第二步 `roles=user,assistant,tool,tool` → **`parallelToolCalls:false` 被接受但不生效**；⑦ `low`（providerOptions）与 `max`（请求体注入）均 200，raw reasoning 314 / 501 字符 |
| A | A4 结论入档 | ✅ | `决策记录.md` 新增 A-5（端点支持工具闭环、决策 2 结论、`parallelToolCalls` 不生效 → 应用层去重是唯一防线）与 A-6（决策 4 结论：不需要回传 reasoning、不变量 3 保持不变、`max` 强度需请求体注入）；`A-基线存档.md` 第 6 节加了证据索引 |
| B | B1 modelAdapter | ✅ | 用户 2026-10-17 验收。新建 `src/agent/modelAdapter.js`。证据：`node --check` ok、`npx eslint src/agent/` 无输出、四场景离线冒烟（假 fetch，不联网）全过：正常 1 次请求 / 两个 delta 共用 `partId` / 协议消息无 U+200B；取消后仅 1 个事件且 `endedBy=cancelled`；超时 `endedBy=timeout`；工具多步 2 步 / `tool-started`+`tool-completed` 配对 / 消息 3 条不重复。单测按 `决策记录.md` **B-8** 不新建，四场景并入 B6（判据已写进 `B-运行层与提问工具.md`） |
| B | B2 modes + skills | ✅ | 用户 2026-10-17 验收通过。**新增**：`src/agent/modes.js`（纯函数：`createModes` / `getMode` / `buildSystemPrompt` / `toolsForMode`）、`src/agent/modePrompts.js`（全项目唯一 `?raw` 入口，无逻辑）、`src/agent/skills/socratic.md`、`src/agent/skills/normal.md`、`src/agent/__tests__/modes.test.js`。**证据**：`node --test "src/agent/__tests__/*.test.js"` → 9 tests / 9 pass / 0 fail；`npx eslint` 改动文件无输出、全量仍 15 错误 / 3 警告；`vite build` ok（38.53s）；本轮 5 个新增文件 `U+200B=false`、两份 md `U+3016/U+3017=false`；Vite `transformRequest` 把 import 改写成 `"/src/agent/skills/socratic.md?import&raw"` 且 md 模块返回字符串；Node 侧最小复现抛 `ERR_UNKNOWN_FILE_EXTENSION ".md"`。决策见 `决策记录.md` **B-9**（含五条结论与实测证据） |
| B | B3 generateAnswerOptions | ✅ | 用户 2026-10-17 验收通过。**新增**：`src/agent/services/generateAnswerOptions.js`（`generateAnswerOptions` / `extractOptions` / `isOptionConfigReady`，用 `modelAdapter` 跑副模型，45s 上限、可取消、`maxRetries: 0`）、`src/agent/__tests__/generateAnswerOptions.test.js`（11 条，假 SSE 不联网）。**证据**：`node --test "src/agent/__tests__/*.test.js"` → 20 tests / 20 pass；`npx eslint src/agent/` 无输出、全量仍 15 错误 / 3 警告；失败路径探针 `calls = 1`、`detail = "HTTP 500"`；新增两文件 `U+200B=false`、`U+3016=false`。决策见 `决策记录.md` **B-10**；协议 §2.2/§2.3 已同步放宽口径 |
| B | B4 askQuestion | ✅ | 用户 2026-10-17 验收通过。**新增**：`src/agent/tools/askQuestion.js`（`createAskQuestionTool` / `validateAskQuestionInput` / `ASK_QUESTION_INPUT_SCHEMA` / 四个 reason 常量；`q_`+12 位十六进制 ID；闭包内 `resultsByCallId` + `askedTexts`）、`src/agent/__tests__/askQuestion.test.js`（15 条，直接调 `execute`，不联网）。**证据**：`node --test "src/agent/__tests__/*.test.js"` → 35 tests / 35 pass；`npx eslint src/agent/` 无输出；新增两文件 `U+200B=false`、`U+3016=false`。决策见 `决策记录.md` **B-11**；协议 §2.2（去重提前）与 §2.3（`internal_error`）已同步 |
| B | B5 runTeachingAgent | ✅ | **新增** `src/agent/runTeachingAgent.js`（`runTeachingAgent` / `resolveRunReason` / `MAX_STEPS=3` / `MAIN_RUN_TIMEOUT_MS=120000` / `OPTION_CONCURRENCY_LIMIT=4` / `RUN_REASONS`）。决策见 `决策记录.md` **B-12**。**证据**：`node --check` + `npx eslint` 该文件均 exit 0；一次性离线冒烟 9 个场景全过（见第 5 节）；`node --test "src/agent/__tests__/*.test.js"` → 35 tests / 35 pass；`npx eslint .` → **15 错误 / 3 警告**（＝基线）；`vite build` ok（15.50s，主包 2,815.83 kB 未变——新模块尚未被页面引用） |
| B | B6 mock 测试 | ✅ | 用户 2026-10-17 验收。**新增** `src/agent/__tests__/runTeachingAgent.test.js`（10 条）；**改** `modelAdapter.js`（可选 `model` 注入口）与 `runTeachingAgent.js`（同名透传），决策见 `决策记录.md` **B-13**。**证据**：`node --test "src/agent/__tests__/*.test.js"` → **45 tests / 45 pass / 0 fail**；三个改动文件 `npx eslint` 无输出；全量 `18 problems (15 errors, 3 warnings)`＝基线；`vite build` ok（10.72s，主包 2,815.83 kB 未变） |
| B | B7 真实端点单跑 | ✅ | 用户 2026-10-17 验收（真实端点，`deepseek-flash`，主题「闭包」）：**四项判据 ✅✅✅✅、退出码 0**。`stepCount=1`、`reason=awaiting_user`、`finishReason=tool-calls`、**3 个问题各 5 档**、`tool-started=3 / tool-completed=3`、`response.messages` 角色 `assistant,tool`、U+200B 三处均 false、事件计数 `run-started=1 / reasoning-delta=354 / text-delta=69 / run-finished=1`。原始结果：`scripts/socratic-once.output.json`（`when=2026-10-17T11:59:17.752Z`）。脚本见 `决策记录.md` **B-14**，阶段结论见 **B-15** |
| C | C1 conversationState | ✅ | 用户 2026-10-17 验收通过（原话「没毛病」）。**新增** `src/utils/conversationState.js`（`reduceSession` / `buildModelContext` / `projectTurns` / `deriveViewState` / `createInitialState` / `TURN_STATUS` / `QUESTION_STATE` / `TOOL_PART_STATUS`）。证据：`node --check` exit 0、`npx eslint src/utils/conversationState.js` exit 0、全量 `npx eslint .` → 18 problems（15 错误 / 3 警告）＝基线；既有测试 `node --test "src/agent/__tests__/*.test.js"` → 45 tests / 45 pass / 0 fail；一次性离线冒烟 8 项全过（见第 5 节）。禁用式 grep（`Object.values` / `isLoading` / `localStorage` / `window.` / `randomUUID` / `Math.random` / `React`）在该文件 **0 命中**、文件内无真实 U+200B 字符 |
| C | C2 useChatSession | ✅ | 用户 2026-10-17 验收（原话「验收」）。**新增** `src/hooks/useChatSession.js`（`useChatSession({ modes, mode, config, optionConfig, optionSystemPrompt, conversationId, runner })`；返回 20 个键＝11 个只读数据 + 9 个命令，无 `setState` / `dispatch`）与 `src/utils/__tests__/useChatSession.test.js`（**7 条**，假 runner，不联网）。证据：`node --test "src/utils/__tests__/*.test.js"` → **7 tests / 7 pass / 0 fail**；`node --test "src/agent/__tests__/*.test.js"` → 45/45 pass；`npx eslint` 两文件 exit 0、全量 18 problems（15/3）＝基线；`vite build` ok（11.24s，4424 modules）；SSR 渲染打印返回清单（初始 `isRunning:false / canSendMessage:true / turns:0`）。依赖变更见 `决策记录.md` **C-2**（破例新增 devDependency `react-test-renderer@18.3.1`，用户 2026-10-17 授权） |
| C | C3 测试 | ✅ | 用户 2026-10-17 验收（原话「都通过了，验收。」）。**新增** `src/utils/__tests__/conversationState.test.js`（**18 条**纯函数用例，不联网、不渲染）。证据：`node --test "src/utils/__tests__/*.test.js"` → **25 tests / 25 pass / 0 fail**（C3 18 + C2 7）；`node --test "src/agent/__tests__/*.test.js"` → 45/45 pass；`npx eslint` 该文件 exit 0、全量 18 problems（15/3）＝基线。覆盖：乱序补建、重复不增卡/不增问题、问题卡顺序＝调用顺序（结果乱序回来仍保持）、旧 `runId` 四连不改状态、五种结束原因映射、取消与迟到片段、双击（第二次原样返回）、一轮两问答完才续轮且模板正确、跳过显式记录、重试换 `runId` 保留内容、`SET_MODE` 条件、`OPEN_CONVERSATION` 降级、上下文配对过滤与清洁、`projectTurns`/`deriveViewState` 投影 |
| C | C4 Node 闭环 | ✅ | 用户 2026-10-17 验收（原话「验收，然后打算交接下一步。」）。**新增** `scripts/session-loop.mjs`（假运行层驱动 reducer；`contextForRun` 与 hook 同构，把本轮用户消息补进上下文；末尾 17 条判据自检，失败则退出码 1）。证据：`node scripts/session-loop.mjs` → **17/17 判据通过、退出码 0**：两个 turn、问题卡顺序＝调用顺序（结果按 1/3/2 乱序回来）、前两题答完不开新一轮、双击被丢弃、上下文 4 条（user/assistant/tool/user）含三个问题原文、第 1 题答案与档位、显式跳过行、手动输入答案、tool-call=3 / tool-result=3 / 悬空 0 / reasoning 0 / U+200B=false；`npx eslint scripts/session-loop.mjs` exit 0；全量 18 problems（15/3）＝基线。**C4 还暴露并修掉了 1 个真缺陷**（问题卡按完成顺序而非调用顺序），见第 5 节 |
| C | 阶段收尾 | ✅ | `决策记录.md` **C-3**（问题 / 7 条结论 / 放弃方案 / 验证证据 / 7 条遗留风险）；`D-开发指导.md` 已起草 |
| D | D1 运行时开关 | ✅ | 用户 2026-10-17 浏览器验收通过（不设键走旧路径、设 `'true'` 显示占位页、删键回旧路径）。交付物与证据见本表上一版记录与第 7 节 D1 日志 |
| D | D2 模式控件 | ✂️ | 已裁剪（`决策记录.md` B-1）：不做用户可见的模式切换控件；代码层仍保留 tools 为空的无工具兜底模式 |
| D | D3 MessageContent + ToolCallCard | ✅ | 用户 2026-10-17 浏览器验收通过（五态文案+图标、默认折叠、键盘展开、顺序不挪位）。交付物与证据见本表上一版记录与第 7 节 D3 日志 |
| D | D4 本轮问题卡组（多题 + 跳过） | ✅ | 用户 2026-10-17 真实端点验收通过（三条作答路径、一轮多题、跳过、自动续轮；首轮暴露的 2 个适配层缺陷已修复并复验生效）。交付物与证据见第 7 节 D4 两条日志 |
| D | D5 配置门槛 | ✅ | 用户 2026-10-17 验收通过（缺副模型提示条、主模型未配置提示两条必验通过；工具失败链路为可选项未测，留 D8 失败链路走查）。交付物与证据见第 7 节 D5 日志 |
| D | D6 提示词迁移 | ✅ | 用户 2026-10-17 验收通过（自定义→提示出现、关闭后不再出现、删除键→无提示）。交付物与证据见第 7 节 D6 日志 |
| D | D7 文案 | ✅ | 用户 2026-10-18 验收（原话「没毛病。验收。」）。2026-10-18 实施完成 + 无头浏览器实跑。**新增**：zh / en 各一个顶层 `AgentChat` 区块（42 键，两语言键集合完全一致，未改任何已有键）；**改**：`ToolCallCard.jsx`（`CARD_STATES` → `labelKey`、新增 `TOOL_LABEL_KEYS`）、`MessageContent.jsx`、`QuestionGroup.jsx`、`AgentChatPage.jsx`。**证据**：`node -e` 键对齐 → zh 195 / en 195、`AgentChat` 42/42、missing `[]` / extra `[]`；真实 i18next 渲染抽查（`本轮 3 个问题`、`5 条`、`42 字`、`option_model_not_configured （候选答案未生成，问题仍可手动作答）`、`duplicate_question：问题重复`、工具建议句插值、en `3 question(s) in this turn`）；`npx eslint` 三个改动目录 exit 0、全量 `npx eslint .` → 18 problems（15 错误 / 3 警告）＝基线；`node --test` utils **45/45**、agent **45/45**；`node scripts/session-loop.mjs` 17/17；`vite build` ok（46.59s，4440 modules，主包 2,868.16 kB）；四个改动文件 U+200B=false。**无头浏览器（Edge，`@playwright/cli` 全局）实测**：`http://localhost:5174` 挂载正常、console 0 error / 0 warning、**页面里没有出现任何 `AgentChat.*` 原文键名**；已逐字核对 5 组的实际渲染：① 未配置态（标题 / 新会话 / 主模型缺失全句 / 空态 / 输入框 aria / placeholder / 发送）；② 已配置但缺副模型（提示条全句 + `关闭提示` 按钮）；③ 迁移提示条全句 + 关闭按钮；④ 失败链路（`这一轮没有完成，可以重发一次。`）；⑤ 运行中（`正在生成…` + `取消` 按钮，点击后回到 `发送`）。**未覆盖**（需真实端点）：工具卡五态与展开区标签、`思考过程` / `N 字`、`本轮 N 个问题` / `跳过此题`、候选答案不可用浮层、`未填写` 与工具建议句（本轮 400 响应的错误文本是 `Bad Request`，不含 `400` 字样，`TOOL_UNSUPPORTED_PATTERN` 未命中） |
| D | D8 浏览器闭环 | ✅ | 用户 2026-10-18 验收（原话「验收」）。走查 + 4 缺陷修复（**D-5**）+ 标签文案（**D-6**），复测证据见本行上一版与第 7 节 D8 两条日志 |
| D | 阶段收尾 | ✅ | `决策记录.md` **D-7**（7 条结论 / 放弃方案 / 验证证据 / 8 条遗留风险）；`E-开发指导.md` 已起草待审阅；HANDOFF 切到 E |**证据**：无头浏览器（Edge）+ 用户提供的临时测试密钥，真实端点 `deepseek-flash` 跑一轮「闭包」——思考块 `1051 字`（可折叠）、正文 1 段、**2 张工具卡**（折叠条 `提问 / 已完成`）、`本轮 2 个问题`、五档候选答案完整渲染（茫然/耳闻/入门/熟悉/精通 + 自答）、选「熟悉」后卡片变 `确认` 且**未提前开下一轮**、待答时页脚 placeholder 切为 `先回答上面的问题，这一轮才会继续`、展开区标签 `工具 / 输入的问题 / 附带的上下文 / 生成的问题 / 候选答案 N 条` 全部正常、候选不可用时浮层 `候选答案暂时不可用，可以直接输入你自己的回答。` 正常；窄屏 390×844 无横向溢出（`scrollWidth 390 = clientWidth 390`，截图 `D:\Temp\d8-narrow.png`，未入库）；`agent_runtime` 删除后旧路径正常渲染（标题 / 模型名 / 欢迎语 / 快速开始 6 例）。**缺陷**：① 工具卡「候选答案不可用」态不可达；② 问题卡永久显示「AI 回答中...」；③ 候选不可用时答案卡没有自定义输入框、**无法作答**；④ 39x 窄屏发送按钮文字折行。**修复（2026-10-18，方案 D-5）**：① `ToolCallCard.resolveCardState` 改判 `output.optionsStatus === 'unavailable'`（保留旧 `status` 兼容）；② `toQuestionCardModel` 的 `status` 恒为 `completed`（D-1 决策 3：不标错误）；③ `AnswerCard` 新增可选 prop `answerSettled`（旧路径不传＝行为不变），新路径由 adapter 传 `true`，空候选时同时显示失败面板与自定义输入框；④ 发送/取消按钮加 `shrink-0 whitespace-nowrap`。**证据**：`node --test "src/utils/__tests__/*.test.js"` → **46/46**（新增 1 条 `answerSettled` 回归、改写 1 条 `status` 断言）；`node --test "src/agent/__tests__/*.test.js"` → 45/45；`npx eslint` 四个改动文件 exit 0、全量 **18 problems（15 错误 / 3 警告）＝基线**；`vite build` ok（22.84s，主包 2,868.36 kB）。**后续按 D-6 调整为专用标签**：候选不可用时问题卡显示「可以点击回答」（`QuestionCard.canAnswer`，新键 ×2 语言，zh 196 / en 196 键对齐），`vite build` 复跑 ok（18.51s，2,868.64 kB）。**浏览器复验尚未做（用户要求他叫了再跑）**。**复测结果（2026-10-18，同一把临时密钥，真实端点）**：(a) 正常链路一轮 3 问全部拿到候选答案 → 三张卡都显示「AI 回答完毕！」，符合预期；(b) 窄屏 390×844 → 发送按钮 `w=62 h=36`、`Range.getClientRects()` **1 个行盒（单行）**、`docScroll 390 = clientWidth 390`；(c) 删掉副模型配置后再跑一轮 → 工具卡折叠条 **`候选答案不可用`**、展开区 `降级原因 / option_model_not_configured （候选答案未生成，问题仍可手动作答）`、问题卡标签 **`可以点击回答`**、答案卡内 `#custom-answer` **存在**且失败面板与输入框同时显示；(d) 两题都用自定义输入作答 → 第一题提交后卡片变 `确认` 且**未提前续轮**，第二题提交后**自动开下一轮**，新轮正文正确引用了学生答案（「你说内层函数『会记住』外层变量」）；(e) console **0 error / 0 warning**。截图 `D:\Temp\d8-verify-narrow.png`（未入库） |
| E | E1 historyStore | ✅ | 用户 2026-10-18 验收（原话「验收完毕，继续吧」）。**新增** `src/utils/historyStore.js`（工厂 `createHistoryStore(storage)`；六函数 `loadAll` / `loadById` / `listForSidebar` / `saveConversation` / `deleteConversation` / `renameConversation`；另导出 `deriveTitle` / `sanitizeConversation` / `STORE_REASONS` / `STORAGE_KEY_V1` / `STORAGE_KEY_V2` / `SCHEMA_VERSION` / `TITLE_MAX_LENGTH`）。**证据**：`node --check` exit 0；`npx eslint src/utils/historyStore.js` 无输出；`npx eslint .` → **18 problems（15 错误 / 3 警告）＝基线**；`node --test "src/utils/__tests__/*.test.js"` **46/46**、agent **45/45**、`node scripts/session-loop.mjs` **17/17**；禁用字样 grep（`localStorage\|window.\|React\|import ... from 'react'`）**0 命中**；一次性离线冒烟 **44/44**（无 storage→unavailable / 整键损坏→corrupt 且原文不动 / 坏条目跳过且写入保留 / 配额满→quota 无写入 / 脏字段+U+200B+reasoning+函数+AbortController 剥离 / 标题 20 字 / 同 ID 两键→新键且旧键字节不变 / v1 原样返回 / 删除两键 / 重命名空标题回退 / 列表倒序稳定 / 纯函数四条）——**脚本已删、不可复跑，正式断言在 E4**；`vite build` ✓ 34.17s、主包 2,868.64 kB（未被页面引用，体积不变）。决策点 1=A / 2=同意 / 3=A。**已验收** |
| E | E2 v1 只读适配 | ✅ | 用户 2026-10-18 验收（原话「验收通过」）。**新增** `src/utils/historyV1.js`（`projectV1Record(record)` + `answerCardToText` / `uiMessageToText`）。决策 = 1A 答案卡→文本片段 / 2A `messages` 主线 / 3A 独立文件，见 `决策记录.md` **E-2**。**证据**：`node --check` exit 0；`npx eslint src/utils/historyV1.js` 无输出；`npx eslint .` → 18（15/3）＝基线；utils 46/46、agent 45/45、`session-loop.mjs` 17/17；`vite build` ✓ 19.31s、主包 2,868.64 kB 未变；一次性冒烟 **34/34**（3 轮结构 / 摘要轮 `source:'answer'` / 失败轮 `interrupted` 且不进上下文 / 无 U+200B 无 reasoning 无 `[object Object]` / 不搬 `error` / 旧记录逐字节不变 / 两次结果一致 / `messages` 缺失退回 uiMessages / 尾部与孤立答案卡 / 空记录）。**冒烟脚本已删，正式断言在 E4**；浏览器判据顺延到 E3。**已验收** |
| E | E3 恢复语义 + 保存接线 | ✅ | 用户 2026-10-18 验收（原话「验收」）。**新增** `src/pages/AgentChatPage/useConversationHistory.js`（`buildSaveSignature` + 载入/保存/提示）；**改** `AgentChatPage.jsx`（接线、三条提示条、`interrupted` 提示、空态等 `ready`）、`locales/zh|en/translation.json`（各新增 `AgentChat.history` 8 键）。决策 = 1A 恢复最近一条 / 2A 签名判定 / 3A 页面提示条，见 `决策记录.md` **E-3**。**证据**：`npx eslint` 改动文件 exit 0、全量 **18（15/3）＝基线**；utils 46/46、agent 45/45、`session-loop.mjs` 17/17；`vite build` ✓ 11.78s、主包 **2,886.49 kB**（+17.85 kB）；键对齐 zh 204 / en 204、`history` 8/8。**无头 Edge 实测**（注入测试数据 + 假端点 `127.0.0.1:9`，无真实密钥）：待答问题刷新后可作答并落盘 2 轮（协议 §6 模板 + `level:'basic'`）；手改 `streaming` 刷新 → 出现「不会自动重发」、`generating:false`、非 localhost 资源 0 条、存储状态转 `interrupted`；v1 会话打开正常、连续两条续聊写入同 ID 的新键（3 轮）、`chat_histories` 前后**完整字符串相等**（450→450）；v2 损坏 → 提示「有 1 条历史数据读不出来」且回落旧会话；patch `setItem` 抛配额 → 提示条出现、该轮仅在内存；新会话不产生空记录；删 `agent_runtime` 后旧路径正常；console 仅 4 条故意的 `Failed to fetch`，无 React 警告。**已验收** |
| E | E4 测试 | ✅ | 用户 2026-10-18 验收（原话「验收」）。**新增** `src/utils/__tests__/historyStore.test.js`（25 条）、`historyV1.test.js`（16 条）、`historySignature.test.js`（11 条），共 52 条；落点决策 = 直接 import 页面 hook，见 `决策记录.md` **E-4**。**证据**：`node --test "src/utils/__tests__/*.test.js"` → **98/98**（基线 46 + 52）；agent 45/45；`session-loop.mjs` 17/17；`npx eslint` 三文件 exit 0、全量 **18（15/3）＝基线**；`vite build` ✓ 17.67s、主包 **2,886.49 kB 与 E3 完全相同**（不进产物）；测试文件无真实端点/密钥/字面量 U+200B。**已验收** |
| E | E5 历史列表界面 | ✅ | 用户 2026-10-18 验收（原话「验收完毕」）。**新增** `src/pages/AgentChatPage/HistoryDrawer.jsx`；**改** `useConversationHistory.js`（`conversations` / `refreshConversations` / `openConversationById` / `removeConversation` / `renameConversation` + 失败状态）、`AgentChatPage.jsx`（页头「历史」按钮、抽屉挂载、错误文案映射）、`locales/zh|en`（`AgentChat.history` 新增 14 键）。决策 1A/2A/3A 见 `决策记录.md` **E-5**。**证据**：`npx eslint` 页面目录 exit 0、全量 18（15/3）＝基线；utils 98/98、agent 45/45、`session-loop` 17/17；`vite build` ✓ 13.60s、主包 **2,895.51 kB**（+9.02 kB）；键 zh/en 各 218、`history` 22/22。**无头 Edge 实测**（注入 3 条含 1 条同 ID 双键、假端点）：列表 3 条且同 ID 只一条、标题按首条消息生成（v1/v2 都生效）、当前会话高亮；打开旧会话内容正常且**未产生回写**（v2 id 未变、v1 长度未变）；行内重命名生效、清空回退自动标题；双键会话删除后两键都搜不到；删当前会话回到空态；打开待答会话仍可作答（落盘 `answered`/`answer`，共 2 轮）；Esc 关闭；390px `scrollWidth=clientWidth=390`；console 仅 1 条故意的 `Failed to fetch`。 |
| E | 阶段收尾 | ✅ | `决策记录.md` **E-6**（7 条结论 / 放弃方案 / 验证证据 / 8 条遗留风险）；`F-开发指导.md` 已起草待审阅；HANDOFF 切到 F |
| F | 阶段开工前置 | ✅ | 用户 2026-10-18 审阅通过（原话「按你的决策来吧」）：取消按钮位置确认不变，投递版本与开关去留按计划后置 → `决策记录.md` **F-1** |
| F | F1 取消 | ✅ | 用户 2026-10-18 验收通过（原话「验收通过」）。**改** `src/agent/modelAdapter.js`（取消不再返回 error）、`src/agent/__tests__/runTeachingAgent.test.js`（+2 条 F1 用例）、`src/pages/AgentChatPage/HistoryDrawer.jsx`（`running` prop：运行中禁用打开 / 删除当前会话 + 提示）、`src/pages/AgentChatPage/AgentChatPage.jsx`（传 `running`、运行中禁用「新会话」、`handleOpenConversation` 二次拦截）、`src/locales/zh|en`（`AgentChat.history.runningHint` 各 1 键）。**证据**：agent **47/47**（含「副模型请求在跑时 abort → 端点看到连接关闭、只有 1 次请求、不产生工具卡」「超时→failed 与取消→cancelled 分开」）；utils 98/98、`session-loop` 17/17、eslint 18（15/3）＝基线；`vite build` ✓ 14.68s、主包 2,896.23 kB（+0.72 kB）；翻译键 zh 219 / en 219、`history` 23/23。**无头 Edge + 本地慢速假端点（`127.0.0.1:5181`，无真实密钥）**：取消后 `mainLen` 15→15（1.2s 内不再增长）、页脚回「发送」、无「这一轮没有完成」/「运行已中断」；落盘 `status:'cancelled'`、`error:null`；取消后立刻再发产生第 2 次请求（服务端 `REQ 1 / CLOSED 1 / REQ 2`）；运行中抽屉提示出现且「打开 / 删除当前会话」禁用、取消后 0 个禁用；console 0 error / 0 warning。决策见 `决策记录.md` **F-2** |
| F | F2 重试最后一轮 | ✅ | 用户 2026-10-18 验收通过（原话「验收完毕」）。决策 1A / 2 派生值 / 3A（用户定「保留现状」）/ 4B（`决策记录.md` **F-3**）。**改** `AgentChatPage.jsx`（`RETRYABLE_TURN_STATUSES`、`canRetryLastTurn` / `isRegenerating` 派生值、最后一轮尾部的「重试这一轮」按钮、运行中文案切换）、`src/utils/conversationState.js`（**缺陷**：`projectTurns` 合并键加 `runId`，块增加 `runId` 字段）、`src/components/MessageContent/MessageContent.jsx`（**缺陷**：key 改 `${runId}:${partId}`）、`src/utils/__tests__/conversationState.test.js`（+1 条回归）、`src/locales/zh|en`（`retry` / `regenerating` 各 2 键）。**证据**：utils **99/99**、agent 47/47、`session-loop` 17/17、eslint 18（15/3）＝基线、`vite build` ✓ 11.84s、主包 2,896.88 kB；键 zh 221 / en 221。无头 Edge + 脚本化端点（`127.0.0.1:5182`）：失败轮出现入口 → 同步连点只 1 次请求 → 「重新生成中…」+ 旧新正文各自成 `<p>`、错误块消失 → 重试中点取消回「发送」且入口重现 → 再重试成功 `completed`/`error:null`/3 片段 3 runId → 落盘改 `streaming` 刷新出现「不会自动重发」+ 入口，重试成功；新会话 console 仅 1 条故意的 `ERR_INCOMPLETE_CHUNKED_ENCODING`。**真实端点（`api.deepseek.com` / `deepseek-flash`，临时密钥只进浏览器内存）**：本机转发代理第 1 次请求回 500 → 该轮 `failed`、出现重试入口；点重试 → 上游 200 → `awaiting_user`、`error:null`，协议消息 `assistant`+`tool` 两条，**3 个 `ask_question` / 3 个结果 / 3 个互不相同的 `toolCallId` / 3 张卡（全 completed）/ 3 个问题**，`parts` 只有成功那次的 1 个 `runId`；代理日志 `REQ1 500 → REQ2 200 → 三个候选答案请求 200`。**代理坑**：转发前必须删 `accept-encoding`，否则 gzip 字节被当文本解析 → 零内容、无报错、`completed` 但全空 |
| F | F3 错误映射 | ✅ | 用户 2026-10-18 验收通过（原话「验收完毕」）。决策 1A / 2A / 3A / 4A（`决策记录.md` **F-4**）。**改** `01-核心协议.md` §5（**新增 `errorKind` 字段**，先改文档）、`src/agent/modelAdapter.js`（`tagError`：失败错误打 `endedBy`，取消仍 `error:null`）、`src/hooks/useChatSession.js`（透传 `errorKind`，含 catch 与缺模式两条路径）、`src/utils/conversationState.js`（`createTurn` / `RUN_FINISHED` / `RETRY_LAST_TURN` / `OPEN_CONVERSATION` / `projectTurns` 五处带 `errorKind`）、`src/utils/historyStore.js`（落盘白名单只收 `timeout`/`failed`）、`src/pages/AgentChatPage/useConversationHistory.js`（签名含 `errorKind`）、**新增** `src/pages/AgentChatPage/errorAdapter.js`（`classifyTurnError` / `ERROR_KIND` / `ERROR_TEXT_KEYS` / `TOOL_UNSUPPORTED_PATTERN`）、`AgentChatPage.jsx`（错误区加分类行，工具不支持改按 `kind` 判断）、`src/locales/zh|en`（各 +3 键 `errorTimeout` / `errorNetwork` / `errorFailed`）、**新增** `src/utils/__tests__/errorMapping.test.js`（7 条）+ `conversationState.test.js` / `historyStore.test.js` 各 +1 条。**证据**：utils **108/108**、agent 47/47、`session-loop` 17/17、eslint 18（15/3）＝基线、`vite build` ✓ 18.46s、主包 2,898.70 kB；键 zh 224 / en 224。**无头 Edge + 本地端点**：400 `tools is not supported by this endpoint` → 建议句（带端点/模型）+ 原文；`127.0.0.1:9` → 「网络连接失败…」+ `Failed to fetch`；挂住端点**等满 120s** → 「请求超时…」+ 落盘 `failed`/`errorKind:'timeout'`，刷新后仍在；取消 → 无错误块、`errorKind:null`。console 仅故意的网络错误与 400 |
| G | G1 配置面板 + 移除运行时开关 | ✅ | **用户 2026-11-01 人工验收通过**（原话「ok，验收完毕」）。验收口径按功能判据：设置入口存在、面板三段齐全、保存即生效、全文无「运行时」字样（G-1 的界面判据写在 G-2 改版之前，不按像素比对）。自动项仍是 2026-10-18 数据，本轮未复跑（见第 5 节）。 **新增** `src/pages/AgentChatPage/ConfigPanel.jsx`（模态；三段＝主模型 / 候选答案模型 / 我的个人信息）；**改** `AgentChatPage.jsx`（页头「设置」入口、`configSnapshot` state 取代挂载时的 `useMemo(…, [])`、保存后重读）、`src/App.jsx`（删 `agent_runtime` 开关，只留 `/design` 分支）、`locales/zh|en`（`page.settings` + `config.title/closeLabel/done/description/profileTitle/profileEmail/profileGithub` 各 8 键；`page.title` 改为「问知轩」/「Wenzhixuan」）。决策见 `决策记录.md` **G-1**。**证据**：eslint 改动文件 exit 0、全量 **18 problems（15/3）＝基线**；utils **108/108**、agent **47/47**、`session-loop` **17/17**；`vite build` ✓ 13.31s、主包 **2,795.23 kB**（−103.47 kB，旧页面不再被引用而被摇掉）；键 zh 78 / en 78、`config` 11/11 对齐；无头 Edge：页头 `问知轩/设置/历史/新会话` 且全文无「运行时」、面板三段齐全（8 个输入框 + 两个个人信息链接）、面板内填完即生效（横幅消失、`enableThinking` 未被覆盖、刷新后仍在）、ESC 关闭、390×844 无横向溢出、console 0 error / 0 warning。**未在真实端点下跑**（用的是假 key） |
| G | G2 界面改版（Markdown / 工具卡 / 问题磁贴 / 版式） | ✅ | **用户 2026-11-01 人工验收通过**（原话「我人工验收了」）。**验收依据＝用户侧人工走查**；本轮 HEAD 的自动基线（`node --test` / `eslint` / `vite build`）因本地 junction 故障未复跑，属待补证据（第 5 节）。 用户要求「好看的、优雅的界面……包含问题卡片、工具卡片调用排列、markdown 渲染」。**新增** `src/components/MessageContent/MarkdownContent.jsx`（react-markdown@10 + remark-gfm@4 重新进包；自绘 components：标题/列表/表格/引用/行内码/代码块带语言标签与一键复制/链接新窗口；`compact` 模式供磁贴题干）；**重绘** `MessageContent.jsx`（正文走 Markdown、思考块换样式）、`ToolCallCard.jsx`（状态主题 + running 进度条 + 折叠条去重 toolName + 展开区「提问/生成的问题/候选答案」分区 + 选项编号 chip）、`QuestionGroup.jsx`（弃用旧 `QuestionCard`，自绘磁贴 grid `sm:grid-cols-2`：编号 + 状态 pill + N 档候选/手动作答 + 整卡可点 + 「跳过此题」stopPropagation + 已答内联「你的回答」两行截断 + 组头引导文案）；**改** `AgentChatPage.jsx`（`max-w-3xl` + `h-dvh` + 吸顶毛玻璃页头带 BrandLogo 与副标题「提问带动理解」+ 空态 hero 与三个推荐词 chip（填词不发送）+ 一体化输入容器聚焦上浮 + 发送 `ArrowUp`/取消 `Square` + 运行中三点脉冲 + 错误区图标化与等宽原文 + 中断提示加图标）、`locales/zh|en`（各 +14 键，`AgentChat` 95/95 对齐）。决策见 `决策记录.md` **G-2**。**证据**：eslint 改动 5 文件 exit 0（修掉一例 `Icon size={13}` PropTypes 报错）、全量 18 problems＝基线；utils 108/108、agent 47/47、`session-loop` 17/17；`vite build` ✓ 13.65s、主包 2,806,491 B（较 G-1 +约 11 kB）；无头 Edge 注入 v2 演示数据逐项截图核对：markdown 全元素、工具卡两态（已完成/候选不可用）、磁贴待答与已答、错误区 + 重试、空态 hero、390 窄屏无横向溢出；console 0 error / 0 warning。**未在真实端点下跑** |
| F | F4 逐项验收 | ✅ | 用户 2026-10-18 验收通过（原话「验收完毕」）。产出 **`docs/agent-mvp/F-验收记录.md`**（16 项清单 / 旧路径 6 项回归 / 体积归因 / 3 条观察 / 投递建议），结论入 `决策记录.md` **F-5**。**本轮未改任何 `src/` 代码**。证据：真实端点 `deepseek-flash` 两轮对话（3+2 调用全部配对、三条作答路径、刷新恢复、无 U+200B/凭据）；旧路径 6 项在 `agent_runtime` 关闭下全过；体积 +166.1 kB 归因为「新增 Agent 代码 161.2 kB + `ai`/`@ai-sdk/openai`/`zod` 首次进包」；`vite build` ✓ 19.03s / 2,898.70 kB、eslint 18（15/3）＝基线、utils 108/108、agent 47/47、`session-loop` 17/17。**遗留 2 条文案问题未修**（「（已回答）」语义、`AnswerCard.send` 键缺失）。**投递决定已落地**：`src/App.jsx` 改为「键不是 `'false'` 就走新路径」（`决策记录.md` **F-6**），`vite build` ✓ 20.10s / 2,898.70 kB，无头 Edge 三情况（无键→新、`'false'`→旧、`'true'`→新）全对、console 0 error / 0 warning |

## 3. 下一步

2026-11-01 最新指令优先：用户要求在下一阶段前梳理清理项。清理方案已在本轮对话交付，尚未实施。第一个动作是按确认后的方案归档本文件及旧规则、建立短规则和短交接，保留长期架构约束；随后补齐现行协议/说明并核对提交范围。旧实现删除单独作为清理批次，在共享依赖清单与验证准备就绪后实施；不把旧代码删除和历史数据兼容移除混为一项。尚未执行 git commit / merge / push。

2026-11-01：**G 阶段已收尾**（G-1 / G-2 均用户人工验收 ✅，结论追加进 `决策记录.md`），当前没有进行中的开发任务。下一步按此顺序：

1. **补自动验证证据**（不阻塞功能，但基线应有数据）：解决 `node_modules` junction 问题——路线 A 在独立终端（非 IDE 内置）重装；路线 B `pnpm install --frozen-lockfile --config.node-linker=hoisted`。装好后复跑 `node --test "src/agent/__tests__/*.test.js" "src/utils/__tests__/*.test.js"`、`node scripts/session-loop.mjs`、`npx eslint .`、`npx vite build`，数字回填第 2 节 G1/G2 行与第 5 节。
2. **投递后待办（按优先级，均需用户确认再动）**：
   - 真端点走查配置面板（假 key 只验到「保存即生效」，没验「填完能真的发消息」）；
   - `AgentChat.config.migrationNotice` 文案改写（现说法「原文仍保存在旧路径的设置里」已误导）；
   - 旧路径死代码是否删除（`G-1` 遗留风险 1，删了就没有前端回退手段）；
   - 可选：代码块语法高亮（+30–80 kB）、已答磁贴答案展开。
3. **新阶段未定义**：A–F 计划已全部结项、G 收尾完成；若还要往下做，需用户先定方向（旧路径清理 / 部署与分包 / 教学效果迭代）。

2026-10-30 G-2 验收复核补充：下一步先修复本地依赖目录后复跑自动命令（建议用户在自带终端清理 `node_modules` 并 `pnpm install --frozen-lockfile`，因为会话内 `pnpm install --force` 被 safe-delete 守卫拦截），再决定是否把 **G-2** 从 🔵 改为 ✅；浏览器静态 UI 走查本轮已通过。

2026-10-30 补充：本轮已按「Agent 架构主体提交 `5b7ed03` 之前」定位并创建保护分支 `archive/pre-agent-upgrade`，本地与远端 `origin` 均指向 `8b06bc8`。若要保留「整个升级工作包开始前（含清理提交之前）」的版本，需要用户另行确认基点。开发下一步仍从 **G-2 验收** 开始。

2026-10-21 补充：本轮机制说明不推进任务。若继续开发，仍从 **G-2 验收** 开始，第一步先核对当前 `b8d5852` 相对既有 G-2 验收项的新增工具/参数流式能力，再与用户确认验收范围；若继续学习，建议按「分层架构 → 双循环时序 → 工具分支 → 上下文 → 文本流 → UI → 状态与恢复」展开。第 5 节所列文档差异尚未回填协议/决策记录。

0. **当前待办 = G 阶段验收**：G-1 已提交 `main`；**G-2（界面改版）已实施、等用户明天验收**（`决策记录.md` **G-2**，验收点：问题磁贴排列、工具卡折叠/展开、markdown 渲染、空态与页头）。验收后按顺序处理：
   - **真端点走查**一次配置面板（假 key 只验到了「保存即生效」，没验「填完能真的发消息」）；
   - **迁移提示文案改写**：`AgentChat.config.migrationNotice` 仍写「原文仍保存在旧路径的设置里」，而旧路径已无入口（`G-1` 遗留风险 3）；
   - **旧路径清理**：`ChatPage` / `AgentModel` / `useStreaming` / `useChatHistory` / `useAgentsConfig` / `StreamingParser` 及只被它们引用的组件（含旧 `MarkdownRenderer`、旧 `QuestionCard`）已无入口，删不删要你定（`G-1` 遗留风险 1）；
   - **可选**：代码块语法高亮（G-2 遗留风险 3，+30–80 kB）、已答磁贴答案展开（G-2 遗留风险 4）。
1. **A–F 计划内任务已全部结束**（六阶段 ✅）。投递版本＝新路径（`决策记录.md` **F-6**）；`agent_runtime` 开关已在 G-1 移除，回退手段随之消失（前端开关没了，只剩 `git revert`）。
2. **投递后待办**（不在本期范围，按优先级）：
   - 删除旧路径（`ChatPage` / `AgentModel` / `useStreaming` / `StreamingParser`）与 `agent_runtime` 开关——`F-1` 决策 2 倾向 A，需先确认没有回退需求；
   - 两条文案问题：「（已回答）」标签语义（实为「候选答案已取到」）、答案卡发送按钮 `aria-label` 为原始键 `AnswerCard.send`（`F-验收记录.md` §4）；
   - 主包分包：现 2.9 MB / gzip 806 kB（`决策记录.md` **F-5** 遗留风险 7）；
   - 模式控件是否恢复（D2 裁剪）与「无工具兜底模式」的用户入口（清单第 1、10 项的界面缺口）；
   - 错误映射的「工具不支持」改为按 provider 错误类型判断，而不是字符串粗判（`决策记录.md` **F-4** 遗留风险 1）。
3. **回退方式写进投递说明**：前端开关，不是服务端灰度（`决策记录.md` **F-6** 遗留风险 1）。
2. **F 阶段三个决策已处置**（`决策记录.md` **F-1**）：③ 取消按钮位置 = 发送按钮位置（**已确认不改**）；① 投递版本后置到 **F4 之后**；② 开关去留后置到**投递之后**（倾向 A：默认开 + 下个版本删旧路径）。**F4 结束必须给出前两个的结论**，否则 18 日投递无据可依。
3. **F2 的代码现状（已实现，F3 前复核）**：入口在 `AgentChatPage.jsx` 的最后一轮尾部，条件由页面自己的 `RETRYABLE_TURN_STATUSES` 判定（`deriveViewState.canRetryLastTurn` 仍宽于需要，**没有改**）；「重新生成中…」由 `parts` 里是否存在旧 `runId` 派生。**两处必须记住的事实**：① `projectTurns` 的文本合并键已含 `runId`（片段 id 跨运行会重复，实测都是 `0`）；② `MessageContent` 的 key 已是 `${runId}:${partId}`——将来若再加按片段渲染的组件，key 里也要带 `runId`。`RETRY_LAST_TURN` **不动** `questions`（决策 3A），所以重试到 `awaiting_user` 后旧 `pending` 问题仍可能被作答（`决策记录.md` **F-3** 遗留风险 2）。
4. **F3 已实现，F4 复核时注意三条**：① `errorKind` 只在**有 error 时**才有值（取消一定 `null`），且只允许 `timeout` / `failed`，落盘白名单在 `historyStore.js`；② 分类顺序在 `errorAdapter.js`：`errorKind==='timeout'` → 原文命中工具不支持 → 原文命中网络 → 普通失败，**不要**在页面里再写第二套判断；③ 「工具不支持」仍是字符串粗判，真实端点若只回 `Bad Request` 会归到「普通失败」（`决策记录.md` **F-4** 遗留风险 1）。
5. **F4 必须补的旧账**：旧路径 6 项走查表（第 5 节首条）至今未填；主包 **2,895.51 kB** 相对 A2 基线（2,732.6 kB）+163 kB，需要归因或说明是否可接受。
6. 之后按 **F1 → F2 → F3 → F4** 顺序，一次一个任务编号。
7. **E 阶段结论**（`决策记录.md` **E-6**）**不得推翻**：新数据只写 `chat_histories_v2`、旧键只读（删除/重命名除外）；恢复＝最近更新的一条；保存＝签名变化；`streaming → interrupted` 不自动重放；列表合并去重；**运行中切换会话会丢掉当前这一轮**——F1 已按 `决策记录.md` **F-2** 结论 B 拦下（运行中禁用「打开 / 删除当前会话 / 新会话」并给提示，删除别的会话与重命名不受影响）。
8. **E 阶段要带上的 C/D 结论**（`C-3` / `D-7`，不得推翻）：
   - 页面**只发命令**：`useChatSession` 返回 20 键（11 只读 + 9 命令），无 setter / `dispatch`；`isRunning` / `pendingQuestions` 用派生值。
   - 渲染只吃 `renderedTurns`，不直接读 `turn.parts` 自己拼；答案只经 `submitAnswer` / `skipQuestion`。
   - 打开既有会话的唯一入口是 `openConversation(record)`（读 `conversationId ?? id`、`mode`、`turns`），**不要新造载入路径**。
   - 旧路径四件套只读不改；`AnswerCard` / `QuestionCard` 只允许**可选 prop 级**改动（D5/D6 已各加一个），E 阶段若还需改必须走 `决策记录.md`。
   - 文案只往 `translation.json` 的 `AgentChat` 区块加键，不改已有键。
   - hook 内有 `stateRef` 镜像（同一次点击内读最新状态），页面不要绕过命令直接改状态；`buildModelContext` 只发已完成轮次，运行中那一轮由 hook 的 `contextForRun` 补上——**页面不要自己拼上下文**。
3. **B 阶段的运行层结论**（不得推翻）：
   - **唯一入口** `runTeachingAgent({ conversationId, turnId, runId, mode, config, messages, optionConfig, optionSystemPrompt, abortSignal, onEvent })`；三个 ID 由会话层分配（B-12）。
   - 结束原因五选一不可合并；`responseMessages` 只取运行层返回值，不手工拼；`model` / `generateOptions` 只给测试。
   - 真实端点已闭环（B-15）；A-5 / A-6 结论仍适用（应用层去重是唯一防线、思考模式默认保留、`reasoning_effort` 的 `max` 需请求体注入）。
   - 写测试时注意：`MockLanguageModelV3` 的 `doStream` **数组形式 1 基偏移**（用函数 + 自增游标）；`toolCallId` 必须**跨步全局唯一**，否则命中 B4 幂等表。
4. **命令与基线**：`node --test "src/agent/__tests__/*.test.js"`（45 条）、`node --test "src/utils/__tests__/*.test.js"`（**46 条**）、`node scripts/session-loop.mjs`（17/17）；**`node --test <目录>` 在本机不可用**（会把目录当模块加载）。基线：`npx eslint .` → 18 problems（15 错误 / 3 警告）；`vite build` 通过（约 18–23s，主包约 2,868 kB）。
5. **可复查的老证据**：`scripts/socratic-once.output.json`（真实运行，`allPassed:true`）、`决策记录.md` **B-1 ~ B-15 / C-1 ~ C-3 / D-1 ~ D-7**。各阶段遗留风险分别写在对应条目的最后一段，不要重复讨论。

## 4. 待你拍板的决策

2026-11-01 清理方案尚未定案：建议先做规则/文档归档与提交范围整理，再单独做旧实现删除。需定下共享文档与短规则的 Git 跟踪范围、已有两份设计文档删除是否纳入清理提交；旧实现删除候选已经静态核查，不能整目录删除 SettingsPanel 或删除 MarkdownRenderer/historyV1。后续是否将 dev 集成 main 作为独立 Git 操作处理，本轮未执行。

2026-11-01：进度查询未引入新技术决策，既有待决策项保持。

已拍板的移到 `决策记录.md`，这里只留未决项。

2026-10-30（G-2 验收复核）：本轮未作新技术决策，未改既有决策；发现本地依赖目录损坏属于环境阻塞，不新增设计决策。

2026-10-30：本轮未作新技术决策，未改既有决策；已按用户指令将保护分支 `archive/pre-agent-upgrade` 推送到远端 `origin`。

2026-10-21：本轮未作新技术决策，未改既有决策。发现的新增工具/事件与结构化副模型说明缺口见第 5 节；若后续要回填协议和决策台账，先按文档维护规则取得用户同意。

| 阶段 | 决策 | AI 倾向 | 状态 |
| --- | --- | --- | --- |
| 方案 | 等待作答时禁用模式切换（而非标记旧问题失效） | 禁用（代码已按此实现，`SET_MODE` 会拒绝） | 待确认（不阻塞 D） |
| D | ~~模式下拉存废 / 工具卡展开内容 / 失败文案口径 / 迁移判定落点~~ | — | ✅ 已拍板 → `决策记录.md` **D-1**（2026-10-17） |
| D | ~~「端点不支持工具」检测信号缺失（审阅新发现）~~ | — | ✅ 已拍板 → `决策记录.md` **D-2**：不自动降级，显示原因 + 建议手动切换 |
| C | ~~作答后是否自动开始下一轮~~ | 自动（命令内原子转换） | ✅ 已拍板 → `决策记录.md` **C-1** |
| C | ~~「跳过问题」的语义~~ | 记成一条真实回答并进入下一轮 | ✅ 已拍板 → **C-1** |
| C | ~~重试语义（入口留 D/F）~~ | 只重试最后一轮、保留原内容 | ✅ 已拍板 → **C-1** |
| C | ~~`pendingQuestion` 应为问题组~~ | 改 `pendingQuestions` 数组 | ✅ 已拍板 → **C-1** |
| C | ~~C2 的两条 hook 级判据怎么取证~~ | 新增 devDependency `react-test-renderer` 跑真实 hook | ✅ 已拍板 → `决策记录.md` **C-2**（用户 2026-10-17 授权破例改依赖） |
| E | ~~历史列表怎么展示新旧会话（决策 1）~~ | 合并成一个列表、同 ID 新键优先 | ✅ 用户 2026-10-18「支持」 |
| E | ~~配额满怎么处理（决策 2）~~ | 提示失败 + 本次只在内存 + 建议删旧会话 | ✅ 用户 2026-10-18 选 A |
| E | ~~旧会话继续对话后怎么写（决策 3）~~ | **A：写新键 `chat_histories_v2`，旧键只读** | ✅ 已拍板 → `决策记录.md` **E-1**（2026-10-18，用户原话「直接写新建吧，旧建自读」） |
| E | ~~本期做历史列表界面（决策 4）~~ | **做**。范围：显示标题 + 删除 + 重命名 + 不区分新旧 + 标题取首条用户消息前 **20** 字 | ✅ 用户 2026-10-18 定 |
| E | ~~旧会话后期「整体移除」，E2 的 v1 适配要做到多深~~ | 完整投影（旧会话可打开、可续聊） | ✅ 已按完整投影落地 → `决策记录.md` **E-2** |
| F | ~~18 日投递哪个版本（F 文档决策 1）~~ | **`agent_runtime` 默认开** | ✅ 用户 2026-10-18 原话「我认为Agent runtime默认开」→ `决策记录.md` **F-6**；`src/App.jsx` 已改并复验 |
| F | `agent_runtime` 开关去留（F 文档决策 2） | A 默认开 + 投递后删旧路径 | ⏸ 投递已完成，删旧路径成为**投递后待办**（第 3 节第 2 条）；开关暂时保留作回退 → **F-1 / F-6** |
| F | ~~取消按钮位置（F 文档决策 3）~~ | 发送按钮位置（运行中「发送」变「取消」） | ✅ 用户 2026-10-18 确认不改 → **F-1** |
| F | ~~副模型中止的取证方式（F1 决策点 1）~~ | 本机临时 HTTP 服务观察真实断开（A） | ✅ 用户 2026-10-18 原话「1A」→ `决策记录.md` **F-2** |
| F | ~~运行中是否禁止切换会话（F1 决策点 2）~~ | 禁用打开 / 删除当前会话 / 新会话 + 提示（B） | ✅ 用户 2026-10-18 原话「2B」→ **F-2** |
| F | ~~重试入口位置与形态~~ | 最后一轮尾部的内联按钮 | ✅ 用户 2026-10-18 原话「1 A」→ `决策记录.md` **F-3** |
| F | ~~重试时遗留的待答问题~~ | 原样保留，不改 C 层（A） | ✅ 用户 2026-10-18 原话「3 A」→ **F-3**（更重的后果见 F-3 遗留风险 2） |
| F | ~~F2 验收证据用假端点还是真实端点~~ | 真实端点（B） | ✅ 用户 2026-10-18 原话「4 B」→ **F-3**；**已执行**（本机代理 + `deepseek-flash`） |
| F | ~~3A 的后果是否收紧（重试后旧 pending 问题仍可作答）~~ | 保留现状，不改 C 层 | ✅ 用户 2026-10-18 原话「3A 的决策保留现状吧」→ **F-3** 遗留风险 2 |
| F | ~~F3 失败类别放在哪~~ | 运行层打标记 + 会话层 `turn.errorKind`（改协议 §5） | ✅ 用户 2026-10-18 原话「确认」→ `决策记录.md` **F-4** |
| F | ~~F3 错误原文是否保留 / 文案粒度 / 超时取证~~ | 保留原文 / 3 个新键 / 真等 120s | ✅ 同上 → **F-4** |
| E | ~~保存接线落点（决策 5）~~ | 放页面（四个保存点后显式调用），不动已验收的 C 层 | ✅ 用户 2026-10-18 选 A |
B 阶段**无待决项**。已拍板并移入 `决策记录.md`：B-1（模式集合与教学指令）、B-2（文档修正）、B-3（一轮多个问题）、B-4（副模型单独配置；末句已标注被 B-10 取代）、B-5（参数上限定案）、B-6（兜底触发条件与错误码）、B-7（B7 脚本沿用 `PROBE_*` 环境变量；UI 端点设置留后续）、B-8（B1 不建单测，四场景并入 B6）、B-9（B2 模式装配与 `?raw` 切分）、B-10（B3 用 `modelAdapter`；候选答案放宽为有几档显示几档）、B-11（`ask_question` 校验顺序 / 状态归属 / `internal_error`）、**B-12**（B5 运行边界 5 条：并发信号量在装配层 / 身份必传 / `finishReason` 判 `limit_reached` / 单次运行不重试 / `endedBy` 一对一映射）、**B-13**（B6 mock 接入：B1 加 `model` 注入口 + B5 透传 / 副模型注入假 `generateOptions` / 「超步数」用非法参数构造 / 取消用首个 `text-delta` 触发）、**B-14**（B7 脚本：副模型沿用 `PROBE_*` / 提示词读 translation.json / 未触发工具不重跑 / 输出落盘留证）。



## 5. 未收尾事项与已知问题

2026-11-01 清理核查更正：历史摘要称 MarkdownRenderer 仅被死代码引用不符合当前源码。实际 AgentChatPage → AnswerCard → MarkdownRenderer，新配置面板也复用 SettingsPanel/SettingsSection.jsx 与 AnswerWaitSettings.jsx；保留 ModelConfigPanel、ConfigManager、useMediaQuery、answerPreferences、historyV1 和 v1 存储兼容。核心协议尚未覆盖 visualize/explain_card、工具参数流式事件及副模型 generateText + submit_options 方案；短交接中需迁移这些说明缺口与自动验证证据缺口。本轮仅静态核查，未对依赖故障原因作新定论，未新增临时文件或服务。

2026-11-01：G-1/G-2 待验收及 10-30 自动验证证据缺口仍保留。本轮未复现依赖故障，不将历史阻塞表述为今日已验证的环境状态。

- **2026-11-01 依赖安装失败 = junction 遍历故障（未定论是否机器级）**：用户在自己终端跑 `pnpm install --frozen-lockfile`，`Packages: +508` 后报 `UNKNOWN UNKNOWN: unknown error, open 'D:\...\node_modules\ai\package.json'`。只读诊断结果：① `node_modules` 是半成品（顶层 43 项、`.pnpm` 509 个目录）；② 顶层 32 个 junction **全部无法解析**（`Test-Path node_modules\<pkg>\package.json` 全部 false）；③ 但 junction 目标本身存在且可读（`.pnpm\react@18.3.1\node_modules\react\package.json`、`.pnpm\ai@6.0.177_zod@4.4.3\node_modules\ai\package.json` 均正常）；④ `fsutil reparsepoint query node_modules\react` 显示 Tag `0xa0000003`、Substitute Name 正确，reparse 数据本身没问题；⑤ 现场新建 junction 复现失败：`mklink /J D:\Temp\j1 D:\Temp\t1` 成功但 `type D:\Temp\j1\a.txt` → `The path cannot be traversed because it contains an untrusted mount point.`，工作区根建 `jlink` 同样失败；用户在自带终端用 `mklink /J` + `Get-Content` 复测 **成功**，说明磁盘与 junction 机制本身没问题；重装后（`added 508` 完成、仍报同一 `UNKNOWN`）本会话再测仍是顶层 40 项、`Test-Path node_modules\ai\package.json` = False，且 `C:\Users\Public` 下新建 junction 也报同一句 → **故障只存在于当前会话侧，不是盘符问题**。`Get-Volume -DriveLetter D` → NTFS / Fixed / Healthy；`fsutil behavior query SymlinkEvaluation` → L2L ENABLED、R2L/R2R DISABLED。**未决**：本会话带沙箱（`rmdir` 被 `[safe-delete]` 守卫拦截），所以「junction 遍历失败」是否机器级尚不能定论，需用户在自带 PowerShell 用同一 `mklink /J` + `type` 复测。两条待选路线：A 删 `node_modules` 后重跑 `pnpm install --frozen-lockfile`（若只是半成品状态）；B 改用 `node-linker=hoisted`（完全不建 junction，`package.json` / `pnpm-lock.yaml` 不动）。另注：本轮 pnpm 提示 `Ignored build scripts: esbuild`，若 `vite build` 报 esbuild 二进制缺失，需 `pnpm approve-builds` 放行 esbuild。

- **2026-10-30 G-2 验收复核**：浏览器静态 UI 走查通过（现有 `dist/` + 注入 v2 演示数据）：页头、Markdown（标题/加粗/列表/表格/引用/行内代码）、通用工具卡折叠与展开、问题磁贴三态、错误区与重试入口、作答浮层、390px 无横向溢出、console 0 error / 0 warning。自动命令复验阻塞：当前 `node_modules` 缺传递依赖（`ai` / `react` / `debug` / `picomatch` 等解析失败），会话内 `pnpm install --force --frozen-lockfile` 被 safe-delete 守卫拦截；需用户在自带终端清理并重装依赖后复跑。临时浏览器文件已删除；`.playwright-cli/` 为空目录且被忽略，删除命令审批超时，未入库；`python` 静态服务 5189 已停止；`git status --short --branch` 仍为 `## dev...origin/dev`。

- **2026-10-30 Git 保护分支**：已创建并推送分支 `archive/pre-agent-upgrade`，本地与远端 `origin` 均指向 `8b06bc8`，用于保留 `5b7ed03 feat(agent): migrate chat to agent runtime architecture` 之前的版本。`git ls-remote --heads origin archive/pre-agent-upgrade` 返回 `8b06bc877fe446d777e2890f116cfbced467a0e0`。本轮未改 `src/`、未跑测试/构建。

- **2026-10-21 源码/文档差异（只登记，未改协议或决策）**：当前 `runTeachingAgent.js:247-252` 注册 `ask_question / visualize / explain_card`；`modelAdapter.js:332-357` 新增 `tool-input-started / tool-input-delta`，核心协议 §4 尚未列入。`generateAnswerOptions.js:234-270` 已使用非流式 `generateText` + 强制 `submit_options`，不再经过 `runModelTurn` / `ContentParser`，B-10 与本文件若干旧摘要仍为旧方案。当前 `MessageContent.jsx:168-215` 将正常提问交给问题组，HTML/SVG 成功结果交给专用卡，而非全部展示成普通工具卡。新增机制的测试、真实端点与验收状态本轮未复验，不能用 A–F 历史计数代替。
- **本轮分析无业务半成品**：只生成对话内分层图和双循环分步示意；未启动服务、未发真实模型请求、未跑测试/构建、未改 `src/`、依赖或既有技术决策。G-2 仍待用户验收。

- **G-2 已提交本地 main（2026-10-18，`8cf7f8b`，未 push）**：7 文件 +753/−199；验收若要大改可用 `git reset --soft HEAD~1` 退回工作区。
- ~~**G-2 走查残留**~~（2026-10-19 已清理）：5179 dev server 已停、`.playwright-cli/` 已删；演示数据与截图也已删。
- **G-2 已知限制**：代码块无语法高亮（+30–80 kB，验收后定）；已答磁贴答案两行截断无展开；`MarkdownRenderer`（react-markdown@8 旧组件）仍在仓库但只被死代码引用。
- **G-1 之后旧路径是死代码（2026-10-18）**：`src/App.jsx` 不再 import `ChatPage`，因此 `pages/ChatPage/`、`lib/AgentModel.js`、`hooks/{useStreaming,useChatHistory,useAgentsConfig}.js`、`utils/StreamingParser.js` 以及只被它们引用的组件（`HeaderButtons` / `ChatLayout` / `ChatWindow` / `ChatHistory` / `HistorySidebar` / `DebugPanel` / `QuickPrompts` / `ThinkingBlock` / `AnswerMessageCard` / `MessageBubble` / `UserInput` / `WelcomeScreen` / `LanguageSwitcher`）在界面上已无入口。`vite build` 已把它们摇掉（主包 2,898.70 → 2,795.23 kB），所以**不影响体积**，但改错文件不会被任何测试抓到。删除需用户拍板（`G-1` 遗留风险 1）。
- **迁移提示与新现状不符**：`AgentChat.config.migrationNotice` 说「原文仍保存在旧路径的设置里」，旧路径已无入口，这句话现在是误导（`G-1` 遗留风险 3）。
- **「我的个人信息」硬编码在 `ConfigPanel.jsx`**：邮箱与 GitHub 直接写在 JSX 里（与旧面板一致），未走 i18n（`G-1` 遗留风险 2）。
- **G-1 未在真实端点下验证**：浏览器证据用的是假 key（`sk-test-not-real`），只证明「面板能开、填完即生效、配置落盘」，没证明「填完能发出消息」。`ModelConfigPanel` 的「测试连接」也未点过。
- **阶段提交已落地（2026-10-18）**：`scripts/*.output.json` 两份探针结果（含端点与掩码密钥 `sk-a****253f`）**未入库**，已加 `.gitignore`，只提交三个 `.mjs` 脚本；`docs/`、`.agent`、`.codebuddy` 仍在忽略列表里，因此 HANDOFF 与阶段文档只有本地副本。提交未做任何代码改动，测试与构建沿用 F4/F6 的同日数据。

- **F 阶段已结项（2026-10-18）**：没有半成品文件、没有临时脚本残留（每轮结束时都清过 `.playwright-cli/`、本地假端点、构建日志）；`git status` 里的改动都是本期交付物与既有文档变动。
- **投递默认开已落地（F-6）**：回退手段是**前端开关**——用户在浏览器控制台执行 `localStorage.setItem('agent_runtime','false')` 后刷新即回旧路径；没有服务端灰度。投递说明里要写这一句，别让人以为可以远程回滚。
- **F4 关闭两笔旧账**：① 旧路径 6 项已在 `agent_runtime` 关闭下重跑并填表（`F-验收记录.md` §2）；② 主包体积已归因（+166.1 kB ≈ 新增 Agent 代码 161.2 kB + `ai`/`@ai-sdk/openai`/`zod` 首次进包），判定可接受（`决策记录.md` **F-5** 结论 4）。
- **F4 发现但未修的两条文案问题**：① 「（已回答）」在未作答时就出现——它由 `hasFetchedAnswer`（=候选答案已取到）驱动，不是「已回答」；② 答案卡发送按钮 `aria-label` 渲染成原始键 `AnswerCard.send`（键缺失）。两者都在新旧路径共用的组件里，改法见 `F-验收记录.md` §4，留到投递后。
- **F4 的另一条观察**：旧路径「选项作答要点两次」（第一次选中、第二次提交），新路径同组件同行为，D8 已按此验收，不算回归。
- **投递前必做**（若拍板默认开）：改 `App.jsx` 默认值 → `vite build` → 无键 / `'false'` / `'true'` 三种情况各抽查一次。
- **F3 改了协议 §5**（新增 `errorKind`）：取值只有 `timeout` / `failed` / `null`，取消必为 `null`；它**不进模型上下文、不参与任何协议判断**，只用于展示与排查。后续若有人按协议字段做校验，记得把它算进去。
- **F3 的超时原文仍是「运行已中断」**：界面靠分类文案解释，原文小字保留（决策 2A）。要改原文就得在 `modelAdapter` 的 timeout 分支写用户向文案，本轮没做。
- **F3 的「工具不支持」仍是字符串粗判**：真实端点 400 若只回 `Bad Request`，会落到「普通失败」而不是建议句（D8 实测过这种情况）。
- **F3 的超时证据成本高**：浏览器里真等了 120s；F4 若还要复现，别把它塞进高频回归，一次即可。
- **F2 修掉两个「重试后被拼在一起」的缺陷**：① `projectTurns` 的文本块合并键只有 `partId`，而 AI SDK 的片段 id 是每次流内自增的（Node 探针实测两次运行都是 `0`）→ 重试后新正文被拼到旧正文后面（F2 判据④直接失败）；修法：合并键加 `runId`、块对象新增 `runId`。② `MessageContent` 的 React key 只用 `partId` → 分块修好后两块的 key 相同，控制台连出 `Encountered two children with the same key`；修法：key 改 `${runId}:${partId}`。**将来任何按片段渲染的组件，key 与合并键都要带 `runId`。**
- **F2 的真实端点证据已补**（2026-10-18，`deepseek-flash`）：`ask_question` 3 次调用 / 3 个唯一 `toolCallId` / 3 张卡 / 3 个问题，重试没有重放旧调用。取证的代理技巧（第 1 次请求 500、转发前删 `accept-encoding`）写在 `决策记录.md` **F-3**，F4 若还要造「先失败再成功」可直接复用这个做法。
- **F2 的决策 3A 后果用户已拍板保留现状**（2026-10-18 原话「3A 的决策保留现状吧」）：重试跑到 `awaiting_user` 后旧 `pending` 问题仍可被作答。**F4 走查不要把它当缺陷上报**，也不要顺手改 `RETRY_LAST_TURN`。
- **`isRegenerating` 的退化边界**：上一轮在被取消前一个片段都没产生时，重试期间仍显示「正在生成…」（没有旧 `runId` 可比）。
- **F1 修掉一个真缺陷（取消曾经会显示错误块）**：`runModelTurn` 取消时把 `AbortError` 当 `error` 返回，会话层写进 `turn.error`，页面显示「这一轮没有完成 / 运行已中断」，违反 D-1「取消不显示为错误」与 F1 判据②。修法：`endedBy === 'cancelled'` 时返回 `error: null`（`src/agent/modelAdapter.js`）。**超时仍带这个 AbortError**（message 是「运行已中断」），F3 必须映射成可读文案，不能直接显示 `turn.error` 原文。
- **F1 的浏览器证据是一次性的**：本地慢速 SSE 假端点（`127.0.0.1:5181`，只监听本机、无真实密钥）与注入的 localStorage 已随验证删除，不可 CI 复跑；可复跑的部分是新增的 2 条 Node 用例。
- **F1 的测试依赖本机 `listen`**：沙箱/CI 若禁止绑定端口，「取消：副模型请求在跑时 abort…」这条会失败；届时按 `决策记录.md` **F-2** 遗留风险 2 降级（换成注入 `baseFetch` 记录 signal），不要删判据。
- **取消时若正好停在工具执行中，界面会留一张「执行中」的工具卡**：`tool-started` 已进 `parts`，`tool-completed` 被 abort 静默丢弃，该轮标 `cancelled`。协议层面无影响（取消的轮次不进上下文、`responseMessages` 为空），但卡片状态不会自己收尾。改法要在 C 层 `CANCEL_RUN` 里把未完成的工具片段标记掉（属已验收的 C 层改动），F1 未擅自改，留给 F2/F4 决定。
- **F1 的运行中限制只覆盖三条路径**：打开任意会话、删除当前会话、新建会话。删除**别的**会话与重命名仍可做（不影响在飞的这一轮）；`runningHint` 只有一句，没区分场景，F4 走查时看是否需要分文案。
- ~~旧路径 6 项走查仍未填表~~ → **已在 F4 补齐（2026-10-18）**：在 `agent_runtime` 关闭、真实端点下逐项重跑并填表（`F-验收记录.md` §2），六项全过；`AnswerCard`（`answerSettled`）与 `QuestionCard`（`cancelLabel` / `unavailable`）两处共用组件改动未破坏旧行为。今日实测「三题全部答完后自动发起下一轮」，A2 未记录是否要求全部答完。
- **E 阶段开工注意**：`src/hooks/useChatHistory.js` 的 `JSON.parse` / `setItem` 都没有 try/catch（损坏数据会白屏），**E 阶段不要复用它**，只作为旧键格式的参考；新键 `chat_histories_v2` 与 `schemaVersion: 2` 见 `01-核心协议.md` §7。
- **E1 的两条实现取舍（E2/E3 必须知情）**：① `parts` 里 `type:'reasoning'` 的片段在**保存时被剥离**（协议 §7 禁止 reasoning 原文入库）→ **刷新后思考块不再出现**，正文 / 工具卡 / 问题卡 / 答案都保留；② `saveConversation` **绝不写旧键**，但 `deleteConversation` / `renameConversation` **会写旧键**（阶段文件 E1 与 E5 判据要求两键同时处理；重命名只改 `title`，`messages` / `uiMessages` 原样保留）。两条都写进了 `决策记录.md` **E-1** 的「补充」段。
- **E 阶段的遗留风险集中在 `决策记录.md` E-6 末段（8 条）**，不在这里重复。F 阶段最需要盯的三条：① **运行中切换会话会丢掉当前这一轮**（E-5 风险 1，F1 做取消时顺带确认交互）；② **旧路径 6 项走查表至今未填**（本文件首条），F4 必须补；③ **主包 2,895.51 kB**（相对 A2 基线 +163 kB），F4 复核是否可接受。
- **~~E5 的新增风险：运行中打开另一条会话会丢掉当前这一轮~~ → 已关闭（2026-10-18，`决策记录.md` **F-2** 结论 B）**：运行中禁用「打开任意会话 / 删除当前会话 / 新会话」，抽屉里显示一句说明；`handleOpenConversation` 另有一道判断。E5 当时的判断（只保存到「发送 / 工具完成」两点）不变，因此这次拦截是行为层的唯一防线。
- **E3 的恢复策略边界**：启动时打开「最近更新的一条」。若刷新前正打开的是较早的一条且之后没产生新消息，刷新会跳到最近那条——E5 列表上线后可改为「记住当前打开的 id」，需新增存储键，单独决策（`决策记录.md` **E-3** 遗留风险 1）。
- **E3 的保存签名只覆盖最后一轮**：四个保存点都作用在最后一轮，所以成立；将来若出现「编辑历史轮次」类功能，签名要扩展。
- **E2 的两条观感代价（E3 验收时会看到，不是缺陷）**：① 旧记录里「作答摘要」会成为一条 `source:'answer'` 的用户气泡，其内容与前面答案卡文本**重复描述同一批答案**（`messages` 主线的直接结果，`决策记录.md` **E-2** 遗留风险 1）；② 旧失败轮不搬 `error` 对象（避免端点与请求信息进界面），只保留正文里的失败提示，因此没有警告样式。另外 `projectV1Record` **尚未被任何页面引用**，浏览器证据在 E3 补。
- **E1 的证据缺口**：44 条冒烟是一次性脚本（已删，不可复跑）；`src/utils/__tests__/historyStore.test.js` 由 **E4** 建，在那之前 `historyStore.js` 没有自动红灯。`loadAll` 返回的 v1 条目是**原样**记录（含 `messages` / `uiMessages`），投影由 E2 做；E3 接线不要绕过 `loadById` / `listForSidebar` 自己解析存储。
- **D8 走查暴露的四个缺陷已全部修完并复验（2026-10-18，`决策记录.md` D-5 / D-6）**：① 工具卡判 `output.optionsStatus`；② 问题卡不再给 `responding`；③ `AnswerCard` 新增可选 prop `answerSettled`，零候选时同时出失败面板与自定义输入框；④ 发送/取消按钮 `shrink-0 whitespace-nowrap`；标签文案改「可以点击回答」。复测证据见第 2 节 D8 行与第 7 节两条日志。**敏感信息**：用户提供的临时测试密钥只写入自动化浏览器的内存 localStorage，未落盘、未写进任何文档。
- **D7 的三点收口情况**：① 文案覆盖已由 D8 补到「工具卡五态 / 思考块 / 问题卡组 / 候选不可用浮层」全部机检 → 关闭；② ~~主包体积跨 D4–D7 未逐轮归因~~ → **F4 已归因**：终局 2,898.70 kB（A2 基线 +166.1 kB）≈ 新增 Agent 代码 161.2 kB（渲染前）+ `ai`/`@ai-sdk/openai`/`zod` 首次进包，判定可接受（`F-验收记录.md` §3 / `决策记录.md` **F-5** 结论 4）；③ 工具卡里的 `unknown` 兜底仍是硬编码技术标记，未收进翻译，如需中文化要另开一条。
- **环境变更（用户 2026-10-18 明确授权）**：全局安装 `@playwright/cli@0.1.22`（`npm i -g`），**未改 `package.json` / `pnpm-lock.yaml`**；浏览器复用系统 Edge（`--browser=msedge`），**未下载 Chromium**。它的临时产物 `.playwright-cli/` 与误写的 `configured.yaml` 已删除，`git status` 无残留。D8 闭环走查可直接用它做窄屏与失败链路取证（截图 / DOM 快照）。
- **D 阶段的暂缓项**：`AgentConfigPanel` 按 `agent_runtime` 分形态（主模型面板移除下拉与 `TEST_MODE` 预设）**暂缓到新路径有设置入口时再做**（`决策记录.md` D-3 ① 机制不变、D-4 时机后移）。将来加设置入口时必须记得这一项。

- **C 阶段已收尾，遗留风险集中在 `决策记录.md` C-3 第 7 段**（7 条），不在这里重复。D 阶段最需要盯的三条：① **`conversationState.js` / `useChatSession.js` 在浏览器里一次都没跑过**——C 阶段全部证据在 Node（纯函数 + `react-test-renderer` 假 runner），真实挂载、真实端点、真实渲染由 D8 补；② **hook 级测试用假 runner**，不覆盖 provider 装配与真实流顺序；③ **没有接存储**，刷新即丢（E 阶段）。
- **C 阶段的代码边界**：新增 `src/utils/conversationState.js`、`src/hooks/useChatSession.js`、`src/utils/__tests__/`（2 个文件）、`scripts/session-loop.mjs`；改 `src/utils/conversationState.js` 一次（问题卡顺序，C4 暴露）；依赖只加了 `devDependencies.react-test-renderer@18.3.1`（C-2）。**旧路径四件套与 `src/agent/**` 未被改写。**
- **C1 的交付证据（离线，一次性冒烟，脚本已删）**：`node .c1-probe/probe.mjs` 与 `recheck.mjs` 全过 —— ① 乱序：`TOOL_COMPLETED` 先到补建卡片，随后 `TOOL_STARTED` 只更新、重复 `TOOL_COMPLETED` 不产生第二张卡/第二个问题（2 卡 2 问）；② 迟到：旧 `runId` 的 `text-delta` / `tool-completed` / `run-finished` 三连，状态 JSON 逐字节不变；③ 双击：同一问题连续两次 `SUBMIT_ANSWER`，第二次被丢弃、`turns` 仍为 1；④ 一轮多问：答一个 + 跳一个之后才产生第二轮，`userMessage.text` 为协议 §6 模板（含「（来自选项：expert）」与「（学生选择了跳过，未作答）」两行）；⑤ 上下文：`buildModelContext` 输出 3 条（user / assistant 含 2 个 tool-call / tool 含 2 个 tool-result），reasoning 与两条故意悬空的调用（`call_orphan` / `call_stray`）都不在其中，无 U+200B，文本内容不含字段名；⑥ 重复 `run-started` 不把已收尾 turn 拉回 `streaming`；⑦ 取消后同一 `runId` 的迟到片段被丢弃、状态停在 `cancelled`；⑧ `projectTurns` 的 blocks 顺序为 `reasoning → text → tool → tool`，问题卡顺序＝调用顺序。**脚本目录已删除、不可复跑**，正式断言在 C3。
- **C4 暴露并修掉的真缺陷（问题卡顺序）**：C1 的 `handleToolCompleted` 原本按**完成顺序**追加问题，而协议 §5 要求「顺序＝模型调用顺序」。真实端点会乱序返回结果——`scripts/socratic-once.output.json` 的 tool 消息顺序是 `call_00 / call_02 / call_01`，assistant 里的调用却是 `00 / 01 / 02`，所以 B7 那种一轮 3 问在旧实现下会排成 1/3/2。修法：按卡片顺序（由 `tool-started` 创建，即调用顺序）决定插入位置；卡片本身是补建的（完成先于开始）时没有顺序信息，退化为完成顺序。**这是 C1 验收后对 `conversationState.js` 的唯一一次改动**，C3 已补用例（结果按 1/3/2 回来仍排 1/2/3），C1/C2/C3 全部测试复跑通过。
- **C4 第一版脚本有一处输入不真实（已改，记下来避免误判）**：我最初在伪造的 `responseMessages` 里也塞了 U+200B，导致「整个状态无 U+200B」判据失败。这不是 reducer 漏清——`modelMessages` 存的是运行层（B1）已经清过的返回值，本层**不再二次清洗协议消息**；脚本的伪造输入应与 B1 的真实输出一致，因此改为只在流片段里注入该字符（验证 reducer 侧的清理）。
- **C3 的 18 条用例覆盖范围**（`src/utils/__tests__/conversationState.test.js`）：① 发送与三种空操作；② `RUN_STARTED` 旧 id 丢弃 / 重复不复活 / 事件先到补建；③ 片段合并、U+200B 清除、空片段不建块；④ 工具乱序补建、重复不增卡不增问题、启动事件不回退已完成卡；⑤ `rejected` 不产生问题卡、`Error` 只留文案；⑥ 五种结束原因映射 + 重复收尾丢弃 + 未知原因归 `failed`；⑦ 旧 `runId` 四连不改状态；⑧ 取消后迟到片段丢弃、重复取消幂等、取消后收尾仍落盘；⑨ 一轮两问答完才续轮、模板与跳过行符合协议 §6；⑩ 双击第二次原样返回、空答案与非待答状态空操作；⑪ 重试换 `runId` 保留内容、新片段另起块；⑫ `SET_MODE` 三态；⑬ `OPEN_CONVERSATION` 降级 `interrupted`；⑭ 上下文配对过滤（悬空 call / 孤立 result 都剔除）、无 reasoning / U+200B / 空块；⑮ `failed`/`cancelled`/`streaming` 的轮回不进上下文；⑯ `projectTurns` 与 `deriveViewState` 投影一致。
- **写 C3 时踩到并修掉的三个测试自身缺陷**（不是实现缺陷，记下来避免以后误判）：① 想在「已 `awaiting_user` 的轮次」上再补一个工具事件来造两问——工具事件只在该轮 `streaming` 时被接受，必须在一轮里连续两次 `TOOL_COMPLETED` 再收尾；② 双击用例最初拿**同一份旧 state** 提交两次，那模拟的是「读到旧状态」，reducer 自然各生成一轮——真正的防线是第二次作用在**第一次的结果**上（hook 侧的 `stateRef` 镜像才负责旧状态那条路径，C2 的用例已覆盖）；③ `buildModelContext` 按协议不发送还在 `streaming` 的轮次，所以「答案进上下文」要等该轮收尾后才看得到，运行中的那一轮由 hook 显式补上用户消息（`contextForRun`）。
- **依赖清单已变更（`决策记录.md` C-2，用户 2026-10-17 授权破例）**：`devDependencies` 新增 `react-test-renderer@18.3.1`，只被 `src/utils/__tests__/useChatSession.test.js` 引用、不进产物。规则 §3「禁止改 `package.json`」由该条**一次性**豁免，后续任务不自动获得授权。`ai 6.0.177` / `@ai-sdk/openai 3.0.63` / `zod 4.4.3` 未动。`react-test-renderer` 已被 React 官方标记弃用，将来升 React 19 时要换成 `@testing-library/react`。
- ~~C2 的两条判据没有运行证据~~ → **已补齐**（2026-10-17）：`node --test "src/utils/__tests__/*.test.js"` → 7 / 7 pass，其中「取消后 `AbortSignal` 确实被触发、状态停 `cancelled`、重复取消幂等」「`isRunning` 与 `turns` 在发送前后、作答前后、取消前后各断言一次」由真实 React 运行时（`react-test-renderer` 的 `act`）驱动。
- **C2 的事件→action 接线有两个刻意选择**：① 事件回调**跳过 `run-finished`**，改由运行层返回值派发一次——事件不带 `error`，用它收尾会丢掉失败原因；② hook 里有一个 `stateRef` 镜像，「先判断能不能发 → 再算上下文 → 再起运行」都读它，派发前把纯函数结果写回去，否则两次快速点击会读到同一个旧 `state` 并各起一次运行。防双击**仍由 reducer 决定**，镜像只让判断及时；`isRunning` 等一律来自 `deriveViewState`，镜像不参与渲染。
- **C1 的两处实现选择超出 C 文档字面**（未新增协议字段；用户 2026-10-17 验收 C1 时按此通过，供 C2/C3/D 复核）：① `parts` 的元素多带一个 `runId`，用于「重试保留原内容」时新旧运行的片段不互相拼接（`RETRY_LAST_TURN` 换新 `runId`，旧块留在原地）；② 一轮问题全部答完/跳过时，该 turn 的 `status` 由 `awaiting_user` 改写为 `completed`——「已不再等待」这件事只在状态上保留一处真相，`deriveViewState.pendingQuestions` 仍按 `questions[].state` 派生。
- **`SET_MODE` 已按「等待作答 / 运行中禁止切模式」实现**（HANDOFF 第 4 节该方案项仍标「待确认」）。若最终决定改成「标记旧问题失效」，只需改 `SET_MODE` 一个分支，不影响 C2 的接口。
- **B5 的交付证据（离线，一次性冒烟，脚本已删）**：`node .b5-smoke/smoke.mjs` 9 个场景全过 —— A 提问后停止（`run-started > tool-started > tool-completed > run-finished{awaiting_user}`、仅 1 次请求、`responseMessages` 2 条且调用与结果配对、事件与协议消息均无 U+200B）；B 一轮三调用（2 ready + 1 `duplicate_question`、三个 `toolCallId` 互不相同、副模型峰值 2）；C 纯文本 `completed`；D 三步持续非法参数 → `limit_reached`（3 次请求、每步 `invalid_input`）；E 取消 → `cancelled`、`responseMessages` 空、取消后事件不再增长；F 端点 500 → `failed`（恰好 `run-started`+`run-finished` 两个事件）；G 身份缺失 → 抛 `缺少运行身份 runId` 且零事件；H `normal` 模式无工具事件；I 6 个问题并发峰值 **= 4**（上限生效）。**脚本与日志已删除，不可复跑**，正式断言在 B6。
- **B 阶段的遗留风险集中在 `决策记录.md` B-15 第 7 段**，不在这里重复。B 当初列给 C 的三条已全部关闭：① 跨轮上下文 → C4 已打印「答案进入下一轮」的 4 条上下文；② 354 条 `reasoning-delta` → D 阶段渲染仍需节流（这是 D 的事，不是 C 的缺口）；③ 取消/重试 → C2 有 hook 级断言、C3 有 reducer 用例。
- **`C-开发指导.md` 已审阅通过（2026-10-17）**：C1–C4 四步，每步「做法要点 / 你检查 / 命令」。审阅时用户对四条检查项（`set*` 断言、无 `isLoading` 类布尔量、无 `Object.values().join(`、纯函数不造 ID）表示认可，未要求整改。**C 阶段代码已开始**：C1 已交付（🔵 待验收），C2–C4 未开始。
- **B7 的原始证据要保留**：`scripts/socratic-once.output.json`（真实运行，`allPassed:true`）。它含完整题干与档位，外发或截图前先确认是否适合公开。
- **B6 的未收尾项（详见 `决策记录.md` B-13 遗留风险）**：① `model` / `generateOptions` 两个测试注入口留在生产签名里，只靠「生产不传」约束，D 阶段接页面时不要传；② B6 全部是模型输出层面的模拟，**不覆盖** provider 装配、开闸 fetch、`thinking` / `reasoning_effort` 请求体注入——只有 B7 真实端点能给这些证据；③ `timeout → failed` 仍无自动断言（B5 内部固定 120s，测试无法缩短）；④ 上游 `MockLanguageModelV3` 的 `doStream` 数组 1 基偏移是实现细节，升级 `ai` 后若有变化，需复核测试注释（当前用函数形式，不受影响）。
- **B5 的未收尾项（详见 `决策记录.md` B-12 遗留风险）**：① `finishReason` 取值依赖 SDK 归一化，若端点在「还想调工具」时给别的值（如 `other`）会被判 `completed`，B7 要复核实测值；② 主运行超时被内部固定为 120s，故 `timeout → failed` 这条映射**没有**离线证据（测试无法缩短主运行预算）；③ 包装层覆写 `execute` 依赖 `tool()` 返回纯对象，已实测 `{ description, inputSchema, execute }` 三个键，但若 AI SDK 升级改变工具对象形态，B6 的断言要先跑一遍；④ 被取消的排队调用返回 `rejected('internal_error')`，F3 做错误映射时不要当程序 bug 上报。
- **本轮 APICallError 仍会打到 stderr**：冒烟的 F 场景触发了 AI SDK 把完整 `APICallError`（含 `url`、`requestBodyValues`、`responseHeader`）打印到 stderr，与 B-10 遗留风险 ① 同源；B5 的返回值只带 `error` 对象本身、不进事件与 `responseMessages`。
- **~~B 阶段没有任何真实端点运行记录~~ → 已不成立（2026-10-17 更新）**：B7 已在真实端点（`deepseek-flash`）跑通，四件事全部有了答案——模型确实会主动调用 `ask_question`；真实参数合规（3 个调用全部 `ready`）；副模型稳定输出 **5 档**（3 个问题各 5 档）；工具结果进 `response.messages` 后**配对 3/3**。原始证据：`scripts/socratic-once.output.json`（`when=2026-10-17T11:59:17.752Z`，`allPassed:true`）。
- `research_agent_upgrade/` 是空目录，可删除。
- 工作区里有两处**不是本会话产生**的改动，未处理、不影响 B 阶段：`升级方案 2026 年 5 月 1 日.md` 处于已删除未暂存（`git status` 显示 ` D`）、`维护待办.md` 处于已修改。切换会话前已用 `git status --short` 核对：`src/agent/` 为本次新增，无临时脚本残留。
- A2 基线已存档：`docs/agent-mvp/A-基线存档.md`（命令输出、走查表、已存在问题清单）。走查表的「现象」已按用户实测补齐；两项细节未记录（第 3 项答案卡形态、第 6 项重试后原内容是否保留），不影响 A2 判据。
- npm 残留已清除：删除 `node_modules` 后重装，顶层非今日目录 0 个、`node_modules/.package-lock.json` 不存在、根目录不再有 `zod`（正确：zod 不是直接依赖，只存在于 `.pnpm/zod@4.4.3`）。
- pnpm 提示的 `Ignored build scripts: esbuild` 未影响构建：A2 的 `vite build` 成功（20385ms，产出 3 个文件）。后续若某次构建因 esbuild 报错，再在用户终端执行 `pnpm approve-builds`。
- 非源码产物（可随时删）：`scripts/probe-tools.output.json`（探针数据，A-5/A-6 的证据来源，验收前建议保留）、`dist/`（A2 构建产物）；另有系统 TEMP 下的 `a2-build-report.mjs` / `vite-build-A2.json` / `vite-build-A2.log`（构建采集临时文件，不在仓库内）。
- 本会话的 shell 受 IDE 安全删除守卫约束：批量删除会触发 `SAFE_DELETE_BULK_CONFIRM_REQUIRED`（如 `node_modules/.pnpm` 10078 项），在会话内无法完成，须用户在自带终端执行；不要用环境变量绕过该守卫。
- ~~决策 4 的风险~~已由实测排除（`决策记录.md` A-6）：该端点上不带 `tools` 回传 `reasoning_content` 也能跑通，同轮多步与跨轮都是 200，且 AI SDK 组装的 assistant 消息里没有原生 reasoning。**协议不变量 3 与存储规则无需修改，思考模式默认保留。**
- **B 阶段必须照做的三条 A 阶段结论**（来自 `决策记录.md` A-5 / A-6）：① 应用层去重是唯一防线——`parallelToolCalls:false` 被端点接受但不生效，实测第二步请求仍带两个 `tool` 消息；② `reasoning_effort` 的 `max` 不在 AI SDK 允许值内（允许 `none|minimal|low|medium|high|xhigh`），只能注入请求体，不能只靠 `providerOptions`；③ provider 不要传 `compatibility`（锁定版本无此选项）。
- 同一份 DeepSeek 文档还写明：思考模式下 `temperature` / `presence_penalty` / `frequency_penalty` 不生效（不报错但被忽略），`top_p` 有效范围 0.95–1.0。B 阶段装配模型参数时要按此写，不要沿用旧 `AgentModel` 的 `temperature: 0.3` 假设。
- A3 期间发现：旧 `AgentModel` 传的 `createOpenAI({ compatibility: 'compatible' })` 在锁定的 `@ai-sdk/openai@3.0.63` 里**既无类型声明也无运行时处理**（`node_modules/@ai-sdk/openai/dist` 全量搜索 `compatibility` 只命中注释）。即该选项是无效参数。旧路径当前可用，说明它并非必需；B 阶段装配 provider 不要照抄，若确需"兼容模式"语义先查该版本提供的替代项（该包有 `strictJsonSchema`、`systemMessageMode` 等）。
- `docs/agent-mvp/B-开发指导.md` 已起草（2026-10-16）并按 B-1 / B-3 回填，**仍等你整体审阅**（B1–B7 七步，每步「做法要点 / 你检查 / 命令」）。审阅通过前不写任何 `src/` 代码。
- B-1 / B-3 引发的下游同步**已完成**（2026-10-16 第二期）：`docs/AGENT_MVP_PLAN.md`（现状表、§4.1 execute 流程与预算、turn 结构、B2/B4/B5/B6 任务表、D2/D4/D5、F3、第 6 节验收清单）、`B-运行层与提问工具.md`（B4 判据、B5 预算与多调用、B6 用例）、`B-开发指导.md`（B4/B5/B6 检查表）、`D-页面与模式.md`（D4 改问题卡组、D5 措辞、判据）、`F-取消重试与验收.md`（2.2 说明与 F3 文案行）、`A-基线存档.md`（撤销"3 张卡＝缺陷"条目）。
- B1 的未收尾项：① 单测按 `决策记录.md` **B-8** 不新建——B1 的证据是一次性离线冒烟（脚本已删），**没有可复跑的命令**；B6 的判据里已强制覆盖这四个场景，B6 交付前 `modelAdapter` 无自动红灯。② `maxOutputTokens` 默认不传（无依据不截断），若后续观测到输出跑飞需补。③ `raw` 路径（DeepSeek 的 `delta.reasoning_content` 提取）未在任何冒烟中覆盖，B6/B7 必须补（构造带 `reasoning_content` 的 SSE）。
- B2 的未收尾项（详见 `决策记录.md` B-9 的遗留风险）：① `modePrompts.js` 含 `?raw`，**任何 Node 侧脚本都不能 import 它**——B7 若要打印真实 system prompt，只能 import `modes.js` 再自己 `readFileSync` 两份 md；② `?raw` 路径尚未进入生产构建（B2 结束时页面未引用它），构建通过不能证明生产包可用，**D 阶段接入后须复验**；③ 两份 md 的文案是首版，D 阶段按真实样例调整时须同步 `modes.test.js` 的断言（尤其"含且仅含一句工具约束"）。
- 构建体积未解释：本轮 `vite build` ok（38.53s），主包 `assets/index-IVw_truv.js` 2,815.83 kB，A2 基线为 2,732.6 kB（+83.2 kB）；`src/agent/**` 之外 grep `modePrompts|agent/modes` 为 0 命中，即 B2 新增模块没被页面引用，差异来源不明（可能是上一次基线测量口径或仓库既有改动），**建议 F4 复核，不要凭印象归因**。
- 测试命令口径：`node --test <目录>` 在 Node v22.22.1 + PowerShell 下不可用（`MODULE_NOT_FOUND`，把目录当模块加载）；可用形式 `node --test "src/agent/__tests__/*.test.js"`。规则第 7 节的命令需同步修正（规则文件未擅自改）。
- **事实更正（2026-10-17）**：第 7 节 2026-10-16「决策 1 讨论（第二轮）」日志里写的"`ContentParser` **返回值是数组**"是错的（日志按规则不改写历史条目，在此更正）。实际 `ContentParser.parse()` 返回**对象**：`{ none: [{content,index,length}], heard: [...], … }`，每个档位是**数组**（`src/utils/ContentParser.js:13-37`）。旧 `useQuestionFlow.js:111-147` 把该数组直接当字符串放进 UI 状态，是旧路径的隐性缺陷；B3 取内容必须写 `parsed[tag]?.[0]?.content`。
- B3 起需要注意：`AgentModel` **不可取消**（无 `abortSignal` 入参、无 `abort()`，内部 60s 超时还会触发自身 3 次重试），而协议要求副模型 45s 且不超过主运行剩余时间。B3 的开工说明已把这一点列为首个决策点。
- B3 的未收尾项（详见 `决策记录.md` B-10 的遗留风险）：① AI SDK 在失败时会把完整 `APICallError`（含 `url`、`requestBodyValues`、`responseHeaders`）打印到 **stderr**，虽然不进我们返回的结构，但 D/F 阶段接日志或错误上报时必须只取 `detail`；② 副模型请求也走开闸 fetch，会多一条空 SSE（用户已确认可接受），换端点需复验；③ 副模型提示词的三层覆盖仍在配置层，B4/D 阶段由上层读取后传入，E 阶段迁移配置时不要改变来源；④ 档位放宽后界面必须按 `options.length` 渲染（D4 判据已补），F4 要确认缺档时没有空行。
- 仓库根残留一个**空目录** `.b3-probe/`（临时探针用，文件已删；git 不跟踪空目录，可随时删除）。
- B4 的未收尾项（详见 `决策记录.md` B-11 的遗留风险）：① `additionalProperties: false` 会让 SDK 在进入 `execute` 前拒绝未知字段，**真实链路上模型看到的是 `tool-error`，不是 `rejected('invalid_input')`**；`execute` 内的同名校验是可测的第二层防御，D 阶段做错误文案时两种表现都要覆盖；② 工具结果携带完整 `options` 会让上下文变长（一轮 3 问 × 最多 5 条）；③ B3 的 `detail`（timeout / cancelled / invalid_output）**没有**透传到工具结果，界面只能靠 `errorCode` 区分；④ `internal_error` 用固定文案，排查依赖上层日志（F3 补）。
- `npx rg` 在本环境会安装一个同名的假包（`rg@0.0.2`）并尝试写 README；本轮用它做 grep 时出现该提示，**已核对 `README.md` 未被改动**（`git status --short -- README.md` 无输出）。以后检索用工具或 `Select-String`，不要 `npx rg`。

## 6. 本轮改动的文件

2026-11-01 提交前清理梳理：仅更新 docs/agent-mvp/HANDOFF.md 第 1–7 节，保留历史日志；未删除源码、替换规则、归档资料、修改忽略配置或执行提交。工作区既有 docs/REDESIGN_KARE.md 与 docs/REDESIGN_KARE_FEASIBILITY.md 删除状态未触碰；.codebuddy 保持原状。

2026-11-01 G 阶段收尾：**改** `docs/agent-mvp/HANDOFF.md`（第 1/2/3/6/7 节）；**追加** `docs/agent-mvp/决策记录.md` 的「G 阶段收尾（2026-11-01）」段（只追加，未改既有条目）。未改 `src/`、依赖文件、核心协议。

2026-11-01 G-2 验收登记：仅更新 `docs/agent-mvp/HANDOFF.md`（第 1/2/3/6/7 节）。未改 `src/`、依赖文件、核心协议或决策记录。

2026-11-01 依赖排障 + 基线试跑记录：仅更新 `docs/agent-mvp/HANDOFF.md`（第 1/5/6/7 节）。未改源码、依赖清单、核心协议或决策记录；诊断期间在工作区根建的临时 junction `jlink` 与 `.jtest/` 已删除，`D:\Temp` 下的 `j1` / `t1` / `jtest_link` 测试目录也已删除。

2026-11-01 进度查询：仅更新 `docs/agent-mvp/HANDOFF.md`。未改源码、依赖和决策记录；工作区既有 `docs/REDESIGN_KARE.md`、`docs/REDESIGN_KARE_FEASIBILITY.md` 删除状态未触碰。

（每轮结束时列出新增/修改的文件，便于下一轮核对边界。）

- 2026-10-30（G-2 验收复核）：仅改 `docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/6/7 节）；未改 `src/`、`scripts/`、依赖文件、核心协议或决策记录。临时文件 `g2-*.yaml` 与 `.playwright-cli/page-*.yml` / console log 已删除；`python` 静态服务已停止；依赖修复命令未改 `package.json` / `pnpm-lock.yaml`。

- 2026-10-30（定位 Agent 升级前提交 + 建保护分支 + 推送远端）：**改** `docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/6/7 节）；**新增并推送 Git 分支** `archive/pre-agent-upgrade` → `8b06bc8`（远端 `origin/archive/pre-agent-upgrade` 同步存在）。未改 `src/`、`scripts/`、依赖文件、核心协议或决策记录。

- 2026-10-21（Agent 机制源码梳理）：仅更新 `docs/agent-mvp/HANDOFF.md` 第 1–7 节；新增并追加项目日记 `.workbuddy-ai/memory/2026-10-21.md`。业务源码、测试、配置、依赖、核心协议及决策记录均未修改；分析与两幅可视化交付在本轮对话。

- 2026-10-19（G-2 迭代三，commit `ef5c90a`）：**改** `AgentChatPage.jsx`（画布 paper-50、页头通栏无线、白色输入胶囊）、`QuestionGroup.jsx`（磁贴白底）、`ToolCallCard.jsx`（卡片白底）；改 `docs/agent-mvp/决策记录.md`（G-2 迭代三）、`HANDOFF.md`（第 6/7 节）。
- 2026-10-19（G-2 迭代二，commit `ea5a443`）：**改** `src/pages/AgentChatPage/AgentChatPage.jsx`（页头/输入区底色与对话区统一为 paper-100，输入容器只留描边）。
- 2026-10-19（G-2 迭代，commit `e3bcec3`）：**改** `src/components/ToolCallCard/ToolCallCard.jsx`（折叠条显示问题原文）、`src/pages/AgentChatPage/QuestionGroup.jsx`（间距收紧）；改 `docs/agent-mvp/决策记录.md`（G-2 追加迭代段）、`HANDOFF.md`（第 5/6/7 节）。
- 2026-10-18（G-2 界面改版，commit `8cf7f8b`）：**新增** `src/components/MessageContent/MarkdownContent.jsx`；**改** `src/components/MessageContent/MessageContent.jsx`、`src/components/ToolCallCard/ToolCallCard.jsx`、`src/pages/AgentChatPage/QuestionGroup.jsx`、`src/pages/AgentChatPage/AgentChatPage.jsx`、`src/locales/zh/translation.json`、`src/locales/en/translation.json`（各 +14 键）；改 `docs/agent-mvp/决策记录.md`（新增 **G-2**）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/5/6/7 节）。**未改** `src/agent/**`、`src/hooks/**`、`src/utils/**`、协议与存储格式、依赖清单（react-markdown@10 / remark-gfm@4 原本就在 `package.json`，G-1 只是被摇出包）。走查临时产物：`public/ui-demo.json` 与 11 张截图已删；`.playwright-cli/` 与 5179 dev server 因审批超时未清理（不入库）。
- 2026-10-18（G-1 配置面板 + 移除运行时开关）：**新增** `src/pages/AgentChatPage/ConfigPanel.jsx`；**改** `src/pages/AgentChatPage/AgentChatPage.jsx`（引入面板、`readConfigSnapshot()`、`configSnapshot` state、两个 `handle*ConfigChange` 合并落盘、页头「设置」按钮、渲染 `<ConfigPanel>`）、`src/App.jsx`（删 `agent_runtime` 判定与 `ChatPage` 的 import）、`src/locales/zh/translation.json`、`src/locales/en/translation.json`（`page.title` 改值 + `page.settings` + `config` 下 7 个新键）；改 `docs/agent-mvp/决策记录.md`（新增 **G-1**）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/5/6/7 节）。`vite build` 重新生成 `dist/`（2,795.23 kB）。浏览器走查临时产物 `.playwright-cli/`、两张截图、`dev-check.log` **均已删除**，5179 端口进程已停。**未改** `src/agent/**`、`src/hooks/useChatSession.js`、`src/utils/**`、旧路径四件套与只被它们引用的组件、依赖文件。
- 2026-10-18（阶段升级总结）：仅更新 `docs/agent-mvp/HANDOFF.md` 的最后更新说明、文件清单与会话日志。读取完整 `.agent/`（当前只有 `rules/agent-mvp/RULE.mdc`），结合协议、决策、验收记录与源码梳理运行时、工具调用和主副模型容错。未修改运行代码、测试、依赖或既有决策。第 1/2 节仍为 A–F 全部完成，第 3/4/5 节既有事项不变；并保留本轮阅读期间新增的阶段提交记录。本轮离线复核命令及输出见第 7 节末尾。

- 2026-10-18（阶段提交）：**未改任何 `src/` 代码**；改 `.gitignore`（新增 `scripts/*.output.json`）；git 提交 `8b06bc8`（`.gitignore` + 删除根目录两份过期文档）、`5b7ed03`（`src/agent/**`、`src/hooks/useChatSession.js`、`src/pages/AgentChatPage/**`、`src/components/{MessageContent,ToolCallCard}/**`、`src/utils/{conversationState,historyStore,historyV1,promptMigration}.js` 与 `src/utils/__tests__/**`、`src/App.jsx`、`AnswerCard`/`QuestionCard` 可选 prop、`locales/zh|en`、`package.json` + `pnpm-lock.yaml` 的 `react-test-renderer`）、`c489d88`（`scripts/probe-tools.mjs`、`run-socratic-once.mjs`、`session-loop.mjs`）；改 `docs/agent-mvp/HANDOFF.md`（第 1/5/6/7 节）。
- 2026-10-18（投递默认开落地，`决策记录.md` **F-6**）：**改** `src/App.jsx`（`useAgentRuntime` 判定改为「键不是 `'false'` 就走新路径」）；改 `docs/agent-mvp/决策记录.md`（新增 **F-6**）、`docs/agent-mvp/F-验收记录.md`（§5 改为「已拍板」并补复验）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/6/7 节）。`vite build` 重新生成 `dist/`（2,898.70 kB，与改动前同尺寸）。临时产物 `.playwright-cli/` 与 `C:/Users/Public/f6-build.*` 已删除。**未改**其它 `src/` 文件、依赖文件。
- 2026-10-18（F4 逐项验收）：**未改任何 `src/` 代码**；**新增** `docs/agent-mvp/F-验收记录.md`；改 `docs/agent-mvp/决策记录.md`（新增 **F-5** 阶段收尾结论）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/6/7 节）。临时产物：体积统计用的 `vite.f4-visualize.config.mjs`（仓库根，已删）、`C:/Users/Public/f4-probe/`、`C:/Users/Public/f4-build.*`、`.playwright-cli/` 均已删除；临时测试密钥只写进浏览器 localStorage。
- 2026-10-18（F3 实施）：**改** `docs/agent-mvp/01-核心协议.md`（§5 增加 `errorKind` 与理由）、`src/agent/modelAdapter.js`（`tagError` + 两处失败返回）、`src/hooks/useChatSession.js`（三处 `RUN_FINISHED` 带 `errorKind`）、`src/utils/conversationState.js`（五处带 `errorKind`）、`src/utils/historyStore.js`（落盘白名单）、`src/pages/AgentChatPage/useConversationHistory.js`（签名）、`src/pages/AgentChatPage/AgentChatPage.jsx`（错误区分类行、工具不支持改按 kind）、`src/locales/zh|en/translation.json`（各 +3 键）；**新增** `src/pages/AgentChatPage/errorAdapter.js`、`src/utils/__tests__/errorMapping.test.js`；改 `src/utils/__tests__/conversationState.test.js`、`historyStore.test.js`（各 +1 条）。改 `docs/agent-mvp/决策记录.md`（新增 **F-4**）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/6/7 节）。`vite build` 重新生成 `dist/`。临时产物 `.playwright-cli/`、`C:/Users/Public/f3-probe/`（400 与挂住端点 + 日志）、`f3-build.cmd|log` **均已删除**。**未改**旧路径四件套、`runTeachingAgent.js`、`useConversationHistory` 的载入/保存逻辑、依赖文件。
- 2026-10-18（F2 补真实端点证据）：**未改任何 `src/` 文件**；改 `docs/agent-mvp/决策记录.md`（**F-3** 结论 4 补真实端点做法与证据、遗留风险 1 关闭、遗留风险 2 记用户「保留现状」）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/7 节）。临时产物：本机转发代理与日志 `C:/Users/Public/f2b/`、`.playwright-cli/` **已删除**；临时测试密钥只写入自动化浏览器内存，未落盘、未进文档。
- 2026-10-18（F2 实施）：**改** `src/pages/AgentChatPage/AgentChatPage.jsx`（重试入口 + 派生值 + 运行中文案）、`src/utils/conversationState.js`（`projectTurns` 合并键加 `runId`、块加 `runId`）、`src/components/MessageContent/MessageContent.jsx`（key 带 `runId`、propTypes 补 `runId`）、`src/utils/__tests__/conversationState.test.js`（+1 条回归）、`src/locales/zh|en/translation.json`（各 +2 键）；改 `docs/agent-mvp/决策记录.md`（新增 **F-3**）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/6/7 节）。`vite build` 重新生成 `dist/`。临时产物 `.playwright-cli/`、`C:/Users/Public/f2-probe/`（脚本化端点 + partId 探针 + 日志）、`f2-build.cmd|log` **均已删除**。**未改**旧路径四件套、`useChatSession.js`、`useConversationHistory.js`、依赖文件。
- 2026-10-18（F1 实施）：**改** `src/agent/modelAdapter.js`（取消时 `error: null`）、`src/agent/__tests__/runTeachingAgent.test.js`（helper 加 `useRealOptions` / `optionConfig`，新增 2 条 F1 用例）、`src/pages/AgentChatPage/HistoryDrawer.jsx`（`running` prop + 提示 + 禁用打开/删除当前会话）、`src/pages/AgentChatPage/AgentChatPage.jsx`（传 `running`、禁用「新会话」、`handleOpenConversation` 拦截）、`src/locales/zh/translation.json` / `src/locales/en/translation.json`（各新增 `AgentChat.history.runningHint` 1 键，未改已有键）；改 `docs/agent-mvp/决策记录.md`（新增 **F-2**）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/6/7 节）。`vite build` 重新生成 `dist/`。无头浏览器临时产物 `.playwright-cli/`、`C:/Users/Public/f1-probe/`（慢速假端点脚本与日志）、`f1-build.cmd|log` **均已删除**。**未改**旧路径四件套、`conversationState.js`、`useChatSession.js`、`hooks/useStreaming.js`、`package.json` / `pnpm-lock.yaml`。
- 2026-10-18（F 开发指导审阅通过 + F 决策入档）：改 `docs/agent-mvp/决策记录.md`（新增 **F-1**：取消按钮位置确认、投递版本与开关去留按计划后置）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/6/7 节，F 阶段标为已开工）。**未改任何 `src/`、`scripts/`、依赖文件。**
- 2026-10-18（E5 验收 + E 阶段收尾 + 起草 F 开发指导）：改 `docs/agent-mvp/决策记录.md`（新增 **E-6** 阶段 E 收尾结论）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/6/7 节，阶段切到 F）；**新增** `docs/agent-mvp/F-开发指导.md`（按规则 2.3 起草，待用户审阅）。**未改任何 `src/`、`scripts/`、依赖文件。**
- 2026-10-18（E5 实施）：**新增** `src/pages/AgentChatPage/HistoryDrawer.jsx`；**改** `src/pages/AgentChatPage/useConversationHistory.js`（列表/打开/删除/重命名）、`AgentChatPage.jsx`（页头按钮、抽屉、错误文案映射）、`src/locales/zh|en/translation.json`（`AgentChat.history` 各加 14 键）；改 `docs/agent-mvp/决策记录.md`（新增 **E-5**）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/5/6/7 节）。`vite build` 重新生成 `dist/`。无头浏览器临时产物 `.playwright-cli/` 与 `D:/Temp/e5-build.log` **已删除**。**未改**旧路径四件套、`src/agent/**`、`historyStore.js`、`historyV1.js`、`conversationState.js`、`useChatSession.js`、依赖文件。
- 2026-10-18（E4 验收 + E5 开工说明）：改 `docs/agent-mvp/HANDOFF.md`（第 1/2/3/7 节；E4 标 ✅、E5 开工范围与三个决策点入档）。**未改任何 `src/`、`scripts/`、依赖文件**（E5 未开工）。
- 2026-10-18（E4 实施）：**新增** `src/utils/__tests__/historyStore.test.js`、`src/utils/__tests__/historyV1.test.js`、`src/utils/__tests__/historySignature.test.js`（共 52 条）；改 `docs/agent-mvp/决策记录.md`（新增 **E-4**）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/6/7 节）。`vite build` 重新生成 `dist/`（产物未变）。**未改任何实现文件**（`historyStore.js` / `historyV1.js` / `useConversationHistory.js` / `AgentChatPage.jsx` 均未动）、旧路径四件套、依赖文件。
- 2026-10-18（E3 验收 + E4 开工说明）：改 `docs/agent-mvp/HANDOFF.md`（第 1/2/3/7 节；E3 标 ✅、E4 用例清单与唯一决策点入档）。**未改任何 `src/`、`scripts/`、依赖文件**（E4 未开工）。
- 2026-10-18（E3 实施）：**新增** `src/pages/AgentChatPage/useConversationHistory.js`；**改** `src/pages/AgentChatPage/AgentChatPage.jsx`（接 hook、三条提示条、`interrupted` 提示、空态等 `ready`）、`src/locales/zh/translation.json` / `src/locales/en/translation.json`（各新增 `AgentChat.history` 8 键，未改已有键）；改 `docs/agent-mvp/决策记录.md`（新增 **E-3**）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/5/6/7 节）。`vite build` 重新生成 `dist/`。无头浏览器临时产物 `.playwright-cli/` 与 `D:/Temp/e3-build.log` **已删除**。**未改**旧路径四件套、`src/agent/**`、`historyStore.js`、`historyV1.js`、`useChatSession.js`、`conversationState.js`、`useChatHistory.js`、依赖文件。
- 2026-10-18（E2 验收 + E3 开工说明）：改 `docs/agent-mvp/HANDOFF.md`（第 1/2/3/7 节；E2 标 ✅、E3 开工事实与决策点入档）。**未改任何 `src/`、`scripts/`、依赖文件**（E3 未开工）。
- 2026-10-18（E2 实施）：**新增** `src/utils/historyV1.js`（唯一源码文件）；改 `docs/agent-mvp/决策记录.md`（新增 **E-2**）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/5/6/7 节）。`vite build` 重新生成 `dist/`（构建产物，非源码）。一次性冒烟脚本与构建日志写在 `D:/Temp/`（**已删除**）。**未改**旧路径四件套、`src/agent/**`、`historyStore.js`、`useChatSession.js`、`conversationState.js`、`AgentChatPage/**`、`useChatHistory.js`、locales、`package.json` / `pnpm-lock.yaml`。
- 2026-10-18（E1 验收 + E2 开工说明）：改 `docs/agent-mvp/HANDOFF.md`（第 1/2/3/7 节；E1 标 ✅、E2 开工事实与决策点入档）。**未改任何 `src/`、`scripts/`、依赖文件**（E2 未开工）。
- 2026-10-18（E1 实施）：**新增** `src/utils/historyStore.js`（唯一源码文件）；改 `docs/agent-mvp/决策记录.md`（**E-1** 追加「补充」段三条：旧键只读的边界、reasoning 不落库、标题回退不硬编码语言）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/5/6/7 节）。`vite build` 重新生成 `dist/`（构建产物，非源码）。一次性冒烟脚本与构建日志写在 `D:/Temp/`（**已删除**）。**未改**旧路径四件套、`src/agent/**`、`useChatSession.js`、`conversationState.js`、`AgentChatPage/**`、`useChatHistory.js`、locales、`package.json` / `pnpm-lock.yaml`。
- 2026-10-18（E 决策 3 拍板 + E1 开工说明）：改 `docs/agent-mvp/决策记录.md`（新增 **E-1**，E 阶段五个前置决策；原「（待填写。）」占位被替换）、`docs/agent-mvp/E-开发指导.md`（§2.1 决策 3 行与 §2.4 标题/结论列回填「A 写新键、旧键只读」）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/6/7 节）。**未改任何 `src/`、`scripts/`、依赖文件**（E1 尚未开工）。
- 2026-10-18（D8 验收 + D 阶段收尾 + 起草 E 开发指导）：**新增** `docs/agent-mvp/E-开发指导.md`（按规则 2.3 起草，待用户审阅）；改 `docs/agent-mvp/决策记录.md`（新增 **D-7** 阶段 D 收尾结论）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/6/7 节）。**未改任何 `src/`、`scripts/`、依赖文件。**
- 2026-10-18（D-6 文案细化）：**改** `src/pages/AgentChatPage/questionAdapter.js`（候选不可用 → `status:'unavailable'`）、`src/components/QuestionCard/QuestionCard.jsx`（新增 `unavailable` 分支：sage 配色 + `Pencil` 图标 + 新键）、`src/locales/zh/translation.json` / `src/locales/en/translation.json`（各新增 1 键 `QuestionCard.canAnswer`，无已有键改动）、`src/utils/__tests__/questionAdapter.test.js`（断言改 `unavailable`）；改 `docs/agent-mvp/决策记录.md`（新增 **D-6**）、`docs/agent-mvp/HANDOFF.md`。`vite build` 重新生成 `dist/`。**未改**旧路径四件套、`src/agent/**`、`useChatSession.js`、`conversationState.js`、`AnswerCard`、`ToolCallCard`、依赖文件。
- 2026-10-18（D8 走查 + 四缺陷修复）：**改** `src/components/ToolCallCard/ToolCallCard.jsx`（`resolveCardState` 改判 `optionsStatus`）、`src/pages/AgentChatPage/questionAdapter.js`（`status` 恒 `completed`、`toAnswerCardModel` 加 `answerSettled:true`）、`src/components/AnswerCard/AnswerCard.jsx`（新增可选 prop `answerSettled` + `showFailurePanel` / `showAnswerInput` 两个派生值，旧路径不传则行为不变）、`src/pages/AgentChatPage/AgentChatPage.jsx`（`<AnswerCard answerSettled>`、发送/取消按钮加 `shrink-0 whitespace-nowrap`）、`src/utils/__tests__/questionAdapter.test.js`（改写 1 条、新增 1 条）；改 `docs/agent-mvp/决策记录.md`（新增 **D-5**）、`docs/agent-mvp/HANDOFF.md`。**未改**旧路径四件套（`ChatPage` / `AgentModel` / `useStreaming` / `StreamingParser`）、`src/agent/**`、`src/hooks/useChatSession.js`、`src/utils/conversationState.js`、`QuestionCard`、翻译文件、依赖文件。`vite build` 重新生成 `dist/`；自动化临时产物 `.playwright-cli/` 已删，窄屏截图只在 `D:\Temp\d8-narrow.png`（未入库）。
- 2026-10-18（D7 实施）：**改** `src/locales/zh/translation.json`、`src/locales/en/translation.json`（各新增一个顶层 `AgentChat` 区块，42 键 ×2，**未改任何已有键**）、`src/components/ToolCallCard/ToolCallCard.jsx`、`src/components/MessageContent/MessageContent.jsx`、`src/pages/AgentChatPage/QuestionGroup.jsx`、`src/pages/AgentChatPage/AgentChatPage.jsx`；改 `docs/agent-mvp/HANDOFF.md`。`vite build` 重新生成 `dist/`（构建产物，非源码）。**未改**旧路径四件套、`src/agent/**`、`src/hooks/useChatSession.js`、`src/utils/conversationState.js`、`QuestionCard`、`AnswerCard`、`App.jsx`、依赖文件。
- 2026-10-17（D 阶段审阅 + 决策拍板）：改 `docs/agent-mvp/决策记录.md`（新增 **D-1** 四个前置决策、**D-2** D5 不自动降级）、`docs/agent-mvp/D-开发指导.md`（决策表回填结论；D3 补 reasoning 节流要点；D4 补「复用样式、重写接线」提醒；D5 按 D-2 改写；D6 补设置面板落地 D-1）、`docs/agent-mvp/HANDOFF.md`（第 1/3/4/6/7 节；第 4 节顺手移除一条早已被 C-1 覆盖的方案层划线行）。**未改任何 `src/`、`scripts/`、依赖文件。**
- 2026-10-17（D1 实施）：**新增** `src/pages/AgentChatPage/AgentChatPage.jsx`（占位组件）；**改** `src/App.jsx`（运行时开关，`agent_runtime === 'true'`，默认关）；改 `docs/agent-mvp/HANDOFF.md`（第 1/2/3/6/7 节）。`vite build` 重新生成 `dist/`（构建产物，非源码）。**未改旧路径四件套、`src/agent/**`、`src/hooks/`、`src/utils/`、locales、依赖文件。**
- 2026-10-17（D3 实施）：**新增** `src/components/ToolCallCard/ToolCallCard.jsx`、`src/components/MessageContent/MessageContent.jsx`；**改** `src/pages/AgentChatPage/AgentChatPage.jsx`（占位 → 临时 mock 验收页）；改 `docs/agent-mvp/HANDOFF.md`（第 1/2/3/6/7 节）。`vite build` 重新生成 `dist/`。**未改旧路径四件套、`src/agent/**`、C 层两个文件、locales、依赖文件。**
- 2026-10-17（D4 实施）：**新增** `src/pages/AgentChatPage/questionAdapter.js`、`src/pages/AgentChatPage/QuestionGroup.jsx`、`src/utils/__tests__/questionAdapter.test.js`；**改** `src/pages/AgentChatPage/AgentChatPage.jsx`（mock → 真实接线）、`src/components/QuestionCard/QuestionCard.jsx`（仅加可选 `cancelLabel` prop，3 处小改，默认行为不变）；改 `docs/agent-mvp/HANDOFF.md`。`vite build` 重新生成 `dist/`。**未改旧路径四件套、`src/agent/**`、C 层两个文件、`AnswerCard`、locales、依赖文件。**
- 2026-10-17（D4 缺陷修复）：**改** `src/pages/AgentChatPage/questionAdapter.js`（answer 改 ContentParser 形状 `{level:[{content}]}`）、`src/utils/__tests__/questionAdapter.test.js`（同步）、`src/pages/AgentChatPage/AgentChatPage.jsx`（AnswerCard 换 `fixed inset-0` 全屏容器）；改 `docs/agent-mvp/HANDOFF.md`。
- 2026-10-17（D5 实施）：**改** `src/pages/AgentChatPage/AgentChatPage.jsx`（配置门槛细化，只改这一个源码文件）；改 `docs/agent-mvp/决策记录.md`（新增 **D-3**）、`docs/agent-mvp/HANDOFF.md`。`vite build` 重新生成 `dist/`。**未改其他 `src/` 文件、locales、依赖文件。**
- 2026-10-17（D6 实施）：**新增** `src/utils/promptMigration.js`、`src/utils/__tests__/promptMigration.test.js`；**改** `src/pages/AgentChatPage/AgentChatPage.jsx`（迁移提示条）；改 `docs/agent-mvp/决策记录.md`（新增 **D-4**）、`docs/agent-mvp/HANDOFF.md`。`vite build` 重新生成 `dist/`。**未改其他 `src/` 文件、locales 内容（仅 import 读取）、依赖文件。**
- 2026-10-17（D7 准备 + 会话交接）：**只改 `docs/agent-mvp/HANDOFF.md`**（第 1/2/3/6/7 节）。D7 文案盘点与翻译文件插入锚点已核对并写入第 3 节；**未改任何 `src/` 文件、翻译文件、依赖文件**（D7 代码未开工）。

- 2026-10-16：新增 `docs/agent-mvp/` 全部文件；改写 `docs/AGENT_MVP_PLAN.md`。
- 2026-10-16：改写 `.codebuddy/rules/agent-mvp/RULE.mdc`，加入以 HANDOFF 交接进度的会话协议。
- 2026-10-16（A1 中断）：只改 `docs/agent-mvp/HANDOFF.md`；未改任何源码、`package.json`、`pnpm-lock.yaml`。副作用：pnpm 重装前删除了 `node_modules/.modules.yaml`，`node_modules/.pnpm` 被部分删除，`node_modules/@ai-sdk` 消失。
- 2026-10-16（A1 续）：用户在自带终端执行 `pnpm install --frozen-lockfile`（+219 -147，Done in 1m 6.6s）；除 `docs/agent-mvp/HANDOFF.md` 外未改任何仓库文件，`node_modules/` 由 pnpm 重装（非仓库文件）。
- 2026-10-16（A1 收尾）：用户在自带终端执行 `Remove-Item node_modules -Recurse -Force` + `pnpm install --frozen-lockfile`；仍在会话内复跑 A1 判据与首跑 `eslint .`。除 `docs/agent-mvp/HANDOFF.md` 外未改任何仓库文件。
- 2026-10-16（A 阶段决策 1/3 入档）：改 `docs/agent-mvp/决策记录.md`（新增 A-1 端点与模型、A-2 lint 只记录）与 `docs/agent-mvp/HANDOFF.md`。未改任何源码或依赖文件。
- 2026-10-16（决策 A-3 入档）：改 `docs/agent-mvp/决策记录.md`（新增 A-3：A3 追加 3 条 reasoning 对照用例）与 `docs/agent-mvp/HANDOFF.md`（第 3 节下一步同步）。未改任何源码或依赖文件。
- 2026-10-16（A2 命令类基线）：只改 `docs/agent-mvp/HANDOFF.md`；跑 `vite build` 重新生成 `dist/`（构建产物，非源码），未改任何 `src/` 文件。临时脚本写在系统 TEMP（`a2-build-report.mjs`），不在仓库内。
- 2026-10-16（A2 归档）：**新增** `docs/agent-mvp/A-基线存档.md`（决策 A-4 授权的范围扩展）；改 `docs/agent-mvp/HANDOFF.md` 与 `docs/agent-mvp/决策记录.md`（新增 A-4）。未改任何 `src/` 文件或依赖文件。
- 2026-10-16（A3 脚本）：**新增** `scripts/probe-tools.mjs`（决策 A-3 授权范围）；改 `docs/agent-mvp/HANDOFF.md`（新增第 0 节「新会话开工清单」、更新 A3 状态与下一步）。未改 `src/` 下任何文件、未改依赖文件。运行时会在 `scripts/` 下生成 `probe-tools.output.json`（探针产物，可删）。
- 2026-10-16（A3 补测 + A4 入档）：改 `scripts/probe-tools.mjs`（新增 `原生assistant含reasoning` 观测、⑤b/⑤c、⑦ 改注入）；改 `docs/agent-mvp/决策记录.md`（新增 A-5、A-6）、`docs/agent-mvp/A-基线存档.md`（新增第 6 节证据索引）、`docs/agent-mvp/HANDOFF.md`。新增/更新 `scripts/probe-tools.output.json`（探针产物）。未改 `src/` 下任何文件、未改依赖文件。
- 2026-10-16（A 阶段收尾）：改 `docs/agent-mvp/决策记录.md`（新增 A-7 阶段收尾结论）、`docs/agent-mvp/HANDOFF.md`（A3/A4 转 ✅、阶段切到 B、下一步改为 B 阶段开工流程）。未改 `src/` 下任何文件、未改依赖文件。**A 阶段累计：只新增 `scripts/probe-tools.mjs` 一个代码文件，`src/` 未动。**
- 2026-10-16（B 阶段开工准备）：**新增** `docs/agent-mvp/B-开发指导.md`（按规则 2.3 起草，待用户审阅）；改 `docs/agent-mvp/HANDOFF.md`（第 1 节当前任务、第 3 节下一步改为 B 阶段流程并清掉 A 阶段残留条目、第 4 节登记 B 阶段四个决策项、第 5 节未收尾、本节与第 7 节日志）。未改 `src/` 下任何文件、未改 `scripts/`、未改依赖文件。
- 2026-10-16（B-1/B-3 拍板与文档同步）：改 `docs/agent-mvp/01-核心协议.md`（§2.2 / §2.3 / §3 / §5 / §6）、`.codebuddy/rules/agent-mvp/RULE.mdc`（§6 关键参数与禁用式条款）、`docs/AGENT_MVP_PLAN.md`（现状表、§4.1、§4.3、B2/B4/B5/B6、D2/D4/D5、F3、第 6 节验收清单）、`docs/agent-mvp/` 下的 `B-运行层与提问工具.md`、`B-开发指导.md`、`D-页面与模式.md`、`F-取消重试与验收.md`、`A-基线存档.md`、`决策记录.md`（新增 B-1~B-3）、`HANDOFF.md`。**未改任何 `src/` 文件、未改 `scripts/`、未改依赖文件。**
- 2026-10-16（B-4~B-6 拍板与同步）：改 `docs/agent-mvp/决策记录.md`（新增 B-4 副模型单独配置、B-5 参数上限定案、B-6 兜底触发条件与错误码）、`docs/agent-mvp/01-核心协议.md`（§2.2 新增"未配置副模型"分支、§2.3 errorCode 两值注释）、`B-运行层与提问工具.md`（决策 2/3 指向、B3 判据 4 条）、`B-开发指导.md`（决策 2/3 行、B3 检查表 4 行）、`D-页面与模式.md`（D5 做法与判据）、`docs/AGENT_MVP_PLAN.md`（D5 行）、`HANDOFF.md`。**未改任何 `src/` 文件、未改 `scripts/`、未改依赖文件。**
- 2026-10-16（B-7 拍板与同步）：改 `docs/agent-mvp/决策记录.md`（新增 B-7：B7 脚本沿用 `PROBE_*` 环境变量；UI 端点设置列为后续事项）、`B-运行层与提问工具.md`（B7 做法补环境变量与缺变量退出）、`B-开发指导.md`（小项行与第 7 步做法要点）、`HANDOFF.md`（第 1/4/6/7 节）。**未改任何 `src/` 文件、未改 `scripts/`、未改依赖文件。**
- 2026-10-16（架构图）：**新增** `docs/agent-mvp/02-架构图.md`（6 张 Mermaid 图，按 B-7 为止的决策绘制）；改 `docs/agent-mvp/README.md`（文件索引加一行）、`HANDOFF.md`（本节与第 7 节）。**未改任何 `src/` 文件、未改 `scripts/`、未改依赖文件。**
- 2026-10-17（架构图 SVG）：**新增** `docs/agent-mvp/diagrams/` 下 7 个 SVG（由 `02-架构图.md` 的 Mermaid 源导出）；改 `02-架构图.md`（加 SVG 链接与导出说明）、`HANDOFF.md`。mermaid-cli 装在系统临时目录，**未改 `package.json` / 锁文件 / `src/`**。
- 2026-10-17（B1 实现 + 验收）：**新增** `src/agent/modelAdapter.js`（`src/agent/` 目录首次创建）；改 `docs/agent-mvp/HANDOFF.md`、`docs/agent-mvp/决策记录.md`（新增 B-8）、`docs/agent-mvp/B-运行层与提问工具.md`（B6 判据补四条覆盖要求）。临时冒烟/诊断脚本（仓库根 `.b1-smoke.mjs`、`.b1-diag.mjs`）运行后**已删除**，未入库。**未改旧路径四件套（`ChatPage` / `AgentModel` / `useStreaming` / `StreamingParser`）、未改 `scripts/`、未改依赖文件。**
- 2026-10-17（B2 实施）：**新增** `src/agent/modes.js`、`src/agent/modePrompts.js`、`src/agent/skills/normal.md`、`src/agent/skills/socratic.md`、`src/agent/__tests__/modes.test.js`；改 `docs/agent-mvp/决策记录.md`（新增 B-9；按 B-3 回改 B-1 结论 3 的过时括号）、`docs/agent-mvp/HANDOFF.md`。临时验证脚本写在仓库根 `.b2-raw-probe/`（Node `?raw` 复现、Vite `transformRequest` 校验、eslint JSON、构建日志），**运行后整目录已删除**。`vite build` 重新生成 `dist/`（构建产物，非源码）。**未改 `src/agent/modelAdapter.js`、旧路径四件套、`scripts/`、`src/services/prompts.js`、依赖文件。**
- 2026-10-17（B2 验收 + B3 事实核对）：用户验收 B2（✅）；用 code-explorer 只读核对 B3 依赖的旧代码事实（`AgentModel` 构造/重试/不可取消、副模型配置来源、`ContentParser` 返回对象、五层提示词覆盖）。**只改 `docs/agent-mvp/HANDOFF.md`**；未改任何 `src/` 文件、未改依赖文件。
- 2026-10-17（B3 实施 + 协议同步）：**新增** `src/agent/services/generateAnswerOptions.js`、`src/agent/__tests__/generateAnswerOptions.test.js`；改 `docs/agent-mvp/01-核心协议.md`（§2.2 流程、§2.3 options 与失败语义、新增放宽理由段）、`docs/agent-mvp/B-运行层与提问工具.md`（B3 做法与判据）、`docs/agent-mvp/B-开发指导.md`（第 3 步）、`docs/AGENT_MVP_PLAN.md`（B3 行）、`docs/agent-mvp/02-架构图.md`（判定文案）、`docs/agent-mvp/D-页面与模式.md`（D4 判据补 `options.length`）、`docs/agent-mvp/决策记录.md`（新增 B-10）、`docs/agent-mvp/HANDOFF.md`。临时探针写在仓库根 `.b3-probe/`（失败 detail 与请求次数），**文件已删除、目录为空**；`vite build` 重新生成 `dist/`。**未改 `AgentModel` / `ContentParser` / `prompts.js` / `modelAdapter.js` / 旧路径四件套 / 依赖文件。**
- 2026-10-17（B4 实施 + 协议同步）：**新增** `src/agent/tools/askQuestion.js`、`src/agent/__tests__/askQuestion.test.js`；改 `docs/agent-mvp/01-核心协议.md`（§2.2 校验顺序改为去重优先、补 `internal_error` 与两段理由）、`docs/agent-mvp/决策记录.md`（新增 B-11；B-4 末句加"已被 B-10 取代"的指向）、`docs/agent-mvp/B-运行层与提问工具.md`（B4 做法与判据）、`docs/agent-mvp/B-开发指导.md`（第 4 步）、`docs/AGENT_MVP_PLAN.md`（B4 行）、`docs/agent-mvp/HANDOFF.md`。`vite build` 重新生成 `dist/`。**未改 B3 服务、`modelAdapter.js`、`modes.js`、旧路径四件套、依赖文件。**
- 2026-10-17（会话收尾：交接给 B5）：**只改 `docs/agent-mvp/HANDOFF.md`**（第 1/2/3/5/6/7 节）。未改任何 `src/`、`docs/` 其他文件、依赖文件。
- 2026-10-17（B5 开工说明 + 5 个决策拍板）：改 `docs/agent-mvp/决策记录.md`（新增 **B-12**）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/6/7 节）。**未写任何 `src/` 代码**（`src/agent/runTeachingAgent.js` 尚未创建），未改 `scripts/`、依赖文件、旧路径四件套。
- 2026-10-17（B5 实施）：**新增** `src/agent/runTeachingAgent.js`；改 `docs/agent-mvp/HANDOFF.md`。临时冒烟目录 `.b5-smoke/`（`smoke.mjs`、`lint.txt`、`build.txt`）运行后**整个目录已删除**；`vite build` 重新生成 `dist/`。**未改 B1–B4 的任何文件、旧路径四件套、`scripts/`、`package.json`、`pnpm-lock.yaml`**（`git status --short -- src/agent package.json pnpm-lock.yaml scripts` 只显示 `?? scripts/`、`?? src/agent/`）。
- 2026-10-17（B5 验收）：**只改 `docs/agent-mvp/HANDOFF.md`**（第 1/2/3/6/7 节）。用户验收 B5 转 ✅；未改任何 `src/`、`scripts/`、依赖文件。
- 2026-10-17（B6 验收）：**只改 `docs/agent-mvp/HANDOFF.md`**（第 1/2/3/6/7 节）。用户验收 B6 转 ✅；未改任何 `src/`、`scripts/`、依赖文件。
- 2026-10-17（B7 实施）：**新增** `scripts/run-socratic-once.mjs`；改 `docs/agent-mvp/决策记录.md`（新增 **B-14**）、`docs/agent-mvp/HANDOFF.md`。接线冒烟曾生成 `scripts/socratic-once.output.json` 与临时日志 `.b7-plumbing.txt`，**两者均已删除**。**未改任何 `src/` 文件、`package.json`、`pnpm-lock.yaml`**。
- 2026-10-17（B7 验收 + B 阶段收尾 + 起草 C 开发指导）：改 `docs/agent-mvp/决策记录.md`（新增 **B-15** 阶段结论）、`docs/agent-mvp/C-开发指导.md`（**新增**，待用户审阅）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/6/7 节）。`scripts/socratic-once.output.json` 是用户真实运行产出的证据，**保留**。**未改任何 `src/` 文件、`scripts/` 下的其他文件、依赖文件。**
- 2026-10-17（C-1 拍板 + C 开发指导审阅通过）：改 `docs/agent-mvp/决策记录.md`（新增 **C-1**）、`docs/agent-mvp/HANDOFF.md`（第 0/1/2/3/4/5/6/7 节）。**未改任何 `src/` 文件、依赖文件**；`C-开发指导.md` 未改动（用户按原稿通过）。
- 2026-10-17（B6 实施）：**新增** `src/agent/__tests__/runTeachingAgent.test.js`（10 条）；**改** `src/agent/modelAdapter.js`（可选 `model` 注入口，3 处）与 `src/agent/runTeachingAgent.js`（同名透传，3 处）；改 `docs/agent-mvp/决策记录.md`（新增 **B-13**）、`docs/agent-mvp/HANDOFF.md`。两处 `src/` 改动均经用户 2026-10-17 明确授权（决策 ① 与连带授权）。临时探针目录 `.b6-probe/`（`probe.mjs`、`case4.mjs`、`lint.txt`、`build.txt`）运行后**整个目录已删除**；`vite build` 重新生成 `dist/`。**未改 B2/B3/B4 文件、旧路径四件套、`scripts/`、`package.json`、`pnpm-lock.yaml`**。
- 2026-10-17（C4 验收 + C 阶段收尾 + 起草 D 开发指导）：**新增** `docs/agent-mvp/D-开发指导.md`；改 `docs/agent-mvp/决策记录.md`（新增 **C-3** 阶段结论）、`docs/agent-mvp/HANDOFF.md`（第 0/1/2/3/4/5/6/7 节）。**未改任何 `src/`、`scripts/`、依赖文件**。
- 2026-10-17（C4 实施 + 缺陷修复）：**新增** `scripts/session-loop.mjs`；**改** `src/utils/conversationState.js`（`handleToolCompleted` 的问题卡插入位置：完成顺序 → 按卡片/调用顺序，约 17 行注释 + 5 行逻辑）、`src/utils/__tests__/conversationState.test.js`（新增 1 条「问题卡顺序＝调用顺序」）与 `docs/agent-mvp/HANDOFF.md`。**未改** `useChatSession.js`、`src/agent/**`、`src/pages/**`、`src/components/**`、`App.jsx`、locales、依赖文件。
- 2026-10-17（C3 验收）：**只改 `docs/agent-mvp/HANDOFF.md`**（第 1/2/3/5/6/7 节）。用户验收 C3 转 ✅；未改任何 `src/`、`scripts/`、依赖文件。
- 2026-10-17（C3 实施）：**新增** `src/utils/__tests__/conversationState.test.js`（17 条）；改 `docs/agent-mvp/HANDOFF.md`。**未改任何生产代码**（`conversationState.js` / `useChatSession.js` 一行未动，测试暴露的三处问题全部在测试自身的构造方式上）。
- 2026-10-17（C2 验收）：**只改 `docs/agent-mvp/HANDOFF.md`**（第 1/2/3/5/6/7 节）。用户验收 C2 转 ✅；未改任何 `src/`、依赖文件。
- 2026-10-17（C2 补 hook 级证据 + 破例加依赖）：**新增** `src/utils/__tests__/useChatSession.test.js`（7 条）；**改** `package.json` / `pnpm-lock.yaml`（`pnpm add -D react-test-renderer@18.3.1`，用户 2026-10-17 明确授权）、`docs/agent-mvp/决策记录.md`（新增 **C-2**）、`docs/agent-mvp/HANDOFF.md`（第 1/2/3/4/5/6/7 节）。未改任何 `src/` 下的生产代码。
- 2026-10-17（C2 实施）：**新增** `src/hooks/useChatSession.js`（`src/hooks/` 下第一个会话层文件）；改 `docs/agent-mvp/HANDOFF.md`。临时探针目录 `.c2-probe/`（`probe.mjs`、`build.txt`）运行后**整个目录已删除**；`vite build` 重新生成 `dist/`（构建产物，非源码）。**未改 `src/agent/`、`src/utils/conversationState.js`、`src/pages/`、`src/components/`、`src/App.jsx`、`scripts/`、locales、`package.json`、`pnpm-lock.yaml`**。
- 2026-10-17（C1 验收）：**只改 `docs/agent-mvp/HANDOFF.md`**（第 1/2/3/5/6/7 节）。用户验收 C1 转 ✅；未改任何 `src/`、`scripts/`、依赖文件。
- 2026-10-17（C1 实施）：**新增** `src/utils/conversationState.js`（`src/utils/` 下第一个会话层文件）；改 `docs/agent-mvp/HANDOFF.md`。临时冒烟目录 `.c1-probe/`（`probe.mjs`、`recheck.mjs`）运行后**整个目录已删除**。本轮**未跑 `vite build`**（新模块尚未被页面引用，无构建风险；C 阶段收尾时统一跑）。**未改 `src/agent/`、`src/hooks/`、`src/pages/`、`src/components/`、`src/App.jsx`、`scripts/`、locales、`package.json`、`pnpm-lock.yaml`**（`git status --short -- src/agent src/hooks package.json pnpm-lock.yaml` 只有既有的 `?? src/agent/`）。

## 7. 会话日志

追加式，最新在下。每条 3–5 行即可。

```text
### 日期 · 阶段/任务
做了什么：
证据：（命令或文件）
没做完 / 卡在哪：
下一轮从哪开始：
```

### 2026-10-16 · 方案
做了什么：对照源码评估并修订方案；拆成 `docs/agent-mvp/` 工作包；写阶段 A 开发指导和本交接文件。
证据：`决策记录.md` P-1 ~ P-3；`vite build` / `eslint .` 基线。
没做完：A 阶段未开始，等待端点配置。
下一轮从哪开始：`A-开发指导.md` 第 1 步。

### 2026-10-16 · A / A1（中断）
做了什么：读 HANDOFF 与 A 阶段文件后开始 A1。核对 `pnpm-lock.yaml`：锁文件钉 `ai@6.0.177` / `@ai-sdk/openai@3.0.63` / `zod@4.4.3`。执行 `pnpm install --frozen-lockfile`。
证据：安装前 `node -p` 打印 `6.0.280 / 3.0.112 / 4.6.2`（与锁文件不符，确认漂移存在）；`git status --short` 显示 `package.json`、`pnpm-lock.yaml` 无改动（改动清单只有既有文档变更）。
没做完：安装未完成。第一次运行因 pnpm 交互式确认（node_modules 由 npm+pnpm 混装）直接退出；加 `--config.confirmModulesPurge=false` 重跑后报 `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`（`node_modules/.pnpm`，10078 项），被 IDE 安全删除守卫拦下，exit=1。当前 `node_modules` 半删：`.modules.yaml` 已删、`node_modules/@ai-sdk` 消失、`ai` 仍解析到 6.0.280；`vite build` / `eslint` 暂不可用。
下一轮从哪开始：用户在自带终端执行 `pnpm install --frozen-lockfile` 并按 Y 确认全量重装，然后在会话内继续核对三个版本号与类型声明 API。

### 2026-10-16 · A / A1（安装完成，待清理复跑）
做了什么：用户终端执行 `pnpm install --frozen-lockfile`（`+ @ai-sdk/openai 3.0.63`、`+ ai 6.0.177`，Done in 1m 6.6s）。随后在会话内核对 A1 三条判据。
证据：
- 版本：`node -p "require('ai/package.json').version"` → `6.0.177`；`@ai-sdk/openai` → `3.0.63`；`require.resolve('zod/package.json',{paths:[require.resolve('ai')]})` → `.pnpm/zod@4.4.3/...`；但根 `require('zod/package.json')` → `4.6.2`（残留）。
- 依赖文件：`git status --short -- package.json pnpm-lock.yaml` 无输出。
- 类型声明：`ai/dist/index.d.ts` 第 389 行 `maxOutputTokens?: number;`、第 444 行 `maxRetries?: number;`、第 1028 行 `declare function stepCountIs(stepCount: number): StopCondition<any>;`、第 1367/2754/3363 行 `stopWhen?: StopCondition<NoInfer<TOOLS>> | ...`；`ai/dist/test/index.d.ts` 命中 `MockLanguageModelV3` 2 次；`@ai-sdk/openai/dist/index.d.ts` 命中 `parallelToolCalls` 2 次；`tool` / `jsonSchema` 声明在 `.pnpm/@ai-sdk+provider-utils@4.0.27_zod@4.4.3/.../index.d.ts` 并由 `ai` 再导出（index.d.ts 第 8 行 export 列表）。
- 运行时抽查：`await import('ai')` → `tool: function`、`jsonSchema: function`、`stepCountIs: function`、`streamText: function`、`generateText: function`；`ai/test` → `MockLanguageModelV3: function`；`import.meta.resolve('ai')` → `.pnpm/ai@6.0.177_zod@4.4.3/...`。
没做完：`node_modules` 仍混有 npm 残留（`node_modules/zod` 为 2026-09-11 目录、4.6.2；顶层 457 个目录中 417 个非今日创建；另有 `.package-lock.json`），zod 版本判据因此未过；另 pnpm 提示 `Ignored build scripts: esbuild`，A2 前需观察 vite build 是否受影响。
下一轮从哪开始：用户在自带终端 `Remove-Item node_modules -Recurse -Force` + `pnpm install --frozen-lockfile`，然后会话内复跑三个版本号检查，A1 转 🔵 待验收。

### 2026-10-16 · A / A1（判据全过，转 🔵）+ A 阶段决策 1
做了什么：确认用户已清理重装，复跑 A1 三条判据；首跑 `npx eslint .` 取 lint 问题清单供决策 3 用；用户定了 A 阶段决策 1 的端点。
证据：
- 版本：`require('ai/package.json').version` → `6.0.177`；`@ai-sdk/openai` → `3.0.63`；`require.resolve('zod/package.json',{paths:[require.resolve('ai')]})` → `.pnpm/zod@4.4.3/node_modules/zod/package.json`；根 `node_modules/zod` 已不存在（`Test-Path` → False）；`.pnpm` 内 zod 只有 `zod@4.4.3`。
- 依赖文件：`git status --short -- package.json pnpm-lock.yaml` 无输出。
- 类型声明（清理后复跑命中数）：`ai/dist/index.d.ts` → `stopWhen` 8、`stepCountIs` 6、`maxOutputTokens` 8、`maxRetries` 28；`ai/dist/test/index.d.ts` → `MockLanguageModelV3` 2；`@ai-sdk/openai/dist/index.d.ts` → `parallelToolCalls` 2；`.pnpm/@ai-sdk+provider-utils@4.0.27_zod@4.4.3/.../index.d.ts` 存在（`tool` / `jsonSchema` 声明在此）。
- 残留：`node_modules` 顶层非今日目录 0 个；`node_modules/.package-lock.json` → False。
- lint 基线（清理后首跑）：9 个文件、15 错误、3 警告。按文件：`src/components/LanguageSwitcher/LanguageSwitcher.jsx`(1err)、`src/hooks/useAgentsConfig.js`(2warn)、`src/hooks/useChatHistory.js`(1err)、`src/hooks/useDeveloperMode.js`(2err)、`src/lib/agents.js`(1err)、`src/pages/ChatPage/ChatPage.jsx`(2err)、`src/pages/LandingPage/LandingPage.jsx`(5err)、`src/ui-review.jsx`(1err 1warn)、`src/utils/ConfigManager.js`(2err)。按规则：`no-unused-vars` x10、`react/no-unescaped-entities` x4、`react-hooks/exhaustive-deps` x2、`react-refresh/only-export-components` x1、`react/prop-types` x1。
- 决策 1（用户口述）：base URL `https://api.deepseek.com`、模型 `deepseek-flash`。
没做完：A1 等用户验收；决策 3 未定；`deepseek-flash` 这个模型 id 未证实存在，A3 需用 `GET /models` 复核；A2 未开始。
下一轮从哪开始：用户验收 A1 并定决策 3，然后执行 `npx vite build` + `npx eslint .` 存档 A2 基线。

### 2026-10-16 · A / 决策 1、决策 3 拍板 + 发现思考模式冲突
做了什么：用户确认端点配置与 lint 处理方式；抓取 DeepSeek 官方「思考模式」文档核对参数；把两条决策写入 `决策记录.md`（A-1、A-2），并在 HANDOFF 第 4 节登记新出现的决策 4。
证据：
- 决策 1（用户确认）：base URL `https://api.deepseek.com/v1`，模型 `deepseek-flash`（id 由用户确认）；思考模式可开关、强度可调：`thinking: {type: "enabled"|"disabled"}`、`reasoning_effort: "low"|"high"|"max"`（文档抓取自 <https://api-docs.deepseek.com/zh-cn/guides/thinking_mode>，2026-10-16）。
- 决策 3（用户确认）：lint 既有问题只记录不修 → `决策记录.md` A-2。
- 冲突证据：同一份文档写明「携带 `tools` 时历史轮次的 `reasoning_content` 必须回传，否则 400」，且思考模式下 `temperature`/`presence_penalty`/`frequency_penalty` 不生效、`top_p` 仅 0.95–1.0 生效。
没做完：A3 未开始（脚本未写）；决策 4（reasoning 回传 vs 不变量 3）需 A3 实测后定；A2 未开始；A1 等验收。
下一轮从哪开始：用户验收 A1 后，跑 `npx vite build` + `npx eslint .` 存档 A2 基线；A3 前需同意在第 4 节登记的对照用例。

### 2026-10-16 · A / 决策 A-3 拍板
做了什么：用户同意 A3 在 5 个用例之外追加 3 条 reasoning 对照用例，已写入 `决策记录.md` A-3，HANDOFF 第 3 节同步；并给出 A1 验收方式（可复现命令）。
证据：`决策记录.md` A-3（含改动范围＝只新建 `scripts/probe-tools.mjs`）。
没做完：A2 未开始（等用户验收 A1 并人工走查旧路径 6 项）；A3 脚本未写。
下一轮从哪开始：用户验收 A1 → 跑 `npx vite build` + `npx eslint .` 存档 A2 基线。

### 2026-10-16 · A / A1 验收复跑（用户要求 AI 执行）
做了什么：按 `A-基线与端点验证.md` A1 三条判据原样复跑一遍，输出原始结果。
证据：`ai 6.0.177`、`@ai-sdk/openai 3.0.63`、`zod` 经 `ai` 解析到 `.pnpm/zod@4.4.3`；`git status --short -- package.json pnpm-lock.yaml` 无输出；声明命中 `stopWhen 8`、`stepCountIs 6`、`maxOutputTokens 8`、`maxRetries 28`、`MockLanguageModelV3 2`、`parallelToolCalls 2`；顶层非今日目录 0、`.package-lock.json` 不存在、根目录无 `zod`；运行时抽查 `ai.tool / ai.jsonSchema / ai.stepCountIs / ai.streamText` 均为 function，`resolved ai` 指向 `.pnpm/ai@6.0.177_zod@4.4.3`。（`ai.stopWhen` 运行时为 undefined 属正常：它是 `streamText`/`generateText` 的参数名，不是导出函数。）
没做完：三条判据全部符合，等用户一句话确认后把 A1 改 ✅；A2 未开始。
下一轮从哪开始：用户确认 → A1 改 ✅ → 跑 `npx vite build` + `npx eslint .` 存档 A2 基线。

### 2026-10-16 · A / A2（命令类基线已完成，走查待用户）
做了什么：A1 经用户确认转 ✅；开始 A2，跑构建与 lint 取基线。
证据：
- `vite build`：ok，20385 ms；产物 `assets/index-IVw_truv.js` 2732.6 KB（超 500 KB 阈值）、`assets/index-CTwOs4Zq.css` 40.3 KB、`index.html` 0.7 KB。原始日志格式：`{ok:true, ms:20385, list:[...over500kb:true...]}`。
- `eslint .`：被检查文件 67 个，其中 9 个有问题 → 15 错误 / 3 警告（与清理依赖前的基线计数一致）。文件与规则分布见 2026-10-16 第三条日志。
- 对比旧基线：旧记录为"主包 2.9MB"，现为 2.73 MB——依赖从 6.0.280 对齐到 6.0.177 后体积变化，属预期。
- 工具限制：本会话的 shell 会把 `vite build` 判定为长驻进程并在 10 秒后截断输出（构建需约 20 秒），因此改为后台启动 + 落盘 JSON 再读取；`npx eslint . -f json` 一次调用内可完成。
没做完：旧路径 6 项行为的人工走查未做（需用户在浏览器操作）；"已存在问题清单"未成型；A2 原始输出尚无归档文件（决策 5 待定）。
下一轮从哪开始：用户完成 6 项走查并回填现象 → 形成已存在问题清单 → A2 转 🔵；随后进 A3 写 `scripts/probe-tools.mjs`。

### 2026-10-16 · A / A2（归档完成，转 🔵）
做了什么：确认走查结果（用户口述 6 项均正常）；按决策 A-4 新建 `docs/agent-mvp/A-基线存档.md` 归档 A2 证据；把决策 5 从 HANDOFF 第 4 节移入 `决策记录.md` 记为 A-4。
证据：
- 采集环境：分支 `refactor/agent-architecture`、commit `3445f35`、node v22.22.1 / pnpm 10.9.0 / vite 6.4.2 / eslint 9.39.4。
- `vite build` ok（20385 ms；`assets/index-IVw_truv.js` 2732.6 KB 超阈值、`assets/index-CTwOs4Zq.css` 40.3 KB、`index.html` 0.7 KB）；`eslint .` 67 个文件 → 9 个文件 15 错误 / 3 警告。
- 走查：6 项用户口述均正常；`A-基线存档.md` 第 3 节的「现象」一列留空待补（第 2/3/6 项最关键）。
- 归档文件：`docs/agent-mvp/A-基线存档.md`（新建）。
没做完：走查表「现象」列未补齐；A2 等用户验收；A3 脚本未写。
下一轮从哪开始：用户补齐第 2/3/6 项现象 → A2 转 ✅；然后写 `scripts/probe-tools.mjs`（5 个原用例 + A-3 的 3 条 reasoning 对照用例）。

### 2026-10-16 · A / A2 走查现象补齐
做了什么：用户实测回填旧路径 6 项行为的现象，写入 `A-基线存档.md` 第 3 节，并把它与 `A-基线与端点验证.md` 对旧代码的描述作了对照表。
证据（用户原话）：「3 张问题卡片、自动发起、重试了我指定的最后一条」。
- 第 2 项：一轮**同时出现 3 张问题卡**——文档描述为「可能同时出现两个问题卡」，实测值比文档更多，属文档描述与事实的偏差（尚未修改文档，待用户决定）。
- 第 3 项：作答后**自动发起下一轮**，与文档描述一致。
- 第 6 项：重试目标为**最后一条**，与「只允许重试最后一轮」的方向一致；重试后原内容是清掉还是追加未记录。
- 已存在问题清单新增一条：一轮 3 张问题卡，由 D4「单题问答卡」改为单题单卡，F4 验收时确认该行为消失。
没做完：A2 等用户验收；两项次要细节未记录（第 3 项答案卡形态、第 6 项原内容是否保留）；A3 脚本未写。
下一轮从哪开始：用户验收 A2 → 写 `scripts/probe-tools.mjs`（5 个原用例 + A-3 的 3 条 reasoning 对照用例），运行前在终端设 `PROBE_BASE_URL / PROBE_API_KEY / PROBE_MODEL`。

### 2026-10-16 · A / A3 复述（未写脚本）
做了什么：A2 经用户确认转 ✅。开始 A3，先复述理解与范围，等用户确认后写脚本。
复述与范围：
- 只新建 `scripts/probe-tools.mjs`；不碰 `src/`、不改依赖、不改 `package.json`。配置从 `PROBE_BASE_URL / PROBE_API_KEY / PROBE_MODEL` 读取，输出中密钥打码。
- 探针镜像产品侧 provider 用法：`createOpenAI({ baseURL, apiKey, compatibility: 'compatible' })` + `provider.chat(model)`（依据 `src/lib/AgentModel.js:122-130`、`:216`，只读参考，不改它）。
- 用例：① 单个工具调用（工具名与参数须是结构化对象）；② 工具结果回传后继续生成（`generateText` + `stopWhen: stepCountIs(2)`，打印 `steps.length` 作为"第二步确实发生"的证据）；③ 思考模型 + 工具 + 第二步的三条对照（a 不回传 `reasoning_content`、b 回传、c `thinking.type="disabled"`）；④ 开闸标记（U+200B）是否出现在 `result.text` / `response.messages`；⑤ `parallelToolCalls: false` 是否被接受。
- 统一用 `maxRetries: 0` 与每例超时，避免重试掩盖真实失败。
不确定点（待确认）：(1) DeepSeek 的 `thinking` 是非标准字段，AI SDK 的 openai provider 只认已知字段，预计需要脚本内的自定义 `fetch` 改写请求体；`reasoning_effort` 能否用 `providerOptions.openai.reasoningEffort` 直通需实测；(2) 第三条对照用例的"回传"需要一个最小版回填机制（记录原始 chunk 里的 reasoning，再在后续请求体的 assistant 消息上补写），这属于 B 阶段机制的探针版，只在脚本内实现；(3) 是否只对同轮多步生效、跨轮是否也必须回传，靠实测判定。
没做完：脚本未写（等用户确认）；A4 未开始。
下一轮从哪开始：用户确认后写 `scripts/probe-tools.mjs`，然后用户在终端设好三个环境变量并运行 `node scripts/probe-tools.mjs`。

### 2026-10-16 · A / A3 脚本落地 + HANDOFF 加开工清单
做了什么：用户确认「先改 HANDOFF 再加开工清单，然后本会话收尾 A」。实际做了两件：(1) `HANDOFF.md` 新增第 0 节「新会话开工清单」；(2) 新建 `scripts/probe-tools.mjs`（决策 A-3 的 10 个用例）。
证据：
- 脚本静态验证：`node --check scripts/probe-tools.mjs` → exit 0；无环境变量运行 → 打印「缺少环境变量…」并 exit 1（说明 `ai` / `@ai-sdk/openai` 导入与顶层 `tool()`/`jsonSchema()` 构造在锁定版本下均正常）；`npx eslint scripts/probe-tools.mjs` → exit 0、无输出。
- 类型确认（写脚本前的查证）：`tool` 用 `inputSchema`（`.pnpm/@ai-sdk+provider-utils@4.0.27_zod@4.4.3/.../index.d.ts:1089`）；`streamText`/`generateText` 签名有 `stopWhen`；`@ai-sdk/openai` 的 `openaiLanguageModelChatOptions` 提供 `parallelToolCalls` 与 `reasoningEffort`（取值 `none|minimal|low|medium|high|xhigh`）→ 因此 ⑤ 与 ⑦ 走 `providerOptions.openai`；DeepSeek 的 `thinking` 不在其列，只能由脚本内自定义 fetch 注入请求体。
- 反向发现：`compatibility: 'compatible'` 在 `@ai-sdk/openai@3.0.63` 中不存在（全包 d.ts 与运行时 JS 均无处理）→ 旧 `AgentModel` 传的是无效参数（已记入第 5 节）。
- 用例清单：① 单工具调用（thinking 关，1 步）；② 工具结果回传后继续生成（thinking 关，目标 2 步）；③a thinking 开＋不回传 reasoning；③b thinking 开＋回传 reasoning；③c thinking 开＋只走 1 步；④ U+200B 开闸标记检查；⑤ `parallelToolCalls:false`；⑥a / ⑥b 跨轮上下文（把上一轮 `response.messages` 放进下一轮）不回传 / 回传 reasoning；⑦ `reasoning_effort` low 与 max 直通。
- 输出设计：控制台打摘要 + 判读汇总，完整结果写 `scripts/probe-tools.output.json`（避免把长输出全贴进对话）。
没做完：脚本未在真实端点上运行（需要用户设环境变量并执行）；A4 未开始；决策 2、4 待 A3 结果。
下一轮从哪开始：用户运行 `node scripts/probe-tools.mjs`，把「判读汇总」与失败用例的 status/responseBody 贴回 → 进 A4 入档。

### 2026-10-16 · A / A3 首轮结果 + 脚本补测
做了什么：读 `scripts/probe-tools.output.json` 判读首轮 10 个用例；发现两处测法缺陷，改脚本补测（⑤b/⑤c、⑦ 改注入、新增 `原生assistant含reasoning` 观测）。
证据（首轮，`when=2026-10-16T11:32:27.289Z`，model `deepseek-flash`）：
- ① status 200，1 步，`get_weather`，参数类型 object，参数 `{location:"杭州",date:"2026-10-17"}` → 通过。
- ② 步数 2，step1 文本 + tool_calls，step2 文本「杭州 2026-10-17 天气多云，气温 7~13°C。」（29 字）→ 通过（B 阶段核心假设成立）。
- ③a（thinking 开、第二步不回传 reasoning）request2 status 200、`reasoningInjected=0` → **未触发文档所述的 400**。
- ③b（回传）request2 status 200、`reasoningInjected=1` → 回传被接受。
- ③c（thinking 开 + 1 步）status 200、1 次工具调用 → 单步不受任何限制。
- ④ `文本含零宽空格=false`、`协议消息含零宽空格=false`（探针未注入带标记的 system prompt，故结论为"端点自身不产生"）。
- ⑤ 请求体出现 `parallel_tool_calls:false`，status 200，工具调用数 1 → 选项被接受；但未证明真的串行。
- ⑥a/⑥b 跨轮（request3 roles=`assistant,tool,assistant,user`）均 status 200 → 不回传也能过。
- ⑦ `reasoning_effort=low` status 200、响应 reasoning 312 字；随后抛 `AI_InvalidArgumentError: invalid openai provider options` —— 原因是 openai provider 允许值为 `none|minimal|low|medium|high|xhigh`，**不含 `max`**，与端点无关。
没做完：补测未跑；A4 未开始。
下一轮从哪开始：用户重跑 `node scripts/probe-tools.mjs`（环境变量沿用），贴回新的「判读汇总」→ 写 A4。

### 2026-10-16 · A / A3 补测通过 + A4 入档完成
做了什么：用户重跑探针，12 个用例全部成功；读补测数据后把 A1–A3 结论按模板写入 `决策记录.md`（A-5、A-6），并在 `A-基线存档.md` 加了证据索引。
证据（`scripts/probe-tools.output.json`，`when=2026-10-16T11:35:12Z`）：
- ③a 第二次请求 `status=200`、`原生assistant含reasoning=0`、`回填reasoning=0` → 「不回传也能跑通」成立，且 reasoning 确实未进入上下文（排除"SDK 偷偷回传"的假象）。
- ⑤b / ⑤c 第二次请求均为 `roles=user,assistant,tool,tool` → 传 `parallelToolCalls:false` 与不传的结果一样，**一次提问仍返回两个工具调用** → 该选项被接受但不生效，应用层去重是唯一防线。
- ⑦ `reasoning_effort=low`（providerOptions）与 `reasoning_effort=max`（请求体注入）均 200，raw 响应 reasoning 314 → 501 字符 → 端点接受 `max`；`max` 传不出去的原因在 AI SDK 的允许值列表，不在端点。
- ⑨ 之外的 ③b/③c/⑥a/⑥b 均成功；④ 仍未见 U+200B。
没做完：A3、A4 等用户验收；A 阶段尚未收尾（验收后即可进入 B）。
下一轮从哪开始：用户验收 A3 + A4 → **开新会话**从 B1–B3 开始（先读 `01-核心协议.md` 与 `B-运行层与提问工具.md`，复述 + 标决策点，不写代码）。

### 2026-10-16 · A 阶段收尾（阶段切换）
做了什么：用户验收 A3 + A4，两条转 ✅；按规则 2.4 写阶段收尾结论，并把本文件切到 B 阶段。
证据：
- `决策记录.md` 新增 **A-7 阶段 A 收尾结论**（问题 / 选项 / 结论 / 原因 / 放弃的方案 / 验证证据 / 遗留风险）。
- A 阶段累计结果：依赖 `ai 6.0.177`、`@ai-sdk/openai 3.0.63`、`zod 4.4.3`；`vite build` ok（20385 ms，主包 2732.6 KB）；`eslint .` 15 错误 / 3 警告（既有）；旧路径走查 6 项正常但一轮出现 3 张问题卡；端点 12 个探针用例全成功。
- 边界核对：A 阶段新增的代码文件只有 `scripts/probe-tools.mjs`，`src/` 下**一个文件都没改**，依赖文件无改动，保底版本（旧 `ChatPage`）仍可用。
没做完：B 阶段未开始；`B-开发指导.md` 尚未起草（规则 2.3 要求开工前先有）。
下一轮从哪开始：用户开新会话做 B 阶段——第一件事是起草/审阅 `B-开发指导.md`，然后按 B1–B3 逐个任务走「复述 → 列范围 → 标决策点 → 等拍板 → 实施」。

### 2026-10-16 · B / 开工准备：起草 `B-开发指导.md`
做了什么：读 `HANDOFF.md`（第 0–3 节）、`01-核心协议.md`（全文）、`B-运行层与提问工具.md`、`决策记录.md` A-1~A-7 与 `A-开发指导.md`（格式模板），按规则 2.3 起草 `B-开发指导.md`，未写任何代码。为核对文件路径与 API，只读了 `src/utils/ContentParser.js`（全文）并检索 `AgentModel` 的 `typewriterDelay`、`ConfigManager.isModelConfigured` 位置；确认 `src/agent/` 目录尚不存在。
证据：新增文件 `docs/agent-mvp/B-开发指导.md`（含目标、开工前准备＝四个待定决策项 + A 阶段四条结论 + 环境基线、B1–B7 七步各自的「做法要点 / 你检查」与命令、通过标准、本阶段不要做）。
对照结论：`ContentParser` 是 `new ContentParser(tags)` 形式的通用 `〖tag〗` 解析器（B3 用它解析五档）；`AgentModel` 的打字机开关是 `settings.typewriterDelay`（B3 需设 `false`）。
没做完：`B-开发指导.md` 待用户审阅；四个决策项待拍板；B1 未开始，`src/` 仍未动。
下一轮从哪开始：用户审阅开发指导并拍板决策 1/2/3（+ B7 配置读取方式），AI 追加 `决策记录.md` 后开始 B1。

### 2026-10-16 · B / 决策 1 讨论（第一轮，未拍板）
做了什么：用户要求先逐点讨论决策、暂不写代码。读 `src/services/prompts.js`（另用 i18next 时的默认模板与 `TEST_MODE`）、`src/utils/ConfigManager.js:98-137`、`src/lib/agents.js`、`src/locales/zh/translation.json` 的 `SystemPrompts.learningMode`，核对旧路径的主提示词来源与内容分节，就「决策 1：两份教学指令各写什么」向用户给出事实、选项与倾向。
证据：旧路径主提示词链路＝`localStorage.mainAgentPrompt` → i18n `SystemPrompts.learningMode` → `prompts.js` 内默认模板；模板分三节（角色定位与目标 / 对话流程 / 输出格式与注意事项），第 3 节全部是 `〖response〗`/`〖question〗` 标签规则 + 单问号 + 不嵌套 + 公式代码包裹规则；旧路径无「模式」概念（`ChatPage` 只用一个可编辑提示词）。
新发现（待用户同意后修正文档）：`B-运行层与提问工具.md` 决策 1 称 `SYSTEM_PROMPTS.TEST_MODE` 「那个键在代码里根本不存在」，实际该键存在于 `prompts.js:179`，仅被 `ConfigManager.getMainPrompt()` 的 catch 分支与 `AgentConfigPanel.jsx:87` 引用；已登记到第 4 节。
没做完：决策 1 未拍板；决策 2/3 与 B7 小项未讨论；未写任何代码，`src/` 未动。
下一轮从哪开始：继续讨论决策 1 的三条子问题（normal 是否允许文字提问、socratic 保留哪些教学要求、新增两条约束的措辞），拍板后 AI 追加 `决策记录.md` 的 B-1。

### 2026-10-16 · B / 决策 1 讨论（第二轮：教学要求谈定 + 旧链路口述核对）
做了什么：用 code-explorer 核对旧路径「提取问题 → 调副模型 → 五档解析 → UI 渲染 → 作答提交」的完整链路（只读），并把该链路与新协议的对应设计逐段讲给用户；用户就决策 1 的教学要求部分给出结论。
用户已定（决策 1 内的教学要求部分）：
- 保留「先确认前置知识」的摸底、分层教学、动态判断学生水平；但**开场仍按初学者对待**，之后按回答调整。
- 同意删除全部 `〖…〗` 格式规则与单问号原则；「用 1–3 个问题检验理解」改为不写数量（次数约束交给协议层）。
- 同意「提问改用 `ask_question`」；并指出 system prompt 里不再需要输出格式要求（待定：那句"必须走工具"放提示词还是工具 description）。
新结果：用户倾向**取消 `normal`（常规问答）模式**，理由是其唯一目的是"普通 chatbot 体验"，模型改为主动触发提问后无必要。已登记影响（总纲验收项、F3 降级出口、D2 模式控件、D5 门槛）。
旧链路事实（本轮核对，供 D/E 阶段引用）：
- 提取：`StreamingParser` 状态机按 `〖/question〗` 闭合触发 `questionComplete` → `useStreaming`（`src/hooks/useStreaming.js:46-58`）→ `ChatPage.onQuestionFound`（`src/pages/ChatPage/ChatPage.jsx:104-115`）；**一轮内每个问题各触发一次，无"只取第一个"**（`src/utils/StreamingParser.js:184,211,240`）——与 A-5 的"一轮 3 张卡"互为印证。
- 副模型输入：`[{role:'assistant', content: mainAiContextRef.current（整段主正文）}, {role:'user', content: question}]`（`ChatPage.jsx:107-114`、`:279`），system prompt = `optionPrompt`（含"同语言回答"指令，语言不是显式参数，`src/services/prompts.js:146-173`）。
- 五档解析：`ContentParser(['none','heard','basic','familiar','expert'])`，**返回值是数组**；解析失败＝空数组 → `AnswerCard` 跳过空档位行，只留自定义输入（静默降级）（`src/hooks/useQuestionFlow.js:90-92,124-135`、`src/components/AnswerCard/AnswerCard.jsx:140,283-284`）。
- 作答：`chooseLevel` 更新问题状态 + `appendUiOnlyMessage`（只进 `uiMessages`）；本轮全部答完由 effect 拼摘要模板作为**新 user 消息**进 `messages`（`ChatPage.jsx:354-386`、`useQuestionFlow.js:153-155`）→ 即 messages / uiMessages 分叉的来源。
- 问题状态只在 `useQuestionFlow` 的 `useReducer` 内存里，刷新即丢（`useQuestionFlow.js:5,89`；`chat_histories` 只存 messages / uiMessages）。
没做完：决策 1 剩两条未定（normal 存废、约束归属）；决策 2/3 与 B7 小项未讨论；`B-运行层与提问工具.md` 那处 TEST_MODE 描述仍待你同意修正；未写任何代码，`src/` 未动。
下一轮从哪开始：用户就「normal 存废」与「约束归属」表态，AI 追加 `决策记录.md` 的 B-1（含裁剪项标记），随后进入点 2（决策 3 副模型配置）。

### 2026-10-16 · B / 决策 1 拍板（B-1 入档）+ TEST_MODE 查证
做了什么：用户拍板决策 1 的遗留项，结论文档写入 `决策记录.md` 的 **B-1**；按用户要求把 `SYSTEM_PROMPTS.TEST_MODE` 查清（存在性与引用点）；回答了「一轮多个问题为什么只取第一个」的设计理由。未写任何代码。
用户决定：① 取消**用户可见的模式控件**（代码层保留 tools 为空的无工具兜底模式）；② 「必须走工具」的归属取方案 a（提示词只留一句工具存在性说明，参数规则放 `jsonSchema` / 工具 description）；③ 本期不考虑语言与双语切换。
TEST_MODE 查证结果（本轮事实，供文档修正与 D 阶段参考）：
- 定义：`src/services/prompts.js:179-186`，内容是一段 `@输出格式要求` 清单（`〖response〗` / `〖question〗` 包裹、标签闭合不嵌套）。
- 引用点只有两处：`src/components/AgentConfigPanel/AgentConfigPanel.jsx:84-88`（设置面板「选择模式」下拉里的**「随意闲聊」预设**，中文名 `AgentConfigPanel.testMode`；选中即 `handleModeSelect` → `onPromptChange` 把这段格式要求写成主提示词）与 `src/utils/ConfigManager.js:113`（`getMainPrompt()` 的 catch 分支，正常路径走不到）。
- 因此旧路径**不存在"常规模式"**：`TEST_MODE` 是旧设置面板的一个预设提示词，且其正文要求模型输出 `〖question〗`，选「随意闲聊」反而更容易触发问题卡。
- 附带：`AgentConfigPanel.jsx:101-112` 的 `findModeByPrompt` 用**提示词全文比对**反推模式，用户改一次提示词下拉就失准——与禁用清单「模式靠比对提示词推断」一条互为印证。
入档：`决策记录.md` B-1（含结论 6 条、原因、放弃方案、遗留风险 3 条）；`HANDOFF.md` 第 2 节 D2 → ✂️、第 4 节移除已拍板行、第 5 节新增总纲与 F/D 文档的同步待办。
没做完：`B-运行层与提问工具.md` 那处 `TEST_MODE` 描述仍待用户同意后修正（第 4 节保留该行）；决策 2 / 决策 3 / B7 小项未讨论；`B-开发指导.md` 的决策 1 行文待回填；`src/` 仍未动。
下一轮从哪开始：用户对「文档修正」表态并进入点 2（决策 3：副模型复用主模型还是单独配置）。

### 2026-10-16 · B / 文档修正落地 + 多问题诉求登记
做了什么：按用户答复「改」修正 `B-运行层与提问工具.md` 决策 1 中与源码不符的一句，并追加 `决策记录.md` **B-2** 记录该修正；把 `B-开发指导.md` 的决策 1 行按 B-1 回填。用户同时提出**新诉求：一轮允许有多个问题**（探针式多问探测，一次只问一个太慢），本轮只登记影响面，未做任何设计改动、未改协议、未写代码。
证据：
- `B-运行层与提问工具.md` 决策 1 的 normal 条目已改写为「旧路径不存在常规模式，只有一个可编辑主提示词；`TEST_MODE` 正文即标签格式要求」并指向 B-1。
- `决策记录.md` B-2 含验证证据链：`src/services/prompts.js:179-186`、`src/components/AgentConfigPanel/AgentConfigPanel.jsx:84-88,101-112`、`src/utils/ConfigManager.js:109-115`。
- 多问题诉求的连带范围已登记在 `HANDOFF.md` 第 4 节（协议 §2/§5/§6/§7、B4/B5/B6 判据、D4、F4、`A-基线存档.md` 的问题条目、总纲禁用清单、规则文件关键参数）。
关键冲突（已向用户指出）：旧路径一轮出现 3 张问题卡目前被记为**缺陷**（`A-基线存档.md` 已存在问题清单），F4 的验收项也写着要让它消失；若一轮允许多问，这条要撤销并把验收项改为「卡片数与问题数一致、无重复卡」。
没做完：多问题的 5 个细节未定（每轮上限、副模型并发与超时、是否答完才进下一轮、`duplicate_question` 语义、UI 呈现）；决策 2 / 决策 3 / B7 小项未讨论；`01-核心协议.md` 未改；`src/` 未动。
下一轮从哪开始：AI 讲清多问题的 5 个细节与各自影响，用户逐条拍板 → 先改 `01-核心协议.md`，再改 B 阶段判据与相关文档，然后回到点 2（决策 3）。

### 2026-10-16 · B / 多问题协议拍板（B-3）与协议同步第一期
做了什么：用户逐条拍板多问题的 5 个细节（软引导不设硬上限 / 副模型并发 4 / 答完或显式跳过后进下一轮 / `duplicate_question` 收窄为文本去重 / UI 一次列出全部问题卡），并同意修改项目规则文件。按"先改协议、再改代码"的顺序完成**协议与规则文件**的第一期同步；未写任何代码。
证据（本轮改动）：
- `决策记录.md`：新增 **B-3**（5 个选项、7 条结论、原因、放弃方案、验证证据、4 条遗留风险）。
- `01-核心协议.md`：§2.2 校验顺序改为「字段非法 → 文本重复」，新增三段说明（一轮允许多个问题、副模型并发上限 4 与失败隔离、每个调用都要配对结果）；§2.3 新增"一轮里可以有多个问题"（问题顺序＝调用顺序）；§3 新增"多个问题时怎么算就绪"（任一 `await_user` 即满足）；§5 `question` → `questions[]`（含 `toolCallId / state: pending|answered|skipped`）；§6 答案模板改为多条连续排列 + 显式"跳过"记录，并新增理由段。
- `.codebuddy/rules/agent-mvp/RULE.mdc` §6：校验项「本轮是否已有问题」→「本轮是否已问过相同文本」；禁用式条款「多调用只取第一个」→「一轮允许多个问题：每个调用都执行、都返回配对结果，一个都不丢弃」；预算「2 次提问尝试、1 个有效问题」→「副模型并发上限 4（超出排队、失败隔离）」。
没做完（第二期同步，均未改）：`B-运行层与提问工具.md` 的 B4/B5/B6 判据、`B-开发指导.md` 第 4/5/6 步的「你检查」表、`D-页面与模式.md` 的 D4（单题卡 → 问题卡组）、`F-取消重试与验收.md` 的 F4「一轮 3 张卡消失」验收项、`A-基线存档.md` 中把"一轮 3 张卡"列为问题的条目、`docs/AGENT_MVP_PLAN.md` 的禁用清单与验收清单。另：决策 2 / 决策 3 / B7 小项未讨论，`src/` 未动。
下一轮从哪开始：先做第二期文档同步（从 `A-基线存档.md` 撤销问题条目、`B-运行层与提问工具.md` 判据改写开始），或按用户意愿直接进入点 2（决策 3 副模型配置）。

### 2026-10-16 · B / 第二期文档同步完成
做了什么：用户选「先同步文档」（答复「1」）。把 B-1 / B-3 的结论同步到全部相关文档（总纲、B 阶段文件与开发指导、D、F、A 基线存档），未写任何代码。
证据（逐处）：
- `docs/AGENT_MVP_PLAN.md`：现状表 ChatLayout 行（改为「保留一轮多问题」）、现状表 `SYSTEM_PROMPTS.TEST_MODE` 表述、§4.1 输入/execute 流程/预算（全部执行、并发 4、文本去重、任一 `await_user` 即停）、§4.3 turn 结构 `questions[]`、B2/B4/B5/B6 任务表行、D2 行标 ✂️、D4 行改问题卡组（含跳过）、D5 行、F3 行、第 6 节验收清单相关条目。
- `B-运行层与提问工具.md`：B4 判据（文本重复）、B5 预算与「多个调用全部执行」、B6 用例（「一轮多个问题」）。
- `B-开发指导.md`：B4 检查表、B5 预算与多调用要点、B5 检查表、B6 用例表（决策 1 行已在上一轮回填）。
- `D-页面与模式.md`：D4 标题/做法/与现状的关系/跳过理由/判据；D5 措辞与判据。
- `F-取消重试与验收.md`：2.2 说明与 F3 文案行（「降级到无工具兜底模式」）。
- `A-基线存档.md`：已存在问题清单里「一轮提问出现 3 张问题卡」条目撤销，注明依据 B-3。
没做完：总纲第 6 节验收清单仅改了两条，其余条目未逐条复核（建议 F4 时统一过一遍）；决策 2 / 决策 3 / B7 小项仍未讨论；`B-开发指导.md` 待用户整体审阅；`src/` 未动。
下一轮从哪开始：进入点 2 —— 决策 3（副模型复用主模型配置还是单独配置）。

### 2026-10-16 · B / 决策 3 拍板（B-4）
做了什么：用户决定副模型**单独配置**；把结论与后果写入 `决策记录.md` **B-4**，并在 `B-运行层与提问工具.md` 决策 3 处加指向、在 `B-开发指导.md` 的决策 3 行回填。未写代码。
证据：`决策记录.md` B-4（结论／原因／放弃方案／3 条后果／遗留风险 3 条）。代码依据：`src/utils/ConfigManager.js:98-106`、`src/lib/agents.js:43-56`、`src/pages/ChatPage/ChatPage.jsx:460-462`。
新登记的待确认项（HANDOFF 第 4 节）：① 无工具兜底模式的触发条件收窄为**仅「端点不支持工具」**（缺副模型不降级模式，仍在 `socratic` 下手动作答）；② `optionsStatus: 'unavailable'` 的 `errorCode` 需区分 `option_model_not_configured` 与 `option_model_failed`。
没做完：上述两项待用户确认；决策 2（`ask_question` 参数上限）与 B7 小项未讨论；`B-开发指导.md` 待整体审阅；`src/` 未动。
下一轮从哪开始：确认上述两项后讨论决策 2，然后起草 B1（`modelAdapter`）的复述与范围。

### 2026-10-16 · B / 澄清轮（指代不明）
做了什么：用户回复「这个不用了。跳过」，指代不明（可能指「决策 2 的讨论」，也可能指「第三节两个小调整」）。未做任何改动，已用选项向用户确认跳过的范围。
证据：本轮无文件改动（仅本行日志）。
没做完：跳过的范围待用户点选；决策 2 与两项小调整的最终状态未定。
下一轮从哪开始：按用户点选的范围处理（若跳过决策 2 → 参数按 `question ≤ 500` / `context ≤ 2000` 定案并记一条；若跳过两项小调整 → 从 HANDOFF 第 4 节移除该行并注明不做）。

### 2026-10-16 · B / 决策 2 定案 + 两项小调整落地（B-5、B-6）
做了什么：用户点选「跳过决策 2 的讨论」，即参数按默认值定案，并同意两项小调整（兜底模式触发条件、错误码区分）按 AI 建议照做。写入 `决策记录.md` **B-5**、**B-6**，并同步协议与各阶段判据。未写代码。
证据：`01-核心协议.md` §2.2 新增"未配置副模型"分支（不发起调用）、§2.3 errorCode 两值注释；`B-运行层与提问工具.md` B3 判据（4 条）、决策 2/3 指向已拍板；`B-开发指导.md` 决策 2/3 行、B3 检查表（4 行）；`D-页面与模式.md` D5 做法与判据（缺副模型不切换模式）；`docs/AGENT_MVP_PLAN.md` D5 行；`HANDOFF.md` 第 4 节精简为仅剩 B7 小项。
没做完：B7 脚本的配置读取方式（`PROBE_*` 还是 `AGENT_*`）仍未定；`B-开发指导.md` 待用户整体审阅；`src/` 未动。
下一轮从哪开始：起草 B1（`modelAdapter`）的复述与范围（碰哪些文件、不碰哪些、逐条判据与自检方式），等用户确认后再动代码。

### 2026-10-16 · B / 决策 4 定案（B-7）+ B 阶段决策点清空
做了什么：用户决定 B7 脚本暂时沿用 A3 探针的环境变量读取端点配置，端点配置的图形化设置留到后续在 UI 里做。写入 `决策记录.md` **B-7**，并同步 B 文件 B7 做法与开发指导（小项行、第 7 步做法要点）。未写代码。
证据：`决策记录.md` B-7（结论 + 3 条遗留风险）；`B-运行层与提问工具.md` B7 做法（`PROBE_BASE_URL` / `PROBE_API_KEY` / `PROBE_MODEL`，缺变量需明确退出）；`B-开发指导.md` 小项行与第 7 步。
状态：B 阶段「需要你拍板的决策」已清空（B-1~B-7 全部入档），只剩 `HANDOFF.md` 第 4 节两条方案层待确认项（等待作答时禁用模式切换、只允许重试最后一轮），都不阻塞 B。
没做完：`B-开发指导.md` 待用户整体审阅；B1 未开始；`src/` 未动。
下一轮从哪开始：起草 B1（`src/agent/modelAdapter.js`）的复述与范围，等用户确认后写第一行代码。

### 2026-10-16 · B / 术语澄清轮
做了什么：用户问「什么叫起草 B1」。已说明：规则里的"起草"专指按 2.3 起草阶段开发指导；对任务编号应叫规则 2.2 的「开工说明」（复述 → 列范围 → 标决策点，三步都不写代码），此前 AI 用词不严谨。本轮无文件改动（仅本行日志）。
证据：`.codebuddy/rules/agent-mvp/RULE.mdc` 2.2 / 2.3。
没做完：B1 的开工说明尚未给出；`src/` 未动。
下一轮从哪开始：给出 B1 的开工说明（复述 / 范围 / 决策点），等用户确认后写第一行代码。

### 2026-10-16 · B / B1 开工说明（未写代码）
做了什么：为 B1 给出开工说明（复述 / 范围 / 决策点）。写说明前只读核对了两处实现细节：`src/lib/AgentModel.js` 的 `createStreamGateFetch`（`AgentModel.js:27-56`：包装 fetch，仅在 `text/event-stream` 响应最前面补一条 `delta.content=U+200B` 的 SSE 事件）与 `ai@6.0.177` 的 `TextStreamPart` 类型（`ai/dist/index.d.ts:2522-2580`：`text-start/text-delta/text-end` 与 `reasoning-delta` 均带 `id`，`tool-call`/`tool-result` 带 `toolCallId/toolName/input/output`）。
关键结论（写进了开工说明）：`partId` 直接用 SDK 给的 `part.id`（同一文本块共享），不必自造；reasoning 需要 `includeRawChunks: true` + 读 `raw` part 的 `delta.reasoning_content`（`AgentModel.js:243-250` 同法）；运行层不能读 `window`，baseURL 归一化只能做"去掉 `/chat/completions` 后缀"，相对路径补全交由上层。
提出的两个决策点（待用户拍板）：① B1 的验证方式（静态检查 + 断言留 B6，还是 B1 就写 `modelAdapter` 单测）；② `run-started` / `run-finished` 由适配器还是 B5 发出（AI 倾向 B5）。
没做完：B1 未实施；两个决策点未拍板；`src/` 未动（`src/agent/` 目录仍不存在）。
下一轮从哪开始：用户对两个决策点表态 → 写 `src/agent/modelAdapter.js`（一次只做 B1）。

### 2026-10-17 · B / B1 职责的第一性讨论（未动文件）
做了什么：用户要求「从第一性原理讨论 B1 这一层的任务」。回答从三个前提推导出 B1 的四条职责（装载 / 翻译 / 净化 / 收敛）与五条边界（不决定下一步、不重试、不持久化、不降级、不拼装协议消息），并解释契约形状（`runId` / `partId` / `toolCallId` / 两处清理 / 结束原因 / `maxRetries: 0`）与四条判据各自在验证什么。未改任何文件（仅本行日志），未写代码。
证据：`01-核心协议.md` §4、`决策记录.md` A-5 / A-6、`B-运行层与提问工具.md` B1 与 2.1。
没做完：B1 的两个决策点（验证方式、`run-started`/`run-finished` 归属）仍待拍板；`src/` 未动。
下一轮从哪开始：用户就"B1 是事实边界而非业务层"达成一致后，对两个决策点表态，再写 `src/agent/modelAdapter.js`。

### 2026-10-17 · B / 分层关系讨论（未动文件）
做了什么：用户要求先讨论「这一层在整体架构中的作用 / 各层相互关系」。回答给出：按"时间尺度 + 唯一所有权"划分的五层（运行层 / 会话层 / 展示层 / 存储层 / 配置层）、ASCII 拓扑图、每层的输入输出与禁止项、三条铁律（单向依赖 / 单写者 / 单形态）、四条数据流（向下配置与信号、向上事件与结果、横向下沉存储、旧路径并行）、失败与取消的穿透路径，并用旧代码三处越界对应的三个症状作反证。
由讨论引出一个新的边界问题（**待用户拍板**）：`stopWhen` 由谁持有——若适配器接受 `stopWhen`，则它跑的是"一次 run（可能多步）"；若只跑一步、由 B5 循环，则 `responseMessages` 需要手工合并，与「真相只有 SDK 一份」冲突。AI 倾向前者，且与「`run-started`/`run-finished` 由 B5 发」一致。
没做完：`stopWhen` 归属与 B1 两个决策点未拍板；`src/` 未动。
下一轮从哪开始：用户就 `stopWhen` 归属表态 → 一并确认 B1 决策点 → 写 `src/agent/modelAdapter.js`。

### 2026-10-17 · B / 讨论节奏重置
做了什么：用户反馈"信息爆炸"，要求一次只讨论一个点。已撤回上一轮自造的「三条铁律 / 四条数据流 / 四个谁决定」框架，改用最小单元重讲（一次发送＝三件事：组装请求 → 模型吐字节流 → 程序翻译给界面；B1 是第③步的翻译），用户确认理解。同轮用一句话澄清两处误读：**「并行」＝新旧路径在代码里并存、由 `App.jsx` 开关选一个渲染，不是运行时两套同跑**；**`stopWhen` 是 `streamText` 的参数，SDK 每步结束后调用它，返回 true 则停**。
后续约定（本轮确认）：一次只讲一个概念、不超过一屏；术语首次出现必须给一句人话解释；不引入自造分类。
没做完：B1 尚未开始；`stopWhen` 归属（X/Y）待拍板；`src/` 未动。
下一轮从哪开始：把 B1 要做的事拆成 4 条人话讲完，只问 `stopWhen` 归属这一个问题。

### 2026-10-16 · 架构图
做了什么：按 `01-核心协议.md` 与决策 B-1~B-7 绘制 `02-架构图.md`（全局分层与数据流、一轮时序含多问题并发、运行层内部、turn/question 状态机、三种投影、新旧对照）。
证据：`docs/agent-mvp/02-架构图.md`；Mermaid 语法用 mermaid@11 解析器校验（临时目录，不入仓库）。
没做完 / 卡在哪：无；当前任务仍为 B1（未开始），本轮不影响进度。
下一轮从哪开始：同第 3 节——起草 B1（`modelAdapter`）的复述与范围。

### 2026-10-17 · B / B1 实现完成（🔵 待验收）
做了什么：按用户拍板的 **Y**（适配器接受 `stopWhen`、一次执行可能多步；`run-started`/`run-finished` 由 B5 发）新建 `src/agent/modelAdapter.js`。四场景离线冒烟验证后删除临时脚本。
证据：
- `node --check src/agent/modelAdapter.js` → exit 0；`npx eslint src/agent/` → 无输出。
- 冒烟（假 fetch，不联网；`endpoint: example.invalid`、`apiKey: 'x'`）：① 正常：请求 **1 次**、`endedBy=finished`、`finishReason=stop`、两个 delta 共用 `partId="0"`、消息文本 `你好，世界`、**无 U+200B**；② 取消：首个事件后 abort → **事件总数 1**、`endedBy=cancelled`；③ 超时：流只发一个 chunk 不结束、`timeoutMs=60` → `endedBy=timeout`；④ 工具多步：请求 2 次、**2 步**、事件 `tool-started:call_1` → `tool-completed:call_1` → `text-delta`、消息 **3 条（assistant/tool/assistant）不重复**、无 U+200B。
- 过程中修掉两个真实缺陷：**(a)** 流卡住时 abort 只置标志、pending 的 `read()` 不返回 → 改为"中断承诺"与每次 `read()` 赛跑，超时/取消才真正生效（修改前实测为挂死，输出 `endedBy=HANG`）；**(b)** `steps[i].response.messages` 在本版本是**累积**的，逐 step 拼接会把第一步重复两次 → 改为取最后一次 `result.response.messages`（实测 3 条）。
没做完：单测未写（决策点①待定）；`maxOutputTokens` 默认不传；B1 待用户验收。
下一轮从哪开始：用户验收 B1 → 按决策点①决定是否补单测 → 进入 B2。

### 2026-10-17 · B / B1 验收通过（✅）+ 决定不建单测
做了什么：用户验收 B1（✅）。用户决定**不落单测文件**，写入 `决策记录.md` **B-8**；把「B6 必须覆盖 B1 的四场景」写进 `B-运行层与提问工具.md` 的 B6 判据，避免证据随临时脚本一起消失。
证据：`决策记录.md` B-8（结论 / 原因 / 遗留风险）；`B-运行层与提问工具.md` B6「额外必须覆盖」四条（`partId` 稳定、两处清理含空块丢弃、取消后事件不增长、请求次数=步数）。
没做完：B2 未开始；`B-开发指导.md` 仍待用户整体审阅；`raw`（`delta.reasoning_content`）路径未覆盖，B6/B7 必须补。
下一轮从哪开始：进入 B2（`modes.js` + `skills/normal.md`、`skills/socratic.md`），先给开工说明（复述 / 范围 / 决策点），不写代码。

### 2026-10-17 · B / B2 开工说明 → 拍板 → 实施（🔵 待验收）
做了什么：先给 B2 的开工说明（复述 / 范围 / 5 个决策点 + 3 处文档内部不一致），未写代码；用户就「决策点 1 为什么要切分文件」要求第一性解释，解释后用户选 A；其余四项当场拍板（工具名数组 / normal 教学意图版 / 工具句在 md / B2 自带测试），并同意按 B-3 回改 B-1 结论 3、`normal` 名字不改、判据 3 按完全不出现 `〖`。随后实施 B2 全部 5 个文件。
证据：
- Node 方言实测（决策点 1 的依据）：`.b2-raw-probe/a.mjs` 里 `import x from './x.md?raw'` → `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".md"`（Node v22.22.1）。
- Vite 侧实测：`createServer({ middlewareMode: true })` + `transformRequest('/src/agent/modePrompts.js')` → 727 字符，import 被改写为 `import normalMd from "/src/agent/skills/normal.md?import&raw"`；单独 transform 两份 md 均返回含标题的字符串模块。
- 测试：`node --test "src/agent/__tests__/*.test.js"` → 9 tests / 9 pass / 0 fail（96ms）。**注意 `node --test src/agent/__tests__/` 不可用**（`MODULE_NOT_FOUND`）。
- 静态：`node --check` 两个 js 均 exit 0；`npx eslint`（3 个改动文件）无输出、exit 0；全量 `npx eslint .` → 73 文件 / 9 有问题 / **15 错误 / 3 警告**（与 A-2 基线一致）。
- 判据 3：`U+3016=false U+3017=false`（normal 827 字符、socratic 1085 字符）。
- 构建：`npx vite build` ok（38.53s，4424 modules，主包 2,815.83 kB、CSS 41.22 kB、index 0.87 kB）；主包比 A2 基线 +83.2 kB，原因未查明（见第 5 节）。
- 边界：`src/agent/**` 之外 grep `modePrompts|agent/modes` 0 命中；`git status --short` 依赖文件无改动、旧路径无改动。
没做完 / 卡在哪：B2 等用户验收（🔵）；`?raw` 未进入生产构建（页面尚未引用），D 阶段需复验；两份 md 文案为首版，D 阶段调整需同步测试断言。
下一轮从哪开始：用户验收 B2 → 给 B3（`generateAnswerOptions.js`）的开工说明（复述 / 范围 / 决策点），不写代码。

### 2026-10-17 · B / B2 验收通过（✅）+ B3 旧代码事实核对
做了什么：用户验收 B2，标 ✅；为 B3 的开工说明用 code-explorer 只读核对旧代码事实（未改任何源码）。
证据（B3 相关事实，file:line 已写入第 3 节第 2 条）：
- `AgentModel`：构造 `{ customEndpoint, apiKey, settings:{ model, system_message, typewriterDelay } }`（`src/lib/AgentModel.js:68-94`）；`getCompletion(messages, onData, onComplete, { onReasoning })` 返回 `Promise<void>`、失败 throw（`:150-190`）；内部 3 次重试 + 退避 1s/2s/4s（`:163-189`）；**无 `abortSignal`/`abort()`**，内部 60s 超时会被重试复用（`:208-212`）。
- 副模型配置键 `optionAgentConfig`（`ConfigManager.js:57-69`）；实例创建 `useAgentsConfig.js:7-21` → `agents.js:43-57`；主副同时校验在 `ChatPage.jsx:460-462`。
- 五档提示词覆盖链 `ConfigManager.js:118-136`（`optionAgentPrompt` > `option_ai_prompt` > `SYSTEM_PROMPTS.OPTION_AI_MODE`）。
- `ContentParser.parse()` 返回**对象**、每档是数组（`ContentParser.js:13-37`）——更正第 7 节 2026-10-16 日志里"返回值是数组"的说法。
- 旧路径唯一封装：`useQuestionFlow.js:111-147` 的 `fetchOptionAnswer`（React hook 内，未复用）。
没做完：B3 未开始；B3 的决策点（超时/取消怎么实现、五档不齐与重复档位怎么判、未配置副模型的判定入口、`language` 参数怎么处理、是否自带测试）待用户拍板。
下一轮从哪开始：用户对 B3 的决策点表态 → 写 `src/agent/services/generateAnswerOptions.js`（一次只做 B3）。

### 2026-10-17 · B / B3 实施（🔵 待验收）+ 协议放宽同步
做了什么：用户就 B3 的六个决策点表态（`modelAdapter` 跑副模型、候选答案放宽为「有几档显示几档」且同档只留首条、`isOptionConfigReady` 服务内判定、`language` 本期不用、B3 自带测试、失败只回白名单），并授权改协议；按「先协议 → 再文档 → 再代码」完成全部改动。
证据：
- 协议：`01-核心协议.md` §2.2 流程改为「至少一条可识别档位 / 零条可识别档位」；§2.3 `options` 改为 `≥1 条`、补 `option_model_failed` 的「零条」语义、新增「为什么候选答案不要求五档齐全」段。
- 代码：`src/agent/services/generateAnswerOptions.js`（`generateAnswerOptions` / `extractOptions` / `isOptionConfigReady` / `OPTION_LEVELS` / 四个 detail 常量；`timeoutMs = min(传入, 45s)`；未配置零请求；失败只回 `{status,errorCode,detail}`）。
- 测试：`node --test "src/agent/__tests__/*.test.js"` → **20 tests / 20 pass / 0 fail**（B2 9 + B3 11，96ms 级）。B3 用例：五档齐全 5 条顺序固定、三档 3 条、同档取首条、零档 `invalid_output`、HTTP 500 → `HTTP 500` 且序列化结果不含端点/密钥/`x-trace`、超时 `timeout`、未配置零请求、开闸标记不进候选答案、契约错误抛错、`isOptionConfigReady` 四类反例。
- 探针（临时脚本，已删）：失败路径 `calls = 1`（`maxRetries: 0` 生效）、`detail = "HTTP 500"`；同时观察到 AI SDK 会把完整 `APICallError` 打到 stderr（已记入第 5 节）。
- 静态：`npx eslint src/agent/` 无输出；全量 `npx eslint .` → 75 文件 / 9 有问题 / **15 错误 / 3 警告**（＝基线）。
- 构建：`npx vite build` ok（20.26s，4424 modules，主包 2,815.83 kB，与 B2 轮完全一致——新增模块未被页面引用）。
- 边界：`git status --short` 依赖文件无改动；`AgentModel` / `ContentParser` / `prompts.js` / `modelAdapter.js` 未改。
没做完 / 卡在哪：B3 等用户验收（🔵）；B4 未开始；D/F 阶段需处理 stderr 泄露与 `options.length` 渲染。
下一轮从哪开始：用户验收 B3 → 给 B4（`tools/askQuestion.js`）的开工说明（复述 / 范围 / 决策点），不写代码。

### 2026-10-17 · B / B3 验收通过（✅）+ B4 开工事实核对
做了什么：用户验收 B3，标 ✅；为 B4 核对 `tool.execute` 第二参数的真实形状（只读 `node_modules/ai/dist/index.mjs`）。
证据：`executeToolCall` 里 `executeTool({ execute, input, options: { toolCallId, messages, abortSignal, experimental_context } })` → B4 的 `toolCallId` 只能从第二参数取；同一次核对确认 `experimental_context` 存在（本期不用）。
没做完：B4 未开始；B4 的决策点（校验顺序、状态归属、工具工厂签名与测试注入点、`questionId` 形式、工具结果是否带 `options`、execute 内部异常兜底）待用户拍板。
下一轮从哪开始：用户对 B4 的决策点表态 → 写 `src/agent/tools/askQuestion.js`（一次只做 B4）。

### 2026-10-17 · B / B4 实施（🔵 待验收）
做了什么：用户就 B4 的 8 个决策点表态（去重最前、闭包内两张表、注入假服务、B4 再判配置、`q_`+12 位十六进制、带完整 options、`internal_error`、description 用草案），并同意给 B-4 加指向；按「先协议 → 再文档 → 再代码」完成 B4。
证据：
- 协议：§2.2 校验顺序改为「`toolCallId` 去重最前 → 模式 → 字段 → 文本重复 → 程序错误」，补两段理由（去重为何必须最前、程序错误为何也要 `rejected`）；§2.3 拒绝结构补 `message?` 与四个 reason。
- 代码：`src/agent/tools/askQuestion.js`（`createAskQuestionTool`、`validateAskQuestionInput`、`ASK_QUESTION_INPUT_SCHEMA`、`ASK_QUESTION_DESCRIPTION`、`QUESTION_MAX_LENGTH=500`、`CONTEXT_MAX_LENGTH=2000`；`execute` 内七步：去重 → 模式 → 校验 → 文本去重 → 生成 ID → 未配置分支 → 调 B3）。
- 测试：`node --test "src/agent/__tests__/*.test.js"` → **35 tests / 35 pass / 0 fail**（B2 9 + B3 11 + B4 15）。B4 关键用例：重放返回同一结果且副模型只调 1 次、重放时传非法参数仍返回第一次结果、并发三调用各自有结果且 ID 不同、未配置零请求、程序异常脱敏（断言不含 `secret.example` / `sk-xxx`）。
- 静态：`npx eslint src/agent/` 无输出；新增两文件 `U+200B=false`、`U+3016=false`。
- 构建：`npx vite build` ok（11.04s，主包 2,815.83 kB，与前两轮一致——新模块尚未被页面引用）。
没做完 / 卡在哪：B4 等用户验收（🔵）；B5 未开始；schema 层与 execute 层的"未知字段"两种表现需在 D 阶段文案里都覆盖。
下一轮从哪开始：用户验收 B4 → 给 B5（`runTeachingAgent.js`）的开工说明（复述 / 范围 / 决策点），不写代码。

### 2026-10-17 · B / 会话收尾：交接 B5（不写代码）
做了什么：用户确认先了解清楚再往下走；本轮只做两件事——解释「`ask_question` 是标准 function calling、模型自主决策、程序把关」与「学生作答在执行层之外、下一轮以 user 消息进入上下文」；并在用户追问"你刚才验证过了？"后如实说明**没有跑过真实端点**。按要求把 HANDOFF 整理成下个会话可直接开工 B5 的状态。
证据：本轮无代码改动，`git status --short` 与上一轮一致（`src/agent/`、`docs/agent-mvp/`、`docs/AGENT_MVP_PLAN.md`、`scripts/`、`.codebuddy/` 为未跟踪；依赖文件无改动）。B 阶段测试基线：35 tests / 35 pass（离线）。
没做完 / 卡在哪：B4 未显式验收（🔵）；B5 未开始；B 阶段真实端点证据仍为零。
下一轮从哪开始：新会话先读本文件第 0–3 节 → 向用户报告当前状态 → 给 B5 的开工说明（复述 / 范围 / 第 3 节第 4 条列的 5 个待决策点），不写代码。

### 2026-10-17 · B / B4 验收通过（✅）
做了什么：用户确认验收 B4，标 ✅；同步第 1/2/5/7 节，并把下个会话的开工提示词交给用户（新会话做 B5 开工说明）。
证据：`docs/agent-mvp/HANDOFF.md` 第 2 节 B4 行改为 ✅，第 1 节整体状态改为"B1–B4 全部 ✅"，第 5 节删除"B4 未显式验收"条目。
没做完：B5 未开始；B 阶段真实端点证据仍为零。
下一轮从哪开始：新会话给 B5 的开工说明，等用户对 5 个决策点拍板后再写代码。

### 2026-10-17 · B / B5 开工说明 + 5 个决策拍板（未写代码）
做了什么：按规则 2.2 给出 B5 的开工说明（复述 / 范围 / 5 个决策点 / 拍板后做法报备），未写代码；用户就 5 条决策逐条选择 A；结论追加为 `决策记录.md` **B-12**，并把两处 B-12 未覆盖的实现选择登记在第 3 节第 6 条。
证据：
- 开工说明核对到的源码事实：`stepCountIs` 实现是 `steps.length === n`（`node_modules/ai/dist/index.mjs:3861-3863`）、数组条件是 `.some()`（`:3875-3879`）、停止条件在工具执行后求值（`:7579-7596`）；`StepResult.toolResults` / `TypedToolResult.output`（`ai/dist/index.d.ts:895`、`765-779`）；B1 三类失败路径返回空 `responseMessages`（`modelAdapter.js:346-390`）；B3 `resolveTimeout` 只在 `>0` 时夹取（`generateAnswerOptions.js:76-79`）→ `getRemainingMs()` 必须 ≥1。
- 用户选择（5 条全 A）：并发上限 4 在 B5 包装工具时用本轮私有信号量；三个 ID 必传、B5 不自造；`await_user` 优先、`finishReason === 'tool-calls'` 才判 `limit_reached`；单次运行不重试、一次调用恰好一对 started/finished；`timeout→failed`、`cancelled→cancelled`、`failed→failed`。
- 边界：本轮**未创建** `src/agent/runTeachingAgent.js`，未改任何 `src/`、`scripts/`、依赖文件；测试基线仍是 35 tests / 35 pass（离线，未复跑）。
没做完 / 卡在哪：B5 代码未开始；B5 自身无独立判据，正式断言要等 B6 的 6 个用例。
下一轮从哪开始：按 `决策记录.md` B-12 写 `src/agent/runTeachingAgent.js`（一次只做 B5），交付后标 🔵 待验收。

### 2026-10-17 · B / B5 实施（🔵 待验收）
做了什么：按 B-12 的 5 条结论实现 `src/agent/runTeachingAgent.js`（单文件、约 250 行）：身份与入参校验 → 造本轮私有信号量（上限 4）并包装 B4 工具 → `stopWhen: [stepCountIs(3), askQuestionReady]` → 转发带 runId 过滤的事件 → `try/finally` 恰好一对 `run-started`/`run-finished` → 五选一结束原因。
证据：
- 静态：`node --check src/agent/runTeachingAgent.js` exit 0；`npx eslint src/agent/runTeachingAgent.js` 无输出、exit 0；全量 `npx eslint .` → **18 problems (15 errors, 3 warnings)**＝基线，未增加。
- 测试：`node --test "src/agent/__tests__/*.test.js"` → **35 tests / 35 pass / 0 fail**（B2 9 + B3 11 + B4 15，未受影响）。
- 一次性离线冒烟（假 fetch，9 个场景全过，逐条见第 5 节）：A 提问后停止 / B 一轮三调用（2 ready + 1 duplicate，峰值 2）/ C `completed` / D `limit_reached`（3 次请求）/ E 取消后事件不再增长 / F 500 → `failed` / G 身份缺失零事件 / H `normal` 无工具 / **I 6 个问题并发峰值 = 4**。
- 构建：`npx vite build` ok（15.50s，主包 2,815.83 kB 与前几轮一致——新模块未被页面引用）。
- 判据核对：`grep hasToolCall` 在 `src/` 下 **0 命中**（文件里只用散文描述「按工具名判定停止」的内置条件，避免验收 grep 误伤）；`grep maxTokens` 0 命中；新增文件 `U+200B=false`、`U+3016=false`。
- 边界：`git status --short -- src/agent package.json pnpm-lock.yaml scripts` → 只有 `?? src/agent/`、`?? scripts/`；B1–B4 文件未改。
没做完 / 卡在哪：B5 等用户验收（🔵）。`timeout → failed` 无离线证据（主运行预算被内部固定 120s，测试无法缩短）。
下一轮从哪开始：用户验收 B5 → 给 B6（`src/agent/__tests__/` 六个用例 + B-8 四条额外覆盖）的开工说明，不写代码。

### 2026-10-17 · B / B5 验收通过（✅）+ B6 开工事实核对
做了什么：用户验收 B5 转 ✅；为 B6 核对 `ai/test` 与 V3 流片段 API（只读 `node_modules`），发现 B6 的第一道墙并写入第 3 节。
证据：`ai/dist/test/index.d.ts` → `MockLanguageModelV3({ doStream })`、`doStreamCalls`、`simulateReadableStream({ chunks, chunkDelayInMs, initialDelayInMs })`；`@ai-sdk/provider@3.0.10/dist/index.d.ts:1895-1954` → V3 流片段类型表与 `finish: { usage, finishReason }`；`:1759` → `LanguageModelV3FinishReason` 是 `{ unified, raw }` 对象，不是字符串；B1 的模型装配是 `createOpenAI(...).chat(config.model)`（`modelAdapter.js:234-266`），对外只暴露 `baseFetch`。
没做完：B6 未开工；接入方式等 4 个决策点待用户拍板。
下一轮从哪开始：用户对 B6 决策点表态 → 写 `src/agent/__tests__/` 的用例（一次只做 B6）。

### 2026-10-17 · B / B6 实施（🔵 待验收）
做了什么：先给 B6 开工说明（复述 / 范围 / 4 个决策点），用户全部选 A；实施中发现「决策① 只授权改 B1 不够」——六用例要打 B5，而 B5 不透传 `model`，于是单独报备并取得「B5 加 2 行透传」的二次授权。随后写 10 条测试并修复两处自测缺陷（见证据）。
证据：
- 测试：`node --test "src/agent/__tests__/*.test.js"` → **45 tests / 45 pass / 0 fail**（B2 9 + B3 11 + B4 15 + **B6 10**）。B6 十条：① 提问后停止（1 次请求、事件四连、`responseMessages` 为 assistant+tool 且 `nextAction:'await_user'`）；② 副模型失败降级（`optionsStatus:'unavailable'`、问题仍在、原因仍 `awaiting_user`）；③ 一轮三调用（2 ready + 1 duplicate、顺序＝调用顺序、ID 不同）；④ 非法→合法（2 次请求、第一步 `invalid_input`、第二步停）；⑤ 超步数（3 次请求、每步 `invalid_input`、`finishReason:'tool-calls'` → `limit_reached`、协议消息保留）；⑥ 取消（首个 `text-delta` 触发 abort，`responseMessages` 空、事件数不再增长）；⑦ `partId` 稳定（3 个 delta 共用一个）；⑧ 两处清理（事件与协议消息都无 U+200B、空文本块被丢弃）；⑨ 请求次数＝步数（工具往返 2 次、`completed`）；⑩ `normal` 无工具事件。
- 静态：`npx eslint` 三个改动文件无输出；全量 `npx eslint .` → **18 problems (15 errors, 3 warnings)**＝基线。
- 构建：`npx vite build` ok（10.72s，主包 2,815.83 kB 未变——测试文件不进产物）。
- 两个实测陷阱（已写进测试注释）：① `MockLanguageModelV3` 的 `doStream` **数组形式是 1 基偏移**（`ai/dist/test/index.mjs:104-109`），第一次调用会读第 2 个元素 → 改用函数 + 自增游标；② 首版脚本里每个 step 都复用 `call_1`，第二步直接命中 B4 的 `toolCallId` 幂等表，拿回第一步的 `rejected` 结果（表现为"合法参数也报 question 必须是字符串"）→ 改为跨步全局唯一 id。这两点是写测试过程中真实踩到并修掉的，不是事后推测。
没做完 / 卡在哪：B6 等用户验收（🔵）。provider 装配 / 开闸 fetch / 请求体注入仍无证据（B7）；`timeout → failed` 仍无自动断言。
下一轮从哪开始：用户验收 B6 → 给 B7（`scripts/run-socratic-once.mjs`，真实端点跑一轮 socratic）的开工说明，不写代码。

### 2026-10-17 · B / B6 验收通过（✅）+ B7 开工事实核对
做了什么：用户验收 B6，标 ✅；为 B7 开工说明核对三件事（只读）：`scripts/probe-tools.mjs` 的 env 处理与打印口径、副模型提示词的来源与可用性、`SystemPrompts.optionAiMode` 的实际文案。
证据：`scripts/probe-tools.mjs:27-35` → 三个 `PROBE_*` 缺一即 `console.error` + `exit(1)`，密钥打码；`src/services/prompts.js` 模块顶层就调 `localStorage`（`:20-33`、`:146-149` 的 getter）→ **Node 侧不能 import**；`src/locales/zh/translation.json` 的 `SystemPrompts.optionAiMode` 长度 332，含 `〖non...〗` 档位标签（副模型协议所需，不违反"教学提示词不得含标签"）。
没做完：B7 未开工；副模型配置与提示词来源等决策点待用户拍板。
下一轮从哪开始：用户对 B7 决策点表态 → 写 `scripts/run-socratic-once.mjs`（一次只做 B7）。

### 2026-10-17 · B / B7 实施（🔵 待真实端点验证）
做了什么：先给 B7 开工说明（复述 / 范围 / 4 个决策点），用户全部选 A；随后写 `scripts/run-socratic-once.mjs`（env 读取 → 读 md 装配模式 → 读翻译文件的副模型提示词 → 造三个 ID → 调 `runTeachingAgent` → 打印问题/档位/步数/事件序列/messages 摘要 → 四项判据自检 → 诊断 → 落盘 → 按判据退出）。
证据：
- 静态：`node --check scripts/run-socratic-once.mjs` exit 0；`npx eslint scripts/run-socratic-once.mjs` 无输出；全量 `npx eslint .` → **18 problems (15 errors, 3 warnings)**＝基线。
- 缺变量：直接运行 → 打印「缺少环境变量。需要 PROBE_BASE_URL / PROBE_API_KEY / PROBE_MODEL 三个都设置…」并 `exit 1`。
- **接线冒烟（不是 B7 证据）**：`PROBE_BASE_URL=https://example.invalid/v1` + 假密钥 → 配置段落正常（密钥 `sk-p****real`、socratic 指令 1083 字符、副模型提示 332 字符来自 `SystemPrompts.optionAiMode`、三个 UUID 生成）；事件 `run-started > run-finished`；`reason=failed`、`stepCount=0`；判据 3❌+1✅；诊断正确走「运行失败：检查端点地址…」分支（首版诊断把 failed 误判成「模型没调工具」，已修）；`socratic-once.output.json` 正常写出。产物已删。
- 过程中确认：`src/services/prompts.js` 顶层即碰 `localStorage`，Node 侧不可 import；副模型提示词只能从 `src/locales/zh/translation.json` 读（332 字符，含 `〖non…〗` 档位标签）。
没做完 / 卡在哪：**B7 的判据还没有任何真实端点输出**——必须由用户在本机带 `PROBE_*` 跑一次，把「问题与候选答案 / 步数与结束原因 / 判据」三段与退出码贴回来，才能标 ✅ 并做 B 阶段收尾。
下一轮从哪开始：用户跑 `node scripts/run-socratic-once.mjs` 并贴输出 → 四项判据全过则 B 阶段收尾（B-15 阶段结论 + HANDOFF 切 C + 起草 `C-开发指导.md`）。

### 2026-10-17 · B / B7 验收通过（✅）+ B 阶段收尾 + C 阶段开工前置
做了什么：用户提供真实端点运行结果（四项判据 ✅×4、退出码 0），B7 转 ✅。读 `scripts/socratic-once.output.json` 补齐证据细节；按规则 2.4 把 B 阶段结论写成 `决策记录.md` **B-15**；HANDOFF 阶段切到 C；按规则 2.3 起草 `C-开发指导.md`。
证据：
- 真实运行（`when=2026-10-17T11:59:17.752Z`，`deepseek-flash` ×2，主题「闭包」）：事件计数 `run-started=1 / reasoning-delta=354 / text-delta=69 / tool-started=3 / tool-completed=3 / run-finished=1`；3 个问题各 5 档（`q_905bb7049ec9`、`q_6bc5f069a96c`、`q_ada7fcf9fc0d`）；`response.messages` 角色 `assistant,tool`；配对 3/3；U+200B 三处 false；`allPassed=true`。
- 阶段结论：`决策记录.md` B-15（含 8 条不变量逐条结论与 6 条遗留风险）。
- 文档：`C-开发指导.md` 新增（目标 / 开工准备含 4 个待拍板决策 / C1–C4 分步含「你检查」与命令 / 通过标准 / 本阶段不要做）。
没做完 / 卡在哪：**C 阶段未开工**。`C-开发指导.md` 等用户审阅；第 4 个决策（`pendingQuestion` 应为问题组）是 C 文档与 B-3 的冲突，必须先定。
下一轮从哪开始：用户审阅 `C-开发指导.md` → 拍板 4 个决策（写入 `决策记录.md` C-1 起）→ 开 C1（`src/utils/conversationState.js`）。

### 2026-10-17 · C / 四个前置决策拍板（C-1）
做了什么：用户审阅 `C-开发指导.md` 时对四个决策表态——1/2/3 认同，第 4 条「改成数组」。结论写进 `决策记录.md` **C-1**，HANDOFF 第 4 节四条标为已拍板、第 3 节同步。
证据：`决策记录.md` C-1（结论 4 条 + 原因 + 放弃方案 + 遗留风险）。用户口述：「决策1,2,3都认同。决策4改成数组吧。」
没做完 / 卡在哪：`C-开发指导.md` 其余部分（C1–C4 分步、通过标准）仍待用户整体审阅；**C 阶段代码未开始**。
下一轮从哪开始：用户对 `C-开发指导.md` 剩余部分表态（可提出整改）→ 开 C1（`src/utils/conversationState.js`）。

### 2026-10-17 · C / C 开发指导审阅通过（会话收尾，交接给 C1）
做了什么：用户确认「其余部分按此执行」，并澄清上一轮问的「3」指的是四条验收检查项（已解释：1 条断言 + 3 条 grep）；本轮换会话前把状态整理成可直接开工 C1 的形态。
证据：`HANDOFF.md` 第 1 节当前任务＝C1（未开始）、第 2 节 C1 行补开工前置、第 3 节第 1–2 条给出 C1 入口与四条硬约束；`决策记录.md` **C-1** 为四个决策的唯一事实源。用户口述：「其余部分按此执行，不过我要新开对话了。」
没做完 / 卡在哪：C 阶段代码未开始；C1 尚无任何证据。本轮**未跑任何命令**（未改代码，无需跑测试）——沿用上次基线：45 tests / 45 pass、`npx eslint .` 15 错误 / 3 警告。
下一轮从哪开始：新会话先读本文件第 0–3 节，然后按规则 2.2 给 C1 的开工说明并实施（C1 无待拍板项）。

### 2026-10-17 · C / C1 实施（🔵 待验收）
做了什么：按规则 2.2 先给 C1 开工说明（复述 / 范围 / 无决策点），然后新建 `src/utils/conversationState.js`：`reduceSession`（14 个 action：SEND_MESSAGE / SUBMIT_ANSWER / SKIP_QUESTION / CANCEL_RUN / RETRY_LAST_TURN / SET_MODE / OPEN_CONVERSATION + 7 个运行事件）、`buildModelContext`、`projectTurns`、`deriveViewState`、`createInitialState` 与三个状态常量。
证据：`node --check` exit 0；`npx eslint src/utils/conversationState.js` exit 0；全量 `npx eslint .` → 18 problems（15 错误 / 3 警告）＝基线；`node --test "src/agent/__tests__/*.test.js"` → 45 / 45 pass / 0 fail；一次性离线冒烟 8 项全过（乱序补建、重复不增卡、旧 runId 三连不改状态、双击只产生一次运行、一轮多问答完才续轮、上下文含 3 条且无 reasoning/悬空/U+200B、重复 run-started 不复活、取消后迟到片段被丢弃），原始打印摘要在第 5 节；禁用式 grep 0 命中、文件内无真实 U+200B。
没做完 / 卡在哪：C1 等用户验收（🔵）；C3 尚未把上述断言固化成测试，**冒烟脚本已删、不可复跑**；本轮未跑 `vite build`（新模块未被页面引用）。C1 有两处实现选择超出 C 文档字面（`parts` 带 `runId`、问题全部结束后 turn 转 `completed`），已写在第 5 节待复核。
下一轮从哪开始：用户验收 C1 → 给 C2（`src/hooks/useChatSession.js`）的开工说明（复述 / 范围 / 无待拍板项，C-1 已定），不写代码。

### 2026-10-17 · C / C1 验收通过（✅）
做了什么：用户验收 C1（原话「没毛病」），状态转 ✅；HANDOFF 第 1 节当前任务切到 C2，第 2 节 C1 行改为 ✅，第 3 节第 1 条改为 C2 入口，第 5 节两处实现选择标注已按此通过。
证据：`docs/agent-mvp/HANDOFF.md` 第 1/2/3/5/6/7 节。
没做完 / 卡在哪：C2 未开始；C1 的离线冒烟仍是「脚本已删、不可复跑」，正式断言在 C3。
下一轮从哪开始：给 C2 的开工说明（复述 / 范围 / 决策点：无），然后写 `src/hooks/useChatSession.js`。

### 2026-10-17 · C / C2 实施（🔵 待验收）
做了什么：按规则 2.2 给 C2 开工说明后新建 `src/hooks/useChatSession.js`：`useReducer(reduceSession)` + 9 个命令（`sendMessage` / `submitAnswer` / `skipQuestion` / `cancelRun` / `retryLastTurn` / `setMode` / `openConversation` / `newConversation`）+ 11 个只读派生字段；ID 由 `crypto.randomUUID` 生成、每次运行一个 `AbortController`、事件→action 映射在 `EVENT_ACTION_TYPES`、`run-finished` 用返回值统一派发。
证据：`node --check` exit 0；`npx eslint src/hooks/useChatSession.js` exit 0；全量 `npx eslint .` → 18 problems（15 错误 / 3 警告）＝基线；`node --test "src/agent/__tests__/*.test.js"` → 45 / 45 pass；`vite build` ok（12.65s，4424 modules）；`react-dom/server` SSR 渲染成功，返回 20 个键、无 `setState` / `dispatch`（唯一以 `set` 开头的是命令 `setMode`），初始视图 `isRunning:false / canSendMessage:true / turns:0 / pendingQuestions:0`。
没做完 / 卡在哪：**取消触发 `AbortSignal` 与 `isRunning` 时序没有运行证据**（本机无 `react-test-renderer` / `jsdom` / `playwright`，且不得加依赖）；`useChatSession` 尚未被任何页面引用，因此 `vite build` 只证明既有应用不受影响，不证明本文件进了产物。
下一轮从哪开始：用户验收 C2 → 给 C3（`src/utils/__tests__/`）的开工说明并写测试；C3 只覆盖 reducer（纯函数），上面两条 hook 级判据仍需另选补法（第 5 节三选一）。

### 2026-10-17 · C / C2 补齐 hook 级证据（依赖破例，C-2）
做了什么：用户授权「装一个 react-test-renderer、破例更改依赖」；按「先文档后代码」先在 `决策记录.md` 立 **C-2**（选项 / 结论 / 原因 / 放弃方案 / 遗留风险），再 `pnpm add -D react-test-renderer@18.3.1`，最后写 `src/utils/__tests__/useChatSession.test.js`（7 条）。
证据：`node --test "src/utils/__tests__/*.test.js"` → **7 tests / 7 pass / 0 fail**；`node --test "src/agent/__tests__/*.test.js"` → 45 / 45 pass；`npx eslint` 新测试文件 exit 0（曾有一处 `no-unused-vars` 已修）、全量 `npx eslint .` → 18 problems（15/3）＝基线；`npx vite build` ok（11.24s，4424 modules）；`git status --short -- package.json pnpm-lock.yaml` 显示两个 `M`，改动只有这一条 devDependency。
没做完 / 卡在哪：C2 等用户验收（🔵）。`react-test-renderer` 已被 React 官方标记弃用（升 React 19 要换 `@testing-library/react`），已写进 C-2 遗留风险；该依赖不进产物（只在测试文件 import）。
下一轮从哪开始：用户验收 C2 → 给 C3 的开工说明（只补 reducer 用例：乱序、重复、`runId` 不匹配、双击、上下文清洁），不写代码。

### 2026-10-17 · C / C2 验收（✅）+ C3 实施（🔵）
做了什么：用户验收 C2（原话「验收」），C2 转 ✅；随后按规则 2.2 写 C3 的纯函数用例（17 条，只 import `conversationState.js`），覆盖 C1 五条判据 + 双击 / 取消 / 迟到事件。
证据：`node --test "src/utils/__tests__/*.test.js"` → **24 tests / 24 pass / 0 fail**（C3 17 + C2 7）；`node --test "src/agent/__tests__/*.test.js"` → 45/45 pass；`npx eslint` 新文件 exit 0、全量 18 problems（15/3）＝基线。
没做完 / 卡在哪：C3 等用户验收（🔵）。写用例时先失败的 4 条全部是**测试构造方式**的问题（在已收尾的轮次上补工具事件、拿同一份旧 state 模拟双击、对 `SET_MODE` 期待 reducer 校验模式是否存在、忘了 `buildModelContext` 不发 streaming 轮），已按第 5 节记下，生产代码未改。
下一轮从哪开始：用户验收 C3 → 给 C4（`scripts/session-loop.mjs`）的开工说明并写脚本。

### 2026-10-17 · C / C3 验收（✅）+ C4 实施（🔵，含 1 个缺陷修复）
做了什么：用户验收 C3（原话「都通过了，验收。」）；随后写 C4 的 `scripts/session-loop.mjs`——假运行层驱动 reducer 走完「发送 → 待答（一轮 3 问）→ 逐题作答/跳过 → 新一轮」，打印两个 turn 的 `status` / 问题 / 答案 / `modelMessages` 条数 / 实际发送的上下文，末尾 17 条判据自检。
证据：`node scripts/session-loop.mjs` → **17/17 通过、exit 0**；上下文 4 条 `user → assistant → tool → user`，tool-call=3 / tool-result=3、悬空 0、reasoning 0、U+200B=false；`node --test "src/utils/__tests__/*.test.js"` → 25/25 pass（新增 1 条顺序用例）；`node --test "src/agent/__tests__/*.test.js"` → 45/45 pass；`npx eslint` 三个改动文件 exit 0、全量 18 problems（15/3）＝基线。
没做完 / 卡在哪：C4 等用户验收（🔵）。**过程中发现并修掉一个真缺陷**：问题卡原按完成顺序排列，而真实端点会乱序返回工具结果（B7 证据在 `scripts/socratic-once.output.json`），已改为按卡片/调用顺序插入，C3 补了用例；另有一处是我脚本第一版把 U+200B 塞进了伪造的 `responseMessages`（该字段本应是 B1 已清洗的输出），已改。
下一轮从哪开始：用户验收 C4 → C 阶段收尾（阶段结论入 `决策记录.md`「C 阶段 · 会话状态层」段 + HANDOFF 切 D + 下一步读/起草 `D-开发指导.md`）。

### 2026-10-17 · C / C4 验收（✅）+ C 阶段收尾 + 起草 D 开发指导（会话交接）
做了什么：用户验收 C4（原话「验收，然后打算交接下一步。」）；按规则 2.4 写 C 阶段结论（`决策记录.md` **C-3**），按规则 2.3 起草 `D-开发指导.md`，HANDOFF 切到 D 并把状态整理成新会话可直接开工的形态。
证据：`决策记录.md` C-3（问题 / 7 条结论 / 放弃方案 / 验证证据 / 7 条遗留风险）；`D-开发指导.md`（目标 / 开工准备含 4 个待拍板决策 + C-3 三条结论 + 基线 / D1–D8 每步「做法要点 · 你检查 · 命令」/ 通过标准 / 本阶段不要做，其中 D2 标注按 B-1 裁剪）；HANDOFF 第 0 节 D 行补了 `D-开发指导.md`、第 4 节登记 4 个 D 决策。
没做完 / 卡在哪：**D 阶段代码未开始**；`D-开发指导.md` 等用户审阅，4 个决策待拍板（模式下拉存废、工具卡展开内容、失败文案口径、迁移判定落点）。
下一轮从哪开始：新会话先读 HANDOFF 第 0–3 节 → 报告状态 → 等用户对 `D-开发指导.md` 与 4 个决策表态 → 拍板后写 `决策记录.md` **D-1** 并开 D1。

### 2026-10-17 · D / 审阅 `D-开发指导.md` + 全部决策拍板（不写代码）
做了什么：与用户共同审阅 `D-开发指导.md`，核对 `D-页面与模式.md`、`AgentConfigPanel.jsx`、`conversationState.js` 的代码事实。发现三处问题：① 决策 1 的原 AI 倾向（保留下拉改名）与代码事实冲突——下拉实为预设提示词填充器（`AgentConfigPanel.jsx:118-124`），新路径主模型提示词无生效入口，副模型提示词仍生效；② D5「端点不支持工具自动降级」无检测信号——会话层只暴露 `turn.error` 文本（`conversationState.js:153-156`、`:818`），无结构化错误码；③ D4 复用旧组件实为「复用样式、重写接线」、D8 的 reasoning 节流缺做法。用户逐项拍板：决策 1＝主模型移除下拉、副模型保留；决策 2/3/4 按原倾向；D5 缺口＝不自动降级、显示原因+建议。结论入 `决策记录.md` **D-1 / D-2**，开发指导回填。
证据：`决策记录.md` D-1 / D-2；`D-开发指导.md` 决策表与 D3/D4/D5/D6 做法要点；`HANDOFF.md` 第 1/3/4 节。本轮未跑命令（未改代码）——沿用基线：`node --test "src/agent/__tests__/*.test.js"` 45/45、`node --test "src/utils/__tests__/*.test.js"` 25/25、`node scripts/session-loop.mjs` 17/17、`npx eslint .` 15 错误 / 3 警告。
没做完 / 卡在哪：D 阶段代码未开始；方案层「等待作答时禁用模式切换」仍为待确认（不阻塞 D）；D-1 遗留风险（1）要求 D5/D6 开工前先选定主模型面板改动对旧路径的处理方式。
下一轮从哪开始：按规则 2.2 给 D1（`src/App.jsx` 运行时开关）的开工说明（复述 / 范围 / 决策点），用户确认后实施。

### 2026-10-17 · D / D1 实施（🔵 待验收）
做了什么：开工说明（复述 / 范围 / 2 个决策点）经用户确认（占位形态＝最小占位、取值约定＝`=== 'true'` 与 `developerMode` 一致）后实施：新增 `src/pages/AgentChatPage/AgentChatPage.jsx`（占位组件，一行文字、无逻辑、不 import 会话层），改 `src/App.jsx` 加 `agent_runtime` 三元分支。
证据：`npx eslint src/App.jsx src/pages/AgentChatPage` → 无输出；全量 `npx eslint .` → 18 problems（15 错误 / 3 警告）＝基线；`npx vite build` → ✓ built in 59.65s，主包 2,816.10 kB（比 B 阶段的 2,815.83 kB +0.27 kB＝占位组件）；`git status --short -- src/pages/ChatPage src/lib/AgentModel.js src/hooks/useStreaming.js src/utils/StreamingParser.js` → 无输出（旧路径四件套零改动；`package.json`/`pnpm-lock.yaml` 的 M 是 C-2 授权的既有改动）。
没做完 / 卡在哪：D1 等用户浏览器验收（🔵）：不设键走旧路径、设 `'true'` 显示占位页、删键回旧路径。协议不变量 1–8 本轮不涉及（未触碰协议消息与渲染数据流）。
下一轮从哪开始：用户验收 D1 → 给 D3（`MessageContent` + `ToolCallCard`）的开工说明（复述 / 范围 / 决策点），不写代码。

### 2026-10-17 · D / D1 验收通过（✅）
做了什么：用户在浏览器完成三步验证（旧路径正常 → 设键显示占位页 → 删键回旧路径），原话「验收通过」，D1 转 ✅。期间发现 5174 端口已被一个既有 dev server 占用（仓库根 `vite-dev.log` 同源），直接复用，未新起进程。
证据：HANDOFF 第 1/2/3 节已同步；用户口述验收。本轮未改代码。
没做完 / 卡在哪：无。方案层「等待作答时禁用模式切换」仍挂待确认（不阻塞 D）。
下一轮从哪开始：给 D3（`MessageContent` + `ToolCallCard`）的开工说明，用户确认后实施。

### 2026-10-17 · D / D3 实施（🔵 待验收）
做了什么：开工说明（含一个代码核对新发现：会话层无法区分「准备问题中 / 生成候选答案中」两个进行态）经用户逐项拍板（① 进行态合并为一个，五态各有真实数据对应；② mock 页验收；③ reasoning 默认折叠）后实施。新增 `ToolCallCard.jsx`（五态 = running / completed+ready / completed+unavailable / completed+rejected / failed；默认折叠；展开区显示工具名+toolCallId+输入的问题+结果摘要+错误/降级原因；原生 button + aria-expanded 键盘可操作；文字+图标区分不只靠颜色）与 `MessageContent.jsx`（按 blocks 顺序渲染，reasoning 默认折叠成「思考过程」块，两个组件均 `memo`）；`AgentChatPage` 改为临时 mock 验收页（五态 + 思考块 + 「文本→工具→工具×4→文本」交错顺序）。第一次 Write 被用户取消（审批弹窗），确认后重写成功。
证据：`npx eslint src/components/MessageContent src/components/ToolCallCard src/pages/AgentChatPage` → 无输出；全量 `npx eslint .` → 18 problems（15/3）＝基线；`npx vite build` → ✓ built in 16.20s；`node --test "src/agent/__tests__/*.test.js"` → 45/45；`node --test "src/utils/__tests__/*.test.js"` → 25/25；`node scripts/session-loop.mjs` → exit 0；`git status --short -- <旧四件套> src/hooks/useChatSession.js src/utils/conversationState.js` → 四件套无输出（C 层两个文件仍是 B/C 阶段的未跟踪状态，本轮未改）。
没做完 / 卡在哪：D3 等用户浏览器验收（🔵）。文案当前硬编码中文，D7 统一收进 translation.json；`useDeferredValue` 节流在 D4 接真实流时才接上（本轮组件层已 `memo`）。
下一轮从哪开始：用户验收 D3 → 给 D4（本轮问题卡组）的开工说明，不写代码。

### 2026-10-17 · D / D3 验收通过（✅）
做了什么：用户在浏览器验收 mock 页（原话「通过」）：五态工具卡文案+图标区分、思考块默认折叠、键盘展开、正文顺序不被挪动。D3 转 ✅。
证据：HANDOFF 第 1/2/3 节已同步；用户口述验收。本轮未改代码。
没做完 / 卡在哪：无。
下一轮从哪开始：给 D4（本轮问题卡组）的开工说明，用户确认后实施。

### 2026-10-17 · D / D4 实施（🔵 待验收）
做了什么：开工说明（复述 / 范围 / 4 个决策点）经用户整体确认（原话「都统一」，按全部同意理解）后实施。接线前核对的事实：`AnswerCard.onLevelSelect(level, content)`（level 五档或 'custom'，`AnswerCard.jsx:161-177`）正好映射 `submitAnswer` 两条路径；`AnswerCard` 吃「按档位为键的对象」且自身跳过空档位行（天然兼容 B-10）；`QuestionCard` 自带 ✕ 按钮（`onCancel`）；运行层配置形状 `{endpoint, apiKey, model}`（B7 同款），由 `ConfigManager.getMainModelConfig()` + `buildEndpointUrl()` 适配；`MODES` 从 `modePrompts.js`（`?raw`，页面侧可用）。实施：新增适配层（3 个纯函数）+ 9 条单测 + `QuestionGroup` + 页面整体接线；`QuestionCard` 加可选 `cancelLabel`（✕ 提示改为「跳过此题」，默认行为不变，旧路径不受影响）。
证据：`node --test "src/utils/__tests__/*.test.js"` → **34/34**（25 + 新 9）；`node --test "src/agent/__tests__/*.test.js"` → 45/45；`node scripts/session-loop.mjs` → exit 0；`npx eslint` 改动文件无输出、全量 18 problems（15/3）＝基线；`npx vite build` → ✓ built in 49.24s（**`?raw` 首次进生产构建并通过**，B-9 遗留风险 ② 关闭）；`git status --short -- <旧四件套> src/agent src/hooks/useChatSession.js src/utils/conversationState.js` → 四件套无输出（后三者仍是 B/C 阶段的未跟踪状态）。
没做完 / 卡在哪：D4 等用户真实端点验收（🔵）。已知让步：文案硬编码中文（D7 收）；配置门槛只有朴素提示（D5 正式做）；`AnswerCard` 倒计时等旧行为原样带入，如有意外在验收时记录。
下一轮从哪开始：用户验收 D4 → 开 D5（先选定 D-1 遗留风险 1 的面板处理方式，再给开工说明）。

### 2026-10-17 · D / D4 首轮验收暴露 2 个真缺陷（已修）
做了什么：用户真实端点验收，正文/思考/工具卡/问题卡组/自定义输入/跳过/自动续轮全部正常，控制台无报错，但发现 2 个缺陷：① **选项作答不能分级**——适配层把 `answer` 给成 `{level: text}` 字符串，而 `AnswerCard` 要求 ContentParser 形状（每档是数组、元素带 `.content`，`AnswerCard.jsx:156-161,281-290` 的 `Array.isArray` 判断），字符串导致档位行全部不渲染；② **浮层位置跳脱、挤压页面**——`AnswerCard` 桌面端依赖 `Draggable bounds="parent"` + `absolute` 居中，旧路径包在 `fixed inset-0` 全屏容器里（`ChatPage.jsx:713`），D4 第一版只包了普通 `<div>`。修复：适配层改出 `{level:[{content}]}`（单测同步改）；页面换成与旧路径同款的 `pointer-events-none fixed inset-0 z-[9999]` 容器。
证据：`node --test "src/utils/__tests__/*.test.js"` → 34/34；`npx eslint` 改动文件无输出。教训（记入第 5 节同款事实）：HANDOFF 早已更正过「`ContentParser.parse()` 返回对象、每档是数组」，D4 适配层第一版没对上，属于既有事实没被执行到位。
没做完 / 卡在哪：修复待用户复验（🔵）。
下一轮从哪开始：用户复验 D4 → 开 D5。

### 2026-10-17 · D / D4 复验通过（✅）
做了什么：用户复验（原话「效果不错。两个bug都解决了。」）：选项分档作答与浮层定位均正常，D4 转 ✅。
证据：HANDOFF 第 1/2/3 节已同步；用户口述验收。本轮未改代码。
没做完 / 卡在哪：无。
下一轮从哪开始：开 D5（配置门槛）——先选定 D-1 遗留风险 1 的面板处理方式，再给开工说明。

### 2026-10-17 · D / D5 实施（🔵 待验收）
做了什么：开工说明（复述 / 范围 / 4 个决策点）经用户拍板（原话「按你说的来做」，四条全按 AI 倾向；另补充「可以推荐模型 deepseek-flash」）后实施：结论先入 `决策记录.md` **D-3**，然后只改 `AgentChatPage.jsx`——主模型未配置提示带推荐文案；新增缺副模型可关闭提示条（`optionReady` 检查，不阻断不切模式）；错误条加 `TOOL_UNSUPPORTED_PATTERN` 宽匹配，命中时显示当前端点与模型名 + 换端点建议（D-2：只提示不降级）。
证据：`npx eslint src/pages/AgentChatPage` → 无输出；`npx vite build` → ✓ built in 15.39s；`node --test "src/utils/__tests__/*.test.js"` → 34/34；`git status --short -- <旧四件套> <C 层>` → 四件套无输出。
没做完 / 卡在哪：D5 等用户验收（🔵）。「疑似工具不支持」是宽匹配，普通 400 也会显示建议行（误判代价仅一行文案，D-3 已记录口径）。
下一轮从哪开始：用户按第 3 节三条路径验收 D5 → 开 D6（`promptMigration.js` + 单测 + 设置面板按 D-3 ① 分形态）。

### 2026-10-17 · D / D5 验收通过（✅）
做了什么：用户完成验收（原话「一和二通过」「继续吧，D5验收完毕」）：缺副模型提示条、主模型未配置提示（含 deepseek-flash 推荐）均通过；工具失败链路为可选项未测，留 D8。过程中用户未备份就 `removeItem` 清掉了两份模型配置，已引导经旧路径设置面板重新填写恢复（`localStorage.remove` 笔误也一并纠正为 `removeItem`）。
证据：HANDOFF 第 1/2 节已同步；用户口述验收。本轮未改代码。
没做完 / 卡在哪：无。工具失败链路文案尚无真实观测，D8 失败链路走查时确认。
下一轮从哪开始：开 D6（提示词迁移判定）——先核对内置提示词的真实来源，再给开工说明。

### 2026-10-17 · D / D6 实施（🔵 待验收）
做了什么：开工说明（复述 / 范围 / 3 个决策点）经用户逐项拍板（提示放新页面+面板分形态暂缓 / localStorage 持久化关闭态 / 不做第三份比对）后实施：结论入 `决策记录.md` **D-4**；新增 `promptMigration.js`（纯判定 + 注入式读取，刻意不 import `prompts.js`——它顶层碰 localStorage、Node 不可加载）+ 11 条单测；`AgentChatPage` 加迁移提示条（关闭写入 `prompt_migration_notice_dismissed`，只出现一次）。过程中修了一处测试自身缺陷：JSON import 路径写成 `../locales`（应为 `../../locales`，测试文件在 `__tests__/` 里），报 `ERR_MODULE_NOT_FOUND` 后修正；`with { type: 'json' }` 在 Node 22 与 eslint 下均可用。
证据：`node --test "src/utils/__tests__/*.test.js"` → **45/45**（34 + 新 11）；`node --test "src/agent/__tests__/*.test.js"` → 45/45；`npx eslint` 改动文件无输出、全量 18 problems（15/3）＝基线；`npx vite build` → ✓ built in 14.79s；`git status --short -- <旧四件套> <C 层>` → 四件套无输出。
没做完 / 卡在哪：D6 等用户验收（🔵）。面板分形态暂缓项已登记在第 5 节。
下一轮从哪开始：用户按第 3 节三条验收 D6 → 开 D7（文案，可裁剪）或直奔 D8。

### 2026-10-17 · D / D6 验收通过（✅）
做了什么：用户验收（原话「验收通过」）：自定义提示词 → 提示条出现；✕ 关闭后再刷新不再出现；删除键后无提示、对话正常。D6 转 ✅。
证据：HANDOFF 第 1/2/3 节已同步；用户口述验收。本轮未改代码。
没做完 / 卡在哪：无。
下一轮从哪开始：用户选定 D7（文案收口，英文可裁剪）或 D8（浏览器闭环走查）。

### 2026-10-17 · D / D7 准备完成 + 会话交接（不写代码）
做了什么：用户选定「先 D7 再 D8」。完成 D7 准备：盘点四个文件约 40 条硬编码文案、确定在两个 translation.json 各新增顶层 `"AgentChat"` 区块（插入点 `"AgentConfigPanel"` 块后，zh/en 均第 91 行附近）、中英文都做不裁剪、组件改用 `useTranslation` + 插值——全部写入第 3 节。**D7 代码未开工，未改任何 src / 翻译文件**。用户随后决定换会话交接，本轮把 HANDOFF 整理成可直接开工的形态。
证据：`git status --short -- src` 本轮无新增改动（与 D6 交付时一致）；HANDOFF 第 1/2/3/6/7 节已同步。沿用基线：`node --test` utils 45/45、agent 45/45、`session-loop.mjs` 17/17、`npx eslint .` 15 错误 / 3 警告、`vite build` 通过。
没做完 / 卡在哪：D7（文案）与 D8（浏览器闭环走查）未做；D 阶段暂缓项（面板分形态）在第 5 节。
下一轮从哪开始：新会话读 HANDOFF 第 0–3 节 → 按第 3 节第 1 条实施 D7 → D8。

### 2026-10-18 · D / 只查看状态（无代码改动）
做了什么：按交接协议读 HANDOFF 第 0–3 节并向用户报告当前状态；用 `git status --short` 与 locales 检索核对 HANDOFF 描述与实际工作区是否一致。
证据：`git status --short`（分支 `refactor/agent-architecture`）＝`M package.json` / `M pnpm-lock.yaml`（C-2 授权的 devDependency）、`M src/App.jsx`（D1 开关）、`M src/components/QuestionCard/QuestionCard.jsx`（D4 可选 `cancelLabel`）、未跟踪 `src/agent/`、`src/pages/AgentChatPage/`、`src/components/{MessageContent,ToolCallCard}/`、`src/hooks/useChatSession.js`、`src/utils/{conversationState,promptMigration}.js`、`src/utils/__tests__/`、`scripts/`、`docs/agent-mvp/`；`src/locales` 下检索 `"AgentChat"` **0 命中** → 与「D7 未开工、翻译文件未改」一致。
没做完 / 卡在哪：D7 仍未开工（第 3 节第 1 条已备好做法）。
下一轮从哪开始：按第 3 节第 1 条实施 D7（`translation.json` 新增 `AgentChat` 区块 + 四个组件文件改 `useTranslation`）。

### 2026-10-18 · D / D7 实施（🔵 待验收）
做了什么：按第 3 节的做法把 D3–D6 的硬编码中文收进翻译文件：zh / en 各新增顶层 `AgentChat` 区块（page / config / messageContent / toolCard / questionGroup，42 键，只加键）；`ToolCallCard` 的 `TOOL_LABELS` → `TOOL_LABEL_KEYS`、`CARD_STATES.label` → `labelKey`，`ResultSummary` 内取 `t`；`MessageContent` 的思考块、`QuestionGroup` 的标题与跳过按钮、`AgentChatPage` 的 13 处文案改用 `useTranslation` + 插值。
证据：键对齐 `node -e` → zh 195 / en 195、`AgentChat` 42/42、missing `[]` / extra `[]`；真实 i18next（`lng:'zh'`、`escapeValue:false`，与 `src/i18n.js` 一致）渲染抽查六条关键串与改前文案逐字一致（含 `option_model_not_configured （候选答案未生成…）` 的那个空格、全角冒号 `：`）；`npx eslint src/components/ToolCallCard src/components/MessageContent src/pages/AgentChatPage` exit 0；全量 `npx eslint .` → 18 problems（15/3）＝基线；`node --test` utils 45/45、agent 45/45；`node scripts/session-loop.mjs` → 17/17；`vite build` ok（46.59s，4440 modules，主包 2,868.16 kB）；四个改动文件 U+200B=false，新增的 `AgentChat` 区块内无 U+3016（该字符仅存在于既有 `SystemPrompts`）。
没做完 / 卡在哪：D7 等用户浏览器验收（🔵）。体积 +52 kB 不能归因 D7（见第 5 节）；`unknown` 兜底未翻译。
下一轮从哪开始：用户浏览器验收 D7 → 开 D8（闭环走查：正常链路 / 失败链路 / 窄屏 / `agent_runtime` 关闭时旧路径 6 项）。

### 2026-10-18 · D / D7 无头浏览器验证（部分验收）
做了什么：用户授权后全局装 `@playwright/cli`（未动仓库依赖）、复用系统 Edge 打开 `http://localhost:5174`，在**独立浏览器会话**（localStorage 为空）里依次造出五种状态，逐字核对 D7 的四十二个键在真实页面上的渲染。
证据：① 未配置态快照 → 标题 `问知轩 · Agent 运行时（开发中）`、`新会话`、主模型缺失全句、`输入一个想学的主题，比如：闭包`、textbox aria `消息输入框`、placeholder、`发送`（禁用）；② 写入假 `mainAgentConfig`（`127.0.0.1:9`）后 → 缺副模型整句 + `关闭提示`；③ `mainAgentPrompt` 设为自定义 → 迁移提示整句 + `关闭提示`；④ 端点不通发送 → `这一轮没有完成，可以重发一次。` + `Failed to fetch`；⑤ 用 `page.route` 延迟 60s 造运行中 → `正在生成…` + `取消`，点击后按钮回 `发送`、该轮错误文本 `运行已中断`。全程 console **0 error / 0 warning**，页面**无 `AgentChat.*` 原文键名**。
没做完 / 卡在哪：工具卡五态、`思考过程`/`N 字`、`本轮 N 个问题`/`跳过此题`、候选答案不可用浮层、`未填写` 与工具建议句未覆盖——需要真实端点，我只在用户配置里拿不到密钥；另 400 响应的错误文本是 `Bad Request`，`TOOL_UNSUPPORTED_PATTERN`（`/tools?|function.?call|\b400\b/i`）不命中，建议句因此无法靠假响应触发（记给 D8）。
下一轮从哪开始：用户在真实端点下看一眼工具卡与问题卡文案，确认后 D7 转 ✅，再开 D8。

### 2026-10-18 · D / D7 验收通过（✅）+ 交接 D8
做了什么：用户验收 D7（原话「没毛病。验收。」），D7 转 ✅；同步第 1/2/3/5/7 节，把下一步切到 D8，并把 D7 没机检到的四组文案并入 D8 走查清单。
证据：HANDOFF 第 1 节当前任务＝D8 待开工、第 2 节 D7 行标 ✅ 并注明验收原话、第 3 节第 1 条改为 D8 的四项走查与取证工具/限制、第 5 节把「D7 三点未收尾」改写为 D8 / F4 收口。本轮**未改任何 `src/` 文件、`scripts/`、翻译文件、依赖文件**。
没做完 / 卡在哪：D8 未开工，尚未给开工说明。
下一轮从哪开始：按规则 2.2 给 D8 的开工说明（复述 / 范围 / 决策点：走查由谁执行、失败链路怎么造、窄屏取证方式、旧路径 6 项的证据形式），用户确认后再动手。

### 2026-10-18 · D / D8 走查（🟡 暴露 4 个缺陷，未改代码）
做了什么：用户拍板 D8 四个决策（走查由 AI 用无头浏览器执行 / 「端点不支持工具」不用测 / 截图放临时目录 / 旧路径 6 项与用户填表），并提供一把临时测试密钥。用 Edge + 真实端点 `deepseek-flash` 跑完一轮「闭包」，逐层读 DOM 文本与尺寸；`agent_runtime` 删除后回旧路径确认渲染正常。
证据：思考块 `1051 字` → 正文 → `提问/已完成` ×2 → `本轮 2 个问题` → 五档候选完整 → 选「熟悉」后卡片变 `确认` 且**未提前续轮**；待答时页脚 placeholder 切换、浮层提示、展开区标签全部正确；窄屏 `scrollWidth 390 = clientWidth 390`（截图 `D:\Temp\d8-narrow.png`）；旧路径正常渲染。**缺陷四条**（①工具卡 unavailable 态不可达 ②问题卡永久「AI 回答中...」 ③候选不可用时答案卡无输入框、无法作答 ④窄屏发送按钮折行）与根因、修法写在第 5 节。
没做完 / 卡在哪：**未改任何代码**（D8 约定只取证）。③ 会让「缺副模型」场景下学生无法作答，建议至少修它；②③ 的修法会动到既有单测断言，③ 若动 `AnswerCard` 还要按规则 §3 申请豁免。旧路径 6 项行为待用户填表。
下一轮从哪开始：用户就 4 条缺陷逐条表态（修 / 不修 / 修哪几条）→ 修的话先改 adapter 与 ToolCallCard，再跑 `node --test "src/utils/__tests__/*.test.js"`、`npx eslint .`、`vite build` 复验。

### 2026-10-18 · D / D8 四缺陷修复（🔵 待叫复验）
做了什么：用户拍板「一起修 / ③ 用 B 方案（给 AnswerCard 加显式 prop）/ 修完通知、复验由他触发」。先按「先文档后代码」在 `决策记录.md` 立 **D-5**（四条修复方案、放弃的占位档方案、遗留风险），再改 5 个文件：`ToolCallCard` 判 `optionsStatus`；`questionAdapter` 的 `status` 恒 `completed` 并新增 `answerSettled:true`；`AnswerCard` 加可选 prop `answerSettled` 与 `showFailurePanel` / `showAnswerInput`（旧路径不传时两个派生值分别等于原来的 `isLoading` / `!isLoading`，行为逐字不变）；页面传 `answerSettled` 并给发送/取消按钮加 `shrink-0 whitespace-nowrap`；同步单测。
证据：`node --test "src/utils/__tests__/*.test.js"` → **46 tests / 46 pass**（新增「始终声明 answerSettled」1 条、改写「待答+候选不可用 → completed」1 条）；`node --test "src/agent/__tests__/*.test.js"` → 45/45；`npx eslint`（5 个改动文件）exit 0、全量 `npx eslint .` → 18 problems（15 错误 / 3 警告）＝基线；`vite build` ok（22.84s，主包 2,868.36 kB）。
没做完 / 卡在哪：**浏览器复验没做**（用户明确「我叫你复验你再复验」）。②的文案别扭（「AI 回答完毕！」vs 答案卡「AI 预测回答失败」）按 D-1 决策 3 保持现状，未擅自加专用标签。
下一轮从哪开始：用户叫复验 → 同一把临时密钥跑一轮「闭包」，核 ①工具卡「候选答案不可用」②问题卡不再转圈 ③零候选时答案卡有 `textarea#custom-answer` 且能提交 ④窄屏发送按钮不折行；通过后 D8 转 ✅ 并做 D 阶段收尾。

### 2026-10-18 · D / D-6 候选不可用标签改为「可以点击回答」
做了什么：用户指出「AI 回答完毕！」与实际状态不符，指定文案「可以点击回答」。先立 `决策记录.md` **D-6**（选项 A 保持 / B 改 error 态 / C 加专用状态；结论 C，说明这是对 D-1 决策 3 的细化），再改 4 个文件：adapter 给 `status:'unavailable'`；`QuestionCard` 新增 `unavailable` 分支（sage 配色、`Pencil` 图标、`t('QuestionCard.canAnswer')`）；zh/en 各加 1 个键；单测断言同步。
证据：`node --test "src/utils/__tests__/*.test.js"` → **46/46**；键对齐 `zh 196 / en 196 / missing [] / extra []`，`zh 可以点击回答 | en Click to answer`；`npx eslint`（5 个改动路径）exit 0、全量 18 problems（15/3）＝基线；`vite build` ok（18.51s，2,868.64 kB）。
没做完 / 卡在哪：浏览器复验仍未做（用户尚未叫）。
下一轮从哪开始：等用户叫复验 → 四点点检（含新标签）→ D8 转 ✅ → D 阶段收尾。

### 2026-10-18 · D / D8 复测通过（🔵 待验收）
做了什么：用户说「ok了。你复测一下吧」，用同一把临时测试密钥在无头浏览器里分三组验证：① 正常链路（3 问全有候选）；② 窄屏 390×844；③ 删掉副模型配置造「候选不可用」再跑一轮，并用自定义输入答完两题看是否自动续轮。
证据：(a) 正常链路三张卡均「AI 回答完毕！」；(b) 窄屏按钮 `62×36`、`Range.getClientRects()` = **1 行盒**、`docScroll 390 = clientWidth 390`；(c) 工具卡 `候选答案不可用` + 展开区 `option_model_not_configured （候选答案未生成，问题仍可手动作答）`、问题卡 `可以点击回答`、`#custom-answer` 存在且与失败面板共存；(d) 第一题提交后 `确认` 且未续轮，第二题提交后**自动开下一轮**，新轮正文引用了学生原话；(e) console 0 error / 0 warning。截图 `D:\Temp\d8-verify-narrow.png`。
没做完 / 卡在哪：D8 待用户验收；D 阶段收尾（阶段结论 + 切 E + 起草 `E-开发指导.md`）未做。
下一轮从哪开始：用户验收 D8 → 按规则 2.4 写 D 阶段结论 → HANDOFF 切 E → 起草 `E-开发指导.md`。

### 2026-10-18 · D / D8 验收 + D 阶段收尾 + 起草 E 开发指导
做了什么：用户验收 D8（原话「验收」），D8 转 ✅。按规则 2.4 写 D 阶段收尾结论（`决策记录.md` **D-7**：7 条结论 / 放弃方案 / 验证证据 / 8 条遗留风险）；HANDOFF 阶段切到 E，「下一步」改成审阅 `E-开发指导.md` 并拍板 4 + 1 条决策；按规则 2.3 起草 `E-开发指导.md`（目标 / 开工准备含 4 个决策与已核对代码事实 / E1–E4「做法要点·你检查·命令」/ 通过标准 / 本阶段不要做）。
证据：`E-开发指导.md` 里的事实全部现场核对过——旧键 `chat_histories` 且 `JSON.parse` 无 try/catch（`useChatHistory.js:4,7-10`）、`useChatSession` 无任何存储代码且 `openConversation(record)` 读 `conversationId ?? id / mode / turns`（`useChatSession.js:275-291`）、v2 形状见 `01-核心协议.md` §7。本轮只改文档，**未改任何 `src/` 文件**。
没做完 / 卡在哪：E 阶段代码未开始；`E-开发指导.md` 待用户审阅，5 条决策待拍板；旧路径 6 项走查仍未填表（F4 前必须补）。
下一轮从哪开始：用户审阅 `E-开发指导.md` → 拍板 5 条 → 追加 `决策记录.md` **E-1** → 从 E1（`src/utils/historyStore.js`）开工，先给开工说明不写代码。

### 2026-10-18 · E / 决策澄清轮（未拍板完，未写代码）
做了什么：就 `E-开发指导.md` §2.1 的 5 条决策逐条解释，答了用户三个概念疑问（「配额满」是什么、「键」指存储槽还是对话 ID、「保存接线落点 / 四个保存点」指什么）。用户当场表态两条：决策 1「支持」；决策 4 **改为要历史列表界面**（范围待定）。
证据：本轮无代码改动；`HANDOFF.md` 第 4 节把决策 1 标为已定、决策 4 标为「方向已定、范围待定」，其余三条仍待拍板。
没做完 / 卡在哪：决策 2 / 3 / 5 未表态；决策 4 的界面范围（是否含删除、重命名、旧会话是否也进列表）待确认，`E-开发指导.md` 需按「做列表」补一条 E 任务与判据（尚未改）。
下一轮从哪开始：用户答复 2 / 3 / 5 与列表范围 → 改 `E-开发指导.md` 补列表任务 → 写 `决策记录.md` E-1 → 开 E1。

### 2026-10-18 · E / 决策拍板（4 条定、1 条冲突待定）+ 回填 E 开发指导
做了什么：用户逐条表态——决策 2 选 A、决策 3 提出「直接写回旧键」、决策 4 要列表（标题/删除/重命名/不分新旧/标题取前 20 字）、决策 5 选 A。按「先文档后代码」把结论回填 `E-开发指导.md`（§2.1 决策表加结论列、新增 §2.4 两条路的代价对比、新增 **E5 列表界面** 一节、§1 加第 5 条判据、§4 通过标准同步），并更新 HANDOFF 第 1/2/3/4/7 节。
证据：核对源码确认「写回旧键」的代价——旧页面 `ChatPage.jsx:556` 按 `currentHistory.messages || []` 读，v2 记录无该字段 → 打开空白；且 `useChatHistory.js:53-72` 的 `autosave` 会在用户继续输入后以旧格式整条覆盖，新内容丢失。
没做完 / 卡在哪：**决策 3 未定且阻塞 E1**（决定 `saveConversation` 的目标键）；E1–E5 均未开工；旧路径 6 项走查仍未填表。
下一轮从哪开始：用户就决策 3 选 A（写新键，推荐）或 B（写旧键，需连带改旧页面）→ 写 `决策记录.md` **E-1** → 给 E1 开工说明。

### 2026-10-18 · E / 决策 3 拍板（E-1）+ E1 开工说明（未写代码）

做了什么：① 按交接协议先报告状态（E 未开工、只剩决策 3）；② 用户问「旧会话 / 新会话是什么意思」，逐项解释了两类记录（旧键 `chat_histories` 的 `{id,title,messages,uiMessages,timestamp}` vs 新键 `chat_histories_v2` 的 `{…,schemaVersion:2,mode,turns}`）、「续聊」这一混合场景，以及写旧键的三条代价；③ 用户拍板 **A：写新键、旧键只读**（原话「直接写新建吧，旧建自读」），并说明旧会话内容后期预计整体移除；④ 按「先文档后代码」把五个前置决策写成 `决策记录.md` **E-1**，回填 `E-开发指导.md` §2.1 决策 3 与 §2.4；⑤ 给出 E1 开工说明（复述 / 范围 / 3 个决策点），**未写任何 `src/` 代码**。

证据：源码事实复核（用于 E-1 的「验证证据」与 E1 范围）——`src/hooks/useChatHistory.js:4` 键名、`:7-10` 无 try/catch 的 `JSON.parse`、`:53-82` `autosave` 整条重写且无配额处理；`src/pages/ChatPage/ChatPage.jsx:556` `currentHistory.messages || []`；`src/utils/conversationState.js:585-609` `OPEN_CONVERSATION` 已把载入的 `streaming` 降级为 `interrupted` 并只挑 `modelMessages/parts/questions/error` 四个字段（E3 的「载入状态映射」在 C 层已有一半，E3 剩页面接线与保存点）；`src/hooks/useChatSession.js:275-291` `openConversation(record)` 读 `conversationId ?? id` / `mode` / `turns`。本轮无测试/构建运行（未改代码）。

没做完 / 卡在哪：**E1 未开工，等用户确认开工说明里的 3 个决策点**（storage 注入方式 / `loadAll` 与 `loadById` 返回形状 / 新键损坏时是否拒写）。另有一条不阻塞项：用户说旧会话后期会整体移除，E2 的 v1 适配深度已记入第 4 节待确认。

下一轮从哪开始：用户就 E1 三个决策点表态 → 新增 `src/utils/historyStore.js`（纯模块、storage 注入、六个函数、一律返结果不抛异常）→ `node --check` + `npx eslint src/utils/historyStore.js` + `npx eslint .` 对照基线 → 标 🔵 待验收。

### 2026-10-18 · E / E1 实施（🔵 待验收）

做了什么：用户就 E1 三个决策点表态「1A2同意3A」→ 新增 `src/utils/historyStore.js`：工厂 `createHistoryStore(storage)` 注入存储；六函数 `loadAll` / `loadById` / `listForSidebar` / `saveConversation` / `deleteConversation` / `renameConversation`；另导出 `deriveTitle` / `sanitizeConversation` / `STORE_REASONS` / `STORAGE_KEY_V1` / `STORAGE_KEY_V2` / `SCHEMA_VERSION` / `TITLE_MAX_LENGTH`。`saveConversation` 只写新键、整键损坏时拒写；删除/重命名同时作用于两键；写入前按协议 §5/§7 白名单剥离（函数、未知键、reasoning 片段、U+200B）；读坏数据跳过并计数、绝不写回。`决策记录.md` E-1 追加「补充」三条。

证据（原始命令与计数）：`node --check src/utils/historyStore.js` → exit 0；`npx eslint src/utils/historyStore.js` → 无输出；`npx eslint .` → **18 problems（15 errors, 3 warnings）＝基线**；`node --test "src/utils/__tests__/*.test.js"` → **tests 46 / pass 46 / fail 0**；`node --test "src/agent/__tests__/*.test.js"` → **45 / 45 / 0**；`node scripts/session-loop.mjs` → **判据 17/17 通过**；grep `localStorage|window.|React|import ... from 'react'` 在该文件 **0 命中**（注释里的字样也已改写，避免检查项被误读）；`npx vite build` → **✓ built in 34.17s**，`dist/assets/index-*.js 2,868.64 kB`（与 D8 一致，尚未被页面引用）。一次性离线冒烟（`D:/Temp/e1-smoke.mjs`）**44 passed / 0 failed**，覆盖：storage 不可用、整键损坏拒写且原文不动、条目级损坏跳过与保留、配额满 `reason:'quota'` 且无写入、脏字段与 U+200B 与 reasoning 与函数与 AbortController 剥离、标题 20 字、同 ID 两键取新键且旧键字节不变、v1 原样返回、删除两键、重命名空标题回退、列表倒序稳定、四条纯函数断言。脚本与构建日志已删除。

没做完 / 卡在哪：E1 标 **🔵 待验收**，用户未确认前不改 ✅；冒烟不可复跑（正式断言在 E4）；E2–E5 未开工；旧路径 6 项走查仍待用户填表（见第 5 节首条）。

下一轮从哪开始：用户验收 E1 → 标 ✅ → 给 E2（v1 只读适配）开工说明（投影规则、只读边界、旧键字节对比方法），仍不写代码等确认。

### 2026-10-18 · E / E1 验收通过（✅）+ E2 开工说明（未写代码）

做了什么：用户验收 E1（原话「验收完毕，继续吧」）→ 把第 2 节 E1 行标 ✅。随后为 E2（v1 只读适配）复核旧路径的存储形状，给出开工说明（复述 / 范围 / 三个决策点 / 判据拆分），**未写任何代码**。

证据（本轮复核的源码事实，供 E2 实施对照）：`src/utils/chatMessages.js:105-137` `createLinkedMessagePair` 产出 `{message:{id,role,content,status,error}, uiMessage:{id,sourceMessageId,role,content,status,error,retryable}}`；`:34-41` 非数组 content 被包成 `[{type:'response',value}]`；`src/components/MessageBubble/MessageBubble.jsx:96-172` 展示类型 `text/math/code/question/thinking/answer-card`，**未知类型走 default 按 markdown 渲染 `value`**；`src/pages/ChatPage/ChatPage.jsx:397-411` `answer-card.value={question,level,answer}` 且只 append 到 `uiMessages`；`:354-386` 一轮多题的作答摘要（模板「问题 N：…／回答：…」）**只进 `messages`、不进 `uiMessages`**；`src/pages/AgentChatPage/QuestionGroup.jsx:33-37` 只有 `state==='pending'` 才 `onOpen`，`onSkip` 无条件可点；`src/pages/AgentChatPage/questionAdapter.js:23` `optionsStatus==='unavailable'` 会把标签渲染成「可以点击回答」。上一轮 E1 的基线命令结果未变（本轮未跑）。

没做完 / 卡在哪：**E2 未开工，等用户就三个决策点表态**（只读问题块用文本片段还是复用问题卡并改 `QuestionGroup`；turn 以 `messages` 还是 `uiMessages` 为主线；投影函数放新文件 `historyV1.js` 还是塞进 `historyStore.js`）。E2 的「打开旧会话看显示 / 旧键字节对比」判据需要页面接线，已确认顺延到 E3。

下一轮从哪开始：用户表态 → 新增投影纯函数 + 一次性 Node 证据（打印一个旧记录投影出的 turns 结构、确认旧键字符串未变）→ `node --check` / `eslint` / 基线三条 / 标 🔵。

### 2026-10-18 · E / E2 实施（🔵 待验收）

做了什么：用户就 E2 三个决策点表态「投影成文本片段吧，如果有的话。2A3A」→ 新增 `src/utils/historyV1.js`：`projectV1Record(record)` 把 v1 `{id,title,timestamp,messages,uiMessages}` 投影成 `{id,title,timestamp,mode:null,turns}`；另导出 `answerCardToText` / `uiMessageToText` 供 E4 断言。规则：`messages` 主线切 turn（user 开轮、assistant 并入）、只在 messages 里的 user 消息认作答摘要（`source:'answer'`）、`uiMessages` 只取展示文本、答案卡摊平成文本片段、`thinking` 丢弃、失败轮保持 `interrupted` 不进上下文、前导欢迎语与孤儿 assistant 丢弃、确定性 turn id、全量剥离 U+200B。

证据（原始命令与计数）：`node --check src/utils/historyV1.js` exit 0；`npx eslint src/utils/historyV1.js` 无输出；`npx eslint .` → **18 problems（15 errors, 3 warnings）＝基线**；`node --test "src/utils/__tests__/*.test.js"` **46/46**、agent **45/45**、`node scripts/session-loop.mjs` **17/17**；`npx vite build` → **✓ built in 19.31s**，主包 2,868.64 kB（未被引用）。一次性离线冒烟 **34 passed / 0 failed**：3 轮结构（问答 / 摘要 / 失败）、第一轮 `parts` 3 段且含代码围栏与问题选项、答案卡文本含「问题/我的回答/档位」、摘要轮 `source:'answer'` 且 `questions` 为空、失败轮 `interrupted` 且 `modelMessages` 为空但正文可见、无 U+200B / reasoning 原文 / `[object Object]` / `example.invalid`、调用前后旧记录逐字节相同、两次投影一致、`messages` 缺失退回 uiMessages、尾部与孤立答案卡、空记录 `turns: []`。脚本与日志已删。

没做完 / 卡在哪：E2 标 **🔵 待验收**；`projectV1Record` 尚未被页面引用，浏览器判据（打开旧会话 / 旧键字节对比）顺延到 E3；E4 才建正式单测。E3–E5 未开工。

下一轮从哪开始：用户验收 E2 → 标 ✅ → 给 E3（恢复语义 + 保存接线）开工说明，仍不写代码等确认。

### 2026-10-18 · E / E2 验收通过（✅）+ E3 开工说明（未写代码）

做了什么：用户验收 E2（原话「验收通过」）→ 第 2 节 E2 行标 ✅。为 E3（恢复语义 + 保存接线）复核 `useChatSession` 与 `AgentChatPage` 的现有接口，给出开工说明（复述 / 范围 / 三个决策点 / 判据与证据计划），**未写任何代码**。

证据（本轮复核的源码事实，E3 实施前仍要复核）：`useChatSession.js:79-90` 接受 `conversationId` 初始值；`:194-211` `sendMessage` 自己保证 `current.conversationId ?? createId()`，页面**不需要**造会话 ID；`:293-306` `newConversation()` 换新 ID 并清空 turns；`:320-343` 返回 `conversationId` / `mode` / `turns` / `renderedTurns` 等只读数据与 9 个命令（无 setter）；`conversationState.js:586-609` `OPEN_CONVERSATION` 已把载入的 `streaming` 降为 `interrupted`、只挑四个字段；`:795-805` `deriveViewState` 只对 `awaiting_user` 派生 `pendingQuestions`。因此 E3 的「载入状态映射」「不自动重放」在 C 层已具备，页面只负责读、存、提示。

没做完 / 卡在哪：**E3 未开工，等用户就三个决策点表态**（启动时恢复哪条会话；保存时机用「保存签名变化」还是定时 debounce；失败与损坏提示放页面提示条还是复用错误区）。E3 的浏览器判据（刷新恢复待答问题、旧会话可打开且旧键字节不变、配额满提示、损坏提示）要在这一步一次性取。

下一轮从哪开始：用户表态 → 新增 `src/pages/AgentChatPage/useConversationHistory.js`（读写封装）+ 改 `AgentChatPage.jsx`（接线与提示条）+ `translation.json` 只加键 → 浏览器实测（刷新前后对比、旧键字节、配额满模拟）→ 标 🔵。

### 2026-10-18 · E / E3 实施（🔵 待验收）

做了什么：用户就 E3 三个决策点表态「一A二A三A」→ 新增 `src/pages/AgentChatPage/useConversationHistory.js`（`buildSaveSignature` 纯函数 + 载入/保存/提示），改 `AgentChatPage.jsx`（接 hook、三条可关闭提示条、「这一轮没有完成」提示、空态等 `ready`），两份翻译各加 `AgentChat.history` 8 键。载入＝最近一条 → `loadById` →（v1 先 `projectV1Record`）→ `openConversation`；保存＝签名变化才写（正文/思考增量不进签名）；失败与损坏各自一条提示。

证据（原始操作与结果）：静态 `npx eslint` 两个改动文件 exit 0、全量 **18 problems（15/3）＝基线**；`node --test "src/utils/__tests__/*.test.js"` 46/46、agent 45/45、`node scripts/session-loop.mjs` 17/17；`npx vite build` **✓ 11.78s**、主包 **2,886.49 kB**（较 E2 +17.85 kB）；键对齐 zh 204 / en 204、`AgentChat.history` 8/8。无头 Edge（`--browser=msedge`，`http://localhost:5174`，注入测试数据 + 假端点 `http://127.0.0.1:9`，**未使用任何真实密钥**）：① 注入 v2 待答会话 → 刷新 → 渲染用户/助手/`本轮 1 个问题`/问题卡；选「入门」→ 存储 2 轮、第一轮 `answered`（`answer:外层变量`、`level:basic`）、第二轮用户消息是协议 §6 模板；② 手改第二轮 `status='streaming'` → 刷新 → 「这一轮没有完成，上面是已经收到的内容；不会自动重发。」、`generating:false`、`performance` 非 localhost 资源 **0** 条、存储状态转 `interrupted`；③ v1 记录调新 → 刷新打开旧会话并渲染正文，连续两次续聊 → `chat_histories_v2` 出现同 ID `e3_legacy`（3 轮），`chat_histories` 前后**完整字符串相等**（450→450）；④ 再刷新打开的是 v2 那份（同 ID 取新键）；⑤ v2 写成 `[{"id":` → 刷新 → 「有 1 条历史数据读不出来，已跳过。」且回落旧会话；⑥ patch `Storage.prototype.setItem` 抛 `QuotaExceededError` → 发送 → 「本地存储空间已满…」提示出现、该轮只在内存、存储仍 3 轮；⑦ 点「新会话」→ 空态、记录数仍 2；⑧ 删 `agent_runtime` 刷新 → 旧路径标题/欢迎语/快速开始正常、两键长度不变；⑨ console 仅 4 条故意的 `TypeError: Failed to fetch`，无 React 警告/未捕获异常。`.playwright-cli/` 与构建日志已删。

没做完 / 卡在哪：E3 标 **🔵 待验收**；浏览器证据一次性、不可复跑（正式断言在 E4）；E4/E5 未开工；旧路径 6 项走查仍待用户填表。

下一轮从哪开始：用户验收 E3 → 标 ✅ → 给 E4（`src/utils/__tests__/historyStore.test.js` + `historyV1` / `buildSaveSignature` 用例）开工说明，仍不写代码等确认。

### 2026-10-18 · E / E3 验收通过（✅）+ E4 开工说明（未写代码）

做了什么：用户验收 E3（原话「验收」）→ 第 2 节 E3 行标 ✅。为 E4（测试）列出用例清单与唯一决策点，**未写任何代码**。

证据（本轮复核的技术前提）：`node -e "import('react')..."` → `useCallback: function`、`default: object`；`node -e "import('./src/pages/AgentChatPage/useConversationHistory.js')..."` → `buildSaveSignature: function`、`SAVE_FAILURE_KEYS` 4 键、`default: function`。即 **Node 可直接导入该 hook 模块取纯函数**，无需为测试抽文件（方案 A 可行）。现有测试风格：`node:test` + `node:assert/strict` + 内存 `fakeStorage`（`src/utils/__tests__/promptMigration.test.js:1-24`）。

没做完 / 卡在哪：**E4 未开工，等用户就「`buildSaveSignature` 测试落点」选 A（直接 import 页面 hook，推荐）或 B（抽出 `src/utils/historySignature.js`，要动已验收的 E3 文件）**。E5 未开工。

下一轮从哪开始：用户选 A/B → 新增 3 个测试文件（`historyStore.test.js` / `historyV1.test.js` / `historySignature.test.js`）→ `node --test "src/utils/__tests__/*.test.js"` 全绿且条数只增不减 → `npx eslint .` 对照 18 problems → 标 🔵。

### 2026-10-18 · E / E4 实施（🔵 待验收）

做了什么：用户选「A」（`buildSaveSignature` 测试直接 import 页面 hook）→ 新增三个纯函数测试文件：`historyStore.test.js`（25 条：不可用/空键、整键与条目级损坏、配额与非配额写失败、保存读取往返、标题 20 字、同 ID 合并与两键并存、v1 原样返回、旧键字节不变、侧栏排序、删除两键与损坏时不做半删、重命名 v2/v1、白名单剥离）、`historyV1.test.js`（16 条：三轮结构、欢迎语丢弃、片段顺序、答案卡摊平、thinking 不复活、modelMessages 纯文本、失败轮不进上下文、不搬 error、uiMessages 回退、尾部与孤立答案卡、空记录、确定性、只读、导出函数）、`historySignature.test.js`（11 条：稳定性与 id/轮数变化、流式正文与 reasoning 不变、工具卡与问题状态变化、运行结束与 error 变化、文案键映射）。**未改任何实现文件。**

证据（原始输出）：`node --test "src/utils/__tests__/*.test.js"` → **tests 98 / pass 98 / fail 0**（E3 前 46，本轮 +52）；`node --test "src/agent/__tests__/*.test.js"` → 45/45；`node scripts/session-loop.mjs` → 17/17；`npx eslint` 三个新文件 exit 0；`npx eslint .` → **18 problems（15 errors, 3 warnings）＝基线**；`npx vite build` → **✓ built in 17.67s**，`dist/assets/index-EluOkdAE.js 2,886.49 kB`（与 E3 同一 hash，测试不进产物）；三文件内无真实端点、无真实密钥（只有 `sk-should-not-be-stored` 假值）、无字面量 U+200B（用 `\u200B` 转义）。

没做完 / 卡在哪：E4 标 **🔵 待验收**；页面级载入/保存接线仍只有 E3 的一次性浏览器证据（E-4 遗留风险 1）；E5 未开工；旧路径 6 项走查仍待用户填表。

下一轮从哪开始：用户验收 E4 → 标 ✅ → 给 E5（历史列表界面）开工说明，仍不写代码等确认。

### 2026-10-18 · E / E4 验收通过（✅）+ E5 开工说明（未写代码）

做了什么：用户验收 E4（原话「验收」）→ 第 2 节 E4 行标 ✅。为 E5（历史列表界面）给出开工说明（复述 / 范围 / 三个决策点 / 判据与证据计划），**未写任何代码**。

证据（本轮复核的接口事实）：`useConversationHistory.js` 内部持有 `createHistoryStore(...)` 实例但不对外暴露（E5 若要在抽屉里调 `listForSidebar` / `deleteConversation` / `renameConversation`，需要扩这个 hook 或自建实例）；`AgentChatPage.jsx` 页头只有标题 + 「新会话」按钮，右侧抽屉可挂在 `<header>` 之后；`openConversation(record)` 读 `conversationId ?? id`、`mode`、`turns`；`session.conversationId` 可用于「当前会话高亮」。

没做完 / 卡在哪：**E5 未开工，等用户就三个决策点表态**（数据与命令从哪来；打开会话的入口；重命名与删除的交互）。E 阶段只剩 E5。

下一轮从哪开始：用户表态 → 新增 `HistoryDrawer.jsx` + 扩展 `useConversationHistory.js`（列表/删除/重命名/按 id 打开）+ 改 `AgentChatPage.jsx`（页头按钮、抽屉挂载、当前会话 id 传入）+ 两份翻译加键 → 浏览器实测四点判据 → 标 🔵。

### 2026-10-18 · E / E5 实施（🔵 待验收）

做了什么：用户选「1A 2A 3A」→ 新增 `HistoryDrawer.jsx`（右侧抽屉：标题+时间+当前高亮、打开/行内重命名/二次点击删除、Esc 与遮罩关闭）；扩展 `useConversationHistory`（`conversations` / `refreshConversations` / `openConversationById`（含签名占位）/ `removeConversation`（删当前会话自动换新）/ `renameConversation` + 列表与操作失败状态）；`AgentChatPage.jsx` 页头加「历史」按钮、挂载抽屉、把失败原因映射成文案；两份翻译各加 14 键。

证据（原始操作与结果）：静态 `npx eslint src/pages/AgentChatPage/` exit 0、全量 **18 problems（15/3）＝基线**；utils **98/98**、agent **45/45**、`session-loop.mjs` **17/17**；`npx vite build` **✓ 13.60s**、主包 **2,895.51 kB**（+9.02 kB）；键 zh 218 / en 218、`AgentChat.history` 22/22。无头 Edge（注入 3 条会话含同 ID 双键 + 假端点 `127.0.0.1:9`，无真实密钥）：① 抽屉 3 条、`e5_dup` 只出现一次且取新键标题、当前会话高亮；② 标题规则对 v2（首条 user 消息）与 v1（`messages` 首条）都生效；③ 打开 v1 会话内容正常，`chat_histories_v2` 的 id 未变、`chat_histories` 长度未变（签名占位，打开不回写）；④ 行内重命名写入 v1 并刷新列表，清空后回退「旧问题：什么是原型链？」；⑤ 双键会话两次点击删除后两键都搜不到、列表变 2 条；⑥ 删当前会话 → `chat_histories` 空、页面回空态；⑦ 打开待答会话 → 问题卡可用，作答后落盘 `answered`/`answer:'外层变量'`、共 2 轮（第二轮因假端点失败属预期），打开时 `timestamp` 未变；⑧ Esc 关闭；⑨ `resize 390×844` → `scrollWidth=clientWidth=390`、抽屉 320；⑩ console 仅 1 条故意的 `TypeError: Failed to fetch`，无 React 警告。`.playwright-cli/` 与构建日志已删。

没做完 / 卡在哪：E5 标 **🔵 待验收**；E 阶段收尾（阶段结论 + `F-开发指导.md`）未做；已知风险：运行中从抽屉切换会话会丢掉这一轮（E-5 遗留风险 1）；旧路径 6 项走查仍待用户填表。

下一轮从哪开始：用户验收 E5 → 标 ✅ → 写 E 阶段收尾结论（`决策记录.md` 新条目）+ 起草 `F-开发指导.md` → HANDOFF 切到 F。

### 2026-10-18 · 简历文案讨论（未改代码，进度不变）

做了什么：用户问「Agent 化之后简历怎么改写」。本轮只读源码取证（`runTeachingAgent.js`、`askQuestion.js`、`modelAdapter.js`、`conversationState.js`、`package.json`）并给出改写建议，**未改任何代码、未改任何已拍板结论**。

证据（可用于简历的事实来源）：`runTeachingAgent.js:24-31`（`MAX_STEPS=3`、主运行 120s、副模型并发 4）、`:152-158`（五个互斥结束原因）、`:219-226`（`askQuestionReady` 读最后一步 `toolResults` 的 `nextAction`）、`:267`（`stopWhen: [stepCountIs(3), askQuestionReady]`）；`askQuestion.js:44-58`（`jsonSchema` + `additionalProperties:false`）、`:69-98`（手写校验）、`:100-108`（程序生成问题 ID）、`:34-37`（四个拒绝 reason）；`conversationState.js:14-20`（`runId` 守卫 + 显式上下文组装）、`:714-727`（只纳入已完成轮次）。测试规模 utils 98 + agent 45 = 143，A3 端点探针 12 例。

没做完 / 卡在哪：简历文案属于用户对外材料，未落盘到仓库；E5 仍 🔵 待验收，F 阶段未开工。

下一轮从哪开始：用户验收 E5 → 标 ✅ → 写 E 阶段收尾结论（`决策记录.md` 新条目）+ 起草 `F-开发指导.md` → HANDOFF 切到 F。

### 2026-10-18 · E / E5 验收通过（✅）+ E 阶段收尾 + 起草 `F-开发指导.md`

做了什么：用户验收 E5（原话「验收完毕」）→ 第 2 节 E5 行标 ✅。按规则 2.4 做阶段收尾：① 把 E 阶段结论按模板写成 `决策记录.md` **E-6**（7 条结论 / 放弃方案 / 验证证据 / 8 条遗留风险）；② 按规则 2.3 起草 `F-开发指导.md`（目标、开工前准备含三个决策与已核对代码事实、F1–F4 分步、通过标准、不要做）；③ HANDOFF 阶段从 E 切到 F，第 1/2/3/4/5 节同步。**未写任何代码。**

证据（本轮复核的 F 阶段前提）：取消命令与页面按钮已存在（`useChatSession.js:183-191`、`AgentChatPage.jsx:324-333`）；重试命令已存在（`useChatSession.js:252-264`）但 `src/pages/AgentChatPage/` 里 `retryLastTurn` / `重试` **0 命中**（F2 只补展示层）；`conversationState.js:109-126` 的 `runId`+状态守卫负责丢弃迟到事件；基线仍为 utils 98/98、agent 45/45、`session-loop` 17/17、eslint 18 problems、主包 2,895.51 kB。本轮未跑测试（只改文档）。

没做完 / 卡在哪：**F 未开工，等用户审阅 `F-开发指导.md` 并拍板三个决策**（18 日投递版本要等 F4；开关去留排在投递之后；取消按钮位置待确认）。旧路径 6 项走查表仍未填（F4 必做）。

下一轮从哪开始：用户审阅通过 → 给 **F1（取消）** 开工说明；若用户先要改开发指导，按意见改完再开工。

### 2026-10-18 · F / 开发指导审阅通过 + 三个决策处置（未写代码）

做了什么：用户回复「按你的决策来吧」→ 视为审阅通过 `F-开发指导.md` 并采纳建议：① 取消按钮位置确认为「发送按钮位置」，不改；② 18 日投递版本后置到 F4 之后；③ `agent_runtime` 开关去留后置到投递之后（倾向 A）。把三条写成 `决策记录.md` **F-1**，HANDOFF 第 1/2/3/4 节同步，F 阶段标为已开工。**未写任何代码。**

证据：本轮只改文档（`决策记录.md`、`HANDOFF.md`），未跑测试与构建；上一轮基线仍有效（utils 98/98、agent 45/45、`session-loop` 17/17、eslint 18 problems、主包 2,895.51 kB）。

没做完 / 卡在哪：F1 未开工，等开工说明确认；投递版本与开关去留两个决策仍悬空（F4 结束 / 投递之后必须给结论）；旧路径 6 项走查表仍空（F4 必做）。

下一轮从哪开始：给 F1（取消）开工说明——复述 F1 判据、列范围（大概率只改测试/临时测量脚本，或只补证据不改实现）、标注「副模型中止怎么取证」这一个决策点，等用户确认后再动手。

### 2026-10-18 · F / F1 取消（🔵 待验收）

做了什么：用户就 F1 两个决策点回「1A 2B」→ ① 取证方式 A：在 `runTeachingAgent.test.js` 起本机临时 HTTP 端点（`127.0.0.1` + 运行时端口，慢速 SSE、不写 `[DONE]`），断言「副模型请求到达 → 取消 → 端点观察到连接关闭 → 无第二次请求」；② 运行中禁止切换 B：`HistoryDrawer` 加 `running` prop（提示条 + 禁用打开/删除当前会话）、页头「新会话」运行中禁用、`handleOpenConversation` 二次拦截，两份翻译各加 `AgentChat.history.runningHint` 1 键。③ 写用例时暴露并修掉一个真缺陷：取消时 `runModelTurn` 返回 `AbortError` → 会话层写进 `turn.error` → 页面出现「这一轮没有完成 / 运行已中断」错误块；改为 `endedBy === 'cancelled'` 时 `error: null`。

证据：`node --test "src/agent/__tests__/*.test.js"` → **47/47**（新增 2 条）；utils **98/98**、`session-loop` 17/17、`npx eslint .` **18 problems（15/3）＝基线**；`npx vite build` ✓ 14.68s、主包 2,896.23 kB（+0.72 kB）；键 zh 219 / en 219、`history` 23/23。无头 Edge + 本地慢速假端点 `127.0.0.1:5181`（注入假配置 `apiKey:'probe-test-key'`，无真实密钥）：取消后 `mainLen` 15→15（1.2s 不再增长）、页脚回「发送」、`hasErrorTitle=false` / `hasAbortText=false`；存储 `status:'cancelled'`、`error:null`；取消后立刻再发 → 服务端 `REQ 1 / CLOSED 1 / REQ 2`；运行中抽屉 `hint:true`、禁用按钮 2 个（打开 + 删除）、「新会话」disabled，取消后 0 个禁用；console 0 error / 0 warning。`.playwright-cli/`、`C:/Users/Public/f1-probe/`、构建临时文件已删。

没做完 / 卡在哪：F1 标 🔵 等验收；超时仍带 `AbortError`（message「运行已中断」），F3 需要 `endedBy` 透传或错误标记；浏览器证据一次性、不可 CI 复跑。

下一轮从哪开始：用户验收 F1 → 标 ✅ → 给 F2（重试最后一轮）开工说明，仍不写代码等确认。

### 2026-10-18 · F / F1 验收通过（✅）+ F2 开工说明（未写代码）

做了什么：用户验收 F1（原话「验收通过」）→ 第 2 节 F1 行标 ✅，第 1 节当前任务切到 F2，第 3 节下一步改成「F2 开工说明已给出，等确认」。随后为 F2（重试最后一轮）复核 `retryLastTurn` / `RETRY_LAST_TURN` / `deriveViewState` 的现状并给出开工说明，**未写任何代码**。

证据（本轮复核的源码事实）：`useChatSession.js:252-264` 的 `retryLastTurn` 只在「无最后一轮 / 正在运行 / 最后一轮没有 `userMessage.text`」时返回 null，其余情况换新 `runId`、用「之前已完成轮次 + 本轮用户消息」重建上下文再调 `startRun`；`conversationState.js:559-569` 的 `RETRY_LAST_TURN` 只改 `runId` / `status` / `error`（`error: null`），`parts` / `modelMessages` / `questions` 原样保留；`conversationState.js:817` 的 `canRetryLastTurn` 是 `Boolean(turn) && !isRunning`，**比 F2 需要的「最后一轮是 failed / cancelled / interrupted」宽**，页面要自己按 `turn.status` 再判；`AgentChatPage.jsx` 里 `retryLastTurn` / `重试` 仍 0 命中；`AgentChat.page` 现有 14 键（`errorTitle` 已写「可以重发一次」，但没有入口）。

没做完 / 卡在哪：**F2 未开工，等用户就开工说明里的三个决策点表态**（入口位置、重试时遗留的待答问题怎么处理、验收证据用假端点还是真实端点）。F3/F4 未开始；旧路径 6 项走查表仍空（F4 必做）。

下一轮从哪开始：用户表态 → 给页面加「重试」入口 + 「重新生成中…」文案（只改 `AgentChatPage.jsx` 与两份翻译）→ 浏览器实测四条判据 → 标 🔵。

### 2026-10-18 · F / F2 实施（🟡 差真实端点证据）

做了什么：用户就 F2 三个决策点 + 证据方式回「1 A / 2 同意 / 3 A / 4 B」→ 页面加「重试这一轮」内联入口（条件：最后一轮 `failed / cancelled / interrupted` 且不在运行中，页面自判 `turn.status`，未动 `deriveViewState.canRetryLastTurn`）；「重新生成中…」用派生值（`parts` 里存在旧 `runId`）；两份翻译各加 `retry` / `regenerating` 2 键。浏览器实测暴露两个缺陷并修掉：`projectTurns` 文本合并键缺 `runId`（片段 id 跨运行重复，实测都是 `0`）导致新旧正文被拼成一段；`MessageContent` 的 key 只用 `partId` 导致 React 重复 key 警告。新增 1 条回归用例。

证据：`node --test "src/utils/__tests__/*.test.js"` → **99/99**；agent 47/47；`session-loop` 17/17；`npx eslint .` → 18 problems（15/3）＝基线；`vite build` ✓ 11.84s、主包 **2,896.88 kB**；键 zh 221 / en 221。无头 Edge + 脚本化端点（`127.0.0.1:5182`，无真实密钥）：失败轮出现入口 → 同步连点两次只产生 1 次请求 →「重新生成中…」+ 旧新正文为两个 `<p>`、错误块消失 → 重试中点取消回到「发送」且入口重现 → 再重试成功（`completed` / `error:null` / 3 片段 3 runId）→ 落盘改 `streaming` 刷新出现「不会自动重发」+ 入口，重试成功；新会话 console 仅 1 条故意的 `ERR_INCOMPLETE_CHUNKED_ENCODING`（重复 key 警告已消失）。`partId` 探针结论：`r1 -> 0`、`r2 -> 0`。临时文件已删。

没做完 / 卡在哪：**决策 4 = 真实端点证据没做**——本轮没有临时密钥，脚本化端点证明不了真实工具链路里 `ask_question` 只出现一次；`决策记录.md` **F-3** 遗留风险 2（重试到 `awaiting_user` 后旧 `pending` 问题仍可作答）已记录，属新决策。

下一轮从哪开始：用户给一把临时测试密钥 → 跑一次「失败 → 重试」并数 `ask_question` / 工具卡 → F2 转 🔵 等验收 → 再给 F3 开工说明。

### 2026-10-18 · F / F2 补真实端点证据（🟡 → 🔵）

做了什么：用户给了一把临时测试密钥并定「3A 保留现状」→ 用本机转发代理（`127.0.0.1:5183`：第 1 次请求回 500，其余转发到 `https://api.deepseek.com`）在无头 Edge 里跑「失败 → 重试」，模型 `deepseek-flash`，主/副模型都指向代理；密钥只写进浏览器 localStorage。第一次跑出「零内容但 completed」，定位到代理把 `accept-encoding` 透传给上游、gzip 字节被当文本解析；转发前删掉该头后复跑成功。

证据：代理日志 `REQ 1 → SYNTHETIC_500`、`REQ 2 → UPSTREAM 200 text/event-stream`、三个候选答案请求均 200。失败轮 UI：`这一轮没有完成，可以重发一次。` + `synthetic failure for retry test` + `重试这一轮`；重试后该轮 `status:'awaiting_user'`、`error:null`，协议消息仅 `assistant` + `tool` 两条，**3 个 `ask_question` / 3 个结果 / 3 个唯一 `toolCallId` / 3 张 completed 卡 / 3 个问题**，`parts` 只有一个成功运行的 `runId`。本轮**未改任何 `src/` 文件**，临时代理与浏览器产物已删。

没做完 / 卡在哪：F2 标 🔵 等验收。3A 的已知后果（重试到 `awaiting_user` 后旧 `pending` 问题仍可作答）按用户决定保留，F4 不作为缺陷上报。

下一轮从哪开始：用户验收 F2 → 标 ✅ → 给 F3（错误映射）开工说明：`turn.error` 目前直显原文，超时是 `AbortError`（「运行已中断」）与取消同源，需要 `endedBy` 透传或可识别标记。

### 2026-10-18 · F / F2 验收通过（✅）+ F3 开工说明（未写代码）

做了什么：用户验收 F2（原话「验收完毕」）→ 第 2 节 F2 行标 ✅，第 1 节当前任务切到 F3，第 3 节下一步改成「F3 开工说明已给出，等确认」。随后复核 F3 的错误链路并给出开工说明，**未写任何代码**。

证据（本轮复核的源码事实）：`AgentChatPage.jsx` 的错误区（标题 + `TOOL_UNSUPPORTED_PATTERN` 建议行 + 原文行）仍在直接渲染 `turn.error`；`conversationState.js:153-158` 的 `toErrorText` 只取 `error.message`；`useChatSession.js:164-170` 派发 `RUN_FINISHED` 只带 `reason` / `responseMessages` / `error`；`runTeachingAgent.js` 的返回值里**有** `endedBy`（`finished | cancelled | timeout | failed`）但会话层没用；协议 §5 的 turn 只有 `error` 字符串，没有类别字段；`modelAdapter` 的超时与取消走同一个 `interrupt(new DOMException('运行已中断','AbortError'))`，取消已返回 `error:null`（F1），**超时仍带这句文案**。

没做完 / 卡在哪：**F3 未开工，等用户就开工说明里的三个决策点表态**（失败类别放在哪、错误原文是否保留、文案粒度）。F4 未开始；旧路径 6 项走查表仍空（F4 必做）。

下一轮从哪开始：用户表态 → 先按结论改 `01-核心协议.md` §5（若需新增字段）→ 运行层标记 + 会话层透传 + 页面分类文案 → 五类各触发一次取证 → 标 🔵。

### 2026-10-18 · F / F3 实施（🔵 待验收）

做了什么：用户回「确认」采纳 1A / 2A / 3A / 4A → 先改协议 §5（新增 `errorKind`），再让运行层在失败错误上打 `endedBy`、会话层透传并存成 `turn.errorKind`（取消一律 `null`，重试清空，落盘白名单只收 `timeout` / `failed`，签名含它）；分类逻辑抽成纯函数 `errorAdapter.classifyTurnError`（timeout → 工具不支持 → 网络 → 普通失败），页面错误区改成「标题 + 分类文案 + 原文」；新增 3 个文案键。

证据：`node --test "src/utils/__tests__/*.test.js"` → **108/108**（`errorMapping` 7 条 + `conversationState` / `historyStore` 各 1 条）；agent 47/47；`session-loop` 17/17；`npx eslint .` → 18 problems（15/3）＝基线；`vite build` ✓ 18.46s、主包 **2,898.70 kB**；键 zh 224 / en 224。无头 Edge + 本地端点：400 `tools is not supported…` → 建议句带端点与模型名；`127.0.0.1:9` → 「网络连接失败…」+ `Failed to fetch`；挂住端点**等满 120s** → 「请求超时…」、落盘 `failed`/`errorKind:'timeout'`、刷新后仍在；取消 → 无错误块、`errorKind:null`。console 仅故意的网络错误与 400，无 React 警告。临时产物全部删除。

没做完 / 卡在哪：F3 标 🔵 等验收；「工具不支持」仍是字符串粗判（真实 400 可能只有 `Bad Request`）；超时原文仍旧；副模型/保存失败未复测（落点未改动）。

下一轮从哪开始：用户验收 F3 → 标 ✅ → 给 F4 开工说明：旧路径 6 项走查表、主包体积归因（+166 kB）、两个投递决策。

### 2026-10-18 · F / F3 验收通过（✅）+ F4 开工说明（未写代码）

做了什么：用户验收 F3（原话「验收完毕」）→ 第 2 节 F3 行标 ✅，第 1 节当前任务切到 F4，第 3 节下一步改成「F4 开工说明已给出，等确认」。随后读 `AGENT_MVP_PLAN.md` §6 的 16 项验收清单与 `A-基线存档.md` §3 的旧路径 6 项走查表，给出 F4 开工说明，**未写任何代码**。

证据（本轮复核的事实）：清单 16 项里，多数已有可复用的证据来源（B6/B7/C3/D8/E3/E5/F1–F3）；缺口是三块——① 旧路径 6 项走查是 A2 阶段用户口述（且 `AnswerCard` / `QuestionCard` 在那之后各加过一个可选 prop，需要回归）；② 主包从 A2 的 2,732.6 kB 涨到 2,898.70 kB，**+166.1 kB 从未归因**；③ 18 日投递版本、`agent_runtime` 开关去留两个决策仍未定（`决策记录.md` **F-1**）。另外清单第 10 项「模式切换被禁用」在 D2 裁剪后没有用户可见控件，需要按「代码层已保证、界面不适用」记录。

没做完 / 卡在哪：**F4 未开工，等用户就开工说明里的三个决策点表态**（谁执行人工项、是否复用同一把临时密钥、一次跑完还是分批）。

下一轮从哪开始：用户表态 → 按 §6 逐项跑并填验收表 → 补旧路径 6 项与体积归因 → 写 `决策记录.md` F 阶段结论（含投递版本决定）→ 标 🔵。

### 2026-10-18 · F / F4 逐项验收（🔵 待验收）

做了什么：用户回「1A2A3A」（AI 执行人工项 / 复用临时密钥 / 一次跑完）→ 用无头 Edge + 真实端点 `deepseek-flash` 跑完总纲 §6 的 16 项，并补齐两笔旧账。新路径：两轮对话（第 1 轮 3 问、第 2 轮 2 问），三题分别用「选项 / 自定义 / 跳过」作答并自动续轮；刷新后恢复、无重放、配对与卫生检查全过。旧路径：`agent_runtime` 关闭后逐项重跑 6 项（普通发送、一轮多题、选项作答、自定义作答、切换历史、重试最后一条）。体积：临时 Vite 插件统计模块字节数并归因。产出 `F-验收记录.md` 与 `决策记录.md` **F-5**。

证据：`F-验收记录.md` 的 16 行表、旧路径 6 行表、体积表；`vite build` ✓ 19.03s / 2,898.70 kB；eslint 18（15/3）＝基线；utils 108/108、agent 47/47、`session-loop` 17/17。真实端点两轮 `calls/results` 3/3 与 2/2 逐 id 配对、`U+200B`/`sk-`/`apiKey`/`[object Object]` 全为 false、存储无 reasoning。旧路径 6 项全过；重试是悬停图标，点击后用户消息仍 1 条。体积：`src/` 480.0 kB、本项目新增 161.2 kB、旧路径 44.1 kB、node_modules 4,782.2 kB（渲染前）。

没做完 / 卡在哪：F4 标 🔵 等验收；**18 日投递版本待拍板**（建议默认开，未改 `App.jsx`）；两条文案问题（「（已回答）」语义、`AnswerCard.send` 键缺失）未修，已入档。

下一轮从哪开始：用户验收 F4 并拍板投递版本 → 若默认开：改 `App.jsx` 默认值、重跑 `vite build`、三种键值各抽查一次 → 再做 F 阶段收尾（`决策记录.md` 追加一段「投递决定」并切阶段）。

### 2026-10-18 · F / 投递决定落地（`agent_runtime` 默认开）

做了什么：用户回「我认为 Agent runtime 默认开」→ 按 F-1 第一档执行：改 `src/App.jsx` 的 `useAgentRuntime`，把「键为 `'true'` 才走新路径」改成「键不是 `'false'` 就走新路径」；写 `决策记录.md` **F-6**（结论 / 放弃的方案 / 证据 / 3 条遗留风险），同步 `F-验收记录.md` §5 与 HANDOFF 第 1–7 节。

证据：`npx eslint src/App.jsx` exit 0；`npx vite build` ✓ 20.10s、主包 `index-D8OghWUQ.js` 2,898.70 kB（与改动前同尺寸）；无头 Edge 三情况：**无键 → 新路径**、**`'false'` → 旧路径**（苏格拉底标题 + 欢迎语）、**`'true'` → 新路径**，再删键 → 仍新路径；页面无 `AgentChat.` 原文键名，console 0 error / 0 warning。临时产物已删。

没做完 / 卡在哪：F4 仍标 🔵 等验收（投递决定已落地，验收表本身未经用户确认）；F 阶段收尾（HANDOFF 标 F4 ✅、写明投递后的后续事项）未做。回退只能靠前端开关，不是服务端灰度。

下一轮从哪开始：用户验收 F4 → 按规则 2.4 做 F 阶段收尾（`决策记录.md` 追一段落地确认、HANDOFF 收尾、列出投递后事项：删旧路径 / 分包 / 两条文案问题）。

### 2026-10-18 · F / F4 验收通过 + F 阶段结项（A–F 全部完成）

做了什么：用户验收 F4（原话「验收完毕」）→ 第 2 节 F4 标 ✅，第 1 节改为「F 阶段已结项、无计划内任务」；`agent_runtime` 与投递版本两行改为最终值（默认开 / 新路径）；第 3 节把「下一步」换成投递后待办清单（删旧路径、两条文案问题、分包、模式控件与兜底入口、工具不支持改按错误类型判断）；第 4 节把开关去留标为「投递后待办」；`决策记录.md` **F-6** 追加「落地确认」。

证据：本轮只改文档（`决策记录.md`、`HANDOFF.md`），**未改任何 `src/`、脚本、依赖文件**；测试与构建沿用同一天的终局数据（utils 108/108、agent 47/47、`session-loop` 17/17、eslint 18 problems（15/3）、`vite build` ✓ 20.10s / 2,898.70 kB）。`git status` 中改动均为本期交付物与既有文档变动，无临时产物。

没做完 / 卡在哪：本期计划内任务全部结束。剩余都是**投递后待办**（见第 3 节第 2 条），不在本期范围；回退手段仍是前端开关，不是服务端灰度。

下一轮从哪开始：若继续这个项目，从「删旧路径」或「两条文案问题」里挑一条，按规则 2.2 先给开工说明；若只做投递，按 `F-验收记录.md` 与 `决策记录.md` **F-5 / F-6** 作为验收与投递依据。

### 2026-10-18 · 阶段提交（仓库清理 + Agent 架构主体 + 验证脚本）

做了什么：用户确认「开发已完成，做一个阶段性的提交」→ 先核对 `git status` 与 HANDOFF，确认工作区即 F4/F6 终局树；把 `scripts/*.output.json` 加进 `.gitignore`（内含端点与掩码密钥，不入库）；按关注点拆成三个提交（仓库清理 / 架构主体 / 验证脚本）。

证据：提交前 `node --test "src/utils/__tests__/*.test.js"` → 108 tests / 108 pass / 0 fail；`node --test "src/agent/__tests__/*.test.js"` → 47/47 pass。`git log --oneline -4` → `c489d88` / `5b7ed03` / `8b06bc8` / `3445f35`；`5b7ed03` 统计 40 files changed, 8663 insertions(+), 19 deletions(-)；提交后 `git status --short` 无输出。

没做完 / 卡在哪：无功能改动，未重跑 `vite build` 与全量 eslint（树未变，沿用 F4/F6 同日结果）。分支 `refactor/agent-architecture` 尚未合入 `main`（也无 PR）。

下一轮从哪开始：功能层面仍从投递后待办清单（第 3 节第 2 条）开始；若要先合主干，用远端提示的 PR 地址 `https://github.com/TownBoats/wenzhixuan-public/pull/new/refactor/agent-architecture` 或本地 merge。

### 2026-10-18 · push 远端

做了什么：用户要求推送到远端 → 执行 `git push -u origin refactor/agent-architecture`，远端新建同名分支并建立跟踪。

证据：`git status -sb` → `## refactor/agent-architecture...origin/refactor/agent-architecture`（无 ahead/behind）；远端返回 `* [new branch]` 与 PR 创建地址。

没做完 / 卡在哪：未创建 PR、未打 tag。

下一轮从哪开始：功能层面仍从投递后待办清单（第 3 节第 2 条）开始。

### 2026-10-18 · 合并进 main 并推送

做了什么：`git fetch` 确认 `main`（`bbd11f4`）是 `refactor/agent-architecture` 的祖先、`origin/main` 无新提交 → `git checkout main` + `git merge --ff-only refactor/agent-architecture`（快进，无合并提交）→ 复跑测试与构建 → `git push origin main`。

证据：`git status -sb` 合并后为 `## main...origin/main [ahead 4]`，推送后 `bbd11f4..c489d88  main -> main`，`git status --short` 无输出；`node --test` utils 108/108、agent 47/47；`npx vite build` 产物 `dist/assets/index-D8OghWUQ.js` 2,898,700 B（与 F6 同一 hash 与尺寸）。**快进同时带入 `3445f35`**，因此 `main` 上少了 `CLAUDE.md`、`bug-scenario-2026-05-06.md`、`bug-scenario-record-2026-05-02.md` 三个文件（该提交原本就在分支上，不是本轮新增删除）。

没做完 / 卡在哪：`origin/refactor/agent-architecture` 分支保留未删；未打 tag、未发布 release。

### 2026-10-18 · G / G-1 配置面板 + 移除「Agent 运行时」开关

做了什么：用户提出「把配置面板搞出来，同时把 Agent 运行时这个东西去掉」→ 先读 HANDOFF 与代码确认缺口（新页面只有「请到设置里」的横幅、没有入口；开关在 `App.jsx`；标题在 `AgentChat.page.title`），给三项决策（面板形态 / 开关范围 / 面板内容）→ 用户全选 A，第 3 项追加「我的个人信息（原来面板有）」→ 实施：新写 `ConfigPanel.jsx`（主模型 / 候选答案模型 / 个人信息，复用 `ModelConfigPanel` + `SettingsSection`）、页面加「设置」按钮并把配置从一次性 `useMemo` 改成可变快照、`App.jsx` 删开关、标题改「问知轩」、中英各加 8 键。

证据：eslint 改动文件 exit 0、全量 18 problems（15/3）＝基线；utils 108/108、agent 47/47、`session-loop` 17/17；`vite build` ✓ 13.31s、主包 2,795.23 kB（−103.47 kB，旧页面不再进包）；键 zh 78 / en 78。无头 Edge（5179，假 key）：页头 `问知轩/设置/历史/新会话`、全文无「运行时」、面板三段 + 8 输入框 + 两个个人信息链接、面板内填完横幅立刻消失、`enableThinking`/`thinkingBudget` 未被覆盖、ESC 关闭、刷新后仍已配置、390×844 无横向溢出、console 0 error / 0 warning。

没做完 / 卡在哪：G-1 标 🔵 等验收；未在真实端点下跑（假 key）；「测试连接」按钮未点；迁移提示文案（「旧路径的设置里」）与旧路径死代码两笔遗留已入第 5 节；本轮未提交 git。

下一轮从哪开始：等你验收 G-1 → 若通过，按第 3 节第 0 条顺序做「真端点走查 → 迁移提示文案 → 旧路径清理是否删」，再决定是否提交。

### 2026-10-18 · G / G-2 界面改版（Markdown / 工具卡 / 问题磁贴 / 版式）

做了什么：用户先要求 commit（G-1 落地为 `c6dd428`），再要求「设计一个好看的、优雅的界面，明天验收，包含问题卡片、工具卡片调用排列、markdown 渲染」→ 实施四个面：① 新增 `MarkdownContent.jsx`（react-markdown@10 + remark-gfm，代码块带语言标签与一键复制，compact 模式供磁贴题干）；② `ToolCallCard` 状态主题化 + running 进度条 + 折叠条去重 toolName + 展开区分区；③ `QuestionGroup` 弃用旧 `QuestionCard`，自绘编号磁贴 grid（整卡可点、跳过 stopPropagation、已答内联答案）；④ 页面版式（max-w-3xl、吸顶毛玻璃页头 + 品牌与副标题、空态 hero + 推荐词 chip、一体化输入容器、三点脉冲、错误区图标化）。随后按用户「先 commit」的惯例把 G-2 提交为 `8cf7f8b`（本地 main，未 push）。

证据：eslint 改动 5 文件 exit 0（修掉 `Icon size={13}` PropTypes 报错，全库清零）、全量 18 problems（15/3）＝基线；utils 108/108、agent 47/47、`session-loop` 17/17；`vite build` ✓ 13.65s、主包 2,806,491 B；键 zh 95 / en 95。无头 Edge + 注入 v2 演示数据（reasoning / markdown 全元素 / 两张工具卡两态 / 两待答 + 一已答磁贴 / 一失败轮）：逐项截图核对通过，390×844 无横向溢出，console 0 error / 0 warning（曾修复 1 条 PropTypes 报错）。

没做完 / 卡在哪：未在真实端点下跑；代码块无语法高亮；已答磁贴答案两行截断；`.playwright-cli/` 与 5179 dev server 清理命令两次审批超时（用户不在电脑前），进程与目录留存但均不入库；未 push。

下一轮从哪开始：等用户验收 G-2（明天）→ 通过后按第 3 节第 0 条顺序推进；若用户对视觉有意见，`git reset --soft HEAD~1` 可整体退回工作区再改。

### 2026-10-19 · G-2 迭代：工具卡直接显示问题 + 磁贴收紧

做了什么：用户反馈「工具卡只有『提问』+ 勾，信息量少、占空间；问题卡片希望更紧凑」→ ① `ToolCallCard` 折叠条主文本改为生成的问题（`output.question` → 回退 `input.question`，truncate + title 悬浮全文，「提问」标签只留展开详情）；② `QuestionGroup` 间距全面收紧（外层 p-3→p-2.5、gap-2.5→2、磁贴 p-3.5→3、头行 mb-2→1.5、底行 mt-3→2）。提交 `e3bcec3`（2 文件 +24/−9，本地 main，未 push）。

证据：eslint 两文件 exit 0；utils 108/108；无头 Edge（5179 复用昨日未关的 server，HMR 直接生效）：宽档工具卡显示「计数器里的 count 为什么不会被回收？ 已完成」单行、窄档省略号截断正常、磁贴间距明显收紧；console 0 error / 0 warning。走查后浏览器、server、`.playwright-cli/`、演示数据、截图全部清理（昨日遗留的一并处理）。

没做完 / 卡在哪：无。G-2 整体仍 🔵 待验收。

下一轮从哪开始：等用户验收。

---

### 2026-10-19 · G-2 迭代二/三：底色统一 → ChatGPT 式沉浸画布（亮底、无线、通栏页头）

做了什么：两轮用户反馈连续落地——①（迭代二，`ea5a443`）页头/输入区去掉浅色块与对话区统一底色；②（迭代三，`ef5c90a`，用户附 ChatGPT 截图参考）画布 `paper-100`→`paper-50` 调亮、页头与底部分隔线全删、页头改通栏（logo 贴左上、按钮贴右上，正文列仍 `max-w-3xl` 居中）、输入框改白色浮起胶囊（`bg-white`+`shadow-soft`，聚焦描边 sage）、亮画布上会隐形的卡片统一 `bg-white`（工具卡/待答磁贴/空态品牌块/推荐词 chip）、提示条 `bg-paper-100/50`。本地 main，未 push。

证据：eslint 改动文件 exit 0；utils 108/108；无头 Edge：计算样式 header=paper-50 且 borderBottomWidth=0、main/footer/输入容器透明继承或白色胶囊；1600 宽档截图确认页头通栏（logo 左上/按钮右上）、390 窄档无横向滚动；console 0 error / 0 warning。浏览器、dev server、`.playwright-cli/`、演示数据、截图全部清理。

没做完 / 卡在哪：无。G-2 整体仍 🔵 待验收。

下一轮从哪开始：等用户验收。

---

### 2026-10-18 · 结项后 / 阶段升级总结与离线复核

做了什么：按用户本轮要求阅读完整 `.agent/`，核对核心协议、相关决策与 F 验收记录，并追踪 `runTeachingAgent`、`modelAdapter`、`askQuestion`、`generateAnswerOptions`、`useChatSession`、`conversationState`、错误展示与历史存储的调用关系。总结重点为：从正文标签触发提问升级为工具协议驱动；运行层/会话层/展示层分离；主模型失败结束运行并提供手动重试，副模型业务失败降级为可手动作答；取消、运行身份隔离、上下文配对过滤与刷新不自动重放。

本轮实际复核命令与原始输出摘录（均退出码 0）：

```text
node --test "src/agent/__tests__/*.test.js" "src/utils/__tests__/*.test.js"
# tests 155
# suites 22
# pass 155
# fail 0
# cancelled 0
# skipped 0
# todo 0

node scripts/session-loop.mjs
判据：17/17 通过
```

核对的现有边界：副模型仍复用 `ContentParser` 解析档位标签；至少一档有效即可用；副模型服务的细分 `detail` 未透传至工具结果；端点不支持工具时只显示建议，不自动降级；重试后的旧 pending 问题按 F-3 保留。测试中的模拟 HTTP 500 会产生 SDK 错误日志，测试结果仍为 155/155；真实端点与浏览器证据沿用 `F-验收记录.md`，本轮未重新发起真实模型请求，也未重新运行构建或 lint。

没做完 / 卡在哪：本轮总结已完成，无新开发任务或待拍板项。A–F 验收状态不变，既有投递后事项继续保留。

下一轮从哪开始：以用户下一项明确需求为准；若继续开发，参照第 3 节的投递后待办及此前阶段提交记录。本轮仅更新交接记录。

### 2026-10-21 · Agent 机制源码梳理与图表组织（非开发验收）

做了什么：按用户要求核查运行时、工具调用、SDK 内循环与学生跨轮循环、上下文组织、文本/推理/工具参数获取及 UI 渲染，区分当前实现、历史决策与文档滞后。对话内给出三层架构图、双循环交互分步示意，并推荐各模块适合的图型、承载信息和组织顺序。

证据：`git status --short && git log -7 --format="%h %s"` 返回 exit 0、stderr 空，开始核查时 status 无输出；日志依次为 `b8d5852`、`f1259c2`、`afa3040`、`d2f3171`、`d3cf21f`、`555a1cf`、`74a2f3f`。关键源码：`runTeachingAgent.js:227-252,272-317`（三工具/停止判断/返回值）；`services/generateAnswerOptions.js:212-270`（有限副模型上下文、非流式 submit_options）；`modelAdapter.js:304-385,417-429`（增量事件/累积协议消息）；`useChatSession.js:54-68,114-176,226-276`（上下文/防双击/收尾/续轮/重试）；`conversationState.js:724-809,818-910`（配对过滤与投影）；`MessageContent.jsx:168-215` 与 `ExplainCard/srcDoc.js:18-30,53-107`（渲染分流与沙箱流式桥接）。以上为静态源码依据，本轮未执行测试/构建、未请求真实端点。

核心结论：一次 run 的工具调用闭环与学生作答后的下一 turn 是两种循环；ask_question 返回问题就绪而不是等待答案；visualize/explain_card 不触发等待学生；parts、modelMessages、questions 分工明确；有效历史只收 awaiting_user/completed，当前 user 由 hook 补入；reasoning 仅展示，模型上下文和持久化出口排除；UI 的参数预览不等于工具已完成。新副模型结构化输出及新增工具/事件尚未出现在既有协议和决策台账的对应位置，差异登记在第 5 节。

没做完 / 卡在哪：无业务半成品；本轮不宣称当前 HEAD 测试或端点验收通过。G-2 保持待验收；文档回填需用户同意，既有决策不擅自改写。

下一轮从哪开始：若继续学习，按本轮可视化顺序逐模块细化；若继续开发，先核对当前 HEAD 与 G-2 验收范围，再等用户确认，不自行进入下一开发任务。

### 2026-10-30 · Git / Agent 升级前版本保护（非开发验收）

做了什么：按用户要求查找 Agent 升级前提交。以 `5b7ed03 feat(agent): migrate chat to agent runtime architecture` 作为 Agent 架构主体提交，确认其直接父提交是 `8b06bc8`；创建本地保护分支 `archive/pre-agent-upgrade` 指向该提交。未切换当前工作分支，当前仍在 `dev`。

证据：`git status --short --branch` → `## dev...origin/dev`；`git --no-pager show --no-patch --pretty="format:%H%n%P%n%s" 5b7ed03` → 父提交 `8b06bc877fe446d777e2890f116cfbced467a0e0`；`git --no-pager show --stat --oneline 8b06bc8` → 仅 `.gitignore` 与过期文档清理；`git branch archive/pre-agent-upgrade 8b06bc8` 后 `git show archive/pre-agent-upgrade` → `8b06bc8 chore: drop outdated process docs and ignore local-only dirs`。

没做完 / 卡在哪：保护分支只在本地，未 push 到远端；若用户要远端留存，下一步执行 `git push origin archive/pre-agent-upgrade`。本轮未跑测试/构建，未改任何 `src/`。

下一轮从哪开始：若继续开发，仍回到 **G-2 验收**；若继续保护版本，先确认是否推送 `archive/pre-agent-upgrade` 到远端，或是否还要另建一个指向升级工作包开始前更早节点的分支。

### 2026-10-30 · Git / 推送升级前保护分支到远端（非开发验收）

做了什么：按用户指令执行 `git push origin archive/pre-agent-upgrade`，把本地保护分支推送到远端 `origin`。推送前后未切换当前分支，当前仍在 `dev`。

证据：推送前 `git --no-pager branch --list archive/pre-agent-upgrade --verbose` → `archive/pre-agent-upgrade 8b06bc8 chore: drop outdated process docs and ignore local-only dirs`；`git push origin archive/pre-agent-upgrade` exit 0，输出 `* [new branch] archive/pre-agent-upgrade -> archive/pre-agent-upgrade`；`git ls-remote --heads origin archive/pre-agent-upgrade` → `8b06bc877fe446d777e2890f116cfbced467a0e0 refs/heads/archive/pre-agent-upgrade`；`git status --short --branch` → `## dev...origin/dev`。

没做完 / 卡在哪：无业务半成品；本轮未跑测试/构建，未改任何 `src/`。保护分支已本地与远端双份存在。

下一轮从哪开始：若继续开发，仍回到 **G-2 验收**；若继续版本保护，可讨论是否还要另建「升级工作包清理提交之前」的更早快照分支。

### 2026-10-30 · 进度查询（非开发验收）

做了什么：读取 HANDOFF 并汇总当前进度；按交接规则更新第 1–7 节。未推进开发、验收或技术决策。

证据：`docs/agent-mvp/HANDOFF.md` 第 1 节显示当前阶段为 G、当前任务为 G-2 🔵 待验收；第 2 节显示 A/B/C/D/E/F 全部 ✅，G-1/G-2 为 🔵；第 3 节显示下一步仍从 G-2 验收开始。

没做完 / 卡在哪：无业务半成品；本轮未跑测试/构建、未改 `src/`。G-2 等用户验收。

下一轮从哪开始：若继续开发，先做 **G-2 验收**；第一步检查 Markdown 渲染、工具卡折叠/展开、问题磁贴和页面版式。

### 2026-10-30 · G-2 验收复核（部分通过 / 环境阻塞）

做了什么：按用户指令复核 G-2。先核对 HANDOFF 与 `决策记录.md` G-2，然后跑自动命令；因本地 `node_modules` 缺失传递依赖，尝试按锁文件修复但被 safe-delete 守卫拦截；随后用现有 `dist/` 起静态服务并通过无头 Edge 注入 v2 演示数据做 UI 走查。

证据：`node scripts/session-loop.mjs` → **17/17 通过**；浏览器静态走查：页头 `问知轩 / 提问带动理解`、Markdown 标题/加粗/列表/表格/引用/行内代码可见、通用工具卡折叠条显示问题原文且展开区含「工具 / 输入的问题 / 生成的问题 / 候选答案 2 条」、问题磁贴三态（待作答/手动作答/已回答）与作答浮层正常、错误区与「重试这一轮」可见、390px `scrollWidth=clientWidth=390`、console 0 error / 0 warning（仅 prompts.js 普通 log）。`git status --short --branch` 结束时仍为 `## dev...origin/dev`。

没做完 / 卡在哪：自动复验未通过环境门槛：`node --test ...` 报缺 `ai` / `react`，`npx eslint ...` 报缺 `debug`，`npx vite build` 报缺 `picomatch`；`pnpm install --frozen-lockfile` 报 `UNKNOWN ... cookie/package.json`，`pnpm install --force --frozen-lockfile` 报 `SAFE_DELETE_BULK_CONFIRM_REQUIRED`。未改 `src/`；G-2 因命令证据不完整仍保持 🔵 待验收。

下一轮从哪开始：用户在自带终端清理并重装依赖（建议删除 `node_modules` 后 `pnpm install --frozen-lockfile`），再复跑 `node --test "src/agent/__tests__/*.test.js" "src/utils/__tests__/*.test.js"`、`node scripts/session-loop.mjs`、G-2 改动文件 eslint、`npx vite build`；若全部通过，再由用户确认是否把 G-2 标 ✅。

### 2026-11-01 · 当前阶段完成情况查询（非开发验收）

做了什么：核对 HANDOFF 第 1–5 节、10-30 最后验收日志、Git 最近提交及 App 入口，回答当前计划完成情况。原计划 A–F 已全部验收；当前 G 阶段的 G-1/G-2 已实施但仍标 🔵。

证据：HEAD `347a6a4`；`src/App.jsx` 直接渲染 AgentChatPage；HANDOFF 阶段表 G1/G2 两行均 🔵；10-30 日志记录静态 dist 浏览器走查通过，但自动测试/lint/build 因缺依赖未完成。本轮未跑验证、未请求端点、未改源码，不宣称当前 HEAD 验证通过。

没做完 / 下一步：G-2 尚未结项；先核对依赖恢复并补齐自动验证，再完成用户验收。仅更新交接，既有未决项保持。

### 2026-11-01 · 基线试跑（依赖未装，仅记录现状）

做了什么：用户在自带终端执行 `node --test "src/agent/__tests__/*.test.js" "src/utils/__tests__/*.test.js"` 与 `node scripts/session-loop.mjs`；本轮未重装依赖，因此结果不是 G-2 验收证据，只是现状记录。

证据：测试汇总 `tests 118 / pass 110 / fail 8 / suites 18`。8 个失败文件全部是 `ERR_MODULE_NOT_FOUND`：`askQuestion.test.js`、`explainCard.test.js`、`generateAnswerOptions.test.js`、`runTeachingAgent.test.js`、`visualize.test.js`（缺 `ai`）、`answerInteraction.test.js`、`historySignature.test.js`、`useChatSession.test.js`（缺 `react`）。`session-loop.mjs` 输出 `判据：17/17 通过`。eslint 与 `vite build` 本轮未跑。

没做完 / 卡在哪：`ai` / `react` 仍解析不到（此前诊断为顶层 junction 无法遍历，node_modules 为半成品）。需用户在自带终端执行 `cmd /c rmdir /s /q node_modules` 后 `pnpm install --frozen-lockfile`，再重跑四条基线命令。

### 2026-11-01 · G-2 用户人工验收（✅）

做了什么：用户原话「我人工验收了」，据此把 **G-2** 从 🔵 改为 ✅，并把「自动基线未复跑」登记为待补证据；同时明确 G-1 仍为 🔵（用户未表态）。

证据：用户口述验收，无新增命令输出。可引用的历史证据仍是 10-30 的浏览器静态走查（页头 / Markdown / 工具卡两态 / 问题磁贴三态 / 错误区与重试 / 390px 无溢出 / console 0 error + 0 warning）与 11-01 的 `session-loop.mjs` 17/17。本轮 HEAD 的 `node --test`、`eslint`、`vite build` 仍未复跑：`ai` / `react` 解析失败（8 个测试文件受阻，汇总 118 tests / 110 pass / 8 fail）。

没做完 / 卡在哪：G-2 已验收但缺自动命令证据；依赖布局问题未解决（`pnpm install` 仍报 `UNKNOWN ... node_modules\ai\package.json`）。G-1 验收状态待用户确认。

下一轮从哪开始：先定依赖方案（独立终端重装 / `--config.node-linker=hoisted`），装好后复跑四条基线并回填第 2 节 G2 行；再确认 G-1，然后做 G 阶段收尾。

### 2026-11-01 · 查询 G-1 验收标准（非开发）

做了什么：按用户提问，从 `决策记录.md` **G-1**（结论 5 条 + 验证证据 4 组 + 遗留风险 5 条）整理出可人工执行的验收清单，并提示 G-1 的界面形态项写在 G-2 改版之前，人工验收应以「设置入口存在 / 面板三段可用 / 保存即生效 / 无运行时字样」为准。未改代码、未改决策。

证据：`决策记录.md:1159-1206`（G-1 全文）。本轮未跑任何命令。

没做完 / 卡在哪：G-1 仍是 🔵，等用户按清单表态。

下一轮从哪开始：用户给出 G-1 结论后改状态；依赖未修复前，自动项（eslint / 测试 / build / 键对齐）仍无法在会话内复跑。

### 2026-11-01 · G-1 用户验收 + G 阶段收尾（✅）

做了什么：用户原话「ok，验收完毕」，据此把 **G-1** 从 🔵 改为 ✅；按 README 2.4 在 `决策记录.md` 追加「G 阶段收尾（2026-11-01）」段（问题 / 选项 / 结论 / 原因 / 放弃方案 / 验证证据 / 7 条遗留风险），并把 HANDOFF 第 1、3 节切到「G 已收尾、无进行中任务」。

证据：用户口述验收，无新增命令输出。可引用证据＝`决策记录.md` G-1 的 2026-10-18 自动项（eslint 18 problems 基线、utils 108/108、agent 47/47、`session-loop` 17/17、`vite build` 2,795.23 kB、键 78/78 + 11/11）与无头 Edge 走查；G-2 同源证据见其条目。本轮 HEAD 的自动基线**仍未复跑**（`ai` / `react` 解析失败）。

没做完 / 卡在哪：两处遗留——① 依赖布局（junction 无法遍历）未解决，自动基线仍是 10-18 数据；② G-1 从未在真实端点下验证（假 key）。两项已写进 `决策记录.md` G 阶段收尾的遗留风险 1、2。

下一轮从哪开始：用户选依赖路线（独立终端重装 / `--config.node-linker=hoisted`）→ 复跑四条基线并回填 → 再做投递后待办第 1 项（真端点走查配置面板）。

### 2026-11-01 · 阶段代码量统计（非开发，供用户做总结）

做了什么：按用户要求用 git 实测各阶段代码量与文件数，未改任何源码。

证据（原始命令与数字）：

- `git diff --shortstat c489d88 ef5c90a`（＝G 阶段：`c6dd428` G-1 + `8cf7f8b` G-2 + `e3bcec3`/`ea5a443`/`ef5c90a` 三次迭代）→ **9 files changed, 986 insertions(+), 216 deletions(-)**。逐文件：`ConfigPanel.jsx` +149（新）、`MarkdownContent.jsx` +198（新）、`AgentChatPage.jsx` +267/−111、`QuestionGroup.jsx` +163/−27、`ToolCallCard.jsx` +119/−42、`MessageContent.jsx` +28/−16、`App.jsx` +4/−16、`locales/zh|en/translation.json` 各 +29/−2。
- `git diff --shortstat 8b06bc8 c489d88`（＝A–F 主体）→ **43 files, +9871 / −19**。
- `git diff --shortstat ef5c90a 347a6a4`（＝G 之后：visualize / explain_card / 副模型结构化输出等）→ **35 files, +2745 / −232**。
- `git diff --shortstat 8b06bc8 347a6a4`（全程净变化）→ **63 files, +13210 / −75**；`git rev-list --count 8b06bc8..347a6a4` → **16 commits**。
- 当前工作树：`src` 下 JS/JSX **111 文件 / 20,846 行**（`src/components` 51 文件 7,131 行、`src/utils` 20 文件 5,430 行、`src/pages` 11 文件 3,403 行、`src/agent` 14 文件 3,161 行 + 2 份 `.md` 教学指令、`src/hooks` 8 文件 1,068 行）；`git ls-files` 计测试文件 16 个、`scripts/*.mjs` 3 个；当前测试套件 **118 条**（11-01 实跑 110 通过 / 8 因依赖未加载失败）。

没做完 / 卡在哪：无开发动作；统计不含 `docs/`（在 `.gitignore` 里，仅本地）与 `node_modules`。自动基线仍未复跑，测试数字同上一轮。

下一轮从哪开始：不变——先修依赖布局，再做投递后待办第 1 项。

### 2026-11-01 · A→G 整体代码量统计（非开发）

做了什么：用户澄清要的是整个 Agent 升级（A–G）的统计，补跑按目录聚合与新增/修改文件计数；未改源码。

证据：

- `git diff --numstat 8b06bc8 347a6a4`（63 文件）→ **+13,210 / −75**；`--diff-filter=A|M|D` → **新增 51 / 修改 12 / 删除 0**。
- 分层（文件数 / 新增行）：运行层 `src/agent`（不含测试）**10 / 1,938**（modelAdapter 458、tools 571、runTeachingAgent 321、services 273、skills 169、modes 125、modePrompts 21）；运行层测试 **6 / 1,378**；会话层（useChatSession 359 + conversationState 915）**2 / 1,274**；存储层（historyStore 667 + historyV1 366）**2 / 1,033**；页面层 `AgentChatPage` **7 / 1,760**；展示组件（MessageContent 439 + VisualizeCard 379 + ExplainCard 306 + ToolCallCard 282）**7 / 1,406**；共用组件兼容改动（AnswerCard/QuestionCard/ModelConfigPanel/SettingsPanel）**4 / 194**；utils 测试 **10 / 2,540**；验证脚本 **3 / 1,208**；文案 zh|en **2 / 280**；杂项（partialJsonField 71、promptMigration 52、answerPreferences 14、ConfigManager 6、prompts.js 11、tailwind.config 7、App.jsx 5、package.json 1、pnpm-lock 31、ChatPage 1）**10 / 199**。
- 测试合计 **16 文件 / 3,918 行 ≈ 新增代码的 30%**；升级新增的 src 代码约 **11,963 行**（13,210 扣除 scripts 1,208、lock 31、package.json 1、tailwind.config 7），约占当前 `src` 总量（111 文件 / 20,846 行）的 **57%**。
- 阶段切分：A–F 主体 2 提交 43 文件 +9,871/−19；G 阶段 5 提交 9 文件 +986/−216；G 后迭代 9 提交 35 文件 +2,745/−232。全程 16 提交，git 提交日期 2026-10-18 → 2026-10-29。

没做完 / 卡在哪：无开发动作。统计不含 `docs/`（仅本地、被 `.gitignore` 排除）与 `node_modules`；行数是净 diff，不是累计敲击量。

下一轮从哪开始：不变——先修依赖布局，再做投递后待办第 1 项。

### 2026-11-01 · 依赖安装排障（环境问题，非开发验收）

做了什么：用户在自己终端跑 `pnpm install --frozen-lockfile`，输出 `Packages: +508`（reused 508、added 0）后以 `UNKNOWN UNKNOWN: unknown error, open 'D:\...\node_modules\ai\package.json'` 失败；同时提示 `Ignored build scripts: esbuild`。本轮做只读诊断定位根因，未改 `src/`、未改 `package.json` / `pnpm-lock.yaml`。

证据：① `node_modules` 处于半成品状态——顶层 43 项、`.pnpm` 509 个目录；② 顶层 32 个 junction 全部读不到（`Test-Path node_modules\<pkg>\package.json` → OK=0 / BAD=32，含 `ai`、`react`、`vite`、`eslint`）；③ junction 目标本身完好：`.pnpm\react@18.3.1\node_modules\react\package.json`、`.pnpm\ai@6.0.177_zod@4.4.3\node_modules\ai\package.json` 均可读；④ `fsutil reparsepoint query node_modules\react` → Tag `0xa0000003`、Substitute Name 指向正确路径；⑤ 现场复现：`mklink /J D:\Temp\j1 D:\Temp\t1` 成功，`type D:\Temp\j1\a.txt` 报 `The path cannot be traversed because it contains an untrusted mount point.`，工作区根 `jlink` 与 `.jtest\link` 同样失败；⑥ `Get-Volume -DriveLetter D` → NTFS / Fixed / Healthy，`fsutil behavior query SymlinkEvaluation` → L2L ENABLED、R2L/R2R DISABLED（后两项默认即如此，不是异常）。

没做完 / 卡在哪：依赖仍未装好，G-2 的自动复验仍做不了。未能定论「junction 遍历失败」是机器级还是本会话沙箱造成——本会话的 `rmdir` 被 `[safe-delete]` 守卫拦截，说明存在文件系统守卫层。已向用户给出两条路线：A 删 `node_modules` 后重跑 `pnpm install --frozen-lockfile`；B 若无改善改用 `pnpm install --frozen-lockfile --config.node-linker=hoisted`（不建 junction，两个依赖文件不动）。临时目录（`.jtest`、`jlink`、`D:\Temp\j1|t1|jtest_link`）已清理。

下一轮从哪开始：先拿用户侧 `mklink /J` 复测结果判定路线；依赖装好后按顺序复跑 `node --test "src/agent/__tests__/*.test.js" "src/utils/__tests__/*.test.js"`、`node scripts/session-loop.mjs`、`npx eslint .`（期望 18 problems = 15 错误 / 3 警告）、`npx vite build`，再回到 **G-2 验收**。

### 2026-11-01 · 阶段提交前清理梳理（方案交付，未实施）

做了什么：按用户要求核查 Git 提交边界、开发规则与文档组织，以及旧路径/共享组件/历史兼容的静态引用关系。形成清单：先归档阶段规则和长交接、提炼短规则/短交接并同步现行协议，再单独处理旧实现与文案清理。

证据：HEAD 347a6a4，dev 与 origin/dev 同步；main 为 ef5c90a，main..dev 共 9 提交、35 文件 +2745/-232。工作区只有两份已跟踪设计文档删除（REDESIGN_KARE.md 与 REDESIGN_KARE_FEASIBILITY.md，合计 725 行），暂存区为空。git ls-files docs .codebuddy .agent 仅返回该两份设计文档，说明其余阶段资料和规则未随代码入库；.gitignore 忽略 docs/.agent/.codebuddy。两个 agent-mvp/RULE.mdc 均为 247 行相同正文、声明 alwaysApply，旧阶段串行流程及白名单仍可能继续生效。

源码证据与清理边界：App 只接 AgentChatPage 和 /design；旧 ChatPage、useStreaming/useChatHistory/useAgentsConfig/useQuestionFlow/useDeveloperMode/useRequestLogger、lib/agents/AgentModel、StreamingParser/ContentParser/chatMessages 及其专用旧 UI 为删除候选。AnswerCard/MarkdownRenderer/ModelConfigPanel/ConfigManager、SettingsSection/AnswerWaitSettings、useMediaQuery/answerPreferences 被当前新路径使用；historyV1/v1 存储与旧配置键继续有效。ui-review 和 /design 是有效开发入口，闲置 LandingPage 另行判断。migrationNotice 仍描述无入口旧设置、AnswerCard.send 缺翻译键；核心协议尚未涵盖三工具、参数流式事件及副模型 submit_options 方案。根 README 包管理说明、失效 CLAUDE.md 引用、UI README 中两份被删除设计文档链接待修正。

没做完 / 卡在哪：本轮仅交付方案，未实施归档、替换规则或删除代码；未运行测试、lint、构建，也未对依赖故障原因追加推断。上轮将 118 当全部测试用例数、将新增行数比例称为业务重写比例均不严谨，后续阶段总结应分别记录测试文件加载失败与新增/删除/净增行数。

下一轮从哪开始：按确认的清理范围，先归档旧 HANDOFF/规则并建立短入口（保留 .codebuddy），补齐现行架构/协议与遗留事项；选择性跟踪共享规则/文档，核对两份设计文档既有删除，再形成阶段收尾提交。旧代码删除作为独立批次验证与提交；不自动合并 main 或推送。

## 结束一轮对话前的更新清单

给 AI 的固定指令，可直接复制：

```
结束前请更新 docs/agent-mvp/HANDOFF.md：
1. 第 1 节当前状态；
2. 第 2 节任务状态和证据位置；
3. 第 3 节下一步（具体到任务编号和第一个动作）；
4. 第 4 节：新出现的待决策项加进来，已拍板的移到决策记录.md；
5. 第 5 节未收尾事项；
6. 第 6 节本轮改动的文件；
7. 第 7 节追加一条会话日志。
只写事实和证据位置，不写"应该已经可以"之类的推测。
```
