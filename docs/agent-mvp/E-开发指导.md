# 阶段 E · 开发指导（历史存储与刷新恢复）

> 本文件是 `E-历史存储与恢复.md` 的**简版操作手册**：只回答「先做什么、怎么检查」。
> 设计与理由不在这里重复——那是阶段文件的职责；协议字段以 `01-核心协议.md` §7 为准。
> 本文件不含阶段文件中没有的新设计；发现缺口按规则 §1「文档维护规则」处理。

## 1. 目标

让新运行时**刷新不丢**：会话能存、能取、能继续，待答问题刷新后仍可作答；旧键 `chat_histories` 只读、字节不变。

四条验收判据（来自阶段文件 §5）：

1. 刷新后待答问题**可继续作答**（不是只显示）。
2. 旧键内容在继续对话前后**字节不变**。
3. 损坏数据 / 配额满**不白屏**，界面有明确提示。
4. 同一 ID 同时存在于新旧两键时，列表只出现一条、读取取新键。

第 5 条来自 2026-10-18 用户新增决策（决策 4）：**页面上有可用的历史列表**——能看到标题与时间、能打开、能重命名、能删除，且不区分新旧。

## 2. 开工前准备

### 2.1 需要你拍板的决策（未拍板前不写代码）

| # | 决策 | 结论（2026-10-18） |
| --- | --- | --- |
| 1 | 历史列表怎么展示新旧会话 | ✅ **A**：合并成一个列表、同 ID 新键优先（用户原话「支持」） |
| 2 | 配额满怎么处理 | ✅ **A**：提示保存失败 + 本次只在内存 + 建议去列表删旧会话；不做静默删数据 |
| 3 | 旧会话继续对话后怎么写 | ✅ **A**：写新键 `chat_histories_v2`，旧键 `chat_histories` 全程只读（用户 2026-10-18 原话「直接写新建吧，旧建自读」）；B 的代价见 §2.4，结论记在 `决策记录.md` **E-1** |
| 4 | 本期做不做历史列表界面 | ✅ **做**（用户原话「还是希望有一个历史列表的界面」）。范围：显示标题、删除、重命名、不区分新旧、标题取首条用户消息前 **20** 字 → 新增任务 **E5** |
| 5 | 保存接线落点 | ✅ **A**：放页面（四个保存点后显式调用 `saveConversation`），不动已验收的 C 层 |

### 2.4 决策 3 的两条路与代价（已定：A，2026-10-18）

| | A 写新键（阶段文件原方案） | B 写回旧键（用户提法） |
| --- | --- | --- |
| 新数据落在哪 | `chat_histories_v2` | `chat_histories`（与旧记录同数组） |
| 旧页面（`agent_runtime` 关闭）能否读 | 不受影响 | **读不出来**：旧页面按 `currentHistory.messages \|\| []` 取内容，v2 记录没有 `messages` 字段 → 打开是空白 |
| 旧数据风险 | 旧键只读，零风险 | 用户一旦在旧页面打开该记录并继续输入，`useChatHistory.autosave` 会以旧格式**整条覆盖**它 → 新格式内容丢失 |
| 用户看到重复吗 | 不会：列表合并去重，同 ID 只显示最新一条 | 不会，但代价是上面两条 |
| 结论 | ✅ **采纳**（`决策记录.md` **E-1**） | 已否：旧页面会读到空白，且 `autosave` 会整条覆盖 |

### 2.2 已核对的代码事实（写代码前请复核，别凭记忆）

| 事实 | 位置 |
| --- | --- |
| 旧键名 `chat_histories`，初始化 `JSON.parse` **无 try/catch**、写回无配额处理 | `src/hooks/useChatHistory.js:4,7-10,35,44` |
| `useChatSession` 只做初始化，**没有任何读写存储的代码**；`conversationId` 可外部传入 | `src/hooks/useChatSession.js:85,320-343` |
| 打开既有会话的接口是 `openConversation(record)`，读 `record.conversationId ?? record.id`、`record.mode`、`record.turns` | `src/hooks/useChatSession.js:275-291` |
| 投影与上下文构建已就绪：`projectTurns(state.turns)`、`buildModelContext`（只发已配对完成的轮次） | `src/utils/conversationState.js` |
| v2 存储形状：`{ id, title, timestamp, schemaVersion: 2, mode, turns }` | `01-核心协议.md` §7 |
| **禁止入库**：函数、`AbortController`、`apiKey`、`endpoint`、reasoning 原文、U+200B | 规则 §6 |
| 保存点四个：用户发送 / 工具完成 / 作答提交 / 运行结束 | 规则 §6、`E-历史存储与恢复.md` §2.3 |

### 2.3 基线（E 阶段起点，改动后不得倒退）

```bash
node --test "src/utils/__tests__/*.test.js"     # 46/46
node --test "src/agent/__tests__/*.test.js"     # 45/45
node scripts/session-loop.mjs                   # 17/17
npx eslint .                                    # 18 problems（15 错误 / 3 警告）
npx vite build                                  # ok，主包约 2,868 kB
```

## 3. 分步操作

### E1 · `src/utils/historyStore.js`

**做法要点**
- 纯模块：**不 import React、不碰 `window`**，`storage` 由参数注入（Node 测试可跑）。
- 六个函数按阶段文件 §4 的签名：`loadAll` / `loadById` / `saveConversation` / `deleteConversation` / `renameConversation` / `listForSidebar`。
- 一律**返回结果、不抛异常**：`{ ok:true, ... }` / `{ ok:false, reason:'quota'|'corrupt'|'not_found' }`。
- 读旧键时逐条 `try/catch`，坏条目跳过并回 `{ corrupt: n }`，**绝不整键丢弃、绝不写回**。
- 反序列化后再做一次「脏字段剥离」：丢掉函数、`AbortController`、未知键，防止上游误存。

