# Cowork Auto-Delegation Design

## Overview

Add automatic multi-agent orchestration to Cowork mode. When given a complex task (e.g., "tổng hợp báo cáo từ nhiều file Excel"), the agent autonomously breaks it into subtasks, spawns parallel sub-agents, and synthesizes results — without user click.

## Architecture

```
User: complex task
  → Cowork Agent (enhanced prompt)
  → tool: delegate({ tasks: [...] })
  → SubagentService.delegate()
    → Promise.allSettled(tasks.map(spawn))
    → SSE: delegateProgress per worker
    → Structured results → agent context
  → Agent synthesizes → final answer
```

## Tool Definition

```ts
{
  name: 'delegate',
  description: 'Delegate subtasks to run in parallel workers. Use for complex multi-step tasks.',
  parameters: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of subtask descriptions',
      },
    },
    required: ['tasks'],
  },
}
```

## System Prompt Addition

In `context-builder.service.ts` for cowork mode, append after existing guidance:

```
When handling complex multi-step tasks:
- Use the delegate tool to run subtasks in parallel
- Break the task into independent, self-contained subtasks
- Do NOT wait for user approval — delegate automatically
- After all subtasks complete, synthesize the results
- Each subtask must be completable without seeing other subtask results
```

## Mode-Policy Changes

Remove `delegate_parallel` from `deniedTools` in cowork mode entry. Add `delegate` tool if needed.

## SubagentService.delegate()

### Flow

1. Generate `requestId`
2. Emit `{ delegate: { requestId, taskCount } }` SSE
3. For each task: emit `{ delegateProgress: { requestId, index, subtask, status: 'running' } }` SSE
4. Run all via `Promise.allSettled(tasks.map((task, i) => this.spawn(task, ...)))`
5. Collect results: `{ index, task, status, summary }`
6. Emit `{ delegateResult: { requestId, results } }` SSE
7. Return formatted string for agent context

### Result Format

```ts
interface DelegateTaskResult {
  index: number
  task: string
  status: 'completed' | 'failed'
  summary: string // first 200 chars of result
}
```

### SSE Events

| Event | Shape | When |
|---|---|---|
| `delegate` | `{requestId, taskCount}` | Delegate started |
| `delegateProgress` | `{requestId, index, subtask?, status}` | Per-worker progress |
| `delegateResult` | `{requestId, results}` | All workers done |

## AgentLoopService Changes

Handle `delegate` tool in `executeTool()`:

```ts
if (name === 'delegate') {
  const tasks = (args as any)?.tasks as string[]
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    result = 'Error: delegate requires a non-empty "tasks" array'
  } else {
    result = await this.subagentService.delegate(
      tasks, providerType, model, providerConfig,
      activeTools, signal, res, sessionId, mode,
    )
  }
}
```

## Frontend

- No new components needed
- CoworkView/ChatPanel renders `delegateProgress` events as streaming status lines
- ArtifactsPanel can show worker results
- StatusBar shows active sub-agent count

## Files Modified

- `backend/src/agent/services/context-builder.service.ts` — system prompt
- `backend/src/agent/services/subagent.service.ts` — add `delegate()` method
- `backend/src/agent/services/agent-loop.service.ts` — handle delegate tool
- `backend/src/tools/tools.service.ts` — seed delegate tool
- `backend/src/mode-policy/mode-policy.config.ts` — allow delegate in cowork
- `frontend/src/components/ChatPanel.vue` — render delegateProgress events
- `frontend/src/locales/vi.json` + `en.json` — delegate i18n

## Testing

- `subagent.service.spec.ts`: `delegate()` with mock tasks, parallel execution, result format
- `agent-loop.service.spec.ts`: delegate tool handling, error cases
- Integration: cowork mode + delegate tool + result synthesis
