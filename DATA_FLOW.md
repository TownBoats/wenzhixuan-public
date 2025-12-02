# 问知选 (WenZhiXuan) 数据流文档

## 项目概述

问知选是一个基于苏格拉底式教学法的 AI 对话学习应用。它采用双 Agent 架构：
- **主 AI (Main Agent)**：负责与用户进行苏格拉底式对话，提出引导性问题
- **选项 AI (Option Agent)**：为主 AI 提出的问题生成多级别的预设回答选项

## 技术栈

- **前端框架**：React 18 + Vite
- **状态管理**：React Hooks (useState, useReducer, useMemo, useCallback)
- **样式**：TailwindCSS
- **国际化**：i18next
- **持久化**：localStorage
- **UI 组件**：react-draggable, react-resizable, react-markdown, framer-motion

---

## 核心架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ChatPage (主页面)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ useAgentsConfig │    │  useChatHistory │    │ useQuestionFlow │         │
│  │   (Agent管理)   │    │   (历史记录)    │    │   (问题状态机)  │         │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘         │
│           │                      │                      │                   │
│           ▼                      ▼                      ▼                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   mainAgent     │    │   localStorage  │    │   useReducer    │         │
│  │   optionAgent   │    │ (chat_histories)│    │  (问题列表)     │         │
│  └────────┬────────┘    └─────────────────┘    └────────┬────────┘         │
│           │                                             │                   │
│           ▼                                             ▼                   │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                      useStreaming (流式解析)                     │       │
│  │  StreamingParser → 解析 〖response〗〖question〗 标签            │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 数据流详解

### 1. 配置数据流

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         ConfigManager (配置管理器)                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  localStorage Keys:                                                      │
│  ├── mainAgentConfig     → 主模型配置 (baseURL, apiKey, model等)        │
│  ├── optionAgentConfig   → 选项模型配置                                  │
│  ├── mainAgentPrompt     → 主模型系统提示词                              │
│  ├── optionAgentPrompt   → 选项模型系统提示词                            │
│  ├── learning_mode_prompt → 学习模式提示词缓存                           │
│  └── option_ai_prompt    → 选项AI提示词缓存                              │
│                                                                          │
│  数据流向:                                                                │
│  ConfigManager.getMainModelConfig() ──┐                                  │
│  ConfigManager.getMainPrompt()     ───┼──▶ useAgentsConfig Hook          │
│  ConfigManager.getOptionModelConfig()─┤                                  │
│  ConfigManager.getOptionPrompt()   ───┘                                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**配置结构**:
```javascript
{
  baseURL: 'https://open.bigmodel.cn',      // API基础URL
  customEndpoint: '/api/paas/v4/chat/completions', // 端点路径
  apiKey: '',                                // API密钥 (BYOK模式)
  model: 'gpt-4o-mini',                      // 模型名称
  useCustomURL: false,                       // 是否使用完整自定义URL
  fullURL: ''                                // 完整自定义URL
}
```

---

