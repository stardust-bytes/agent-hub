# Plan Bubble Status on Reload Design

**Goal:** When viewing old session messages, the PlanBubble should show the actual step execution statuses (DONE/FAILED/TODO) and hide approve/reject buttons for completed plans.

## Problem

`runPlanMode()` saves the plan message once at creation time with `status: 'PENDING'` and steps `status: 'TODO'`. After `executePlan()` updates the Plan/PlanStep records in the DB, the saved message content is never updated. On reload, PlanBubble shows stale data.

## Solution

In `loadSession()`, when encountering a `plan`-role message, fetch current plan data from `GET /api/plans/:id` and merge the real statuses into the display data.

## File

`frontend/src/components/ChatPanel.vue` — modify the `msg.role === 'plan'` handler in `loadSession()`.
