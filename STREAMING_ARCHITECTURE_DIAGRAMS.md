# Streaming Architecture: Visual Diagrams

This document contains detailed visual diagrams showing how the React chat application handles streaming messages and thinking states.

## 1. Component Hierarchy & Data Flow

```
┌───────────────────────────────────────────────────────────────────┐
│                      ChatPage (Main Component)                    │
│  Manages: messages[], uiMessages[], isLoading, currResponse, etc. │
└───────────────────────────────────────┬───────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
          ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐
          │    ChatLayout    │ │  SettingsPanel   │ │ HeaderButtons│
          └────────┬─────────┘ └──────────────────┘ └──────────────┘
                   │
                   ▼
         ┌──────────────────────┐
         │     ChatWindow       │
         │  - Renders messages  │
         │  - Streaming state   │
         └─────────┬────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
    ┌──────────────┐   ┌──────────────────────────────┐
    │ MessageBubble│   │  MessageBubble (Streaming)   │
    │(Completed)   │   │  isStreaming={true}          │
    │ - text       │   │  - Live updates              │
    │ - code       │   │  - Animation indicators      │
    │ - math       │   │  - ThinkingBlock active      │
    │ - thinking   │   │                              │
    │ - question   │   │  ┌──────────────────────────┐│
    │ - answer-card│   │  │  ThinkingBlock           ││
    │              │   │  │  isStreaming={true}      ││
    └──────────────┘   │  │  - Animated dots         ││
                       │  │  - Live preview (200ch)  ││
                       │  │  - Gradient fade         ││
                       │  └──────────────────────────┘│
                       └──────────────────────────────┘
```

## 2. Streaming Data Pipeline - Detailed

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Response Stream                          │
│            Raw text with 〖tag〗content〖/tag〗                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ mainAgent.getCompletion() callback
                         ▼
              ┌──────────────────────────┐
              │ ChatPage receives chunk  │
              │ streamedResponse += ...  │
              └────────────┬─────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
  ┌────────────────┐ ┌──────────────┐ ┌────────────────┐
  │ responseParser │ │ feedThinking │ │ appendResponse │
  │   .feed()      │ │  (chunk)     │ │ (for logging)  │
  └────────┬───────┘ └──────┬───────┘ └────────────────┘
           │                │
           │                ▼
           │          ┌─────────────────┐
           │          │  currThinking   │
           │          │  state string   │
           │          │  (accumulates)  │
           │          └─────────────────┘
           │
           ▼
  ┌──────────────────────────────────┐
  │   StreamingParser.feed()         │
  │   (State machine processor)      │
  │                                  │
  │  Buffer + Parser State:          │
  │  ┌───────────────────────────┐  │
  │  │ INITIAL → IN_TAG →        │  │
  │  │ IN_CONTENT → CLOSING_TAG  │  │
  │  └───────────────────────────┘  │
  └────────────┬─────────────────────┘
               │
               ▼
  ┌──────────────────────────────────────┐
  │ contentChunk Callback Triggered      │
  │ ({ content, tag })                   │
  │                                      │
  │ if (tag === lastTag && prevLen > 0) │
  │   Append to last block               │
  │ else                                 │
  │   Create new { type: tag, value }   │
  └────────────┬─────────────────────────┘
               │
               ▼
  ┌──────────────────────────────────────┐
  │   setCurrResponse(prev => ...)       │
  │   State Update (Triggers Re-render)  │
  └────────────┬─────────────────────────┘
               │
               ▼
  ┌──────────────────────────────────────┐
  │  currResponse State Updated          │
  │  [                                   │
  │    { type: 'text', value: '...' }  │
  │    { type: 'code', value: '...' }  │
  │  ]                                   │
  │  + currThinking stored simultaneously│
  └────────────┬─────────────────────────┘
               │
               ▼
  ┌──────────────────────────────────────┐
  │  React Re-render Triggered           │
  │  ChatWindow receives new props:      │
  │  - isLoading={true}                  │
  │  - currResponse={...}                │
  │  - currThinking={...}                │
  └────────────┬─────────────────────────┘
               │
               ▼
  ┌──────────────────────────────────────┐
  │  ChatWindow Renders Streaming        │
  │  MessageBubble with isStreaming=true │
  │  content={[                          │
  │    { type: 'thinking', value: ... }, │
  │    ...currResponse                   │
  │  ]}                                  │
  └────────────┬─────────────────────────┘
               │
               ▼
  ┌──────────────────────────────────────┐
  │  MessageBubble Maps Content Types:   │
  │  - ThinkingBlock (isStreaming=true)  │
  │  - MarkdownRenderer (text)           │
  │  - CodeBlock (code)                  │
  │  - etc.                              │
  └────────────┬─────────────────────────┘
               │
               ▼
  ┌──────────────────────────────────────┐
  │  User Sees Live Updates:             │
  │  ✓ Thinking text appears real-time   │
  │  ✓ Last 200 chars shown in preview   │
  │  ✓ Animated dots indicate streaming  │
  │  ✓ Content formatted with Markdown   │
  └──────────────────────────────────────┘
