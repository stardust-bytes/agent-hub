# Chat/Agent Mode Switching — Phase 1 Design

**Date:** 2026-06-07
**Status:** Draft

## Goal

Add a Chat/Agent mode toggle to the workspace. Chat mode provides a pure LLM conversation without tool calling. Agent mode (existing behavior) runs the ReAct loop with tool execution.

## Architecture

```
Frontend                          Backend
┌─────────────────────┐           ┌──────────────────────┐
│ ChatPanel.vue       │  POST     │ AgentController      │
│  mode: chat|agent   │ ────────→│  chatDto.mode         │
│  toggle below input  │           │  'chat' → streamLLM   │
│                     │  SSE      │  'agent' → ReAct loop │
│ ArtifactsPanel.vue  │ ←─────── │                      │
│  tool trace (agent)  │           └──────────────────────┘
└─────────────────────┘
```

## Scope

Phase 1 only — UI mode + routing. Tool registry (Phase 2), MCP (Phase 3), autonomy (Phase 4) are out of scope.

## Backend Changes

### ChatDto (`backend/src/agent/dto/chat.dto.ts`)
- Add field `mode: string` (`@IsString() @IsOptional()`, default `'chat'`)

### AgentService (`backend/src/agent/agent.service.ts`)
- `streamChat()` receives `mode` from controller
- `'chat'`: build messages with empty tools array, call provider, no ReAct loop
- `'agent'`: existing behavior — ContextBuilder + ReAct loop + tool definitions

### ContextBuilderService (`backend/src/agent/services/context-builder.service.ts`)
- `build()` receives optional `mode` param
- If `mode === 'chat'`, return empty `tools: []`
- If `mode === 'agent'`, return default tool definitions as before

### Provider (OllamaProvider)
- No changes needed — it already works based on tool definitions passed in context

## Frontend Changes

### ChatPanel.vue
- Add `mode` ref: `'chat' | 'agent'`, default `'chat'`
- Toggle pill below input row: `[ Chat | Agent ]`
  - Active mode: `bg-cyber-accent/15 text-cyber-accent`
  - Inactive mode: `text-cyber-accent/50 hover:text-cyber-accent`
- Request body includes `mode` field
- Chat mode: parse only `token` SSE events, no toolCall/toolResult/thinking
- Agent mode: existing SSE parsing (token, toolCall, toolResult, thinking)

### ArtifactsPanel.vue
- Phase 1: simple tool trace display when in agent mode
- Shows tool call → result log from recent agent execution

### ModelSelector row
- Toggle + ModelSelector on same line below input:
```
┌─────────────────────────────┐
│ $ █ type something...       │
├─────────────────────────────┤
│ [ Chat | Agent ]  llama3.2 ▾│
└─────────────────────────────┘
```

## Data Flow

### Chat Mode
1. User types message, mode = `'chat'`
2. POST `/api/agent/chat` `{ message, mode: 'chat', sessionId, model }`
3. Backend builds context with empty tools, streams LLM directly
4. Frontend renders token events only
5. Messages persisted to session

### Agent Mode (existing)
1. User types message, mode = `'agent'`
2. POST `/api/agent/chat` `{ message, mode: 'agent', sessionId, model }`
3. Backend builds context with tools, runs ReAct loop
4. Frontend renders token, toolCall, toolResult, thinking events
5. Messages persisted to session

## Files Changed

| File | Change |
|---|---|
| `backend/src/agent/dto/chat.dto.ts` | Add `mode` field |
| `backend/src/agent/agent.service.ts` | Branch on `mode` param |
| `backend/src/agent/services/context-builder.service.ts` | Accept `mode`, return empty tools for chat |
| `frontend/src/components/ChatPanel.vue` | Add toggle, branch SSE parsing |
| `frontend/src/components/ArtifactsPanel.vue` | Show tool trace in agent mode |

## Non-Goals
- No new backend endpoint — reuse `POST /api/agent/chat`
- No new database tables
- No changes to sessions, tasks, knowledge modules
- No tool registry changes (Phase 2)
- No MCP integration (Phase 3)
- No agent planning/memory (Phase 4)