**你检查**
- `historyStore.js` 里每个 `JSON.parse` 与 `setItem` 都在 `try/catch` 内（`grep` 可查）。
- 文件内无 `localStorage`、`window.`、`React`、`import ... from 'react'`。
- 同 ID 两键都有时，`loadById` 返回新键、`listForSidebar` 只有一条。

**命令**：`node --check` + `npx eslint src/utils/historyStore.js` + E4 的单测。

### E2 · v1 只读适配

**做法要点**
- 新增纯函数（建议放 `historyStore.js` 或 `src/utils/historyV1.js`）：把旧记录 `{ id, title, timestamp, messages, uiMessages }` 投影成 `turns`。
- 文本片段照抄；`uiMessages` 里的 `answer-card` 片段投影成只读的问题块（不可作答，历史就是历史）。
- **只读**：任何路径都不得对旧键调用 `setItem`。
- 上下文只取纯文本（旧记录里 `messages` / `uiMessages` 已分叉，见阶段文件 §2.2）。

**你检查**
- 打开一个旧会话，第一轮内容显示正常、一轮多问题可读。
- 继续该会话对话后，`localStorage.getItem('chat_histories')` 的字符串与操作前**逐字节相同**（贴两个长度 + 前 80 字符对比）。

**命令**：E4 单测 + 浏览器实测（对比旧键字符串）。

### E3 · 恢复语义

**做法要点**
- 页面加载时 `loadAll()` → 若有会话，`openConversation(record)`；无则保持空态。
- 载入状态映射（阶段文件 §4）：`streaming → interrupted`（保留片段 + 提示「这一轮没有完成」，**不自动重放**）；`awaiting_user` 恢复为可作答；`completed/failed/cancelled` 原样。
- 悬空工具调用：留在 `parts` 里展示，**不进上下文**（`buildModelContext` 已过滤，别自己再拼）。
- 保存接线：在四个点后调用 `saveConversation`；失败必须让界面看得见（不许空 `catch`）。

**你检查**
- 待答状态刷新后，问题卡、五档、自定义输入都可用，提交后能正常续轮。
- 手动把某轮 `status` 改成 `streaming` 再刷新 → 显示为未完成，且**没有**自动发起请求（网络面板无新请求）。

**命令**：浏览器实测 + 网络面板截图。

### E4 · 测试（`src/utils/__tests__/historyStore.test.js`）

**做法要点**：假 `storage`（内存 Map 实现 `getItem/setItem/removeItem`，可抛配额异常）。用例至少覆盖：损坏 JSON 跳条不抛、配额满返回 `ok:false`、同 ID 合并、删除同时作用于两键、旧键字节不变、v1 投影形状、脏字段剥离。

**你检查**：全是纯函数用例，不联网、不渲染、不依赖真实 `localStorage`。

**命令**：`node --test "src/utils/__tests__/*.test.js"`（条数应 ≥ 46 + 新增）。

### E5 · 历史列表界面（决策 4：做）

**做法要点**
- 位置：`src/pages/AgentChatPage/` 内新增抽屉/侧栏组件（例如 `HistoryDrawer.jsx`），由页头「新会话」旁的一个按钮打开；不改旧路径任何组件。
- 数据只经 `historyStore.listForSidebar()`：**合并两键、同 ID 新键优先、按时间倒序**，界面不区分「新」「旧」。
- 显示：标题（首条用户消息前 20 字；无则「未命名会话」）+ 时间；当前会话高亮。
- 三个动作：**打开**（`openConversation(record)`）、**重命名**（`renameConversation`，空标题回退到自动标题）、**删除**（`deleteConversation`，同时作用于两键，需二次确认）。
- 删除/重命名失败（配额、找不到）必须在界面提示，不许空 `catch`。
- 打开一个 `streaming` 状态的会话时按 E3 规则转 `interrupted` 并提示，不自动重放。

**你检查**
- 刷新页面后列表里能看到之前的会话，点开内容与刷新前一致；待答问题仍可作答。
- 删除一条同时存在于两键的会话后，`localStorage` 里两个键都查不到它。
- 列表里同一个会话只出现一次（做过「继续旧会话」之后仍是一条）。
- 旧记录与新记录混排时都可点开，旧记录打开后仍可继续对话（按决策 3 的结论写）。

**命令**：E4 单测（`listForSidebar` 合并去重）+ 浏览器实测（刷新 / 删除 / 重命名各一次）。

## 4. 通过标准

1. 五条目标判据逐条有证据（命令输出 / 浏览器截图 / 旧键字节对比），含 E5 的列表四项动作。
2. `node --test "src/utils/__tests__/*.test.js"` 全绿、条数只增不减；agent 45/45 不受影响。
3. `npx eslint .` 回到 18 problems（15/3）或更少；`npx vite build` 通过。
4. 旧路径（`agent_runtime` 关闭）行为不变，`chat_histories` 只读。
5. 规则 §4 八条协议不变量逐条自检并写进交付说明。

## 5. 本阶段不要做

- 不做批量迁移旧数据（只读适配 + 继续即写新键）。
- 不做多标签页并发写入的锁。
- 不做后端/云端存储，不引入状态库、不升级依赖。
- 不重写 `src/pages/ChatPage/`、`src/lib/AgentModel.js`、`src/hooks/useStreaming.js`、`src/utils/StreamingParser.js`。
- 不在 E 阶段顺手改页面视觉、不新增设置入口（那是 D-3 ① 的暂缓项，单独立项）。
- 不做「自动重放未完成运行」——即使看起来只差一步。
