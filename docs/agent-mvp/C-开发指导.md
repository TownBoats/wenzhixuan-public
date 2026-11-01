# 阶段 C 开发指导：会话状态层

> 详细理由、决策点与监督办法见 `C-会话状态层.md`；数据结构与协议以 `01-核心协议.md` 为唯一事实源。本文件是可直接照做的简版操作步骤。

**目标**：把「谁在什么时候改状态」从页面收回到一个地方。产出一个**纯函数状态机**（`src/utils/conversationState.js`）+ 一个**只发命令的 hook**（`src/hooks/useChatSession.js`），并在 Node 里用假运行层跑通「发送 → 待答 → 作答 → 新一轮」。

预计 2.5 小时。本阶段**只写 `src/utils/`、`src/hooks/`、`src/utils/__tests__/`、`scripts/session-loop.mjs`**：不碰页面、不碰 `src/agent/`、不碰 localStorage。

---

## 开工前准备（约 15 分钟）

### 1. 先定四件事（`C-会话状态层.md` 第 3 节 + 一处与 B-3 的冲突，AI 不得自行拍板）

| 编号 | 要定什么 | 卡住哪个任务 | AI 倾向（仅供参考） |
| --- | --- | --- | --- |
| 决策 1 | 作答后是否**自动**开始下一轮 | C1 / C2 | ✅ 文档倾向 A：自动开始，但必须从「effect 观察」改成「命令内原子转换」（C 文档 2.4） |
| 决策 2 | 「跳过问题」的语义 | C1 / C2 | ✅ 文档倾向 A：把跳过记成一条真实回答（如「我暂时不想回答这个问题」）并进入下一轮；跳过按钮本身可裁剪 |
| 决策 3 | 失败重试的**语义**（入口位置留给 D/F） | C2 | 只允许重试**最后一轮**；重试期间保留原内容、显示「重新生成中」，不清空 |
| 决策 4 | **`pendingQuestion` 是单个还是问题组**（C 文档写单数，但 `决策记录.md` **B-3** 已改为一轮多个问题） | C1 / C2 / D4 | 改成 `pendingQuestions`（数组）或「本轮问题组」；界面按 `questions.length` 渲染，与 B-3 的 D4 判据一致 |

拍板后由 AI 追加到 `决策记录.md`（C-1 起编号），并从 `HANDOFF.md` 第 4 节移除。

### 2. 带着 B 阶段的五条结论开工（`决策记录.md` B-12 ~ B-15，不得推翻）

1. **运行层已经有唯一入口**：`runTeachingAgent({ conversationId, turnId, runId, mode, config, messages, optionConfig, optionSystemPrompt, abortSignal, onEvent })`。**三个 ID 由会话层分配**（B-12），事件已带 `runId`，会话层只做归属过滤。
2. **结束原因是五选一**：`completed | awaiting_user | failed | cancelled | limit_reached`（不可合并）。`awaiting_user` 才进入待答状态，其余按语义收尾。
3. **`responseMessages` 只能取运行层返回值**（B1 的 `sanitizeMessages` 已清 U+200B、已丢弃空文本块）。**不要自己拼协议消息**。
4. **测试注入口 `model` / `generateOptions` 只给测试**（B-13）：C3/C4 若要驱动真实运行层，可以传；接页面（D）时绝不能传。
5. **真实端点已闭环一次**（B-15，`scripts/socratic-once.output.json`）：一轮 3 个问题各 5 档、`stepCount=1`、3 个调用全配对。C 阶段要在此基础上补「答案如何进上下文」。

### 3. 环境与基线

- 测试口径（已实测）：`node --test "src/agent/__tests__/*.test.js"`、`node --test "src/utils/__tests__/*.test.js"`；**`node --test <目录>` 在本机不可用**。
- 对照基线：`npx eslint .` 目前 **15 错误 / 3 警告**（18 problems）；`vite build` 通过。本阶段收尾时**改动文件必须干净、全量错误数不得增加**。
- 现有测试基线：**45 tests / 45 pass**（B2 9 + B3 11 + B4 15 + B6 10）。C3 新增用例后总数应上升，既有用例不得变红。
- 固定的交付格式（每完成一个任务编号）：改动文件清单 → 逐条判据自检 → 协议不变量 1–8 自检 → 可直接复制的命令与原始输出 → 更新 `HANDOFF.md`。
- **分层硬约束**：`conversationState.js` 必须是纯函数（不 import React、不碰 localStorage、不产生随机 ID——ID 由 hook 生成后作为 action 字段传入）。

---

## 分步操作

### 第 1 步：C1 · `src/utils/conversationState.js`（纯函数状态机）

**做法要点**

- 四个导出：`reduceSession(state, action)`、`buildModelContext(turns)`、`projectTurns(turns)`、`deriveViewState(state)`。
- `runId` 守卫写在**每个运行事件**的最前面：不匹配就 `return state`（返回原状态，不报错、不记日志）。
- `toolCallId` 幂等：`TOOL_STARTED` 遇到已存在的 id 视为更新；`TOOL_COMPLETED` 找不到卡片时**先补建再更新**，不静默丢弃。
- `SUBMIT_ANSWER` 在一次 action 内完成「写答案 → 问题改已答 → 追加用户 turn → 标记新运行开始」；问题不是待答状态时原样返回（这就是防双击的机制）。
- `buildModelContext` 显式组装，用户答案用 `01-核心协议.md` §6 的固定模板；**禁止** `Object.values().join()` 之类通用拼接。
- turn 结构按协议 §5（`id / runId / modeSnapshot / status / userMessage / modelMessages / parts / questions / error`），`questions` 是数组。

