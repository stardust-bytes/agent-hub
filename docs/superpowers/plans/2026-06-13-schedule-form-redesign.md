# Schedule Tasks Form Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Schedule Tasks form UX — larger modal, dropdown time pickers (HH:MM), multi-day weekly selection.

**Architecture:** Add `cronDaysOfWeek` column to ScheduleTask → update DTO and `findEligible` → redesign form in ScheduleTasksView.

**Tech Stack:** NestJS, Prisma, SQLite, Vue 3, TailwindCSS

---

### Task 1: Backend — add cronDaysOfWeek column

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/schedule-tasks/dto/create-schedule-task.dto.ts`
- Modify: `backend/src/schedule-tasks/schedule-tasks.service.ts`

- [ ] **Step 1: Update Prisma schema**

Add `cronDaysOfWeek` field to `ScheduleTask` model in `backend/prisma/schema.prisma`:

```prisma
model ScheduleTask {
  id            Int      @id @default(autoincrement())
  name          String
  description   String?
  prompt        String
  frequency     String   @default("manual")
  cronMinute    Int?
  cronHour      Int?
  cronDayOfWeek Int?
  cronDaysOfWeek String?   // NEW: comma-separated "1,3,5" for Mon,Wed,Fri
  modelId       Int?
  projectPath   String?
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  logs          ScheduleTaskLog[]
}
```

- [ ] **Step 2: Generate migration**

Run:
```
cd backend && npx prisma migrate dev --name add_cron_days_of_week
```
Expected: Migration applied. No data loss (nullable column).

- [ ] **Step 3: Update DTO**

Read `backend/src/schedule-tasks/dto/create-schedule-task.dto.ts`. Add:

```typescript
@IsOptional()
@IsString()
cronDaysOfWeek?: string;
```

- [ ] **Step 4: Update findEligible weekly logic**

Read `backend/src/schedule-tasks/schedule-tasks.service.ts`. Replace the `weekly` case in `findEligible`:

```typescript
case 'weekly':
  const days = (task.cronDaysOfWeek ?? String(task.cronDayOfWeek ?? '')).split(',').map(Number);
  return days.includes(day) && task.cronHour === hour && task.cronMinute === minute && (now.getTime() - lastRunTime > 86400000 * 7);
```

- [ ] **Step 5: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/schedule-tasks
git commit -m "feat: add cronDaysOfWeek field for multi-day weekly scheduling"
```

---

### Task 2: Frontend — redesign ScheduleTasksView form

**Files:**
- Modify: `frontend/src/components/ScheduleTasksView.vue`

- [ ] **Step 1: Read current ScheduleTasksView.vue**

Read `frontend/src/components/ScheduleTasksView.vue`. Focus on the form modal section (the BaseModal with input fields).

- [ ] **Step 2: Replace time number inputs with dropdowns**

Replace the current grid with number inputs:

```html
<div class="space-y-3">
  <!-- existing: name, description, prompt fields -->

  <!-- Frequency selector -->
  <select v-model="form.frequency"
    class="w-full bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono">
    <option v-for="f in FREQUENCIES" :key="f" :value="f">{{ t(`schedules.frequency.${f}`) }}</option>
  </select>

  <!-- Time picker (shown for non-manual) -->
  <div v-if="form.frequency !== 'manual'" class="space-y-3">
    <!-- Hour + Minute dropdowns for daily/weekdays/weekly -->
    <div v-if="['daily','weekdays','weekly'].includes(form.frequency)" class="flex items-center gap-2">
      <div class="flex items-center gap-1">
        <span class="text-2xs text-cyber-muted font-mono">HH</span>
        <select v-model.number="form.cronHour"
          class="bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono">
          <option v-for="h in 24" :key="h-1" :value="h-1">{{ String(h-1).padStart(2,'0') }}</option>
        </select>
      </div>
      <span class="text-cyber-muted font-mono">:</span>
      <div class="flex items-center gap-1">
        <select v-model.number="form.cronMinute"
          class="bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono">
          <option v-for="m in 60" :key="m-1" :value="m-1">{{ String(m-1).padStart(2,'0') }}</option>
        </select>
        <span class="text-2xs text-cyber-muted font-mono">MM</span>
      </div>
    </div>

    <!-- Minute-only for hourly -->
    <div v-if="form.frequency === 'hourly'" class="flex items-center gap-2">
      <span class="text-xs text-cyber-muted font-mono">{{ t('schedules.form.atMinute') }}</span>
      <select v-model.number="form.cronMinute"
        class="bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono">
        <option v-for="m in 60" :key="m-1" :value="m-1">{{ String(m-1).padStart(2,'0') }}</option>
      </select>
    </div>

    <!-- Day-of-week checkboxes for weekly -->
    <div v-if="form.frequency === 'weekly'">
      <div class="text-xs text-cyber-muted font-mono mb-1">{{ t('schedules.form.days') }}</div>
      <div class="flex flex-wrap gap-2">
        <label v-for="(label, idx) in DAYS" :key="idx"
          class="flex items-center gap-1 px-2 py-1 border border-cyber-code-border rounded cursor-pointer text-xs font-mono select-none transition-colors duration-150"
          :class="selectedDays.includes(idx)
            ? 'bg-cyber-accent/20 text-cyber-accent border-cyber-accent/40'
            : 'text-cyber-muted hover:text-cyber-text hover:border-cyber-accent/30'">
          <input type="checkbox" :value="idx" v-model="selectedDays" class="sr-only" />
          {{ label }}
        </label>
      </div>
    </div>
  </div>

  <!-- Preview text -->
  <div class="text-xs text-cyber-muted font-mono" v-if="form.frequency !== 'manual'">
    {{ scheduleDesc }}
  </div>
</div>
```

