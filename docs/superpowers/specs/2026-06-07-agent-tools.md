# Phase 6 — Agent Tools & Agentic Automation

**Date:** 2026-06-07
**Status:** Draft
**Goal:** AI agent can autonomously execute actions (create/update/list tasks, search knowledge base) during chat, with tool calls displayed as separate cards in the UI.

---

## 1. User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| AGT-1 | User says "Tạo task cài đặt auth module priority cao" → agent creates task | Task appears in Kanban Board, agent confirms via chat |
| AGT-2 | Agent searches knowledge base when needing context | Agent calls `search_knowledge`, injects results into response |
| AGT-3 | User sees tool execution log in real-time | ChatPanel shows `[⚙] create_task(...)` → `[result] Task #42 created` as separate cards |
| AGT-4 | User sees error when tool fails | Error message displayed instead of silent failure |
| AGT-5 | Agent chains multiple tools | Multiple tool calls + results shown sequentially, then final text |

---

## 2. Backend

### Tool Definitions

Defined in `AgentService`, sent to Ollama with each chat request:

| Tool | Description | Parameters |
|---|---|---|
| `create_task` | Create a new task | `title` (required), `priority` (0-2), `description` |
| `update_task` | Update task status/priority | `id` (required), `status`, `priority` |
| `list_tasks` | List tasks, optional filter | `status` (optional filter) |
| `search_knowledge` | Search knowledge base | `query` (required) |

### AgentService Flow

1. Build messages array: system context + user message
2. Send to Ollama `/api/chat` with `tools: TOOLS` and `stream: true`
3. Read NDJSON stream — handle two response types:
   - **Text response** (`message.content`): emit SSE `data: {"token":"..."}` (existing flow)
   - **Tool call** (`message.tool_calls`): emit SSE `data: {"toolCall":{name, args}}`, execute tool, emit SSE `data: {"toolResult":{name, result}}`
4. If tool calls exist → after executing all, send results back to Ollama for final text
5. Loop until no more tool calls

### Tool Execution

- `create_task` → `TasksService.create()`
- `update_task` → `TasksService.update()`
- `list_tasks` → `TasksService.findAll()`
- `search_knowledge` → `KnowledgeService.search()`

### SSE Event Types (added to existing token/DONE events)

| Event | Payload | When |
|---|---|---|
| `data: {"toolCall":{"name":"create_task","args":{...}}}` | Tool call start | Before execution |
| `data: {"toolResult":{"name":"create_task","result":"Task #42 created"}}` | Tool result | After execution |

### No changes needed:
- `TasksService` — already has CRUD methods
- `KnowledgeService.search()` — already implemented (text-based)
- `TasksGateway` — already emits Socket.io events (Kanban updates)

---

## 3. Frontend — ChatPanel

### Tool Call Cards

New message role type `'tool'` in the `Message` interface:

```typescript
interface Message {
  role: 'user' | 'agent' | 'system' | 'tool'
  content: string
  timestamp: string
  typing?: boolean
  toolName?: string       // for tool messages
  isResult?: boolean      // true = result, false = call
}
```

Rendering:
- `role === 'tool' && !isResult`: `[⚙] toolName(args...)` in amber/blue card
- `role === 'tool' && isResult`: `[result] resultText` in green card

### Typescript Changes

Add tool card rendering to the ChatPanel template. Tool cards have:
- Background `bg-cyber-dark` with left border accent
- Prefix `[⚙]` in amber for calls, `[result]` in green for results
- Monospace args display

---

## 4. SSE Parser Update

Current parser handles `token` and `error` events. Add handling for `toolCall` and `toolResult`:

```typescript
if (parsed.toolCall) {
  const { name, args } = parsed.toolCall
  // Push tool call message
  messages.value.push({
    role: 'tool',
    content: `${name}(${formatArgs(args)})`,
    timestamp: now(),
    toolName: name,
    isResult: false,
  })
} else if (parsed.toolResult) {
  // Push tool result message
  messages.value.push({
    role: 'tool',
    content: parsed.toolResult.result,
    timestamp: now(),
    toolName: parsed.toolResult.name,
    isResult: true,
  })
}
```

---

## 5. Files to Modify

- `backend/src/agent/agent.service.ts` — add tool definitions + execution loop
- `backend/src/agent/agent.service.spec.ts` — update tests
- `backend/src/agent/providers/ollama.provider.ts` — handle tool_calls in stream
- `frontend/src/components/ChatPanel.vue` — tool card rendering + SSE parsing

---

## 6. Implementation Order

1. Define tool schemas + execution in `AgentService`
2. Update `OllamaProvider` to send tools and parse `tool_calls` from NDJSON stream
3. Add tool call + tool result SSE events
4. Frontend: add tool card rendering + SSE parser
5. Verify: backend tests pass, frontend builds, manual E2E test