```

## 3. StreamingParser State Machine - Detailed

```
INPUT: "〖text〗Hello〖/text〗〖code〗python\nprint()〖/code〗"

Step 1: INITIAL State
┌─────────────────────────────┐
│ Looking for opening bracket │
│ buffer = "〖text〗Hello..."   │
│ Found 〖 at position 0       │
│ ✓ State = IN_TAG            │
│ ✓ Remove 〖 from buffer      │
└─────────────────────────────┘
         │
         ▼
Step 2: IN_TAG State
┌──────────────────────────────┐
│ Reading tag name until 〗     │
│ buffer = "text〗Hello..."     │
│ Found 〗 at position 4        │
│ ✓ currentTag = "text"        │
│ ✓ State = IN_CONTENT         │
│ ✓ Remove "text〗" from buffer │
└──────────────────────────────┘
         │
         ▼
Step 3: IN_CONTENT State
┌────────────────────────────────────┐
│ Accumulating content until next 〖  │
│ buffer = "Hello〖/text〗〖code〗..."  │
│ Found 〖 at position 5 (〖/text〗)   │
│ ✓ content = "Hello"                │
│ ✓ Fire contentChunk callback       │
│ ✓ State = CLOSING_TAG              │
│ ✓ Remove "Hello〖/" from buffer    │
└────────────────────────────────────┘
         │
         ▼
Step 4: CLOSING_TAG State
┌──────────────────────────────────────┐
│ Verify closing tag matches opening   │
│ buffer = "text〗〖code〗python..."    │
│ Found 〗 at position 4               │
│ ✓ closingTag = "text" ✓ Matches     │
│ ✓ Fire tagComplete callback         │
│ ✓ State = INITIAL                   │
│ ✓ Remove "text〗" from buffer        │
└──────────────────────────────────────┘
         │
         ▼
Step 5: INITIAL State (Second Tag)
┌──────────────────────────────┐
│ Looking for opening bracket  │
│ buffer = "〖code〗python..."   │
│ Found 〖 at position 0        │
│ ✓ State = IN_TAG             │
└──────────────────────────────┘
         │
         ▼
        ...repeat until end
```

## 4. ThinkingBlock Rendering States

```
┌─────────────────────────────────────────────────────────────────┐
│                  ThinkingBlock Component States                 │
└─────────────────────────────────────────────────────────────────┘

STATE 1: STREAMING (isStreaming = true)
┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐
│  │  [💡] 思考中 • • •                            思考了 5,234 字  │ ← Header (always visible)
│  │         ↑        ↑        ↑
│  │      animate   animate   animate
│  │      [0ms]     [150ms]   [300ms]
│  ├─────────────────────────────────────────────────────────────┤
│  │  Let me analyze the problem step by step. First, I need      │ ← Preview (last 200 chars)
│  │  to understand what we're dealing with...                   │
│  │  ┌───────────────────────────────────────────────────────┐  │
│  │  │ Gradient fade to white (top edge)                   │  │
│  │  └───────────────────────────────────────────────────────┘  │
│  │  max-height: 112px (7rem)                                   │
│  └─────────────────────────────────────────────────────────────┘
│
│  Key Features While Streaming:
│  • Header text: "思考中" (pulsing animation)
│  • 3 bouncing dots with staggered delays
│  • No chevron icon (locked)
│  • Can't expand (header not clickable)
│  • Shows live preview of last 200 chars
│  • Gradient fade hides the exact cutoff point

