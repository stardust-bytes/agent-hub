# Artifact Plan Update & Alignment Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix ArtifactsPanel plan step status not updating during plan execution, and fix checkbox `[ ]` misalignment when step text wraps.

**Architecture:** Two file changes: add array spread trigger in CoworkView's `planStepUpdate` handler to guarantee Vue 3 reactivity, and fix CSS classes in ArtifactsPanel to match PlanBubble's alignment pattern.

**Tech Stack:** Vue 3 Composition API, TailwindCSS

---

### Task 1: Fix planStepUpdate reactivity in CoworkView

**Files:**
- Modify: `frontend/src/components/CoworkView.vue`

- [ ] **Step 1: Add array spread trigger after step mutation**

Find the `planStepUpdate` handler (around line 651-665). After the `if (stepText)` block, add `activePlans.value = [...activePlans.value]` to trigger re-render.

The final code should look like:
```typescript
} else if (parsed.planStepUpdate) {
  const upd = parsed.planStepUpdate as { planId: number; stepId: number; status: string }
  let stepText = ''
  for (const plan of activePlans.value) {
    if (plan.id === upd.planId) {
      const step = plan.steps.find(s => s.id === upd.stepId)
      if (step) { step.status = upd.status; stepText = step.text }
      break
    }
  }
  if (stepText) {
    const icon = upd.status === 'DONE' ? '✅' : upd.status === 'DOING' ? '⟳' : upd.status === 'FAILED' ? '✗' : '[ ]'
    messages.value.push({ role: 'system', content: `${icon} ${stepText}`, timestamp: now() })
    await scrollToBottom()
  }
  activePlans.value = [...activePlans.value]
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/CoworkView.vue
git commit -m "fix: trigger ArtifactsPanel reactivity on planStepUpdate"
```

---

### Task 2: Fix ArtifactsPanel checkbox alignment

**Files:**
- Modify: `frontend/src/components/ArtifactsPanel.vue`

- [ ] **Step 1: Fix step row alignment classes**

Find the step row div in the plan section (around line 21):
```html
<div v-for="step in plan.steps" :key="step.id" class="flex items-center gap-2 text-sm font-mono">
```

Change `items-center` to `items-start`:
```html
<div v-for="step in plan.steps" :key="step.id" class="flex gap-2 items-start text-sm font-mono">
```

- [ ] **Step 2: Fix checkbox span classes**

Find the checkbox span (around line 22), add `shrink-0 w-6 text-xs leading-5`:
```html
<span :class="step.status === 'DONE' ? 'text-cyber-green' : step.status === 'DOING' ? 'text-cyber-orange' : step.status === 'FAILED' ? 'text-red-400' : 'text-cyber-muted'" class="shrink-0 w-6 text-xs leading-5">
```

- [ ] **Step 3: Run type check**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ArtifactsPanel.vue
git commit -m "fix: align plan step checkboxes with items-start and fixed width"
```
