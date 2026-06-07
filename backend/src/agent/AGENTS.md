# agent/ — Agent Context

AI agent integration module. Implements full ReAct loop with Ollama SSE streaming, native tool calling (create_task, update_task, list_tasks, search_knowledge), context building, and session management.

## Responsibility

- `AgentController` — exposes `POST /api/agent/chat` (SSE streaming endpoint).
- `AgentService` — orchestrator: builds context via `ContextBuilderService`, calls `OllamaProvider`, persists messages via `SessionsService`.
- `OllamaProvider` — ReAct loop host: streams LLM via `LLMCallerService`, executes tools, emits SSE events (token/toolCall/toolResult/thinking/[DONE]).
- `ContextBuilderService` — builds system prompt with tool definitions, loads chat history from Prisma.
- `LLMCallerService` — LLM streaming abstraction: calls Ollama API, yields StreamChunk objects (token/tool_call/done/error).
- `SessionsService` — CRUD for chat sessions.

## Files

```
agent/
├── agent.module.ts
├── agent.controller.ts
├── agent.controller.spec.ts
├── agent.service.ts
├── agent.service.spec.ts
├── dto/
│   ├── chat.dto.ts
│   ├── agent-run-state.ts     — execution tracking (steps, duration, iterations)
│   └── agent-action.dto.ts    — text-based action parser (activate_skill, search_kb, respond)
├── services/
│   ├── context-builder.service.ts  — builds LLM context with tool definitions + history
│   └── llm-caller.service.ts       — Ollama streaming + native tool calling
└── providers/
    ├── llm-provider.interface.ts
    ├── ollama.provider.ts          — ReAct loop: stream → tool_calls → execute → loop → respond
    └── ollama.provider.spec.ts
```

## API

**`POST /api/agent/chat`**

Request body:
```json
{ "message": "string", "model": "string (optional)", "sessionId": "number" }
```

Response: SSE stream (text/event-stream)
```
data: {"token":"..."}
data: {"toolCall":{"name":"create_task","args":{...}}}
data: {"toolResult":{"name":"create_task","result":"..."}}
data: {"thinking":"Synthesizing..."}
data: [DONE]
```

## SSE Events

| Event | Shape | When |
|---|---|---|
| `token` | `{token: string}` | Streaming LLM response text |
| `toolCall` | `{toolCall: {name, args}}` | LLM requested a tool call |
| `toolResult` | `{toolResult: {name, result}}` | Tool execution completed |
| `thinking` | `{thinking: string}` | Synthesis/processing indicator |
| `[DONE]` | plain text | Stream complete |
| `error` | `{error: string}` | Error occurred |

## ReAct Loop

1. Build context (system prompt + tool definitions + chat history)
2. Stream LLM response (native tool calling via Ollama API)
3. If tool_calls present: execute each tool (create_task, update_task, list_tasks, search_knowledge)
4. For search_knowledge: inject synthesis prompt and loop back to LLM
5. No tool_calls: emit response tokens and end

Tools available: create_task, update_task, list_tasks, search_knowledge

## Key Patterns

- **AgentRunState**: tracks step count, duration, step history for observability
- **Lazy agent message**: frontend creates agent message on first `token` event to ensure correct ordering
- **Tool execution via TasksService/KnowledgeService**: direct service injection (no adapter layer)

## Dependencies

- TasksModule (tool execution)
- KnowledgeModule (RAG search)
- SessionsModule (chat history CRUD)
- SettingsService (Ollama base URL from global SettingsModule)

## Testing

```bash
npx jest src/agent          # 3 suites, 16 tests
npx jest --watch            # watch mode
```

Tests mock `LLMCallerService`, `ContextBuilderService` as async generators/functions.
