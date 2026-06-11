# Cowork Mode Auto-Execute Design

**Date:** 2026-06-11
**Status:** Draft

## Problem

In cowork mode, two confirmation flows interrupt the LLM's autonomous workflow:
1. `delegate_parallel` tool shows DelegateBubble asking user to choose parallel vs sequential
2. `create_plan` tool is instructed to set `requireApproval=true` for risky operations, pausing for user approval

User wants the LLM to execute sub-agents and plans without confirmations in cowork mode.

## Solution

### 1. Disable delegate_parallel in cowork mode

Add `delegate_parallel` to `deniedTools` in the cowork mode policy. The LLM will use `spawn_subagent` directly for parallel tasks, which runs immediately without confirmation. `spawn_subagent` already has appropriate guidance in its tool description for decomposing complex tasks.

### 2. Update create_plan guidance for cowork mode

Change the system prompt's `create_plan` guidance in cowork mode to instruct the LLM to always set `requireApproval=false`. Plans will auto-execute without user confirmation.

The current prompt (shared for all non-chat modes):
```
- Set requireApproval=true for risky operations (destructive file ops, architecture changes, operations needing user decisions).
- Set requireApproval=false for safe multi-step work (refactoring, building components, data processing).
```

New prompt for cowork mode:
```
- Always set requireApproval=false — plans execute automatically.
- The user trusts you to decide when and how to break down work.
- Do not ask for approval or confirmation before executing plans.
```

## Files Changed

| File | Change |
|---|---|
| `backend/src/mode-policy/mode-policy.config.ts` | Add `delegate_parallel` to cowork `deniedTools` |
| `backend/src/agent/services/context-builder.service.ts` | Update cowork system prompt to remove confirmation guidance |

## Out of Scope

- Agent mode behavior unchanged (sub-agents remain disabled, create_plan denied)
- No changes to `delegate_parallel` tool definition (still available in agent mode if re-enabled)
- No changes to `spawn_subagent` tool (already runs without confirmation)
