# Plan Mode Design

## Summary

Plan Mode lets the user prefix any agent request with `/plan` to trigger a planning phase. The agent proposes a step-by-step checklist, persists it to the DB, streams it to the frontend as a special chat bubble, and waits for user approval before executing step by step.

## Problem

The current `AgentLoopService` executes tasks in one pass — PLANNING → EXECUTING → DONE. For complex multi-step tasks, there is no checkpoint where the user can review what the agent intends to do before it starts executing tools. Plan Mode adds an explicit proposal + approval gate.

## Trigger

User prefixes their message with `/plan `:

```
/plan refactor the auth module to use JWT refresh tokens
```

`AgentService` detects the prefix on the backend before dispatching to `AgentLoopService`. No `ChatDto` schema changes needed — the `/plan` prefix is transparent to the DTO.

## Data Model

Two new Prisma models. Migration name: `add-plan-tables`.

```prisma
model Plan {
  id        Int        @id @default(autoincrement())
  sessionId Int
  session   Session    @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  title     String
  status    String     @default("PENDING") // PENDING | APPROVED | EXECUTING | DONE | FAILED
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  steps     PlanStep[]
}

model PlanStep {
  id        Int      @id @default(autoincrement())
  planId    Int
  plan      Plan     @relation(fields: [planId], references: [id], onDelete: Cascade)
  order     Int
  text      String
  status    String   @default("TODO")  // TODO | DOING | DONE | FAILED
  updatedAt DateTime @updatedAt
}
```

`Session` gets a back-relation: `plans Plan[]`.

## Backend Architecture

### New PlansModule

```
backend/src/plans/
├── plans.module.ts       — registers service + controller, exports PlansService
├── plans.controller.ts   — read endpoints + approve/reject
├── plans.service.ts      — DB operations
├── plans.service.spec.ts
└── dto/
    ├── create-plan.dto.ts
    └── plan-response.dto.ts
```

`PlansService` methods:
- `create(sessionId, title, steps: string[]): Promise<Plan & { steps: PlanStep[] }>` — creates Plan (PENDING) + ordered PlanStep records
- `findOne(id): Promise<Plan & { steps: PlanStep[] }>` — load plan with steps
- `findBySession(sessionId): Promise<Plan[]>`
- `approve(id): Promise<Plan>` — set status → APPROVED
- `reject(id): Promise<void>` — delete plan (cascades to steps)
- `updateStepStatus(stepId, status: string): Promise<PlanStep>`

### API Endpoints (PlansController)

