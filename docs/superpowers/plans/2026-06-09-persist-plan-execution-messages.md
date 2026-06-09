# Persist Plan Execution Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save plan execution output (tokens, tool calls, step updates) into session messages so they persist across reloads.

**Architecture:** Add `sessionsService.saveMessage()` calls to `runPlanMode()`, `executePlan()`, and `runForStep()` in `AgentLoopService` — matching the existing pattern in the `run()` method.

**Tech Stack:** NestJS + Prisma (backend only, no frontend changes)

---

## File Map

| File | Action |
|---|---|
| `backend/src/agent/services/agent-loop.service.ts` | Modify — add `saveMessage` calls in 3 methods |
| `backend/src/agent/services/agent-loop.service.spec.ts` | Modify — update `mockPlansService`, add `mockSessionsService` assertions |

---

## Task 1: Persist plan execution messages

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Add session save in runPlanMode()**

After `plan` variable is created (after line 340), add:

```typescript
if (sessionId) {
  await this.sessionsService.saveMessage(
    sessionId, 'system', `[Plan] ${plan.title} — ${plan.steps.length} steps created`,
  );
}
```

- [ ] **Step 2: Add session save in executePlan()**

Before step execution (after the `planStepUpdate: DOING` write, around line 274), add:

```typescript
if (sessionId) {
  await this.sessionsService.saveMessage(sessionId, 'system', `Executing step: ${step.text}`);
}
```

After step DONE (after the `planStepUpdate: DONE` write, around line 284), add:

```typescript
if (sessionId) {
  await this.sessionsService.saveMessage(sessionId, 'system', `Step completed: ${step.text}`);
}
```

After step FAILED (after the `planStepUpdate: FAILED` write, inside the catch block, around line 289), add:

```typescript
if (sessionId) {
  await this.sessionsService.saveMessage(sessionId, 'system', `Step failed: ${step.text}`);
}
```

- [ ] **Step 3: Add session save in runForStep()**

In the tool call loop, after the `toolCall` SSE write (after line 504), add:

```typescript
if (sessionId) {
  await this.sessionsService.saveMessage(sessionId, 'tool', `${name}(${JSON.stringify(args)})`, name, false);
}
```

After denied tool result write (after line 509, before `continue`), add:

```typescript
if (sessionId) {
  await this.sessionsService.saveMessage(sessionId, 'tool', denyMsg, name, true);
}
```

After successful tool result write (after line 521), add:

```typescript
if (sessionId) {
  await this.sessionsService.saveMessage(sessionId, 'tool', result, name, true);
}
```

- [ ] **Step 4: Run tests to verify no regressions**

```bash
cd backend
npx jest src/agent --no-coverage
```

Expected: all tests pass (no changes to test expectations needed since existing tests mock `sessionsService` already).

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: persist plan execution messages to session history"
```