STATE 2: COMPLETED (isStreaming = false, open = false)
┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐
│  │  [💡] 查看思考过程  ▼                            思考了 5,234 字  │ ← Header (clickable)
│  └─────────────────────────────────────────────────────────────┘
│
│  Key Features When Closed:
│  • Shows "查看思考过程" (View thinking process)
│  • Chevron icon pointing down (▼)
│  • Character count displayed
│  • Content hidden below header

STATE 3: COMPLETED AND EXPANDED (isStreaming = false, open = true)
┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐
│  │  [💡] 收起思考过程  ▲                            思考了 5,234 字  │ ← Header (clickable)
│  ├─────────────────────────────────────────────────────────────┤
│  │  Let me analyze the problem step by step. First, I need      │
│  │  to understand what we're dealing with...                   │
│  │                                                              │
│  │  1. Define the problem space                                │
│  │  2. Identify key constraints                                │
│  │  3. Explore potential solutions                             │
│  │  4. Evaluate trade-offs                                     │
│  │                                                              │
│  │  After careful consideration, the optimal approach is...    │
│  │                                                              │
│  │  [Full Markdown-rendered thinking text continues...]        │
│  └─────────────────────────────────────────────────────────────┘
│
│  Key Features When Expanded:
│  • Shows "收起思考过程" (Hide thinking process)
│  • Chevron icon pointing up (▲)
│  • Full thinking text visible (monospace font)
│  • Markdown rendering applied
│  • White/50 background for content area
```

## 5. Message Bubble Content Type Router

```
                       MessageBubble
                    (content array)
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐       ┌─────────┐     ┌──────────┐
    │ 'text'  │       │'thinking'│    │  'code'  │
    └────┬────┘       └────┬────┘     └────┬─────┘
         │                 │               │
         ▼                 ▼               ▼
  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Markdown    │  │ ThinkingBlock│  │  CodeBlock   │
  │ Renderer    │  │  Component   │  │  Component   │
  │             │  │  Collapsible │  │              │
  │ - Bold      │  │  - Streaming │  │ - Syntax     │
  │ - Italic    │  │  - Expanded  │  │   highlight  │
  │ - Lists     │  │  - Live edit │  │ - Line nos.  │
  │ - Tables    │  │              │  │ - Copy btn   │
  │ - Links     │  │              │  │              │
  │ - Images    │  │              │  │              │
  └─────────────┘  └──────────────┘  └──────────────┘
         │                 │               │
         └─────────────────┼───────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐       ┌─────────┐     ┌──────────────┐
    │ 'math'  │       │'question'│    │'answer-card' │
    └────┬────┘       └────┬────┘     └────┬─────────┘
         │                 │               │
         ▼                 ▼               ▼
  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │ KaTeX Block │  │ Question     │  │ Answer Card  │
  │             │  │ Buttons      │  │  Component   │
  │ - LaTeX     │  │              │  │              │
  │   equation  │  │ - Button     │  │ - Question   │
  │ - Inline    │  │   style 1    │  │   display    │
  │   math      │  │ - Button     │  │ - Answer     │
  │ - Copy btn  │  │   style 2    │  │   display    │
  │             │  │ - Clickable  │  │ - Level tag  │
  │             │  │   (optional) │  │   (color)    │
  └─────────────┘  └──────────────┘  └──────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │ User Interacts │
                  │ - Click button │
                  │ - Copy code    │
                  │ - Expand card  │
                  └────────────────┘
```

## 6. Re-render Optimization: Ref vs State

```
Without optimization (all state):
╔════════════════════════════════════════╗
║     100 chunks arrive per second       ║
║            (from API)                  ║
╚════════════┬═════════════════════════════╝
             │
             ├─→ setState() ──→ Re-render (expensive!)
             ├─→ setState() ──→ Re-render (expensive!)
             ├─→ setState() ──→ Re-render (expensive!)
             ...100 times per second...
             ├─→ setState() ──→ Re-render (expensive!)
             │
             ▼
        CPU overloaded ❌

With optimization (Ref + State):
╔════════════════════════════════════════╗
║     100 chunks arrive per second       ║
║            (from API)                  ║
╚════════════┬═════════════════════════════╝
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌────────┐      ┌─────────────┐
│ Ref ++ │      │  setState() │
│ (fast) │      │  (triggers  │
│  x100  │      │  re-render) │
└────────┘      └──────┬──────┘
    │                  │
    ├─ Direct access   ├─ UI update
    ├─ No re-render    ├─ React sync
    └─ Buffer ready    └─ Smooth 60fps ✓

