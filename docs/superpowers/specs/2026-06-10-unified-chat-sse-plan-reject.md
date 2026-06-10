# Unified Chat SSE + Plan Reject Design

Date: 2026-06-10

## Problem

1. Rejecting a plan deletes it (no trace). User must manually re-request a new plan.
2. Two separate SSE endpoints (`/api/agent/chat` and `/api/agent/plans/:id/execute`) fragment the frontend logic.

## Decisions

### Reject → CANCELLED status + Agent continues

`PlansService.reject()` replaces `delete` with `update({ status: 'CANCELLED' })`. When user rejects, frontend sends a message through `/chat`. Backend sets plan to CANCELLED, then the LLM continues the conversation naturally — it can ask the user if they want to create a new plan.

### Unified SSE — single `/api/agent/chat` endpoint

Remove `POST /api/agent/plans/:id/execute`. Plan approve and plan execution happen inside the main `/chat` SSE stream:

| Frontend sends | Backend action |
|---|---|
| `/plan approve <id>` | Approve plan + executePlan via SSE |
| `/plan reject <id>` | Set CANCELLED + LLM continues in SSE |
| `/plan <text>` | runPlanMode (unchanged) |
| normal text | run (unchanged) |

## Scope

Single implementation plan. Files:

| File | Change |
|---|---|
| `plans/plans.service.ts` | reject() delete → CANCELLED |
| `plans/plans.service.spec.ts` | Update tests |
| `plans/plans.controller.ts` | 204 → 200, return updated plan |
| `agent/agent.service.ts` | Handle /plan approve, /plan reject |
| `agent/agent.service.spec.ts` | Update tests |
| `agent/agent.controller.ts` | Remove POST /plans/:id/execute |
| `frontend/.../ChatPanel.vue` | handleApprove, handleReject → use /chat |
