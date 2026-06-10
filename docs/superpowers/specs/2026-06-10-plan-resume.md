# Design Spec: Plan Resume + Plan Viewer

**Date:** 2026-06-10
**Status:** Draft
**Goal:** Allow interrupted plan execution to be resumed from the last completed step, with a dedicated PlansView UI for monitoring and control.

---

## Backend Changes

### New Plan Status: INTERRUPTED

Plan status flow extended:

```
PENDING → APPROVED → EXECUTING → INTERRUPTED (on abort/disconnect)
INTERRUPTED → EXECUTING (on resume)
EXECUTING → DONE (all steps complete)
```

### PlansService

Add method: `setInterrupted(planId)` — sets plan status to `INTERRUPTED`.

### AgentLoopService.executePlan

- When `signal.aborted` detected: set plan `INTERRUPTED` via `plansService.setInterrupted()` instead of `updateStatus('DONE')`
- On start: skip steps with status `DONE`, only execute steps with `TODO` or `FAILED`
- Resume vs fresh execution determined by plan status automatically

### No new API endpoints

`POST /api/agent/plans/:id/execute` detects automatically:
- `APPROVED` → execute from first TODO step
- `INTERRUPTED` / `EXECUTING` → resume (skip DONE steps)

---

## Frontend Changes

### New: PlansView.vue

Full-width component showing plans for the current session:
- Plan list ordered by newest first
- Each plan card: title, status badge, progress bar, step list with status icons
- Execute button (APPROVED) / Resume button (INTERRUPTED/EXECUTING)
- Disabled when another plan is executing
- Polls `GET /api/plans/session/:sessionId` every 3s when plans are active

### Plan Steps Display

Each step shows: status icon, order, text

| Status | Icon |
|---|---|
| TODO | ○ |
| DOING | ⟳ |
| DONE | ✓ |
| FAILED | ✗ |

### Modified Files

- New: `frontend/src/components/PlansView.vue`
- Modify: `frontend/src/components/AppShell.vue` — add `plans` routing
- Modify: `frontend/src/components/SidebarNav.vue` — add Plans icon
- Modify: `frontend/src/locales/*.json` — add `plans.*` keys
- Modify: `backend/src/plans/plans.service.ts` — add `setInterrupted()`
- Modify: `backend/src/agent/services/agent-loop.service.ts` — resume logic + INTERRUPTED on abort

---

## Implementation Order

1. Add `setInterrupted` to PlansService + update status flow
2. Update AgentLoopService.executePlan: INTERRUPTED on abort, skip DONE steps on resume
3. Create PlansView.vue component
4. Wire PlansView into AppShell + SidebarNav
5. Add i18n keys
6. Final verification