- [ ] **Step 3: Add selectedDays ref and watcher**

In the `<script setup>`, add:

```typescript
const selectedDays = ref<number[]>([])

watch(selectedDays, (days) => {
  if (days.length > 0) {
    form.cronDaysOfWeek = days.sort((a, b) => a - b).join(',')
  } else {
    form.cronDaysOfWeek = ''
  }
})
```

- [ ] **Step 4: Update form reset and editTask for cronDaysOfWeek**

Update `resetForm()`:
```typescript
function resetForm() {
  form.value = { name: '', description: '', prompt: '', frequency: 'manual', cronMinute: 0, cronHour: 0, cronDayOfWeek: 0, cronDaysOfWeek: '' }
  selectedDays.value = []
}
```

Add `cronDaysOfWeek` to the form ref:
```typescript
const form = ref({
  name: '',
  description: '',
  prompt: '',
  frequency: 'manual',
  cronMinute: 0,
  cronHour: 0,
  cronDayOfWeek: 0,
  cronDaysOfWeek: '',
})
```

Update `editTask()` to load existing days:
```typescript
function editTask(task: ScheduleTask) {
  editingTask.value = task
  form.value = {
    name: task.name,
    description: task.description ?? '',
    prompt: task.prompt,
    frequency: task.frequency,
    cronMinute: task.cronMinute ?? 0,
    cronHour: task.cronHour ?? 0,
    cronDayOfWeek: task.cronDayOfWeek ?? 0,
    cronDaysOfWeek: task.cronDaysOfWeek ?? '',
  }
  if (task.cronDaysOfWeek) {
    selectedDays.value = task.cronDaysOfWeek.split(',').map(Number)
  } else if (task.cronDayOfWeek != null) {
    selectedDays.value = [task.cronDayOfWeek]
  } else {
    selectedDays.value = []
  }
  showForm.value = true
}
```

- [ ] **Step 5: Update scheduleDesc computed for weekly multi-day**

Update `scheduleDesc`:

```typescript
const scheduleDesc = computed(() => {
  const f = form.value.frequency
  const mm = String(form.value.cronMinute).padStart(2, '0')
  const hh = String(form.value.cronHour).padStart(2, '0')
  if (f === 'hourly') return t('schedules.hint.hourly', { m: mm })
  const time = `${hh}:${mm}`
  if (f === 'daily') return t('schedules.hint.daily', { time })
  if (f === 'weekdays') return t('schedules.hint.weekdays', { time })
  if (f === 'weekly') {
    const days = selectedDays.value.length > 0
      ? selectedDays.value.map(d => DAYS[d]).join(', ')
      : DAYS[form.value.cronDayOfWeek || 0]
    return t('schedules.hint.weekly', { day: days, time })
  }
  return ''
})
```

- [ ] **Step 6: Make modal wider**

Find the `<BaseModal>` element. Add `max-w-xl` to the modal's content wrapper or find if BaseModal supports a size prop. If BaseModal uses a slot, add a wrapper:

```html
<BaseModal v-model="showForm">
  <template #header>...</template>
  <div class="p-3 space-y-3 max-w-xl">
    <!-- form fields -->
  </div>
  <template #footer>...</template>
</BaseModal>
```

- [ ] **Step 7: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: PASS

- [ ] **Step 8: Commit**

```
git add frontend/src/components/ScheduleTasksView.vue
git commit -m "feat: redesign schedule form with dropdown time pickers and multi-day weekly"
```

---

## Verification

After all tasks:

```bash
cd frontend && npm run type-check && npm run build
cd backend && npx tsc --noEmit
```

Expected: all PASS.
