# Plan Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow interrupted plan execution to be resumed from the last completed step, with a dedicated PlansView UI for monitoring and control.

**Architecture:** Backend: add INTERRUPTED plan status, executePlan skips DONE steps on resume. Frontend: new PlansView component shows plans with step status, execute/resume buttons, polling for updates.

**Tech Stack:** NestJS 10, Prisma 5, Vue 3, TailwindCSS, TypeScript.

---

## File Map

**Create:**
- `frontend/src/components/PlansView.vue`

**Modify:**
- `backend/src/plans/plans.service.ts` — add `setInterrupted()`
- `backend/src/plans/plans.service.spec.ts` — test `setInterrupted`
- `backend/src/agent/services/agent-loop.service.ts` — set INTERRUPTED on abort, skip DONE on resume
- `frontend/src/components/AppShell.vue` — add `plans` view
- `frontend/src/components/SidebarNav.vue` — add Plans icon
- `frontend/src/locales/vi.json` — plans keys
- `frontend/src/locales/en.json` — plans keys

---

## Task 1: Add setInterrupted to PlansService

**Files:**
- Modify: `backend/src/plans/plans.service.ts`
- Modify: `backend/src/plans/plans.service.spec.ts`

- [ ] **Step 1: Add setInterrupted method**

Read `backend/src/plans/plans.service.ts` and add after `updateStatus`:

```typescript
  async setInterrupted(id: number) {
    return this.prisma.plan.update({ where: { id }, data: { status: 'INTERRUPTED' } });
  }
```

- [ ] **Step 2: Add test**

Read `backend/src/plans/plans.service.spec.ts` and add inside the describe block:

```typescript
  describe('setInterrupted', () => {
    it('sets plan status to INTERRUPTED', async () => {
      mockPrisma.plan.update.mockResolvedValue({ id: 1, status: 'INTERRUPTED' });
      const result = await service.setInterrupted(1);
      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: 1 }, data: { status: 'INTERRUPTED' },
      });
      expect(result.status).toBe('INTERRUPTED');
    });
  });
```

- [ ] **Step 3: Run tests**

```bash
cd backend && npx jest src/plans --no-coverage
```

Expected: PASS (2 suites)

- [ ] **Step 4: Commit**

```bash
git add backend/src/plans/plans.service.ts backend/src/plans/plans.service.spec.ts
git commit -m "feat: add setInterrupted to PlansService"
```

---

## Task 2: Update executePlan — INTERRUPTED on abort + resume skip DONE

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Read current executePlan**

Read `backend/src/agent/services/agent-loop.service.ts`, find the `executePlan` method.

- [ ] **Step 2: Modify executePlan for resume logic**

Make these changes to the `executePlan` method:

1. At the top, after fetching the plan, filter steps to skip DONE ones:

```typescript
    const plan = await this.plansService.findOne(planId);
    await this.plansService.updateStatus(planId, 'EXECUTING');

    const sortedSteps = [...plan.steps]
      .filter(s => s.status !== 'DONE')
      .sort((a, b) => a.order - b.order);
```

2. On signal abort, set INTERRUPTED instead of DONE. Find the end of the method where `if (!signal.aborted)` block is, and change it to set INTERRUPTED when aborted:

After the for loop, replace the end section with:

```typescript
    if (signal.aborted) {
      await this.plansService.setInterrupted(planId);
    } else {
      await this.plansService.updateStatus(planId, 'DONE');
      res.write('data: [DONE]\n\n');
    }
```

- [ ] **Step 3: Verify the complete method looks correct**

Read the full method to make sure logic is sound:
- Steps with status DONE are filtered out from the start (not executed)
- On signal abort: set INTERRUPTED
- On normal completion: set DONE
- Signal checks remain before res.write calls

- [ ] **Step 4: Run tests**

```bash
cd backend && npx jest src/agent --no-coverage
```

Expected: All agent tests pass

- [ ] **Step 5: Run all tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All 37 suites pass

