# Message Rendering & Streaming: Quick Reference

## Key Concepts at a Glance

### Message Pair System
```javascript
// Every message exists in TWO forms:

// 1. Storage layer (pure text, for API/persistence)
message = {
  id: "msg_xxx",
  role: "assistant",
  content: "Full plain text response",
  status: "completed",
  error: null
}

// 2. Display layer (rich structured content)
uiMessage = {
  id: "msg_xxx",
  sourceMessageId: "msg_xxx",
  role: "assistant",
  content: [              // Array of typed blocks
    { type: 'thinking', value: '...' },
    { type: 'text', value: '...' },
    { type: 'code', value: '...' }
  ],
  status: "completed"
}
```

### Content Types
| Type | Component | Example |
|------|-----------|---------|
| `text` | MarkdownRenderer | Formatted text with bold, lists, etc. |
| `code` | CodeBlock | Syntax-highlighted code with copy button |
| `math` | KaTeX block | LaTeX equations rendered beautifully |
| `thinking` | ThinkingBlock | Collapsible model reasoning |
| `question` | QuestionButtons | Clickable suggested questions |
| `answer-card` | AnswerMessageCard | Structured Q&A with understanding level |

## Streaming Architecture

### Quick Sequence
```
1. API sends chunk
   ↓
2. ChatPage.runAssistantTurn() callback receives it
   ↓
3. responseParser.feed(chunk) — parses XML-like tags
   ↓
4. feedThinking(chunk) — for reasoning text
   ↓
5. setState() updates currResponse & currThinking
   ↓
6. ChatWindow re-renders with isLoading=true
   ↓
7. MessageBubble displays streaming content live
   ↓
8. ThinkingBlock shows last 200 chars with animation
```

### Streaming Parser Format
```
API sends: 〖thinking〗reasoning here〖/thinking〗〖text〗answer here〖/text〗

Parser converts to:
[
  { type: 'thinking', value: 'reasoning here' },
  { type: 'text', value: 'answer here' }
]
```

## Component Quick View

### ChatWindow
- **Props**: `messages`, `isLoading`, `currResponse`, `currThinking`
- **Shows**: Completed messages + streaming message
- **Streaming UI**: Generic loading indicator OR live MessageBubble

### MessageBubble
- **Props**: `content` (array), `isStreaming`, `status`, `error`
- **Routes**: Each content block to appropriate renderer
- **Features**: Copy button, retry button (on hover), error states

### ThinkingBlock
- **Props**: `content` (string), `isStreaming` (boolean)
- **States**:
  - Streaming: Animated dots, last 200 chars preview, no expand
  - Completed/Closed: "View thinking" button + char count
  - Completed/Open: Full thinking text in monospace

### MarkdownRenderer
- **Features**: Bold, italic, code, tables, links, LaTeX
- **Plugins**: remarkGfm, remarkMath, rehypeKatex

## Re-render Optimization

### Why Both Ref and State?

```javascript
// Refs for raw data buffer (no re-renders)
const currResponseRef = useRef([]);    // Direct access in callbacks

// State for UI updates (triggers re-render)
const [currResponse, setCurrentResponse] = useState([]);

// Usage pattern:
contentChunk({ content, tag }) => {
  currResponseRef.current = updated;     // Immediate, no wait
  setCurrResponse(updated);               // Scheduled batch update
}

// When stream ends:
endParser() => {
  // Use ref to get complete buffer
  const full = currResponseRef.current;
  
  // Reset both
  reset();
  setCurrResponse([]);
}
```

## Error Handling

### Error State Structure
```javascript
{
  status: 'error',
  error: {
    message: '请求失败，请检查模型配置后重试。',
    detail: 'Actual error info'
  }
}
```

### Retry Flow
```
User clicks retry button
  ↓
Find message index
  ↓
Slice messages before this one
  ↓
runAssistantTurn() with same ID
  ↓
Message re-rendered in place
```

