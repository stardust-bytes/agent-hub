# Delegate Parallel Mode — Design Spec

## Overview

Add a `delegate_parallel` tool that lets the LLM decompose complex parallelizable tasks and ask the user whether to run via sub-agents or step-by-step. Simple tasks continue to auto-run via `spawn_subagent` without user prompts.

## Motivation

- User wants control over HOW complex parallel work is executed
- Simple parallel tasks → LLM auto-decides (existing `spawn_subagent` behavior)
- Complex multi-part tasks → user chooses: sub-agent parallel or step-by-step

## Architecture

### New tool: `delegate_parallel`

Defined in `ContextBuilderService.getEnabledTools()`:

```typescript
{
  name: 'delegate_parallel',
  description: 'Decompose a complex task into parallel subtasks. ' +
    'Use ONLY when the user request involves multiple independent pieces of work ' +
    'that can run concurrently. This will ask the user whether to use sub-agents ' +
    'or step-by-step execution.',
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The original user request or overall task description.',
      },
      subtasks: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of independent subtasks that can run in parallel. ' +
          'Each should be self-contained and not depend on others.',
      },
    },
    required: ['task', 'subtasks'],
  },
}
```

### SSE Event: `subagent:delegate`

When `delegate_parallel` is called, the backend emits:

```typescript
data: {"subagent":true,"delegate":{"task":"...","subtasks":["a","b","c"]}}
```

Then emits `[DONE]` to end the current SSE stream.

### Backend flow

1. Agent loop's inline handler detects `delegate_parallel` tool call
2. Stores the subtask list in `SubagentService.pendingDelegations` (in-memory Map)
3. Emits `subagent:delegate` SSE event
4. Returns from the agent loop (stream ends with `[DONE]`)
5. User clicks button → sends `/delegate approve <sessionId>` or `/delegate sequential <sessionId>`
6. AgentService handles the command:
   - If "parallel" → spawn `spawn_subagent` for each subtask sequentially
   - If "sequential" → run the task through normal agent loop without sub-agents

### Frontend

- Handle `subagent:delegate` SSE event
- Show a DelegateBubble component with:
  - Task description
  - Numbered list of subtasks
  - Two buttons: "▶ Run parallel (sub-agents)" / "→ Run step-by-step"
- On button click → set input to `/delegate parallel` or `/delegate sequential` and submit

### Files

**Backend:**
- `context-builder.service.ts` — add `delegate_parallel` tool definition
- `agent-loop.service.ts` — inline handler for `delegate_parallel` tool
- `subagent.service.ts` — add `pendingDelegations` Map + approval methods
- `agent.service.ts` — handle `/delegate` commands
- `AGENTS.md` — update

**Frontend:**
- Handle `subagent:delegate` event in ChatPanel + CoworkView
- `DelegateBubble.vue` — new component for the mode selection UI

### Non-goals

- True parallel execution (sub-agents run sequentially for now)
- Approval/rejection of individual sub-agent spawns (covered by `spawn_subagent` auto-run)
- Persistence of delegation state
