# Schedule Tasks Grid + Detail Page — Design Spec

**Date:** 2026-06-13
**Status:** Draft

---

## Problem

The schedule tasks list is a vertical list that's hard to scan. There's no dedicated detail page — task info and execution logs are shown inline (expandable section in list). The cron scheduler doesn't fire reliably due to a strict inequality in interval checks.

**Goal:** Convert the task list to a grid layout, add a dedicated detail page with log history, and fix the cron interval check.

---

## Section 1: Grid Layout

Replace the current vertical list (`v-for` with full-width cards) with a responsive grid.

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-3 py-3">
  <div v-for="task in tasks" :key="task.id"
    class="border border-cyber-code-border bg-cyber-dark p-3 cursor-pointer hover:border-cyber-accent/40 transition-colors duration-150"
    @click="$router.push(`/tasks/${task.id}`)">
    <div class="flex items-center gap-2 mb-2">
      <div class="w-2 h-2 rounded-full shrink-0"
        :class="task.enabled ? 'bg-cyber-green' : 'bg-cyber-muted'"></div>
      <div class="text-sm text-cyber-text font-mono truncate flex-1">{{ task.name }}</div>
    </div>
    <div class="text-xs text-cyber-muted font-mono mb-2">
      <span class="px-1 border border-cyber-code-border text-2xs"
        :class="frequencyClass(task.frequency)">{{ t(`schedules.frequency.${task.frequency}`) }}</span>
      <span class="ml-1">{{ scheduleTime(task) }}</span>
    </div>
    <div class="text-xs font-mono mb-2">
      <span v-if="task.logs?.[0]"
        :class="task.logs[0].status === 'SUCCESS' ? 'text-cyber-green' : task.logs[0].status === 'FAILED' ? 'text-red-400' : 'text-cyber-orange'">
        {{ task.logs[0].status }}
      </span>
      <span v-else class="text-cyber-muted">—</span>
    </div>
    <div class="flex gap-1 mt-auto" @click.stop>
      <button @click="runNow(task.id)" class="text-xs text-cyber-accent/70 font-mono px-1.5 py-0.5 border border-cyber-code-border transition-colors duration-150 hover:text-cyber-accent hover:border-cyber-accent/40">▶</button>
      <button @click="editTask(task)" class="text-xs text-cyber-muted font-mono px-1.5 py-0.5 border border-cyber-code-border transition-colors duration-150 hover:text-cyber-accent">✎</button>
      <button @click="confirmDelete(task)" class="text-xs text-cyber-muted font-mono px-1.5 py-0.5 border border-cyber-code-border transition-colors duration-150 hover:text-red-400">✕</button>
    </div>
  </div>
</div>
```

The current header bar (title + add button) stays unchanged. Modals (create/edit, confirm delete) stay unchanged.

The grid uses `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` — 1 column on mobile, 2 on tablet, 3 on desktop.

---

## Section 2: Detail Page `/tasks/:id`

### Route

Add to `frontend/src/router/index.ts`:
```typescript
import ScheduleTaskDetailView from '../components/ScheduleTaskDetailView.vue'
// ...
{ path: '/tasks/:id', name: 'task-detail', component: ScheduleTaskDetailView, props: true },
```

### ScheduleTaskDetailView.vue

New component. Receives `id` as route prop. Fetches task details + logs.

**Template layout:**

```
┌──────────────────────────────────────────────┐
│ ← Tasks    task name        [▶ Run] [✎] [✕] │
├──────────────────────────────────────────────┤
│ Info                    │ Schedule            │
│ Model: gpt-4o           │ Daily 14:30         │
│ Project: /home/proj     │ Asia/Ho_Chi_Minh    │
│ Prompt: "..."           │ Enabled: ✓          │
├──────────────────────────────────────────────┤
│ Execution History (logs)                     │
│ ┌──────┬────────┬──────────┬──────────┐      │
│ │ Time │ Status │ Duration │ Output   │      │
│ ├──────┼────────┼──────────┼──────────┤      │
│ │ 14:30│ SUCCESS│ 12s      │ "done..." │      │
│ │ 13:30│ FAILED │ 5s       │ "err..."  │      │
│ └──────┴────────┴──────────┴──────────┘      │
└──────────────────────────────────────────────┘
```

**Script:**
```typescript
const props = defineProps<{ id: string }>()
const task = ref<ScheduleTask | null>(null)
const logs = ref<ScheduleTaskLog[]>([])

onMounted(async () => {
  const [t, l] = await Promise.all([
    api.listTasks().then(ts => ts.find(t => t.id === Number(props.id))),
    api.getTaskLogs(Number(props.id)),
  ])
  task.value = t ?? null
  logs.value = l
})
```

**Log table:** Rows show `createdAt`, `status` (color-coded), duration (calculated from `startedAt` → `completedAt`), and truncated `output`. Click row to expand output in a modal or inline.

---

## Section 3: Fix Cron Interval Check

**File:** `backend/src/schedule-tasks/schedule-tasks.service.ts`

Change all `>` to `>=` in the `findEligible` method:

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

**Root cause:** After a task runs, `lastRunTime` is set to execution time. The next day at the same time, `now - lastRunTime` equals exactly `86400000` (24h). Using `>` (strict greater than) rejects this exact match, so the task never runs again until 1ms later (which never arrives if cron checks at precise minute boundaries).

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/ScheduleTasksView.vue` | Replace list with grid layout, add `$router.push` on card click, add `scheduleTime()` helper |
| `frontend/src/components/ScheduleTaskDetailView.vue` | NEW — detail page with info + logs table |
| `frontend/src/router/index.ts` | Add `/tasks/:id` route |
| `frontend/src/api/scheduleTasks.ts` | No change (logs API already exists) |
| `backend/src/schedule-tasks/schedule-tasks.service.ts` | Fix `>` → `>=` in findEligible |
| `frontend/src/locales/*.json` | Add i18n keys if needed |
