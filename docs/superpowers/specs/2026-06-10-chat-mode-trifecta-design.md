# Chat Mode Trifecta Design

## Problem

ChatPanel currently has 2 modes (Chat/Agent) with simplistic tool filtering (chat = no tools, agent = all tools). Need 3 distinct modes with different tool sets, system prompts, and workspace boundaries.

## Solution

### Backend — ChatDto mode enum
Extend from `'agent' | 'chat'` to `'agent' | 'chat' | 'cowork'`.

### Backend — Tool filtering (AgentLoopService.run)
- `chat`: only `web_search`, `web_fetch` tools provided to LLM
- `agent`: all tools (except cowork project path is NOT mentioned in prompt)
- `cowork`: all tools (workspace_data NOT mentioned in prompt, cowork project IS)

### Backend — System prompts (ContextBuilderService)
- Add `mode` param to `build()` method
- **Chat**: simple Q&A prompt, no tool definitions, no environment info. "You are a helpful assistant. Use web_search and web_fetch when needed."
- **Agent**: full prompt with all tool definitions. Cowork project path omitted.
- **Cowork**: full prompt with all tool definitions. Workspace_data omitted, cowork project path included.

### Frontend — 3-way toggle
Replace 2-button toggle with 3-button toggle (Chat / Agent / Cowork).

### Files Changed

| File | Change |
|---|---|
| `backend/src/agent/dto/chat.dto.ts` | `@IsIn(['agent', 'chat', 'cowork'])` |
| `backend/src/agent/agent.service.ts` | Pass mode to contextBuilder.build() |
| `backend/src/agent/services/context-builder.service.ts` | Add `mode` param to `build()`, different prompts |
| `backend/src/agent/services/agent-loop.service.ts` | `activeTools` logic: chat→web only, others→all |
| `frontend/src/components/ChatPanel.vue` | 3-way mode toggle |
| `frontend/src/locales/vi.json` | `chat.mode.cowork` |
| `frontend/src/locales/en.json` | `chat.mode.cowork` |
