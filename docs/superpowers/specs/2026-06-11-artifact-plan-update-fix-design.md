# Artifact Plan Update & Alignment Fix

**Date:** 2026-06-11
**Status:** Draft

## Problem

Two bugs in the ArtifactsPanel plan display:

1. **Plan step status not updating** — When the LLM executes a plan and emits `planStepUpdate` SSE events, CoworkView mutates step status in-place on the `activePlans` reactive ref, but the ArtifactsPanel doesn't reflect the changes.

2. **Checkbox `[ ]` misalignment** — In ArtifactsPanel, step rows use `items-center` for flex alignment. When step text wraps across multiple lines, the `[ ]` prefix stays vertically centered instead of aligning to the top, causing visual misalignment with other rows.

## Root Cause

**Issue 1:** `activePlans` is a `ref<PlanData[]>`. Mutating nested properties (`step.status = upd.status`) within the reactive proxy should trigger Vue 3's reactivity system, but the change may not propagate to the ArtifactsPanel prop binding in all cases. An explicit array reference change (`activePlans.value = [...activePlans.value]`) guarantees re-render.

**Issue 2:** ArtifactsPanel uses `items-center` (vertical center) instead of `items-start` (top-align) for step rows, and the `[ ]` prefix span lacks `shrink-0 w-6` to maintain fixed width. PlanBubble already uses the correct pattern: `items-start`, `shrink-0 w-6`, `leading-5`.

## Solution

### 1. CoworkView: Trigger reactivity on planStepUpdate

Add `activePlans.value = [...activePlans.value]` after the step status mutation to create a new array reference.

### 2. ArtifactsPanel: Fix alignment

- Change `items-center` → `items-start` on the step row div
- Add `shrink-0 w-6 text-xs leading-5` to the `[ ]` prefix span

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/CoworkView.vue` | Add `activePlans.value = [...activePlans.value]` |
| `frontend/src/components/ArtifactsPanel.vue` | Fix checkbox alignment classes |
