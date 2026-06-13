# Schedule Tasks Grid + Detail Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert schedule tasks list to grid layout, add detail page with execution logs, fix cron interval check.

**Architecture:** Fix `>` → `>=` in backend `findEligible` → redesign ScheduleTasksView as grid → create ScheduleTaskDetailView + route.

**Tech Stack:** NestJS, Vue 3, TailwindCSS, vue-router

---

### Task 1: Backend — fix cron interval check

**Files:**
- Modify: `backend/src/schedule-tasks/schedule-tasks.service.ts`

- [ ] **Step 1: Fix interval comparisons**

Read `backend/src/schedule-tasks/schedule-tasks.service.ts`. In the `findEligible` method, change all `>` to `>=` for the interval checks:

```typescript
case 'hourly':
  return task.cronMinute === minute && (now.getTime() - lastRunTime >= 3600000);
case 'daily':
  return task.cronHour === hour && task.cronMinute === minute && (now.getTime() - lastRunTime >= 86400000);
case 'weekdays':
  return task.cronHour === hour && task.cronMinute === minute
    && day >= 1 && day <= 5 && (now.getTime() - lastRunTime >= 86400000);
case 'weekly':
  const days = (task.cronDaysOfWeek ?? String(task.cronDayOfWeek ?? '')).split(',').map(Number);
  return days.includes(day) && task.cronHour === hour
    && task.cronMinute === minute && (now.getTime() - lastRunTime >= 86400000 * 7);
```

- [ ] **Step 2: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```
git add backend/src/schedule-tasks/schedule-tasks.service.ts
git commit -m "fix: change cron interval check from > to >= for reliable scheduling"
```

---

### Task 2: Frontend — grid layout for ScheduleTasksView

**Files:**
- Modify: `frontend/src/components/ScheduleTasksView.vue`

- [ ] **Step 1: Read current ScheduleTasksView.vue**

Read the file to understand the current structure.

- [ ] **Step 2: Replace the task list with grid layout**

Find the task list section (the `v-for="task in tasks"` div). Replace it with:

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-3 py-3">
  <div v-for="task in tasks" :key="task.id"
    class="border border-cyber-code-border bg-cyber-dark p-3 cursor-pointer hover:border-cyber-accent/40 transition-colors duration-150 flex flex-col"
    @click="$router.push(`/tasks/${task.id}`)">
    <div class="flex items-center gap-2 mb-2">
      <div class="w-2 h-2 rounded-full shrink-0"
        :class="task.enabled ? 'bg-cyber-green' : 'bg-cyber-muted'"></div>
      <div class="text-sm text-cyber-text font-mono truncate flex-1">{{ task.name }}</div>
    </div>
    <div class="text-xs text-cyber-muted font-mono mb-2 flex items-center gap-1">
      <span class="px-1 border border-cyber-code-border text-2xs"
        :class="frequencyClass(task.frequency)">{{ t(`schedules.frequency.${task.frequency}`) }}</span>
      <span>{{ scheduleTime(task) }}</span>
    </div>
    <div class="text-xs font-mono mb-3">
      <span v-if="task.logs?.[0]"
        :class="task.logs[0].status === 'SUCCESS' ? 'text-cyber-green' : task.logs[0].status === 'FAILED' ? 'text-red-400' : 'text-cyber-orange'">
        {{ task.logs[0].status }}
      </span>
      <span v-else class="text-cyber-muted">—</span>
    </div>
    <div class="flex gap-1 mt-auto" @click.stop>
      <button @click="runNow(task.id)" class="text-xs text-cyber-accent/70 font-mono px-1.5 py-0.5 border border-cyber-code-border transition-colors duration-150 hover:text-cyber-accent hover:border-cyber-accent/40">&#9654;</button>
      <button @click="editTask(task)" class="text-xs text-cyber-muted font-mono px-1.5 py-0.5 border border-cyber-code-border transition-colors duration-150 hover:text-cyber-accent">&#9998;</button>
      <button @click="confirmDelete(task)" class="text-xs text-cyber-muted font-mono px-1.5 py-0.5 border border-cyber-code-border transition-colors duration-150 hover:text-red-400">&#10005;</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add scheduleTime function**

In the `<script setup>`, add:

