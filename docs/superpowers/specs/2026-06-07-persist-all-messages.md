# Persist All Chat Messages

## Overview

Save all message types (tool calls, tool results, thinking indicators) to the session database, not just user and assistant messages.

## Motivation

Currently only `user` and `assistant` messages survive a page refresh. Tool calls, tool results, and thinking indicators are streamed via SSE but never persisted. Loading a session only shows user inputs and agent replies, losing the full conversation context.

## Design

### Schema Change

Add two nullable fields to `ChatMessage`:

```prisma
model ChatMessage {
  id        Int      @id @default(autoincrement())
  sessionId Int
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      String
  content   String
  toolName  String?   // "create_task", "search_knowledge", etc. — null for user/assistant/system
  isResult  Boolean   @default(false)  // true for tool results, false for tool calls
  createdAt DateTime @default(now())
}
```

### Backend Changes

#### SessionsService.saveMessage()
Expand the type signature to accept optional `toolName` and `isResult`:
```ts
async saveMessage(sessionId: number, role: string, content: string, toolName?: string, isResult?: boolean)
```

#### OllamaProvider
Inject `SessionsService`. During the ReAct loop, save messages as they occur:
- Tool call → `saveMessage(sessionId, 'tool', toolName+"("+args+")", toolName, false)`
- Tool result → `saveMessage(sessionId, 'tool', result, toolName, true)`
- Thinking → `saveMessage(sessionId, 'system', thinkingText)`

Requires passing `sessionId` through `streamChat()` from `AgentService`.

#### AgentService
Pass `sessionId` to `provider.streamChat()` so the provider can persist messages during the ReAct loop.

### Frontend Change

#### loadSession()
When loading history from `GET /api/sessions/:id/messages`, map the `toolName` and `isResult` fields to the frontend Message type:

```ts
if (msg.toolName) {
  // map to tool call/result message type
}
```

### Data Flow

```
Before:
  AgentService → provider.streamChat() → SSE only (no persistence)
  AgentService → saveMessage('user') + saveMessage('assistant') after stream

After:
  OllamaProvider.streamChat() → saveMessage('tool') + saveMessage('system') during stream
  AgentService → saveMessage('user') + saveMessage('assistant') after stream (unchanged)
```

### Files Changed

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `toolName` and `isResult` to ChatMessage |
| `backend/src/sessions/sessions.service.ts` | Expand `saveMessage` signature |
| `backend/src/sessions/sessions.service.spec.ts` | Update tests |
| `backend/src/agent/providers/ollama.provider.ts` | Inject SessionsService, save messages |
| `backend/src/agent/providers/ollama.provider.spec.ts` | Update tests |
| `backend/src/agent/agent.service.ts` | Pass `sessionId` to provider |
| `frontend/src/components/ChatPanel.vue` | Update `loadSession` mapping |