Base path: `/api/plans`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/plans/session/:sessionId` | List plans for a session |
| `GET` | `/api/plans/:id` | Get plan with steps |
| `POST` | `/api/plans/:id/approve` | Set plan status → APPROVED |
| `POST` | `/api/plans/:id/reject` | Delete plan |

### Plan Execution Endpoint (AgentController)

`POST /api/agent/plans/:id/execute` — SSE stream (same pattern as `/api/agent/chat`).

Request body: `{ providerModelId: number }` — same as `/api/agent/chat`, required to resolve the LLM provider for each step execution.

Lives in `AgentController` to avoid circular dependency: `AgentModule` imports `PlansModule`, so `AgentController` can access both `PlansService` and `AgentLoopService`.

### AgentService Changes

Before dispatching to `AgentLoopService`, detect `/plan ` prefix:

```typescript
if (dto.message.startsWith('/plan ')) {
  const taskText = dto.message.slice(6).trim();
  return this.agentLoopService.runPlanMode(taskText, providerConfig, dto.sessionId, res);
}
// otherwise: normal loop
return this.agentLoopService.run(...);
```

### AgentLoopService New Methods

**`runPlanMode(taskText, providerConfig, sessionId, res)`**

1. Build planning system prompt:
   ```
   You are in Plan Mode. Output ONLY a JSON object — no prose, no markdown.
   Format: { "title": "short plan title", "steps": ["step 1", "step 2", ...] }
   Maximum 10 steps. Be specific and actionable.
   ```
2. Call LLM with `[{ role: 'user', content: taskText }]`
3. Parse JSON from response
4. Call `plansService.create(sessionId, title, steps)`
5. Emit SSE: `{ plan: { id, title, steps: [{id,order,text,status}] } }`
6. Emit `[DONE]`

**`executePlan(planId, providerConfig, res)`**

1. Load plan via `plansService.findOne(planId)`
2. For each step (sorted by `order`):
   - `plansService.updateStepStatus(step.id, 'DOING')`
   - Emit `{ planStepUpdate: { planId, stepId: step.id, status: 'DOING' } }`
   - Run full agent loop for `step.text` (PLANNING→EXECUTING→EVALUATING→RESPONDING)
   - `plansService.updateStepStatus(step.id, 'DONE')`
   - Emit `{ planStepUpdate: { planId, stepId: step.id, status: 'DONE' } }`
3. Update plan status → DONE
4. Emit `[DONE]`

### New SSE Events

| Event | Shape | When |
|---|---|---|
| `plan` | `{ id, title, steps: [{id,order,text,status}] }` | LLM finishes proposing the plan |
| `planStepUpdate` | `{ planId, stepId, status }` | Each step changes state during execution |

## Frontend Architecture

### New Component: PlanBubble.vue

`frontend/src/components/PlanBubble.vue`

Compact inline design (Option A):
- Title line with `[PLAN]` tag in `text-cyber-cyan`
- Steps list using `[ ]` / `[✓]` / `[⟳]` prefix, monospace font
- Approve/Reject buttons shown only when `plan.status === 'PENDING'`
- `[ ]` = dimmed (`text-cyber-muted`), `[✓]` = green (`text-cyber-green`), `[⟳]` = orange (`text-cyber-orange`)

Props: `plan: PlanResponse` (reactive — parent updates steps in place)

Approve button click handler:
1. `POST /api/plans/:id/approve`
2. Open new `EventSource` to `POST /api/agent/plans/:id/execute`
3. On `planStepUpdate` events — emit to parent store to update the step in place

### ChatPanel Changes

- Detect `plan` SSE event → store plan message in session messages as `{ type: 'plan', plan: {...} }` → render `<PlanBubble>`
- Detect `planStepUpdate` SSE event → find the plan message by `planId`, mutate the matching step's status → Vue reactivity updates `PlanBubble` in place
- Execution SSE stream from `PlanBubble` feeds `planStepUpdate` events back through the same reactive message store

### i18n Keys

```
plans.approve         → "Phê duyệt" / "Approve"
plans.reject          → "Từ chối" / "Reject"
plans.status.pending  → "Chờ phê duyệt" / "Awaiting approval"
plans.status.executing → "Đang thực hiện" / "Executing"
plans.status.done     → "Hoàn thành" / "Done"
plans.step.todo       → "[ ]"
plans.step.doing      → "[⟳]"
plans.step.done       → "[✓]"
```

## Error Handling

- LLM returns non-JSON in plan mode → emit `{ error: 'Agent failed to produce a valid plan. Try again.' }`, do not create Plan record
- Step execution fails → mark step `FAILED`, emit `planStepUpdate { status: 'FAILED' }`, continue to next step (don't abort entire plan)
- `approve` called on non-PENDING plan → 400 Bad Request
- `execute` called on non-APPROVED plan → 400 Bad Request

## Files

| File | Action |
|---|---|
| `backend/prisma/schema.prisma` | Add `Plan`, `PlanStep` models; add `plans` back-relation to `Session` |
| `backend/prisma/migrations/*/migration.sql` | Auto-generated by `prisma migrate dev --name add-plan-tables` |
| `backend/src/plans/plans.module.ts` | New |
| `backend/src/plans/plans.service.ts` | New |
| `backend/src/plans/plans.service.spec.ts` | New |
| `backend/src/plans/plans.controller.ts` | New |
| `backend/src/plans/plans.controller.spec.ts` | New |
| `backend/src/plans/dto/create-plan.dto.ts` | New |
| `backend/src/plans/dto/plan-response.dto.ts` | New |
| `backend/src/agent/dto/execute-plan.dto.ts` | New — `{ providerModelId: number }` for POST execute endpoint |
| `backend/src/plans/AGENTS.md` | New |
| `backend/src/plans/CLAUDE.md` | New (`@AGENTS.md`) |
| `backend/src/agent/services/agent-loop.service.ts` | Add `runPlanMode()` + `executePlan()` methods |
| `backend/src/agent/services/agent-loop.service.spec.ts` | Add plan mode tests |
| `backend/src/agent/agent.service.ts` | Add `/plan` prefix detection |
| `backend/src/agent/agent.service.spec.ts` | Add plan mode test |
| `backend/src/agent/agent.controller.ts` | Add `POST /api/agent/plans/:id/execute` SSE endpoint |
| `backend/src/agent/agent.controller.spec.ts` | Add execute endpoint test |
| `backend/src/agent/agent.module.ts` | Import `PlansModule` |
| `backend/src/agent/AGENTS.md` | Update: new SSE events, new endpoints, new methods |
| `backend/src/app.module.ts` | Import `PlansModule` |
| `frontend/src/components/PlanBubble.vue` | New |
| `frontend/src/locales/vi.json` | Add `plans.*` keys |
| `frontend/src/locales/en.json` | Add `plans.*` keys |
| `frontend/src/views/ChatPanel.vue` (or equivalent) | Handle `plan` + `planStepUpdate` SSE events |