### 2. Agent 数据流

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           AgentModel (AI模型封装)                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  创建流程:                                                                │
│  ┌─────────────────┐                                                     │
│  │ createMainAgent │ ──▶ new AgentModel({                                │
│  │createOptionAgent│      customEndpoint,                                │
│  └─────────────────┘      apiKey,                                        │
│           │               settings: { model, system_message, temp... },  │
│           │               callbacks: { onRequestStart, onResponseEnd }   │
│           ▼             })                                               │
│  ┌─────────────────┐                                                     │
│  │  useAgentsConfig│ ──▶ 管理 Agent 实例生命周期                          │
│  └─────────────────┘     配置变化时调用 agent.updateApiConfig()           │
│                                                                          │
│  请求流程:                                                                │
│  agent.getCompletion(messages, onDataReceived, onComplete)               │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ 1. 触发 onRequestStart 回调                                  │        │
│  │ 2. 发送 POST 请求到 API (stream: true)                       │        │
│  │ 3. 读取 SSE 流，解析 JSON                                    │        │
│  │ 4. 每收到内容块调用 onDataReceived(content)                  │        │
│  │ 5. 流结束时调用 onResponseEnd + onComplete                   │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 3. 消息数据流

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            消息状态管理                                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ChatPage 维护两套消息:                                                   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ messages (真实消息)                                          │        │
│  │ 用于发送给 AI 的原始对话历史                                  │        │
│  │ 格式: [{ role: "user"|"assistant", content: string }]        │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ uiMessages (UI消息)                                          │        │
│  │ 用于渲染界面的结构化消息                                      │        │
│  │ 格式: [{                                                     │        │
│  │   role: "user"|"assistant",                                  │        │
│  │   content: [                                                 │        │
│  │     { type: "response", value: "..." },                      │        │
│  │     { type: "question", value: "..." },                      │        │
│  │     { type: "answer-card", value: { question, level, answer }}│        │
│  │   ]                                                          │        │
│  │ }]                                                           │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                          │
│  消息流转:                                                                │
│  用户输入 ──▶ messages + uiMessages 添加用户消息                          │
│       │                                                                  │
│       ▼                                                                  │
│  mainAgent.getCompletion(messages)                                       │
│       │                                                                  │
│       ▼                                                                  │
│  StreamingParser 解析流式响应                                             │
│       │                                                                  │
│       ├──▶ 〖response〗内容 ──▶ currResponse 状态                         │
│       │                                                                  │
│       └──▶ 〖question〗内容 ──▶ onQuestionFound 回调                      │
│                   │                                                      │
│                   ▼                                                      │
│            useQuestionFlow.addQuestion()                                 │
│                   │                                                      │
│                   ▼                                                      │
│            optionAgent 生成多级别回答                                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 4. 问题流转数据流 (useQuestionFlow)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         问题状态机 (useReducer)                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  State 结构:                                                              │
│  {                                                                       │
│    list: Question[],    // 问题列表                                       │
│    selected: Question   // 当前选中的问题                                  │
│  }                                                                       │
│                                                                          │
│  Question 对象:                                                           │
│  {                                                                       │
│    id: string,                    // 唯一ID                              │
│    question: string,              // 问题文本                             │
│    index: number,                 // 问题序号                             │
│    status: 'idle'|'requesting'|'responding'|'completed',                 │
│    isAnswered: boolean,           // 用户是否已回答                        │
│    isConfirmed: boolean,          // 是否已确认                           │
│    hasFetchedAnswer: boolean,     // 是否已获取AI回答                      │
│    answer: {                      // 五个级别的预设回答                    │
│      none: string,                // 完全不懂                             │
│      heard: string,               // 听说过                               │
│      basic: string,               // 基本了解                             │
│      familiar: string,            // 比较熟悉                             │
│      expert: string               // 专家级别                             │
│    },                                                                    │
│    selectedLevel: string,         // 用户选择的级别                        │
│    selectedContent: string        // 用户选择的回答内容                    │
│  }                                                                       │
│                                                                          │
│  Actions:                                                                │
│  ├── ADD_QUESTION    → 添加新问题                                         │
│  ├── SET_STATUS      → 更新问题状态                                       │
│  ├── SET_ANSWER      → 设置AI生成的回答                                   │
│  ├── SELECT          → 选中问题(打开AnswerCard)                           │
│  ├── ANSWER_SELECTED → 用户选择了某个级别的回答                            │
│  ├── REMOVE          → 删除问题                                           │
│  ├── DESELECT        → 取消选中                                           │
│  ├── MARK_FETCHED    → 标记已获取回答                                     │
│  └── CLEAR           → 清空所有问题                                       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

