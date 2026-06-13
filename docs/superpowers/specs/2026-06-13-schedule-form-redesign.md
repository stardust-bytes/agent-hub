# Schedule Tasks Form Redesign — Design Spec

**Date:** 2026-06-13
**Status:** Draft

---

## Problem

The current Schedule Tasks creation form is cramped and uses raw number inputs for time configuration. The weekly frequency only allows one day of week. Users need:

1. A larger modal with proper time picker dropdowns (HH:MM)
2. Weekly frequency to support selecting multiple days of week
3. Better visual clarity for the schedule configuration

---

## Data Model

### `cronDayOfWeek` → `cronDaysOfWeek`

Add new nullable String field to `ScheduleTask` model for storing multiple days:

```prisma
model ScheduleTask {
  // ... existing fields
  cronDaysOfWeek String?  // NEW: "1,3,5" = Mon,Wed,Fri
  // cronDayOfWeek Int?   // KEPT: nullable, deprecated
}
```

The old `cronDayOfWeek Int?` stays for backward compat (existing data). New code writes to `cronDaysOfWeek`. The `findEligible()` method checks `cronDaysOfWeek` first, falls back to `cronDayOfWeek`.

Migration: `prisma migrate dev --name add_cron_days_of_week` — adds nullable column, no data loss.

### DTO Update

```typescript
@IsOptional()
@IsString()
cronDaysOfWeek?: string;
```

---

## Frontend: ScheduleTasksView.vue Form Redesign

### Modal Size

Change the BaseModal to be wider. The modal uses a default width — add `class="max-w-xl"` to the modal content wrapper or use the `class` prop if BaseModal supports it.

### Time Picker: Replace number inputs with dropdowns

Replace:
```html
<input v-model.number="form.cronMinute" type="number" min="0" max="59" class="w-16 ..." />
<input v-if="..." v-model.number="form.cronHour" type="number" min="0" max="23" class="w-16 ..." />
```

With styled `<select>` dropdowns:
```html
<select v-model.number="form.cronHour" class="bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono">
  <option v-for="h in 24" :key="h-1" :value="h-1">{{ String(h-1).padStart(2,'0') }}</option>
</select>
<span class="text-cyber-muted font-mono">:</span>
<select v-model.number="form.cronMinute" class="bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono">
  <option v-for="m in 60" :key="m-1" :value="m-1">{{ String(m-1).padStart(2,'0') }}</option>
</select>
```

Layout:
```html
<div class="flex items-center gap-1">
  <span class="text-xs text-cyber-muted font-mono">HH</span>
  <select v-model.number="form.cronHour">...</select>
  <span class="text-cyber-muted font-mono">:</span>
  <select v-model.number="form.cronMinute">...</select>
  <span class="text-xs text-cyber-muted font-mono">MM</span>
</div>
```

### Frequency-specific form layout

- **manual**: no time picker shown
- **hourly**: only minute dropdown visible
- **daily**: HH:MM dropdowns
- **weekdays**: HH:MM dropdowns
- **weekly**: HH:MM dropdowns + day-of-week checkboxes

### Weekly: Day-of-week checkboxes

```html
<div v-if="form.frequency === 'weekly'" class="flex flex-wrap gap-2">
  <label v-for="(label, idx) in DAYS" :key="idx"
    class="flex items-center gap-1 px-2 py-1 border border-cyber-code-border rounded cursor-pointer text-xs font-mono"
    :class="selectedDays.includes(idx) ? 'bg-cyber-accent/20 text-cyber-accent border-cyber-accent/40' : 'text-cyber-muted hover:text-cyber-text'">
    <input type="checkbox" :value="idx" v-model="selectedDays" class="sr-only" />
    {{ label }}
  </label>
</div>
```

Where `selectedDays` is a `ref<number[]>` synced with `form.cronDaysOfWeek`:
```typescript
const selectedDays = ref<number[]>([])

watch(selectedDays, (days) => {
  form.cronDaysOfWeek = days.sort((a,b) => a-b).join(',')
})

// On load/edit:
if (task.cronDaysOfWeek) {
  selectedDays.value = task.cronDaysOfWeek.split(',').map(Number)
}
```

### Preview Text Update

Update `scheduleDesc` computed to handle multi-day weekly:

```typescript
if (f === 'weekly') {
  const dayLabels = form.value.cronDaysOfWeek
    ? form.value.cronDaysOfWeek.split(',').map(Number).map(d => DAYS[d]).join(', ')
    : DAYS[form.value.cronDayOfWeek || 0]
  return t('schedules.hint.weekly', { day: dayLabels, time })
}
```

---

## Files Changed

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `cronDaysOfWeek String?` to ScheduleTask |
| `backend/prisma/migrations/` | New migration `add_cron_days_of_week` |
| `backend/src/schedule-tasks/dto/create-schedule-task.dto.ts` | Add `cronDaysOfWeek` field |
| `backend/src/schedule-tasks/schedule-tasks.service.ts` | Update `findEligible` weekly logic |
| `frontend/src/components/ScheduleTasksView.vue` | Redesign form: larger modal, dropdown time pickers, multi-day checkboxes |
| `frontend/src/locales/*.json` | Update i18n if needed |

---

## Out of Scope

- Changing the existing `cronDayOfWeek` field — kept for backward compat, no data migration needed
- Full calendar widget — dropdown selects are sufficient for MVP
- Timezone support — all times are server-local