Lifecycle:
┌─────────────────────────────────────┐
│ Streaming (while isLoading=true)    │
│ currResponseRef += content (no re-r)│
│ currResponse = newState (re-render) │
│ → 5-10 re-renders per sec (batched)│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Stream Ends (endParser called)      │
│ Use currResponseRef.current (buffer)│
│ Create message with full content    │
│ Reset both ref and state            │
└─────────────────────────────────────┘
```

## 7. Error Handling Flow

```
┌──────────────────────────────────────┐
│ API Request Fails                    │
│ .catch(error) triggered              │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ buildFailedAssistantPair()           │
│ - Gather partial currResponseRef     │
│ - Add error message block            │
│ - Create error uiContent             │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Create Message with:                 │
│ - status: 'error'                    │
│ - error: { message, detail }         │
│ - uiContent: [...error message]      │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ syncConversationState()              │
│ - Add to messages[]                  │
│ - Add to uiMessages[]                │
│ - setIsLoading(false)                │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ MessageBubble Renders:               │
│ ┌──────────────────────────────────┐│
│ │ [status='error']                 ││
│ │ ┌──────────────────────────────┐││
│ │ │ Partial content (if any)     │││
│ │ │                              │││
│ │ │ 🔴 请求失败，请检查模型配置..│││
│ │ │    [Retry Button on hover]   │││
│ │ └──────────────────────────────┘││
│ │ Red background, red text         ││
│ └──────────────────────────────────┘│
└────────────┬─────────────────────────┘
             │
             ▼
    User clicks Retry
             │
             ▼
  runAssistantTurn() again
  (with assistantMessageId preserved)
```

## 8. Chat History & Persistence

```
┌──────────────────────────────────────┐
│  User Conversation                   │
│  - messages[] (canonical data)       │
│  - uiMessages[] (display data)       │
└────────────┬─────────────────────────┘
             │
             │ autosave (from useChatHistory)
             │ every message completed
             │
             ▼
┌──────────────────────────────────────┐
│  JSON Serialization                  │
│  {                                   │
│    id: "chat_xxx",                   │
│    title: "Conversation topic",      │
│    messages: [...],                  │
│    uiMessages: [...],                │
│    timestamp: Date.now(),            │
│    model: "claude-opus"              │
│  }                                   │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│  localStorage.setItem()              │
│  (or backend API save)               │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│  User Returns Later                  │
│  selectHistory(chatId)               │
│  ↓                                   │
│  Load JSON from storage              │
│  ↓                                   │
│  normalizeStoredChat()               │
│  ↓                                   │
│  Reconstruct messages & uiMessages   │
│  ↓                                   │
│  ChatWindow renders history          │
└──────────────────────────────────────┘
```

## 9. Theme System Application

```
┌─────────────────────────────────────────┐
│  tailwind.config.js                     │
│  Defines theme colors:                  │
│  tech: {                                │
│    primary: '#0A192F',   ← Dark navy   │
│    accent: '#64FFDA',    ← Cyan       │
│    text: '#8892B0',      ← Blue gray  │
│  }                                      │
└──────────────────────┬──────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   ┌─────────┐  ┌─────────┐  ┌────────────┐
   │ChatWindow│  │MessageB.│  │ThinkingBlock│
   │theme=    │  │theme=   │  │theme=      │
   │'default' │  │'tech'   │  │'default'   │
   └────┬─────┘  └────┬────┘  └────────────┘
        │             │
        ▼             ▼
   ┌─────────┐  ┌──────────────────┐
   │ Warm    │  │ Dark Navy        │
   │ Beige   │  │ + Cyan Accents   │
   │ BG      │  │                  │
   │ Cyan    │  │ tech-primary     │
   │ Text    │  │ tech-accent      │
   └─────────┘  └──────────────────┘
```

---

**Generated from analysis of:**
- `src/hooks/useStreaming.js`
- `src/utils/StreamingParser.js`
- `src/components/ChatWindow/ChatWindow.jsx`
- `src/components/MessageBubble/MessageBubble.jsx`
- `src/components/ThinkingBlock/ThinkingBlock.jsx`
- `src/pages/ChatPage/ChatPage.jsx`

