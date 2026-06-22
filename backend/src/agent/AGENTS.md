# agent/ — Agent Context

AI agent integration module. Implements State Machine orchestrator with Planning, Evaluating, and Self-correction phases. Ollama SSE streaming, native tool calling, context building, and session management.

## Responsibility

- `AgentController` — exposes `POST /api/agent/chat` (SSE streaming endpoint). Uses `@Res({ passthrough: false })` to directly write SSE events.
- `AgentService` — thin orchestrator: resolves provider model, builds context, delegates to `AgentLoopService`, persists messages. Handles the `/agent <slug> <task>` command (parsed by `dto/agent-command.util.ts`): resolves the profile via `AgentProfilesService`, builds context with the profile's system prompt, scopes tools via `filterSubagentTools`, optionally switches to the profile's `modelId`, and runs the loop directly with `agentCmd.slug` as `subagentName` (unknown/disabled slug → error SSE listing enabled slugs).
- `AgentLoopService` — State Machine orchestrator: drives PLANNING → EXECUTING → EVALUATING → CORRECTING → RESPONDING → DONE loop, executes tools, emits SSE events. Implements `runPlanMode()` and `executePlan()` for Plan Mode. Detects `[PLAN_CREATED]` marker from `create_plan` tool execution and routes to approval (`[DONE]`) or auto-execution (`executePlan()`). Emits `planInterrupted` SSE event when a plan execution is aborted.
- `LLMControllerService` — provider-agnostic LLM routing: selects registered provider, manages message history, builds message arrays. Exposes `stream()` (async generator) and `generateCompletion()` (non-streaming, collects full response).
- `danger-patterns.config` — pattern-based block rules (`BLOCK_RULES`) and `matchDangerPattern()` for fast-path security evaluation. Covers interpreters, package runners, network, cloud CLIs, git destructive, etc.
- `denial-tracking` — `DenialTracker` class: limits consecutive (3) and total (20) denials before falling back to fail-closed state.
- `OllamaProvider` — raw LLM streaming only: calls Ollama `/api/chat`, yields `StreamChunk` objects (token/tool_call/done/error). No tool execution or loop logic.
- `ContextBuilderService` — builds system prompt with tool definitions (filtered via `ModePolicyService`) + agent output path info + OS environment info (platform, cwd, user home), loads chat history from Prisma. Strips `spawn_subagent`/`delegate` from the main agent's tools when `Setting agent.autoDispatch === 'false'` (default keeps them).
- `PermissionsService` — manages tool permission config stored in `Setting` table under key `agent.permissions`. Exposes `getConfig`, `updateConfig`, and `isAllowed(toolName)`.
- `YoloClassifierService` — 2-stage security classifier: fast-path allowlist, pattern matching (danger-patterns), Stage 1 LLM gate, Stage 2 LLM detailed analysis. Integrates `DenialTracker` to prevent abuse loops. Configurable via `YoloConfig`.
- `SubagentService` — spawns sub-agents by delegating to `AgentLoopService.run` with a sub-agent system prompt. Prefixes all SSE events with `subagent:true` marker and converts `[DONE]` to a JSON event to prevent premature stream termination. `spawn_subagent`/`delegate` accept an optional `profile` slug: the loop resolves it via `AgentProfilesService.findBySlug`, applying the profile's system prompt + scoped tools (`filterSubagentTools`); dispatch tools are always stripped from sub-agents (→ depth 1). An unknown/disabled slug yields a `Error: unknown agent profile "<slug>"` tool result without throwing.

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
│   ├── approve-tool.dto.ts    — body for POST /api/agent/approve-tool
│   ├── permissions-config.ts  — PermissionsConfig types (per-mode tool rules)
│   ├── update-permissions.dto.ts — body for PATCH /api/agent/permissions
│   ├── yolo-config.dto.ts     — YoloConfig DTO for GET/PATCH /api/agent/yolo-config
│   ├── write-stream.interface.ts — SSE write-stream abstraction
│   ├── execute-plan.dto.ts    — execute-plan body shape
│   └── agent-command.util.ts  — parseAgentCommand for the /agent <slug> <task> command
├── services/
│   ├── agent-loop.service.ts            — State Machine orchestrator (main loop)
│   ├── agent-loop.service.spec.ts
│   ├── llm-controller.service.ts        — provider-agnostic LLM routing + message building + generateCompletion (non-streaming)
│   ├── context-builder.service.ts       — builds LLM context with tool definitions (via ModePolicyService), history, agent output path instructions
│   ├── context-builder.service.spec.ts
│   ├── permissions.service.ts           — tool permission config: getConfig/updateConfig/isAllowed + decide() with 6-mode dispatch
│   ├── permissions.service.spec.ts
│   ├── approval-manager.service.ts      — tracks pending tool-call approvals; resolves on POST /approve-tool
│   ├── danger-patterns.config.ts        — pattern-based BLOCK_RULES + matchDangerPattern
│   ├── danger-patterns.config.spec.ts
│   ├── denial-tracking.ts               — DenialTracker (consecutive/total limits)
│   ├── denial-tracking.spec.ts
│   ├── yolo-classifier.constants.ts     — YOLO system prompt + stage prompt suffixes + allowlist
│   ├── yolo-classifier.service.ts       — 2-stage LLM classifier (YoloResult/YoloConfig)
│   └── yolo-classifier.service.spec.ts
├── subagent/
│   ├── subagent.service.ts         — spawns sub-agents + delegate() parallel orchestration with SSE progress; adds `subagentName` to SSE events and prefixes saved messages with `[subagent:<name>]` for persistence
│   ├── subagent.service.spec.ts
│   ├── subagent-tools.util.ts      — filterSubagentTools (strips dispatch tools + applies allowedTools) + runWithConcurrency
│   └── subagent-tools.util.spec.ts
├── mcp/
│   ├── mcp.module.ts               — MCP integration module
│   ├── mcp.service.ts              — manages configured MCP servers + exposes their tools to the loop
│   └── mcp-client.service.ts       — per-server MCP client (connect, list tools, call tool)
└── providers/
    ├── llm-provider.interface.ts   — LLMProvider interface + StreamChunk/OllamaMessage/StreamOptions types
    ├── ollama.provider.ts          — raw Ollama stream only (no loop/tool/SSE logic)
    ├── ollama.provider.spec.ts
    └── openai.provider.ts          — OpenAI-compatible streaming provider (OpenAI/DeepSeek spec)
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

