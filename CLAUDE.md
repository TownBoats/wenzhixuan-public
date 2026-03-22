# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **问知轩/WisClick** - a React-based Q&A interactive framework featuring Socratic questioning methodology. The app encourages deeper learning through AI-driven follow-up questions that prompt users to think critically before receiving answers.

## Common Commands

```bash
# Install dependencies
pnpm install

# Start development server (runs on http://127.0.0.1:5174)
pnpm dev

# Build for production
pnpm build

# Run linter
pnpm lint

# Preview production build
pnpm preview
```

## Architecture

### Technology Stack
- **Build Tool**: Vite 6.x
- **Framework**: React 18.x with React Router DOM 7.x
- **Styling**: Tailwind CSS 3.x with custom theme (tech-themed colors: primary #0A192F, accent #64FFDA)
- **State Management**: Custom React hooks + localStorage persistence
- **i18n**: i18next + react-i18next (supports zh/en)
- **Animation**: Framer Motion + styled-components
- **Markdown**: react-markdown with remark-gfm, remark-math, rehype-katex

### Directory Structure
```
src/
├── components/       # Reusable UI components (23 components)
│   ├── ChatLayout/   # Main chat container
│   ├── ChatWindow/   # Message display area
│   ├── AnswerCard/   # Delayed reveal answer cards
│   ├── QuestionCard/ # Extracted questions for user interaction
│   ├── ModelConfigPanel/ # API key & model settings (BYOK)
│   └── ...
├── pages/
│   ├── ChatPage/     # Main chat interface
│   └── LandingPage/  # Landing/welcome page
├── hooks/            # Custom React hooks
│   ├── useStreaming.js   # Handles SSE streaming responses
│   ├── useQuestionFlow.js # Manages Socratic question flow
│   ├── useChatHistory.js  # Persists chat history to localStorage
│   ├── useAgentsConfig.js # Agent/Model configuration
│   └── useDeveloperMode.js
├── lib/
│   ├── AgentModel.js # Core API client (OpenAI-compatible streaming)
│   └── agents.js     # Agent prompt templates
├── utils/
│   ├── ContentParser.js   # Parses 〖question〗 and 〖response〗 tags
│   └── StreamingParser.js
├── locales/          # i18n translation files
│   ├── en/translation.json
│   └── zh/translation.json
└── services/
    └── prompts.js    # Prompt templates
```

### Dual-Agent System

The app uses a two-agent architecture:

1. **Main Agent** - Socratic tutor that:
   - Uses `〖response〗...〖/response〗` tags for explanations
   - Uses `〖question〕...〖/question〕` tags for follow-up questions

2. **Option Agent** - Answer predictor that:
   - Generates 5 answer levels: none, heard, basic, familiar, expert
   - Uses tags: `〖none〕...〖/none〕`, `〖heard〕...〖/heard〕`, etc.

### Key Data Flow

1. User submits question → Main Agent responds with tagged content
2. Frontend parses `〖question〕` tags in real-time streaming
3. For each extracted question → Option Agent generates answer predictions
4. User selects answer level → Continues conversation context
5. Answer Card has delay reveal mechanism (configurable in settings)

### API Integration

- **BYOK (Bring Your Own Key)**: Users provide their own API endpoint and key
- **OpenAI-compatible**: Works with any OpenAI-format API (GLM, Ollama, etc.)
- **Streaming**: Server-Sent Events for real-time response display
- **Customizable**: Model, temperature, max_tokens, top_p, frequency_penalty, presence_penalty

### Storage

- All data stored in localStorage (no backend required)
- Chat history persists across sessions
- API keys are NOT sent to any external server

## Important Implementation Details

- The `AgentModel` class in `src/lib/AgentModel.js` handles all API communication with retry logic and timeout handling
- Content parsing uses custom `ContentParser` utility to extract tagged content from streaming responses
- Tailwind config includes custom animations (blob, border-flow, fade-in-out) and scrollbar utilities
- ESLint is configured with React hooks rules; run `pnpm lint` before committing
