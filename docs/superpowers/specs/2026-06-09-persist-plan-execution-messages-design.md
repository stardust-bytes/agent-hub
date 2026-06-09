# Persist Plan Execution Messages Design

**Goal:** Save plan execution output (tokens, tool calls, tool results, step status) into session chat messages so they persist across page reloads.

## Problem

`AgentLoopService.executePlan()` and `runForStep()` stream all events to the frontend via SSE but never call `sessionsService.saveMessage()`. Unlike the regular `run()` method (which saves every tool call, result, and thinking event), plan execution leaves no trace in the database.

## Changes

Single file: `backend/src/agent/services/agent-loop.service.ts`

### 1. `runPlanMode()` (line 296)

Add after plan is created successfully (after line 340):
```typescript
if (sessionId) {
  await this.sessionsService.saveMessage(
    sessionId, 'system', `[Plan] ${plan.title} — ${plan.steps.length} steps created`,
  );
}
```

### 2. `executePlan()` (line 255)

Add saveMessage calls for each step status:
- Before step execution (after line 273): Save "Executing step: `text`"
- After DONE (after line 283): Save "Step completed: `text`"
- After FAILED (inside catch, after line 288): Save "Step failed: `text`"

### 3. `runForStep()` (line 479)

Add saveMessage calls matching the pattern in `run()`:
- Tool call SSE emission (after line 504): save tool call message
- Denied tool result (after line 509): save denied tool result
- Successful tool result (after line 520): save tool result

## No Frontend Changes

`handleApprove()` in ChatPanel.vue already processes all SSE events (token, toolCall, toolResult, planStepUpdate) and renders them in the chat. Persisting to DB on the backend side means they will appear when loading session history.