```typescript
function scheduleTime(task: { frequency: string; cronHour: number | null; cronMinute: number | null; cronDayOfWeek: number | null; cronDaysOfWeek: string | null; timezone: string | null }): string {
  const mm = String(task.cronMinute ?? 0).padStart(2, '0')
  const hh = String(task.cronHour ?? 0).padStart(2, '0')
  if (task.frequency === 'hourly') return `:${mm}`
  if (task.frequency === 'daily') return `${hh}:${mm}`
  if (task.frequency === 'weekdays') return `${hh}:${mm}`
  if (task.frequency === 'weekly') {
    const days = task.cronDaysOfWeek
      ? task.cronDaysOfWeek.split(',').map(Number).map(d => DAYS[d]).join(',')
      : DAYS[task.cronDayOfWeek ?? 0]
    return `${days} ${hh}:${mm}`
  }
  return ''
}
```

- [ ] **Step 4: Add router import**

Add to the import section:
```typescript
import { useRouter } from 'vue-router'
const router = useRouter()
```

- [ ] **Step 5: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```
git add frontend/src/components/ScheduleTasksView.vue
git commit -m "feat: convert schedule tasks list to grid layout with card click navigation"
```

---

### Task 3: Frontend — ScheduleTaskDetailView + route

**Files:**
- Create: `frontend/src/components/ScheduleTaskDetailView.vue`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Create ScheduleTaskDetailView.vue**

Create `frontend/src/components/ScheduleTaskDetailView.vue`:

```vue
<template>
  <div class="flex flex-col bg-cyber-bg min-w-0 h-full">
    <div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-cyber-code-border shrink-0 bg-cyber-dark">
      <button @click="router.push('/tasks')" class="text-xs text-cyber-muted font-mono hover:text-cyber-accent transition-colors duration-150">&#8592; {{ t('schedules.detail.back') }}</button>
      <span class="text-sm text-cyber-accent font-mono ml-2 truncate">{{ task?.name || t('schedules.detail.loading') }}</span>
      <div class="ml-auto flex gap-1">
        <button @click="runNow(task!.id)" class="text-xs text-cyber-accent/70 font-mono px-2 py-0.5 border border-cyber-code-border transition-colors duration-150 hover:text-cyber-accent">&#9654; {{ t('schedules.runNow') }}</button>
        <button @click="editTask(task)" class="text-xs text-cyber-muted font-mono px-2 py-0.5 border border-cyber-code-border transition-colors duration-150 hover:text-cyber-accent">&#9998;</button>
        <button @click="confirmDelete(task)" class="text-xs text-cyber-muted font-mono px-2 py-0.5 border border-cyber-code-border transition-colors duration-150 hover:text-red-400">&#10005;</button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-4">
      <!-- Info section -->
      <div class="border border-cyber-code-border bg-cyber-dark p-3">
        <div class="grid grid-cols-2 gap-3 text-sm font-mono">
          <div><span class="text-cyber-muted">{{ t('schedules.form.name') }}:</span> <span class="text-cyber-text">{{ task?.name }}</span></div>
          <div><span class="text-cyber-muted">{{ t('schedules.form.description') }}:</span> <span class="text-cyber-text">{{ task?.description || '—' }}</span></div>
          <div><span class="text-cyber-muted">{{ t('schedules.frequency') }}:</span> <span class="text-cyber-text">{{ task ? t(`schedules.frequency.${task.frequency}`) : '' }} {{ scheduleTime(task) }}</span></div>
          <div><span class="text-cyber-muted">{{ t('schedules.model') }}:</span> <span class="text-cyber-text">{{ task?.modelId || '—' }}</span></div>
          <div><span class="text-cyber-muted">{{ t('schedules.form.projectPath') }}:</span> <span class="text-cyber-text">{{ task?.projectPath || '—' }}</span></div>
          <div><span class="text-cyber-muted">{{ t('schedules.timezone') }}:</span> <span class="text-cyber-text">{{ task?.timezone || 'UTC' }}</span></div>
          <div class="col-span-2"><span class="text-cyber-muted">{{ t('schedules.form.prompt') }}:</span></div>
          <div class="col-span-2 text-cyber-text bg-cyber-code-bg p-2 whitespace-pre-wrap text-xs font-mono">{{ task?.prompt }}</div>
        </div>
      </div>

      <!-- Logs section -->
      <div class="border border-cyber-code-border bg-cyber-dark">
        <div class="px-3 py-2 border-b border-cyber-code-border">
          <span class="text-sm text-cyber-accent font-mono">{{ t('schedules.logs.header') }}</span>
        </div>
        <div v-if="logs.length === 0" class="px-3 py-4 text-sm text-cyber-muted font-mono text-center">{{ t('schedules.logs.empty') }}</div>
        <div v-for="log in logs" :key="log.id" @click="expandedLog = expandedLog === log.id ? null : log.id"
          class="px-3 py-2 border-b border-cyber-code-border last:border-0 cursor-pointer hover:bg-cyber-bg/30 transition-colors duration-150">
          <div class="flex items-center gap-3 text-xs font-mono">
            <span class="text-cyber-muted shrink-0">{{ log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : '' }}</span>
            <span class="shrink-0" :class="log.status === 'SUCCESS' ? 'text-cyber-green' : log.status === 'FAILED' ? 'text-red-400' : 'text-cyber-orange'">{{ log.status }}</span>
            <span v-if="log.startedAt && log.completedAt" class="text-cyber-muted shrink-0">{{ Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000) }}s</span>
            <span v-if="log.sessionId" class="text-cyber-accent/60 shrink-0">#{{ log.sessionId }}</span>
          </div>
          <div v-if="expandedLog === log.id && log.output" class="mt-2 text-xs text-cyber-text font-mono whitespace-pre-wrap bg-cyber-code-bg p-2 break-all">{{ log.output }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import * as api from '../api/scheduleTasks'
import type { ScheduleTask, ScheduleTaskLog } from '../api/scheduleTasks'

const props = defineProps<{ id: string }>()
const router = useRouter()
const { t } = useI18n()

const task = ref<ScheduleTask | null>(null)
const logs = ref<ScheduleTaskLog[]>([])
const expandedLog = ref<number | null>(null)

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function scheduleTime(t: ScheduleTask | null): string {
  if (!t) return ''
  const mm = String(t.cronMinute ?? 0).padStart(2, '0')
  const hh = String(t.cronHour ?? 0).padStart(2, '0')
  if (t.frequency === 'hourly') return `:${mm}`
  if (t.frequency === 'daily') return `${hh}:${mm}`
  if (t.frequency === 'weekdays') return `${hh}:${mm}`
  if (t.frequency === 'weekly') {
    const days = t.cronDaysOfWeek
      ? t.cronDaysOfWeek.split(',').map(Number).map(d => DAYS[d]).join(',')
      : DAYS[t.cronDayOfWeek ?? 0]
    return `${days} ${hh}:${mm}`
  }
  return ''
}

onMounted(async () => {
  try {
    const tasks = await api.listTasks()
    task.value = tasks.find((t: ScheduleTask) => t.id === Number(props.id)) ?? null
  } catch { /* ignore */ }
  try {
    logs.value = await api.getTaskLogs(Number(props.id))
  } catch { /* ignore */ }
})

async function runNow(id: number) {
  try {
    await api.runTask(id)
    logs.value = await api.getTaskLogs(Number(props.id))
  } catch { /* ignore */ }
}

async function confirmDelete(t: ScheduleTask | null) {
  if (!t) return
  if (!confirm(t('schedules.deleteConfirm'))) return
  try {
    await api.deleteTask(t.id)
    router.push('/tasks')
  } catch { /* ignore */ }
}
</script>
```