## Styling & Themes

### Theme Prop
All components accept `theme="default" | "tech"`

**Default Theme:**
- Background: Warm beige (#F5F1EA)
- Text: Gray
- Accents: Cyan

**Tech Theme:**
- Background: Dark navy (#0A192F)
- Text: Muted blue
- Accents: Cyan (#64FFDA)

### Colors
```javascript
tech: {
  primary:   '#0A192F',  // Main bg
  secondary: '#112240',  // Hover/alt
  accent:    '#64FFDA',  // Thinking indicator, active
  text:      '#8892B0',  // Regular text
  highlight: '#CCD6F6',  // Important text
}
```

## File Locations

| Task | File |
|------|------|
| Streaming logic | `src/hooks/useStreaming.js` |
| Parser | `src/utils/StreamingParser.js` |
| Container | `src/components/ChatWindow/ChatWindow.jsx` |
| Message render | `src/components/MessageBubble/MessageBubble.jsx` |
| Thinking display | `src/components/ThinkingBlock/ThinkingBlock.jsx` |
| Markdown | `src/components/MarkdownRenderer/MarkdownRenderer.jsx` |
| Q&A card | `src/components/AnswerMessageCard/AnswerMessageCard.jsx` |
| Main logic | `src/pages/ChatPage/ChatPage.jsx` |
| Message utils | `src/utils/chatMessages.js` |
| Config | `tailwind.config.js` |

## State Management

### useStreaming Hook Returns
```javascript
{
  parser,              // StreamingParser instance
  currResponse,        // Current response blocks array
  currThinking,        // Current thinking string
  currResponseRef,     // Direct ref to response
  currThinkingRef,     // Direct ref to thinking
  feedThinking,        // Function to add thinking chunk
  end,                 // Function to finalize parsing
  reset,               // Function to clear
  resetThinking        // Function to clear thinking
}
```

### ChatPage State
```javascript
const [uiMessages, setUiMessages] = useState([]);      // Display data
const [messages, setMessages] = useState([]);          // Storage data
const [isLoading, setIsLoading] = useState(false);     // Streaming state
const [inputText, setInputText] = useState('');        // User input
```

## Animation Keyframes

### Thinking Block Dots
```css
[animation-delay:0ms]   - First dot
[animation-delay:150ms] - Second dot
[animation-delay:300ms] - Third dot
```

### ThinkingBlock Preview Fade
```css
Gradient fade at top:
from-white/70 to-transparent (h-6)
```

### Overall Pulse
```css
animate-pulse        - Text "thinking..."
```

## Common Issues & Solutions

### Streaming stops updating?
✓ Check `isLoading` state
✓ Verify `currResponse` and `currThinking` are in state
✓ Check `responseParser.feed()` is being called

### ThinkingBlock not showing?
✓ Verify content has `{ type: 'thinking', value: ... }`
✓ Check `isStreaming` prop is set correctly
✓ Ensure `ChatWindow` receives `currThinking`

### Message not rendered after streaming?
✓ Verify `endParser()` is called
✓ Check `syncConversationState()` adds to both arrays
✓ Verify `setIsLoading(false)` is called

### Styling doesn't apply?
✓ Check `theme` prop is passed down
✓ Verify Tailwind class names are correct
✓ Check tech theme colors in tailwind.config.js

## Performance Tips

1. **Ref + State pattern**: Use refs for callbacks, state for UI
2. **Batch updates**: React batches setState calls automatically
3. **Lazy render**: Only messages in viewport are fully rendered
4. **Markdown cache**: useMemo in MarkdownRenderer
5. **Parser cleanup**: dispose() clears timeouts

---

For detailed information, see:
- `MESSAGE_RENDERING_GUIDE.md` — Full technical guide
- `STREAMING_ARCHITECTURE_DIAGRAMS.md` — Visual diagrams
- Source files — Actual implementation