问题生命周期:
┌─────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐
│ 主AI输出 │───▶│ 解析问题  │───▶│ 请求选项AI │───▶│ 用户选择  │───▶│ 继续对话  │
│ question │    │ addQuestion│    │fetchOption │    │ chooseLevel│    │ 自动发送  │
└─────────┘    └───────────┘    └───────────┘    └───────────┘    └──────────┘
```

---

### 5. 流式解析数据流

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         StreamingParser (流式解析器)                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  解析标签格式:                                                            │
│  〖response〗...内容...〖/response〗  → 普通回复内容                        │
│  〖question〗...问题...〖/question〗  → 引导性问题                          │
│                                                                          │
│  状态机:                                                                  │
│  INITIAL ──▶ IN_TAG ──▶ IN_CONTENT ──▶ CLOSING_TAG ──▶ INITIAL           │
│     │           │            │              │                            │
│     │     找到〖开始    读取内容      找到〖/结束                           │
│     │                                                                    │
│  回调函数:                                                                │
│  ├── contentChunk({ content, tag, index })  → 内容块回调                  │
│  ├── questionComplete({ content, index })   → 问题完成回调                │
│  └── parsingComplete()                      → 解析完成回调                │
│                                                                          │
│  useStreaming Hook 封装:                                                  │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ const { parser, currResponse, end } = useStreaming({        │        │
│  │   onQuestionFound: (content, index) => {                    │        │
│  │     // 添加问题到列表                                         │        │
│  │     // 触发选项AI请求                                         │        │
│  │   }                                                         │        │
│  │ });                                                         │        │
│  │                                                             │        │
│  │ // 使用: parser.feed(chunk) 喂入流式数据                     │        │
│  │ // 结束: end() 完成解析                                      │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 6. 历史记录数据流

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        useChatHistory (历史记录管理)                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  localStorage Key: 'chat_histories'                                      │
│                                                                          │
│  History 对象:                                                            │
│  {                                                                       │
│    id: string,           // 对话ID (chat_${timestamp})                   │
│    title: string,        // 对话标题 (取自第一条用户消息)                  │
│    messages: Message[],  // 真实消息列表                                  │
│    uiMessages: UIMessage[], // UI消息列表                                 │
│    timestamp: number     // 时间戳                                        │
│  }                                                                       │
│                                                                          │
│  Hook 返回:                                                               │
│  {                                                                       │
│    histories,        // 所有历史记录                                      │
│    currentChatId,    // 当前对话ID                                        │
│    currentHistory,   // 当前对话数据                                      │
│    newChat(),        // 创建新对话                                        │
│    selectHistory(),  // 选择历史对话                                      │
│    updateTitle(),    // 更新标题                                          │
│    deleteHistory(),  // 删除对话                                          │
│    autosave(),       // 自动保存                                          │
│  }                                                                       │
│                                                                          │
│  自动保存触发:                                                            │
│  useEffect(() => {                                                       │
│    autosave({ id: currentChatId, messages, uiMessages });                │
│  }, [currentChatId, messages, uiMessages]);                              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 7. 完整用户交互流程

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           用户交互完整流程                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. 用户输入问题                                                          │
│     │                                                                    │
│     ▼                                                                    │
│  2. handleSendMessage()                                                  │
│     ├── 更新 messages + uiMessages                                       │
│     ├── 调用 mainAgent.getCompletion()                                   │
│     │                                                                    │
│     ▼                                                                    │
│  3. 主AI流式响应                                                          │
│     ├── responseParser.feed(chunk) 解析每个数据块                         │
│     ├── 〖response〗 → 更新 currResponse 状态                             │
│     └── 〖question〗 → 触发 onQuestionFound                               │
│                │                                                         │
│                ▼                                                         │
│  4. 问题处理                                                              │
│     ├── addQuestion() 添加到问题列表                                      │
│     └── fetchOptionAnswer() 调用选项AI                                   │
│                │                                                         │
│                ▼                                                         │
│  5. 选项AI流式响应                                                        │
│     ├── ContentParser 解析五个级别回答                                    │
│     │   〖none〗〖heard〗〖basic〗〖familiar〗〖expert〗                     │
│     └── 更新问题的 answer 字段                                            │
│                │                                                         │
│                ▼                                                         │
│  6. 用户点击 QuestionCard                                                 │
│     ├── selectQuestion() 选中问题                                        │
│     └── 显示 AnswerCard 弹窗                                              │
│                │                                                         │
│                ▼                                                         │
│  7. 用户选择回答级别                                                      │
│     ├── handleLevelSelect(level, content)                                │
│     ├── chooseLevel() 更新问题状态                                        │
│     └── 添加 answer-card 类型消息到 uiMessages                            │
│                │                                                         │
│                ▼                                                         │
│  8. 检测所有问题已回答                                                    │
│     ├── 生成回答摘要                                                      │
│     ├── 自动发送给主AI                                                    │
│     └── 继续苏格拉底式对话                                                │
│                │                                                         │
│                ▼                                                         │
│  9. 自动保存到 localStorage                                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 组件层级结构

```
App
└── ChatPage
    ├── HistorySidebar          // 历史记录侧边栏
    ├── ChatLayout              // 聊天布局容器
    │   ├── WelcomeScreen       // 欢迎界面
    │   ├── QuickPrompts        // 快速提示选项
    │   ├── MessageBubble[]     // 消息气泡列表
    │   │   ├── MarkdownRenderer // Markdown渲染
    │   │   └── AnswerMessageCard // 回答卡片消息
    │   ├── QuestionCard[]      // 问题卡片列表 (横向滚动)
    │   └── UserInput           // 用户输入框
    ├── AnswerCard              // 回答选择弹窗 (可拖拽/缩放)
    ├── SettingsPanel           // 设置面板
    │   ├── ModelConfigPanel    // 模型配置
    │   ├── PromptConfigPanel   // 提示词配置
    │   └── AgentConfigPanel    // Agent配置
    ├── DebugPanel              // 调试面板
    └── HeaderButtons           // 顶部按钮组
```

---

## 关键状态汇总

| 状态名 | 所在位置 | 用途 |
|--------|----------|------|
| `messages` | ChatPage | 发送给AI的原始消息历史 |
| `uiMessages` | ChatPage | 用于UI渲染的结构化消息 |
| `currResponse` | useStreaming | 当前正在流式接收的响应 |
| `singleTurnQuestion` | useQuestionFlow | 当前轮次的问题列表 |
| `selectedQuestion` | useQuestionFlow | 当前选中的问题 |
| `mainModelConfig` | useAgentsConfig | 主模型配置 |
| `optionModelConfig` | useAgentsConfig | 选项模型配置 |
| `histories` | useChatHistory | 所有历史对话记录 |
| `currentChatId` | useChatHistory | 当前对话ID |
| `isLoading` | ChatPage | 加载状态 |
| `isInitialLayout` | ChatPage | 是否为初始布局 |

---

## localStorage 键值对照表

| Key | 用途 | 数据类型 |
|-----|------|----------|
| `mainAgentConfig` | 主模型API配置 | JSON Object |
| `optionAgentConfig` | 选项模型API配置 | JSON Object |
| `mainAgentPrompt` | 主模型系统提示词 | String |
| `optionAgentPrompt` | 选项模型系统提示词 | String |
| `chat_histories` | 对话历史记录 | JSON Array |
| `answerCardSize` | 回答卡片尺寸 | JSON Object |
| `waitTime` | 回答等待时间 | Number |
| `enableWaitTime` | 是否启用等待时间 | Boolean String |
| `learning_mode_prompt` | 学习模式提示词缓存 | String |
| `option_ai_prompt` | 选项AI提示词缓存 | String |
