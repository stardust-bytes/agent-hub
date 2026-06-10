# agent/ — Agent Context

AI agent integration module. Implements State Machine orchestrator with Planning, Evaluating, and Self-correction phases. Ollama SSE streaming, native tool calling, context building, and session management.

## Responsibility

- `AgentController` — exposes `POST /api/agent/chat` (SSE streaming endpoint). Uses `@Res({ passthrough: false })` to directly write SSE events.
- `AgentService` — thin orchestrator: resolves provider model, builds context, delegates to `AgentLoopService`, persists messages.
- `AgentLoopService` — State Machine orchestrator: drives PLANNING → EXECUTING → EVALUATING → CORRECTING → RESPONDING → DONE loop, executes tools, emits SSE events. Implements `runPlanMode()` and `executePlan()` for Plan Mode. Detects `[PLAN_CREATED]` marker from `create_plan` tool execution and routes to approval (`[DONE]`) or auto-execution (`executePlan()`). Emits `planInterrupted` SSE event when a plan execution is aborted.
- `LLMControllerService` — provider-agnostic LLM routing: selects registered provider, manages message history, builds message arrays.
- `OllamaProvider` — raw LLM streaming only: calls Ollama `/api/chat`, yields `StreamChunk` objects (token/tool_call/done/error). No tool execution or loop logic.
- `ContextBuilderService` — builds system prompt with tool definitions (filtered via `ModePolicyService`) + agent output path info + OS environment info (platform, cwd, user home), loads chat history from Prisma.
- `PermissionsService` — manages tool permission config stored in `Setting` table under key `agent.permissions`. Exposes `getConfig`, `updateConfig`, and `isAllowed(toolName)`.

## Files

```
agent/
├── agent.module.ts
├── agent.controller.ts
├── agent.controller.spec.ts
├── agent.service.ts
├── agent.service.spec.ts
├── dto/
│   ├── chat.dto.ts           — message, providerModelId (Int), sessionId (Int), mode? ('agent'|'chat')
│   ├── agent-run-state.ts     — execution tracking (steps, duration, iterations, currentState)
│   ├── agent-state.enum.ts    — AgentState enum (PLANNING/EXECUTING/EVALUATING/CORRECTING/RESPONDING/DONE)
│   ├── agent-action.dto.ts    — text-based action parser (activate_skill, search_kb, respond)
│   └── execute-plan.dto.ts    — DTO for POST /api/agent/plans/:id/execute body
├── services/
│   ├── agent-loop.service.ts       — State Machine orchestrator (main loop)
│   ├── agent-loop.service.spec.ts
│   ├── llm-controller.service.ts   — provider-agnostic LLM routing + message building
│   ├── context-builder.service.ts  — builds LLM context with tool definitions (via ModePolicyService), history, agent output path instructions
│   ├── context-builder.service.spec.ts
│   ├── permissions.service.ts      — tool permission config: getConfig/updateConfig/isAllowed
│   └── permissions.service.spec.ts
└── providers/
    ├── llm-provider.interface.ts   — LLMProvider interface + StreamChunk/OllamaMessage/StreamOptions types
    ├── ollama.provider.ts          — raw Ollama stream only (no loop/tool/SSE logic)
    └── ollama.provider.spec.ts
```

## API

**`POST /api/agent/chat`**

Request body:
```json
{ "message": "string", "providerModelId": 1, "sessionId": 1, "mode": "agent" }
```

Response: SSE stream (text/event-stream)
```
data: {"token":"..."}
data: {"toolCall":{"name":"create_task","args":{...}}}
data: {"toolResult":{"name":"create_task","result":"..."}}
data: {"thinking":"Synthesizing..."}
data: [DONE]
```

**`GET /api/agent/permissions`**

Get current tool permissions config.

**`PATCH /api/agent/permissions`**

Update tool permissions config.

**`POST /api/agent/chat` (plan approve/reject/resume)**

Plan execution is now handled inside the main `/chat` SSE stream. Send messages prefixed with `/plan approve <id>`, `/plan reject <id>`, or `/plan resume <id>` in cowork mode. The backend executes the plan and streams events through the same SSE connection.

## SSE Events

| Event | Shape | When |
|---|---|---|
| `token` | `{token: string}` | Streaming LLM response text |
| `toolCall` | `{toolCall: {name, args}}` | LLM requested a tool call |
| `toolResult` | `{toolResult: {name, result}}` | Tool execution completed |
| `thinking` | `{thinking: string}` | Synthesis/processing indicator |
| `[DONE]` | plain text | Stream complete |
| `error` | `{error: string}` | Error occurred |
| `plan` | `{id, title, status, steps:[{id,order,text,status}]}` | LLM proposes a plan (runPlanMode or create_plan tool) |
| `planStepUpdate` | `{planId, stepId, status}` | Step changes state during plan execution |
| `planInterrupted` | `{planId, stepId, reason}` | Plan execution was aborted by user (followed by `[DONE]`; also persisted to session history as system message) |

## State Machine Loop

1. Resolve provider model from `ProvidersService` (get baseUrl + key + model name)
2. Build context (system prompt + tool definitions + chat history)
3. **PLANNING** → **EXECUTING**: stream LLM response, collect tokens + tool_calls
4. If tool_calls present → **EVALUATING**: execute each tool, check result quality
   - If `create_plan` returns `[PLAN_CREATED]` marker: emit `plan` SSE, route to approval (emit `[DONE]` and return) or auto-execute via `executePlan()` and return
5. If result OK → back to **EXECUTING** (continue loop, max 10 iterations)
6. If result fails → **CORRECTING**: retry up to 2× with different args, then try fallback tool, then ask user
7. No tool_calls or correction exhausted → **RESPONDING**: emit final text tokens
8. **DONE**: emit `[DONE]` SSE event

Tools available: create_task, update_task, list_tasks, get_task, delete_tasks, search_knowledge, web_fetch, web_search, create_note, update_note, list_notes, delete_note, convert_note_to_task, resume_plan, create_plan

Permission check: before each tool execution, `PermissionsService.isAllowed(name)` is called. Denied tools emit a `toolResult` denial SSE and `continue` (skip CORRECTING).

Self-correction fallback map: `web_fetch` → `web_search`, `search_knowledge` → `web_search`

## Key Patterns

- **AgentRunState.currentState**: tracks active AgentState for observability
- **Lazy agent message**: frontend creates agent message on first `token` event to ensure correct ordering
- **Tool execution via ToolExecutor interface**: `AgentLoopService` injects all executor instances directly
- **Provider resolution**: `AgentService` resolves `providerModelId` → `ProviderModel` → provider config (baseUrl, key) at request start

## Dependencies

- ModePolicyModule (tool filtering per agent mode)
- PlansModule (plan persistence + approve/reject via AgentService)
- TasksModule (task tool executors)
- KnowledgeModule (search_knowledge executor)
- SessionsModule (chat history CRUD)
- ProvidersModule (provider model resolution)
- ToolsModule (all ToolExecutor implementations)
- NotesModule (note tool executors — create/update/list/delete/convert)


## Testing

```bash
npx jest src/agent          # 8 suites, 56 tests
npx jest --watch            # watch mode
```

Tests mock `LLMControllerService`, `ContextBuilderService`, tool executors.
