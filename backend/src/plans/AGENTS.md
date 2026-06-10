# plans/ — Agent Context

Plan Mode persistence module. Stores AI-proposed plan checklists in SQLite. Plans are created by `AgentLoopService.runPlanMode()` and executed by `AgentLoopService.executePlan()`.

## Responsibility

- `PlansService` — CRUD for `Plan` + `PlanStep` tables. Exposes `create`, `findOne`, `findBySession`, `findNextActionable`, `approve`, `reject`, `updateStepStatus`, `updateStatus`.
- `PlansController` — REST endpoints for reading plans, finding next actionable plan, and approving/rejecting them.

## Files

```
plans/
├── plans.module.ts
├── plans.controller.ts
├── plans.controller.spec.ts
├── plans.service.ts
└── plans.service.spec.ts
```

## API Endpoints

Base path: `/api/plans`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/plans/session/:sessionId` | List plans for a session (with steps) |
| `GET` | `/api/plans/:id` | Get plan with steps |
| `POST` | `/api/plans/:id/approve` | Set plan status PENDING → APPROVED |
| `POST` | `/api/plans/:id/reject` | Delete plan (cascade to steps) |
| `GET` | `/api/plans/session/:sessionId/next` | Find next actionable plan for session |

## Plan Status Flow

```
PENDING → APPROVED (via POST /approve)
APPROVED → EXECUTING (set by AgentLoopService.executePlan())
EXECUTING → DONE (set when all steps complete)
```

## PlanStep Status Values

```
TODO   — not started
DOING  — currently executing
DONE   — completed
FAILED — failed but execution continues to next step
```

## Dependencies

- PrismaService (Plan + PlanStep CRUD)

## Testing

```bash
npx jest src/plans    # 2 suites
```