- [ ] **Step 6: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: set INTERRUPTED on plan abort, skip DONE steps on resume"
```

---

## Task 3: Create PlansView component

**Files:**
- Create: `frontend/src/components/PlansView.vue`

- [ ] **Step 1: Read existing components for patterns**

Read `frontend/src/components/TasksView.vue` for pattern reference on full-width views with loading/fetching.

- [ ] **Step 2: Create PlansView.vue**

Create `frontend/src/components/PlansView.vue`:

```vue
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-xs tracking-widest font-mono">
        <HiClipboardList class="w-3 h-3 inline" /> {{ t('plans.header') }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-2xl mx-auto space-y-3">
        <div v-if="plans.length === 0" class="text-center text-cyber-muted text-sm font-mono py-8">
          {{ t('plans.empty') }}
        </div>
        <div v-for="plan in plans" :key="plan.id"
          class="bg-cyber-dark border border-cyber-border rounded p-3 space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono" :class="statusDot(plan.status)">{{ statusIcon(plan.status) }}</span>
              <span class="text-cyber-text text-sm font-mono">{{ plan.title }}</span>
            </div>
            <span class="text-cyber-muted text-[10px] font-mono">{{ statusLabel(plan.status) }}</span>
          </div>

          <div class="h-1 bg-cyber-bg rounded overflow-hidden" v-if="plan.steps.length > 0">
            <div class="h-full bg-cyber-accent transition-all duration-500" :style="{ width: progressPercent(plan) + '%' }"></div>
          </div>

          <div class="text-cyber-muted text-[10px] font-mono">
            {{ doneCount(plan) }}/{{ plan.steps.length }} {{ t('plans.steps') }}
          </div>

          <div class="space-y-1">
            <div v-for="step in plan.steps" :key="step.id"
              class="flex items-center gap-2 text-xs font-mono">
              <span :class="stepIconClass(step.status)">{{ stepIcon(step.status) }}</span>
              <span :class="stepTextClass(step.status)">{{ step.text }}</span>
            </div>
          </div>

          <div v-if="plan.status === 'APPROVED'" class="pt-1">
            <button @click="execute(plan.id)"
              class="px-3 py-1 text-xs font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 transition-colors duration-150">
              {{ t('plans.execute') }}
            </button>
          </div>
          <div v-else-if="plan.status === 'INTERRUPTED' || plan.status === 'EXECUTING'" class="pt-1">
            <button @click="execute(plan.id)"
              class="px-3 py-1 text-xs font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 transition-colors duration-150">
              {{ t('plans.resume') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiClipboardList } from 'vue-icons-plus/hi'

interface PlanStep {
  id: number
  order: number
  text: string
  status: string
}

interface Plan {
  id: number
  title: string
  status: string
  steps: PlanStep[]
}

const { t } = useI18n()
const plans = ref<Plan[]>([])
let pollTimer: ReturnType<typeof setInterval> | null = null

function statusDot(status: string): string {
  if (status === 'EXECUTING') return 'text-cyber-orange'
  if (status === 'INTERRUPTED') return 'text-red-400'
  if (status === 'DONE') return 'text-cyber-green'
  return 'text-cyber-muted'
}

function statusIcon(status: string): string {
  if (status === 'EXECUTING') return '⟳'
  if (status === 'INTERRUPTED') return '◷'
  if (status === 'DONE') return '✓'
  return '○'
}

function statusLabel(status: string): string {
  if (status === 'EXECUTING') return t('plans.executing')
  if (status === 'INTERRUPTED') return t('plans.interrupted')
  if (status === 'DONE') return t('plans.done')
  if (status === 'APPROVED') return t('plans.approved')
  if (status === 'PENDING') return t('plans.pending')
  return status
}

function stepIcon(status: string): string {
  if (status === 'DONE') return '✓'
  if (status === 'FAILED') return '✗'
  if (status === 'DOING') return '⟳'
  return '○'
}

function stepIconClass(status: string): string {
  if (status === 'DONE') return 'text-cyber-green'
  if (status === 'FAILED') return 'text-red-400'
  if (status === 'DOING') return 'text-cyber-orange'
  return 'text-cyber-muted'
}

function stepTextClass(status: string): string {
  if (status === 'DONE') return 'text-cyber-muted line-through'
  if (status === 'FAILED') return 'text-red-400/80'
  return 'text-cyber-text'
}

function doneCount(plan: Plan): number {
  return plan.steps.filter(s => s.status === 'DONE').length
}

function progressPercent(plan: Plan): number {
  if (plan.steps.length === 0) return 0
  return Math.round((doneCount(plan) / plan.steps.length) * 100)
}

function hasActivePlan(): boolean {
  return plans.value.some(p => p.status === 'EXECUTING')
}

async function execute(planId: number) {
  try {
    const res = await fetch(`/api/agent/plans/${planId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerModelId: Number(localStorage.getItem('workspace.modelId')),
        sessionId: Number(localStorage.getItem('workspace.sessionId')),
      }),
    })
    if (res.ok) {
      startPolling()
    }
  } catch { /* ignore */ }
}

async function loadPlans() {
  const sessionId = localStorage.getItem('workspace.sessionId')
  if (!sessionId) return
  try {
    const res = await fetch(`/api/plans/session/${sessionId}`)
    if (res.ok) plans.value = await res.json() as Plan[]
  } catch { /* ignore */ }
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(loadPlans, 3000)
}

onMounted(loadPlans)

onUnmounted(() => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
})
</script>
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build 2>&1
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PlansView.vue
git commit -m "feat: add PlansView component with plan list, step progress, and execute/resume"
```

---

## Task 4: Wire PlansView into AppShell + SidebarNav

**Files:**
- Modify: `frontend/src/components/AppShell.vue`
- Modify: `frontend/src/components/SidebarNav.vue`

- [ ] **Step 1: Update AppShell**

Read `frontend/src/components/AppShell.vue`. Find the FilesView import and conditional render. Add PlansView:

Add import at top:
```typescript
import PlansView from './PlansView.vue'
```

Add conditional render after FilesView:
```html
      <PlansView v-if="activeView === 'plans'" class="flex-1 overflow-hidden" />
```

Extend the `activeView` type to include `'plans'`.

- [ ] **Step 2: Update SidebarNav**

Read `frontend/src/components/SidebarNav.vue`. Add a Plans navigation item:

Add to the `navItems` array:
```typescript
  { view: 'plans', label: 'Plans', icon: '📋' },
```

Update the `activeView` type to include `'plans'`.

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build 2>&1
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AppShell.vue frontend/src/components/SidebarNav.vue
git commit -m "feat: wire PlansView into AppShell and SidebarNav"
```

---

## Task 5: Add i18n Keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add Vietnamese keys**

Read `frontend/src/locales/vi.json`, append:

```json
  "plans.header": "KẾ HOẠCH",
  "plans.empty": "Chưa có kế hoạch nào",
  "plans.execute": "Thực thi",
  "plans.resume": "Tiếp tục",
  "plans.executing": "đang chạy",
  "plans.interrupted": "bị gián đoạn",
  "plans.done": "hoàn thành",
  "plans.approved": "đã duyệt",
  "plans.pending": "chờ duyệt",
  "plans.steps": "bước"
```

- [ ] **Step 2: Add English keys**

Read `frontend/src/locales/en.json`, append:

```json
  "plans.header": "PLANS",
  "plans.empty": "No plans yet",
  "plans.execute": "Execute",
  "plans.resume": "Resume",
  "plans.executing": "executing",
  "plans.interrupted": "interrupted",
  "plans.done": "done",
  "plans.approved": "approved",
  "plans.pending": "pending",
  "plans.steps": "steps"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add plans i18n keys"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Full backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS (37+ suites)

- [ ] **Step 2: Frontend build**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Review commit log**

```bash
git log --oneline -8
```

Expected: Clean commit history.
