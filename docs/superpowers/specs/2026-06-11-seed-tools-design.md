# Seed Tools — Add spawn_subagent and delegate_parallel

**Date:** 2026-06-11
**Status:** Draft

## Problem

`seed.ts` seeds `DEFAULT_TOOLS` into the `Tool` database table, but `spawn_subagent` and `delegate_parallel` are missing. These tools are instead hardcoded directly in `ContextBuilderService.getEnabledTools()`, which means:
- They don't appear in the tools registry UI (`GET /api/tools`)
- They can't be toggled via the tools management interface
- Duplication of tool definition logic between seed and context builder

## Solution

### 1. Add to seed.ts

Insert two new entries into `DEFAULT_TOOLS`:
- `spawn_subagent` — delegating a sub-agent for a specific task
- `delegate_parallel` — decomposing into parallel subtasks

### 2. Remove hardcoded blocks from ContextBuilderService

Delete the two `if (mode === 'agent' || mode === 'cowork')` blocks in `getEnabledTools()` that currently add these tools manually. They will now be loaded from the database and filtered by `ModePolicyService`.

## Mode Policy Handling

- Agent mode: `enabledTools = '*'` (all) → both tools pass through
- Cowork mode: `enabledTools = '*'` (all) → both tools pass through
- Chat mode: falls back to agent policy → tools visible but never called (chat mode doesn't execute ReAct loop)

No changes to `mode-policy` configuration needed.

## Files Changed

| File | Change |
|---|---|
| `backend/prisma/seed.ts` | Add 2 entries to DEFAULT_TOOLS |
| `backend/src/agent/services/context-builder.service.ts` | Remove 2 hardcoded blocks (~50 lines) |

## Out of Scope

- No database migration needed (seed is upsert-based)
- No changes to agent loop (tools are already handled by name)
- No changes to mode policy