- [ ] **Step 2: Add route**

Edit `frontend/src/router/index.ts`:

Add import:
```typescript
import ScheduleTaskDetailView from '../components/ScheduleTaskDetailView.vue'
```

Add route:
```typescript
{ path: '/tasks/:id', name: 'task-detail', component: ScheduleTaskDetailView, props: true },
```

- [ ] **Step 3: Add i18n keys**

Add to `frontend/src/locales/vi.json`:
```json
"schedules": {
  // ... existing keys, add:
  "detail": {
    "back": "Tasks",
    "loading": "Đang tải..."
  },
  "model": "Model",
  "timezone": "Timezone",
  "frequency": "Tần suất"
}
```

Add to `frontend/src/locales/en.json`:
```json
"schedules": {
  // ... existing keys, add:
  "detail": {
    "back": "Tasks",
    "loading": "Loading..."
  },
  "model": "Model",
  "timezone": "Timezone",
  "frequency": "Frequency"
}
```

Note: Add these INSIDE the existing `"schedules"` object, don't duplicate it.

- [ ] **Step 4: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add frontend/src/components/ScheduleTaskDetailView.vue frontend/src/router/index.ts frontend/src/locales
git commit -m "feat: add schedule task detail page with execution logs"
```

---

## Verification

After all tasks:

```bash
cd frontend && npm run type-check && npm run build
cd backend && npx tsc --noEmit
```

Expected: all PASS.
