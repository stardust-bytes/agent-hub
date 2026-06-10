# Resume Plan SSE Fix & Auto-Continue Feature Design

## Problem Summary

1. **Bug**: `/resume-plan` slash command calls `POST /api/agent/plans/:id/execute` but the frontend (`ChatPanel.vue:resumePlan()`) does **not** read the SSE response stream. Server emits `planStepUpdate`, `token`, `toolCall`, `toolResult` events but they are discarded — only a static system message "Resuming plan..." appears.

2. **Feature**: When the user types "tiếp tục" / "continue" in a session, the system should auto-detect and either resume the latest actionable plan or display it for approval.

---

## Architecture & Design

### Section 1 — Bug Fix: SSE streaming in resumePlan

**Root cause**: `frontend/src/components/ChatPanel.vue` line 625-641.
`resumePlan()` does `fetch(...)` and only checks `res.ok`, never reading `res.body.getReader()`.

**Fix**: Extract a shared SSE reader function `readPlanExecuteStream(reader, planId, callbacks)` that both `handleApprove` and `resumePlan` use:
- `onStepUpdate(planId, stepId, status)` — update PlanBubble step status
- `onToken(token)` — append to current agent message (lazy-created on first token)
- `onToolCall(name, args)` — push tool call message
- `onToolResult(name, result)` — push tool result message
- `onDone()` — finalize, set streaming=false, mark plan DONE if all steps complete

The `resumePlan` function must set `streaming.value = true` before starting and reset on completion/error.

### Section 2 — Backend: `GET /api/plans/session/:sessionId/next`

New endpoint in `PlansController` + `PlansService`.

**Response shape**:
```ts
{ found: false }
// or
{ found: true, plan: PlanWithSteps, action: 'approve' | 'resume' }
```

**Logic** (`PlansService.findNextActionable`):
1. Query `findFirst` for session, `orderBy: { createdAt: 'desc' }`, include steps
2. No plan → `{ found: false }`
3. Plan status `PENDING` → `{ found: true, plan, action: 'approve' }`
4. Plan status `APPROVED | EXECUTING | INTERRUPTED` with any step status not DONE → `{ found: true, plan, action: 'resume' }`
5. Otherwise → `{ found: false }`

### Section 3 — Backend: `resume_plan` agent tool

**New file**: `backend/src/tools/executors/resume-plan.executor.ts`

Implements `ToolExecutor` interface:
- `name` → `resume_plan`
- `description` → "Resume execution of a plan by plan ID. Use when the user asks to continue or resume a plan."
- `execute(args)` → calls `AgentLoopService.resumePlanById(planId, providerModelId, sessionId, signal, res)`

**Modifications to `AgentLoopService`**:
- Add `resumePlanById(planId, providerModelId, sessionId, signal, res)` that:
  1. Resolves provider model (same as `AgentService.executePlan`)
  2. Loads context via `ContextBuilderService`
  3. Calls `executePlan(planId, providerType, modelName, systemPrompt, tools, providerConfig, signal, res, sessionId)`
- Return a result string: `"Plan #{id} resumed. {n} steps completed."`

The tool executor receives `AgentLoopService` (already injectable), `ProvidersService`, `PlansService` and resolves the active provider model. The `res` object is not available to tool executors directly — instead, the tool executor validates the plan, calls `PlansService.findOne(planId)` to verify it exists, checks status, and returns a string result describing the plan status and remaining steps. The actual SSE execution goes through the existing `POST /api/agent/plans/:id/execute` endpoint, called by the frontend.

**Registration**: Add to `AgentLoopService.executorMap` as `resumePlanExecutor`.

### Section 4 — Frontend: Auto-continue detection

In `ChatPanel.vue:submit()`, before sending the request:

1. Check if input matches `/^(tiếp\s*tục|tiếp|continue|resume)\b/i`
2. If match and `currentSessionId` is set:
   a. `GET /api/plans/session/{sessionId}/next`
   b. If `found && action === 'resume'` → call `resumePlan(plan.id)` (which now properly reads SSE)
   c. If `found && action === 'approve'` → push a `plan` message into `messages` array (same shape as `/plan` output) so `PlanBubble` renders with approve/reject buttons
   d. If `not found` → fall through to normal agent chat

**Edge cases**:
- No session created yet → create one first (same as existing flow)
- No provider model selected → ignore (same as existing guard)
- Multiple "tiếp tục" in a row while streaming → ignored (streaming guard)

---

## File Changes Summary

### Backend
| File | Change |
|---|---|
| `backend/src/plans/plans.service.ts` | Add `findNextActionable(sessionId)` |
| `backend/src/plans/plans.controller.ts` | Add `GET session/:sessionId/next` |
| `backend/src/tools/executors/resume-plan.executor.ts` | **New** — `ResumePlanExecutor` |
| `backend/src/tools/tools.module.ts` | Register `ResumePlanExecutor` |
| `backend/src/agent/services/agent-loop.service.ts` | Add `resumePlanById()`, register executor |
| `backend/src/agent/agent.service.ts` | No change (uses existing `executePlan`) |

### Frontend
| File | Change |
|---|---|
| `frontend/src/components/ChatPanel.vue` | Fix `resumePlan()` SSE reader, add auto-continue detection in `submit()`, extract shared SSE reader |

---

## Testing Plan

1. **Unit**: `PlansService.findNextActionable` — test PENDING, APPROVED incomplete, EXECUTING, DONE, no-plan cases
2. **Unit**: `ResumePlanExecutor` — test name/description/execute shape
3. **E2E**: `/resume-plan` modal → select plan → verify SSE events rendered in chat (tool calls, tokens, step updates)
4. **E2E**: Type "tiếp tục" → verify it auto-resumes an EXECUTING plan
5. **E2E**: Type "tiếp tục" with a PENDING plan → verify PlanBubble appears with approve button
