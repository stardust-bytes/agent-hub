# Seamless Page Headers Implementation Plan

**Goal:** Redesign all page headers to be seamless (no border between header and content) with consistent container width, icon accent boxes, breadcrumbs for detail pages, and a unified tab bar for Settings.

**Design spec:** `docs/superpowers/specs/2026-06-21-seamless-page-headers.md`

---

## Common Patterns (apply to all tasks)

**Container:** `mx-auto max-w-5xl w-full` for header + content sharing same width. Padding `px-6`.

**Header area:** No `border-b`. No `h-[3rem]`. Padding `pt-5 pb-4` for list views, `pt-4 pb-4` for detail views.

**Icon box:** `<div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center"><HiIcon class="w-4 h-4" /></div>`

**Action ghost recipe:** `text-sm rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors duration-150 px-2.5 py-1`

**Badge recipe:** `text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5`

**Clean up:** Remove all `xl:pl-3 pl-10` references (legacy sidebar padding). Remove `h-[3rem]` and `border-b border-border` from header bars.

---

## Task 1: List views — ScheduleTasks, Notes, AgentOutput

**Files:** `ScheduleTasksView.vue`, `NotesView.vue`, `AgentOutputView.vue`

**Pattern:** Header `pt-5 pb-4` → icon box + title + badge + ghost action (ml-auto). Content in same `px-6` flow. No border.

### ScheduleTasksView.vue
```
<div class="flex flex-col bg-background min-w-0 h-full">
  <div class="mx-auto max-w-5xl w-full px-6 pt-5 pb-4">
    <div class="flex items-center gap-3">
      <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
        <HiClock class="w-4 h-4" />
      </div>
      <span class="text-base font-semibold text-foreground">{{ t('schedules.header') }}</span>
      <span class="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">{{ tasks.length }} active</span>
      <div class="ml-auto">
        <button @click="openAddForm" class="text-sm rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors duration-150 px-2.5 py-1">{{ t('schedules.add') }}</button>
      </div>
    </div>
  </div>
  <div class="mx-auto max-w-5xl w-full px-6 pb-6 flex-1 overflow-y-auto">
    ...existing content...
  </div>
</div>
```

### NotesView.vue
Same pattern — icon `HiDocumentText`, title `t('notes.header')`, badge with `notes.length`, action `+ New`.

### AgentOutputView.vue
Same pattern — icon `HiDownload`, title `t('agentOutput.header')`, badge with `files.length`, action `Refresh`.

- [ ] **Step 1:** Edit `ScheduleTasksView.vue` — remove old header bar, add seamless header
- [ ] **Step 2:** Edit `NotesView.vue` — same transform
- [ ] **Step 3:** Edit `AgentOutputView.vue` — same transform
- [ ] **Step 4:** Type-check + build
- [ ] **Step 5:** Commit

---

## Task 2: Detail view — ScheduleTaskDetailView

**Files:** `ScheduleTaskDetailView.vue`

**Pattern:** Breadcrumb (mono, muted) → header with icon + title + count + actions.

- [ ] **Step 1:** Edit `ScheduleTaskDetailView.vue` — replace old header with:
  - breadcrumb: `Tasks / task.name` in `font-mono text-xs text-muted-foreground`
  - title row: icon box + title (`text-lg font-bold`) + run count badge + Edit + Run Now
  - no `border-b`, no `h-[3rem]`
  - content uses same `mx-auto max-w-5xl px-6`
- [ ] **Step 2:** Type-check + build
- [ ] **Step 3:** Commit

---

## Task 3: Settings tabs — SettingsView + tab content views

**Files:** `SettingsView.vue`, `ProvidersView.vue`, `AgentsView.vue`, `ToolsView.vue`, `UsageView.vue`, `MemoryView.vue`, `PermissionView.vue`

**Pattern:** 
- `SettingsView.vue` becomes the container with: header icon + "Settings" title → tab bar → active tab content
- Tab bar: `inline-flex border-b border-border`, tabs in `font-mono text-sm`, active = `text-primary border-b-2 border-primary`
- Each tab content view removes its own `h-[3rem]` header bar (since the tab bar replaces it)
- Tab views keep a small in-content title for context: `font-mono text-xs text-muted-foreground mb-3`

