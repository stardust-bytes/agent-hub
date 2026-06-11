# Multi-Agent: Subagent Spawn (Cowork Model)

## Overview

Implement `spawn_subagent` as a native tool within the agent loop, following Claude Code's subagent pattern. The main agent delegates sub-tasks to a subagent that runs an independent state machine loop synchronously, sharing the same tool registry and filesystem.

## Status

Design approved. Pending implementation.

## Prerequisites

- Agent Loop (State Machine) — ✅ Done
- Permissions System — ✅ Done
- MCP Protocol — 🟡 In progress (Playwright MCP connected)
- Context Management — ❌ Not required for this feature

## Architecture

### Execution Flow

```
Main EXECUTING → LLM returns tool_call spawn_subagent(task)
  → SubagentService.spawn(task, sharedContext)
    → AgentLoopService.run()  // re-entrant call
      → subagent PLANNING → EXECUTING → EVALUATING → CORRECTING → RESPONDING → DONE
    → returns result string
  → ToolResult("spawn_subagent", result)
→ Main EXECUTING continues
```

### Sub-loop isolation

Each sub-loop gets its own:

- **AgentRunState** — separate `step`, `maxIterations`, `currentState`, `startTime`
- **System prompt** — built from the task description:
  > "You are a sub-agent. Your task: {task}. You have access to the same workspace. Complete the task and report back."
- **Tool set** — same as main agent, EXCEPT `spawn_subagent` is excluded (prevent recursion)
- **LLM call** — separate call using the same provider/model

The sub-loop reuses `AgentLoopService.run()` directly via a wrapper that manages context injection and event prefixing.

### SSE Events

New event types prefixed with `subagent:` to distinguish from main agent events:

| Event | Payload | When |
|---|---|---|
| `subagent:start` | `{ task }` | Subagent begins |
| `subagent:token` | `{ token }` | Streaming subagent text |
| `subagent:toolCall` | `{ name, args }` | Subagent invoked a tool |
| `subagent:toolResult` | `{ name, result }` | Tool execution complete |
| `subagent:thinking` | `{ thinking }` | Subagent synthesizing |
| `subagent:done` | `{ result }` | Subagent completed |

### Persistence

- Subagent messages are **NOT persisted** to the Session's ChatMessage table
- The main agent may choose to include subagent results in its own response which gets persisted normally

### Tool Policy

- Subagent shares the **same ToolRegistry** as the main agent
- **Blocked:** `spawn_subagent` — prevents infinite recursion
- **Permissions:** `PermissionsService.isAllowed()` applies identically

### Error Handling

| Scenario | Behavior |
|---|---|
| Subagent LLM error | Tool result: `[Subagent failed: {error}]` |
| Subagent max iterations | Tool result: `[Subagent reached max iterations. Partial result: {output}]` |
| Subagent tool execution failure | Normal self-correction within sub-loop |
| Subagent success | Tool result: `[Subagent completed: {final_output}]` |

The subagent can fail independently without affecting the main agent's loop. The main agent receives the error as a tool result and can decide how to proceed.

## Files to Create

```
src/agent/subagent/
├── subagent.service.ts           — orchestrates sub-loop execution
├── subagent.service.spec.ts      — tests
├── subagent-executor.service.ts  — tool executor for 'spawn_subagent'
└── subagent-executor.service.spec.ts
```

Modify:
- `src/agent/agent.module.ts` — register SubagentModule
- `src/agent/services/agent-loop.service.ts` — expose `run()` for re-entrant call if needed
- `src/agent/dto/tool-registry.service.ts` — register `spawn_subagent` tool (unless already dynamic)

## Frontend Changes

### New event handlers

The SSE stream consumer in `frontend/src/` must handle `subagent:*` events:

- `subagent:start` → create a subagent block in the chat
- `subagent:token` → append text to the active subagent block
- `subagent:toolCall` → show tool call line inside the block
- `subagent:toolResult` → show tool result line
- `subagent:thinking` → show thinking indicator
- `subagent:done` → finalize block, make collapsible

### UI Component

Render subagent output as a nested, collapsible block:

```
┌─ [subagent] Task description ──────────────┐
│ ⟳ tool_call: analyze_package               │
│ ✅ tool result: ...                         │
│ Output text here...                         │
└─────────────────────────────────────────────┘
```

- Background: `bg-cyber-code-bg`
- Border: `border border-cyber-code-border rounded`
- Title bar: `bg-cyber-dark` with task name
- Collapsible via click on title bar
- Terminal-style progress indicators inside

## Dependencies

- AgentLoopService (re-entrant call)
- ToolRegistry (shared tool definitions + executors)
- PermissionsService (tool access control)
- LLMControllerService (provider resolution)

## Non-goals

- Sub-subagent spawning (blocked at tool level)
- Async/background subagent execution (synchronous only)
- Cross-session subagent persistence
- Context management / conversation summarization
