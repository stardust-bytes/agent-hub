# Remove delegate_parallel Tool

## Overview

Remove the `delegate_parallel` tool and all associated code. The `delegate` tool (added in cowork auto-delegate) supersedes it with simpler auto-parallel execution. `create_plan` handles sequential multi-step coordination.

## Motivation

The project currently has two delegation tools with overlapping responsibilities:

| Aspect | `delegate` (keep) | `delegate_parallel` (remove) |
|---|---|---|
| User interaction | Auto-executes, no prompt | Shows DelegateBubble, waits for parallel/sequential choice |
| SSE events | `delegate`, `delegateProgress`, `delegateResult` | `subagent:delegate` |
| Execution | `Promise.allSettled` — all subtasks concurrently | Stored as `PendingDelegation`, then looped or re-routed |
| Complexity | Single method `SubagentService.delegate()` | 4 Map methods + in-memory expiry + separate `/delegate` command handler |
| System prompt | Referenced in cowork mode | Not referenced anywhere |

`delegate` covers the parallel use case fully. For sequential multi-step work, `create_plan` already exists. `delegate_parallel` adds ~100 lines of backend code + a dedicated Vue component + special SSE handling for a feature (user choosing parallel vs sequential) that adds little value.

## Files to Modify

### Backend

| File | Change |
|---|---|
| `prisma/seed.ts` | Remove `delegate_parallel` entry from `DEFAULT_TOOLS` |
| `agent/services/agent-loop.service.ts` | Remove `delegate_parallel` handler block (lines 214-236) |
| `mode-policy/mode-policy.config.ts` | Remove `'delegate_parallel'` from agent `deniedTools` |
| `agent/agent.service.ts` | Remove `/delegate` command handler (lines 113-191) |
| `agent/subagent/subagent.service.ts` | Remove `PendingDelegation` interface, `pendingDelegations` Map, `createDelegation()`, `getDelegation()`, `removeDelegation()` |

### Frontend

| File | Change |
|---|---|
| `components/DelegateBubble.vue` | DELETE entire file |
| `components/ChatPanel.vue` | Remove `subagent.delegate` SSE handling, DelegateBubble import/ref/template |
| `components/CoworkView.vue` | Remove `subagent.delegate` SSE handling |
| `locales/vi.json` | Remove `delegate.task`, `delegate.subtasks`, `delegate.parallel`, `delegate.sequential` |
| `locales/en.json` | Remove `delegate.task`, `delegate.subtasks`, `delegate.parallel`, `delegate.sequential` |

### Documentation

| File | Change |
|---|---|
| `agent/AGENTS.md` | Remove `delegate_parallel` from tool list, SSE events |
| `mode-policy/AGENTS.md` | Remove `delegate_parallel` from denied tools list |

## What Stays

- `delegate` tool in `seed.ts` — keep for auto-parallel execution
- `SubagentService.delegate()` — keep, used by `delegate` tool
- `SubagentService.spawn()` — keep, used by `delegate()` and directly
- `delegate` SSE events (`delegate`, `delegateProgress`, `delegateResult`) — keep
- i18n keys `delegate.running`, `delegate.completed`, `delegate.failed`, `delegate.complete` — keep (used by delegate tool progress)
- `create_plan` tool — unchanged, handles sequential multi-step

## Testing After Removal

```bash
npx jest src/agent/subagent/   # subagent tests (update: remove delegation CRUD tests)
npx jest src/agent/            # all agent tests
npx jest src/mode-policy/      # mode-policy tests
npx jest --no-coverage         # full suite
```

Frontend:
```bash
cd frontend && npx vue-tsc --noEmit   # type check
```