**你检查**

| 看什么 | 期望 |
| --- | --- |
| 迟到事件 | 那段代码是 `return state`，不是 `throw` 或 `console.warn` |
| 乱序 | `TOOL_COMPLETED` 先到时能看到补建分支 |
| 双击防护 | 在 reducer 的条件里，不是按钮上的 `disabled` |
| 上下文序列化 | 贴出实际结果，确认没有 `Object.values` 痕迹、没有 reasoning、没有 U+200B |

**命令**

```bash
node --check src/utils/conversationState.js
npx eslint src/utils/conversationState.js
```

### 第 2 步：C2 · `src/hooks/useChatSession.js`（只发命令的 hook）

**做法要点**

- `useReducer(reduceSession, 初始值)`；对页面只暴露数据 + 命令，**不返回任何 `set` 开头的函数**。
- 每次运行持有自己的 `AbortController`（放 ref，随 `runId` 管理）：取消、切换会话、重试时中止上一个。
- 运行层通过 `onEvent` 把规范事件推给 reducer；hook 负责把事件转成 action。
- `isRunning` 由 `turns.at(-1)?.status === 'streaming'` **派生**，不新增可写布尔量。
- 三个 ID（`conversationId / turnId / runId`）在这里生成并随 action 传入 reducer。
- 命令必须可安全重复调用：`cancelRun` 无运行时是空操作；`retryLastTurn` 运行中是空操作。

**你检查**

| 看什么 | 期望 |
| --- | --- |
| 返回值 | 贴出 hook 的返回清单，确认没有 `setState`、没有 `dispatch` |
| 取消 | `cancelRun` 调的是本轮的 controller，不是"随便一个" controller |
| 派生状态 | `isRunning` 的定义只有一处，且来自 `turns` |
| 重试语义 | `retryLastTurn` 用的是新 `runId`，旧 turn 内容保留 |

**命令**

```bash
npx eslint src/hooks/useChatSession.js
```

### 第 3 步：C3 · 测试（`src/utils/__tests__/`）

**做法要点**：`node --test` + 纯函数测试 + **假运行层**驱动的 reducer 测试（假运行层只是按脚本依次调 `onEvent`，不联网、不渲染）。

**你检查**

| 看什么 | 期望 |
| --- | --- |
| C1 的五条判据 | 乱序、重复、`runId` 不匹配、双击、上下文清洁，各有用例 |
| 取消 | abort 后运行层再吐事件，状态不变 |
| 迟到事件 | 旧 `runId` 的事件被丢弃，且不产生新 turn |

**命令**

```bash
node --test "src/utils/__tests__/*.test.js"
node --test "src/agent/__tests__/*.test.js"
```

### 第 4 步：C4 · `scripts/session-loop.mjs`（Node 闭环）

**做法要点**：用假运行层驱动 reducer，走完「发送 → 待答 → 作答 → 新一轮」，打印每个 turn 的关键字段（`status`、问题、答案、`modelMessages` 条数）。

**你检查**

| 看什么 | 期望 |
| --- | --- |
| 两个 turn | 内容符合预期，第二个 turn 的上下文里含第一个 turn 的问题与用户答案 |
| 上下文 | 没有悬空调用、没有 reasoning、没有 U+200B |
| 打印 | 是原始输出，不是"应该没问题" |

**命令**

```bash
node scripts/session-loop.mjs
```

---

## 通过标准

- C3 的 `node --test` 全绿并贴原始输出；既有 45 条不变红。
- C4 的原始打印贴出，两个 turn 与上下文符合预期。
- `useChatSession` 的返回值清单确认页面**无法直接写状态**。
- `grep` 新会话层：没有 `isLoading` 之类的可写布尔量，没有 `Object.values(...).join(`。
- `npx eslint <改动文件>` 干净；`npx eslint .` 不超过 15 错误 / 3 警告。
- 改动文件全部落在允许清单内；`src/agent/` 与旧路径四件套未被改写；依赖文件无改动。
- 协议不变量 1–8 逐条自检有结论。

## 本阶段不要做

- 不碰 `src/pages/`、`src/components/`、`src/App.jsx`（D 阶段）：本阶段不出现任何 JSX。
- 不碰 `src/agent/` 的既有文件（B1–B7 已验收）；确实需要时先报备并取得同意。
- 不接 localStorage / 历史存储（E 阶段）、不做取消按钮与重试入口的界面（D/F 阶段）。
- 不引入状态库（Redux/Zustand）、不做 TypeScript 迁移、不改依赖。
- 不用 `Object.values(...).join(...)` 构建上下文；不在 reducer 里生成随机 ID；不把 reasoning 放进 `modelMessages`。