### SettingsView.vue structure:
```
<div class="flex-1 flex flex-col bg-background overflow-hidden">
  <div class="mx-auto max-w-5xl w-full px-6 pt-5 pb-0">
    <div class="flex items-center gap-3">
      <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
        <HiCog class="w-4 h-4" />
      </div>
      <span class="text-base font-semibold text-foreground">{{ t('settings.header') }}</span>
    </div>
  </div>

  <div class="mx-auto max-w-5xl w-full px-6">
    <div class="flex gap-0 border-b border-border">
      <button v-for="tab in TABS" :key="tab.key"
        @click="router.push('/settings/' + tab.key)"
        class="font-mono text-sm px-3 py-1.5 transition-colors duration-150"
        :class="activeSettingsTab === tab.key ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'"
      >{{ t(tab.labelKey) }}</button>
    </div>
  </div>

  <MemoryView v-if="activeSettingsTab === 'memories'" />
  <UsageView v-else-if="activeSettingsTab === 'usage'" />
  ...
</div>
```

### Tab content views (ProvidersView, AgentsView, ToolsView, UsageView, MemoryView, PermissionView):
- Remove their `h-[3rem] border-b border-border bg-surface` header bar
- Add a small `font-mono text-xs text-muted-foreground` section label inside the content area
- Keep existing content structure

- [ ] **Step 1:** Edit `SettingsView.vue` — add header with icon + title, add tab bar below
- [ ] **Step 2:** Edit `ProvidersView.vue` — remove header bar, add inline label
- [ ] **Step 3:** Edit `AgentsView.vue` — same
- [ ] **Step 4:** Edit `ToolsView.vue` — same
- [ ] **Step 5:** Edit `UsageView.vue` — same
- [ ] **Step 6:** Edit `MemoryView.vue` — same
- [ ] **Step 7:** Edit `PermissionView.vue` — same
- [ ] **Step 8:** Type-check + build
- [ ] **Step 9:** Commit

---

## Task 4: Simple views — Connectors, Files

**Files:** `ConnectorsView.vue`, `FilesView.vue`

**Pattern:** Standard list header with icon + title + optional action.

- [ ] **Step 1:** Edit `ConnectorsView.vue` — seamless header, icon box + "Connectors" + "+ Connect" ghost
- [ ] **Step 2:** Edit `FilesView.vue` — seamless header, icon box + "Files" (no action)
- [ ] **Step 3:** Type-check + build
- [ ] **Step 4:** Commit

---

## Task 5: CoworkView ProjectBar restyle

**Files:** `cowork/ProjectBar.vue`

**Changes:**
- Remove `h-[3rem]` and `border-b border-border` from root div
- Add icon box with folder icon
- Restyle path: first segment `font-medium text-foreground`, rest `text-muted-foreground`
- Keep connection dot (green/success on left)
- Keep sub-agent badge but restyle to match badge recipe
- Keep project menu button
- Remove `xl:pl-3 pl-10` padding

```
<div class="flex items-center gap-3 px-6 py-3">
  <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
    <HiFolder class="w-4 h-4" />
  </div>
  <span class="w-2 h-2 rounded-full shrink-0" :class="projectPath ? 'bg-success' : 'bg-muted'"></span>
  <div class="flex items-center gap-1 min-w-0 font-mono text-sm">
    <span class="text-foreground font-medium truncate">{{ rootDir }}</span>
    <span class="text-muted-foreground truncate">{{ subPath }}</span>
  </div>
  <span v-if="subagentCount && subagentCount > 0"
    class="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5 flex items-center gap-1">
    <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
    {{ subagentCount }}
  </span>
  <div class="ml-auto flex items-center gap-1">
    ... existing project menu button ...
  </div>
</div>
```

- [ ] **Step 1:** Edit `cowork/ProjectBar.vue` — seamless restyle
- [ ] **Step 2:** Type-check + build
- [ ] **Step 3:** Commit

---

## Task 6: Clean up legacy padding

**Files:** All modified views

- [ ] **Step 1:** Scan all modified files for remaining `xl:pl-3 pl-10` patterns and remove them
- [ ] **Step 2:** Verify no `h-[3rem]` remains in header bars (except legitimate uses like input bars)
- [ ] **Step 3:** Type-check + build
- [ ] **Step 4:** Full test run
- [ ] **Step 5:** Commit

---

## Task 7: Update AGENTS.md

**Files:** `frontend/AGENTS.md`, `frontend/src/components/AGENTS.md`

- [ ] **Step 1:** Update `frontend/src/components/AGENTS.md` Header Pattern section to reflect the new seamless design
- [ ] **Step 2:** Commit

---

## Verification

Each task must pass:
```
npm --prefix frontend run type-check
npm --prefix frontend run build
npm --prefix frontend run test
```
