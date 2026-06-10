# Agent Auto-Plan with Stop/Resume Design

## Summary

Enable the LLM to autonomously decide when to create and execute plans (without requiring `/plan` slash commands), with user-configurable approval gates. Add Stop/Resume lifecycle: user can interrupt execution at any step, state is preserved, and the next "continue" message auto-resumes the plan — even after errors.

## Problem

1. Plan mode requires explicit `/plan` slash command in cowork mode. The LLM cannot autonomously decide to plan multi-step work.
2. No Stop button in the UI — user must close the connection to abort, which is unclear and doesn't properly signal the frontend.
3. No auto-resume on "continue" message — user must manually use `/resume-plan` or `/plan resume <id>`.
4. `runForStep()` creates its own `AbortController.signal`, making it unresponsive to stop/abort.

## Backend Architecture

### Section 1 — `create_plan` tool

**New file**: `backend/src/tools/executors/create-plan.executor.ts`

Implements `ToolExecutor`:
- `name` → `create_plan`
- `description` → "Create a multi-step plan for complex tasks. Call this when a task requires sequential steps. Set requireApproval=true for risky/destructive changes, false for safe multi-step work."
- `parameters`:
  ```json
  {
    "title": { "type": "string", "description": "Short plan title" },
    "steps": { "type": "array", "items": { "type": "string" }, "description": "Step descriptions (max 10)" },
    "requireApproval": { "type": "boolean", "description": "true = wait for user approval before executing" }
  }
  ```
- `execute(args, context)`:
  1. Validates `title` (string), `steps` (string[], length <= 10)
  2. Calls `PlansService.create(context.sessionId, title, steps)` → plan status PENDING
  3. If `requireApproval === false`: immediately calls `PlansService.approve(planId)` → status APPROVED
  4. Returns string: `[PLAN_CREATED] id=X requireApproval=true/false title="..."`

**Registration**: Add to `tools.module.ts` EXECUTORS array, inject into `AgentLoopService.executorMap`.

**Agent loop integration** in `AgentLoopService.run()`:
After `executeTool()` (line 171), check if result starts with `[PLAN_CREATED]`:
- Parse plan ID, title, requireApproval
- Emit `plan` SSE event (same shape as existing `/plan` flow)
- If `requireApproval === true`:
  - Set `this.state = AgentState.RESPONDING`
  - Emit `[DONE]`
  - Return (frontend shows PlanBubble with Approve/Reject)
- If `requireApproval === false`:
  - Call `this.executePlan(planId, ...)` directly within the same SSE stream
  - `executePlan` handles its own loop and emits `[DONE]`
  - Return after executePlan completes

**System prompt update** in `ContextBuilderService.buildSystemPrompt()`:
Add to the tool list description section:
```
When to use create_plan:
- Use for multi-step tasks that need sequential coordination
- requireApproval=true: risky operations (destructive file ops, architecture changes, user decisions needed)
- requireApproval=false: safe multi-step tasks (refactoring, building components, data processing)
- Do NOT use for single-step tasks — use the appropriate tool directly
```

### Section 2 — Stop button

**Backend — Interrupt SSE event**: In `AgentLoopService.executePlan()`, when `signal.aborted`:
- Before breaking, emit: `data: {"planInterrupted":{"planId":N,"stepId":M,"reason":"user_stopped"}}\n\n`
- Then call `PlansService.setInterrupted(planId)` (already exists)
- Do NOT emit `[DONE]` (already the case)

**Frontend — Stop button in ChatPanel.vue**:
- When `isStreaming === true` AND a plan is being executed, show a stop button `"■ Dừng"`
- On click:
  1. Close the SSE connection (`reader.cancel()`)
  2. Set `isStreaming = false`
  3. Push a system message: `"[⏹ Plan interrupted at step X. Send 'tiếp tục' to resume.]"`
  4. No POST needed — closing the connection triggers abort via `req.on('close')`

**Fix `runForStep()` abort signal**:
Change `runForStep(signal, ...)` to accept the parent `AbortSignal` parameter instead of creating its own `new AbortController().signal`. Pass it through to `executeStep()`.

### Section 3 — Auto-detect continue + resume

**Flow in `AgentService.streamChat()`**:
Before the `/plan` slash check and before the normal agent run:

```
1. If sessionId is falsy → skip (no session yet)
2. Call PlansService.findNextActionable(sessionId)
   Returns: { found: true, plan, action: 'approve'|'resume' } | { found: false }
3. If found AND isContinueIntent(message):
   a. action === 'resume' → auto-call executePlan(planId, ...), return
   b. action === 'approve' → let normal flow handle it (LLM can use resume_plan tool)
4. Else → fall through to normal agent run
```

**New helper `isContinueIntent(message)`**:
```typescript
function isContinueIntent(msg: string): boolean {
  const lower = msg.toLowerCase().trim();
  const keywords = ['tiếp tục', 'tiếp', 'continue', 'resume', 'làm tiếp', 'next'];
  return keywords.some(k => lower.startsWith(k) || lower === k);
}
```

**Frontend — Session load with interrupted plan**:
On session load, if `GET /api/plans/session/:id/next` returns `{ found: true, action: 'resume' }`:
- Push a system message into chat: `"[Plan #X was interrupted. Send 'tiếp tục' to resume.]"`
- Show PlanBubble with current step statuses and a `"▶ Tiếp tục"` button

### Section 4 — Error resilience

**Already works:**
- Step execution in `executePlan()` has try/catch per step → FAILED step does not stop the loop
- Resume filters `.filter(s => s.status !== 'DONE')` → DOING/TODO/FAILED steps are retried

**Changes:**
- `runForStep()` receives parent `AbortSignal` → abort works at the step level too
- On resume, DOING steps are re-executed from scratch (no partial state to restore within a step)

## File Changes Summary

### Backend

| File | Change |
|---|---|
| `backend/src/tools/executors/create-plan.executor.ts` | **New** — `CreatePlanExecutor` |
| `backend/src/tools/tools.module.ts` | Register `CreatePlanExecutor` |
| `backend/src/agent/services/agent-loop.service.ts` | Detect `[PLAN_CREATED]` in `run()`, handle requireApproval routing, add `createPlan` to executorMap, emit `planInterrupted` event, pass signal to `runForStep()` |
| `backend/src/agent/services/context-builder.service.ts` | Add `create_plan` usage guidelines to system prompt |
| `backend/src/agent/agent.service.ts` | Add `isContinueIntent()` + auto-resume check in `streamChat()` before normal flow |
| `backend/src/tools/AGENTS.md` | Document `create_plan` executor |

### Frontend

| File | Change |
|---|---|
| `frontend/src/components/ChatPanel.vue` | Add stop button during plan execution, handle `planInterrupted` SSE event, auto-detect continue on session load |
| `frontend/src/components/PlanBubble.vue` | Add INTERRUPTED status display + "Tiếp tục" button |

## Testing Plan

1. **Unit**: `CreatePlanExecutor.execute` — valid input creates plan, requireApproval=true leaves PENDING, false sets APPROVED
2. **Unit**: `isContinueIntent` — matches "tiếp tục", "continue", "resume", "next"; rejects unrelated messages
3. **Unit**: `PlansService.findNextActionable` — INTERRUPTED > APPROVED > EXECUTING priority
4. **Integration**: Agent loop tool call → `[PLAN_CREATED]` marker detection → SSE plan event emission
5. **E2E**: User sends complex task → LLM calls create_plan → plan bubble appears → approve → steps execute
6. **E2E**: During plan execution, click Stop → state saved → type "tiếp tục" → plan resumes from current step