**`POST /api/agent/approve-tool`**

Approve or deny a pending tool call (resolved by `ApprovalManagerService`). Body: see `approve-tool.dto.ts`.

**`GET` / `PATCH /api/agent/yolo-config`**

Get / update the YOLO classifier config (`yolo-config.dto.ts`).

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
| `(subagentName)` | `"researcher"` | Optional string added to any SSE event emitted from a sub-agent run; identifies the active sub-agent profile |
| `error` | `{error: string}` | Error occurred |
| `plan` | `{id, title, status, steps:[{id,order,text,status}]}` | LLM proposes a plan (runPlanMode or create_plan tool) |
| `planStepUpdate` | `{planId, stepId, status}` | Step changes state during plan execution |
| `planInterrupted` | `{planId, stepId, reason}` | Plan execution was aborted by user (followed by `[DONE]`; also persisted to session history as system message) |
| `subagent` | `{subagent: true, ...original}` | Added by SubagentService to all original SSE events from sub-agent runs; `{subagent:true, done:true}` replaces `[DONE]` |


## State Machine Loop

1. Resolve provider model from `ProvidersService` (get baseUrl + key + model name)
2. Build context (system prompt + tool definitions + chat history)
3. **PLANNING** → **EXECUTING**: stream LLM response (unlimited iterations — LLM self-evaluates and decides when done)
4. If tool_calls present: execute each tool, feed results back to LLM, continue loop
   - If `create_plan` returns `[PLAN_CREATED]` marker: emit `plan` SSE, route to approval (emit `[DONE]` and return) or auto-execute via `executePlan()` and return
5. If no tool_calls → **RESPONDING**: LLM decided task is complete, emit final text tokens
6. **DONE**: emit `[DONE]` SSE event

Tools available (gated by the Tools registry `enabled` flag and `ModePolicyService` per mode) — task/note CRUD (create_task, update_task, list_tasks, get_task, delete_tasks, create_note, update_note, list_notes, delete_note, convert_note_to_task), planning (create_plan, resume_plan, spawn_subagent), knowledge/web (search_knowledge, web_fetch, web_search), file ops (read_file, write_file, list_directory, grep, run_command [disabled by default]), Office (read_excel, write_excel, list_excel_sheets, excel_add_sheet, excel_chart, read_word, write_word, edit_word), Google connectors (gmail/calendar/drive/sheets), GitHub (search repos, issue CRUD, PR listing, commits), Slack (send message, list channels, history, search), and Notion (search, get/create/update page, query database). See `tools/AGENTS.md` for the authoritative executor list.

Permission check: before each tool execution, `PermissionsService.isAllowed(name)` is called. Denied tools emit a `toolResult` denial SSE and continue to next tool call.

## Key Patterns

- **AgentRunState.currentState**: tracks active AgentState for observability
- **Lazy agent message**: frontend creates agent message on first `token` event to ensure correct ordering
- **Tool execution via ToolExecutor interface**: `AgentLoopService` injects all executor instances directly
- **Provider resolution**: `AgentService` resolves `providerModelId` → `ProviderModel` → provider config (baseUrl, key) at request start

## Dependencies

- ModePolicyModule (tool filtering per agent mode)
- PlansModule (plan persistence + approve/reject via AgentService)
- ScheduleTasksModule (`forwardRef`) — `create_task` / `convert_note_to_task` executors
- KnowledgeModule (search_knowledge executor)
- SessionsModule (chat history CRUD)
- ProvidersModule (provider model resolution)
- ToolsModule (all ToolExecutor implementations)
- NotesModule (note tool executors — create/update/list/delete/convert)
- ConnectorModule (Google connector services + OAuth)
- MemoryModule (memory context injection + extraction)
- McpModule (external MCP server tools)
- CoworkModule (active project path resolution)
- WorkspaceModule (file-op path validation)
- ExcelModule (excel tool executors)
- AgentProfilesModule (resolves `profile` slug → system prompt + scoped tools for spawn_subagent/delegate)


## Testing

```bash
npx jest src/agent          # 12 suites, 75 tests
npx jest --watch            # watch mode
```

Tests mock `LLMControllerService`, `ContextBuilderService`, tool executors.
