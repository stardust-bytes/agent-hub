# TasksView Mobile Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize TasksView for mobile (<768px) with tab-based status navigation, modal-based task CRUD, and unified task card design.

**Architecture:** TasksView owns all modals (TaskFormModal, BaseConfirmModal) and passes a `mobileStatus` prop to KanbanBoard which conditionally renders single-column (mobile) or 4-column drag-and-drop (desktop). TaskCard emits `edit`/`delete` events that bubble through KanbanBoard to TasksView.

**Tech Stack:** Vue 3 Composition API, TailwindCSS (cyber-* tokens), vue-i18n, vue-draggable-plus, socket.io-client, vue-icons-plus/hi

---

## Files

| Type | File |
|------|------|
| Modify | `frontend/src/locales/vi.json` |
| Modify | `frontend/src/locales/en.json` |
| Create | `frontend/src/components/BaseConfirmModal.vue` |
| Create | `frontend/src/components/TaskFormModal.vue` |
| Modify | `frontend/src/components/TaskCard.vue` |
| Remove | `frontend/src/components/TaskCardMenu.vue` |
| Modify | `frontend/src/components/KanbanBoard.vue` |
| Modify | `frontend/src/components/TasksView.vue` |

---

### Task 1: Add i18n keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add Vietnamese keys**

Edit `frontend/src/locales/vi.json`, insert after line 40 (after `"tasks.ws.disconnected"` line):

```json
  "tasks.add.modal.title": "Thêm task",
  "tasks.edit.modal.title": "Sửa task",
  "tasks.form.title": "Tên task",
  "tasks.form.priority": "Ưu tiên",
  "tasks.form.status": "Trạng thái",
  "tasks.form.save": "Lưu",
  "tasks.form.cancel": "Huỷ",
  "tasks.delete.confirm": "Xoá task này?",
  "tasks.delete.confirm.btn": "Xoá",
  "tasks.delete.cancel.btn": "Huỷ",
  "tasks.edit": "SỬA"
```

- [ ] **Step 2: Add English keys**

Edit `frontend/src/locales/en.json`, insert after line 40:

```json
  "tasks.add.modal.title": "Add task",
  "tasks.edit.modal.title": "Edit task",
  "tasks.form.title": "Title",
  "tasks.form.priority": "Priority",
  "tasks.form.status": "Status",
  "tasks.form.save": "Save",
  "tasks.form.cancel": "Cancel",
  "tasks.delete.confirm": "Delete this task?",
  "tasks.delete.confirm.btn": "Delete",
  "tasks.delete.cancel.btn": "Cancel",
  "tasks.edit": "Edit"
```

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('frontend/src/locales/vi.json','utf8')); JSON.parse(require('fs').readFileSync('frontend/src/locales/en.json','utf8')); console.log('OK')"`

Expected: `OK`

---

### Task 2: Create BaseConfirmModal.vue

**Files:**
- Create: `frontend/src/components/BaseConfirmModal.vue`

- [ ] **Step 1: Create component**

Write `frontend/src/components/BaseConfirmModal.vue`:

```vue
<template>
  <BaseModal v-model="modelValue" :closable="false">
    <template #header>
      <span class="text-cyber-text text-sm font-mono">{{ title }}</span>
    </template>
    <div class="px-3 py-4">
      <p class="text-sm text-cyber-muted font-mono">{{ message }}</p>
    </div>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <button
          @click="$emit('update:modelValue', false)"
          class="px-3 py-1.5 text-sm font-mono text-cyber-muted bg-cyber-dark hover:text-cyber-text transition-colors duration-150"
        >{{ t('tasks.form.cancel') }}</button>
        <button
          @click="onConfirm"
          class="px-3 py-1.5 text-sm font-mono text-white bg-red-500/80 hover:bg-red-500 transition-colors duration-150"
        >{{ t('tasks.delete.confirm.btn') }}</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

defineProps<{
  modelValue: boolean
  title: string
  message: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

const { t } = useI18n()

function onConfirm() {
  emit('confirm')
  emit('update:modelValue', false)
}
</script>
```

---

### Task 3: Create TaskFormModal.vue

**Files:**
- Create: `frontend/src/components/TaskFormModal.vue`

- [ ] **Step 1: Create component**

Write `frontend/src/components/TaskFormModal.vue`:

```vue
<template>
  <BaseModal v-model="modelValue" :closable="true" max-height="80vh">
    <template #header>
      <span class="text-cyber-text text-sm font-mono">
        {{ editing ? t('tasks.edit.modal.title') : t('tasks.add.modal.title') }}
      </span>
    </template>
    <div class="px-3 py-4 space-y-3">
      <div>
        <label class="text-sm text-cyber-muted font-mono block mb-1">{{ t('tasks.form.title') }}</label>
        <input
          v-model="form.title"
          class="w-full bg-cyber-dark px-2 py-1.5 text-sm font-mono text-cyber-text placeholder-cyber-muted/40 outline-none"
          :placeholder="t('tasks.add.placeholder')"
        />
      </div>
      <div>
        <label class="text-sm text-cyber-muted font-mono block mb-1">{{ t('tasks.form.priority') }}</label>
        <div class="flex gap-2">
          <button
            v-for="p in PRIORITY_OPTIONS"
            :key="p.value"
            @click="form.priority = p.value"
            :class="[
              'flex-1 text-sm py-1 font-mono transition-colors duration-150',
              form.priority === p.value ? p.activeClass : p.inactiveClass,
            ]"
          >{{ t(p.labelKey) }}</button>
        </div>
      </div>
      <div>
        <label class="text-sm text-cyber-muted font-mono block mb-1">{{ t('tasks.form.status') }}</label>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="s in STATUS_OPTIONS"
            :key="s.value"
            @click="form.status = s.value"
            :class="[
              'text-sm px-2 py-1 font-mono transition-colors duration-150',
              form.status === s.value ? s.activeClass : s.inactiveClass,
            ]"
          >{{ t(s.labelKey) }}</button>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <button
          @click="$emit('update:modelValue', false)"
          class="px-3 py-1.5 text-sm font-mono text-cyber-muted bg-cyber-dark hover:text-cyber-text transition-colors duration-150"
        >{{ t('tasks.form.cancel') }}</button>
        <button
          @click="onSave"
          :disabled="!form.title.trim()"
          class="px-3 py-1.5 text-sm font-mono text-black bg-cyber-accent hover:bg-cyber-accent/80 transition-colors duration-150 disabled:opacity-40"
        >{{ t('tasks.form.save') }}</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

interface Task {
  id: number
  title: string
  description?: string | null
  status: string
  priority: number
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  modelValue: boolean
  editing: Task | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { t } = useI18n()

const PRIORITY_OPTIONS = [
  { value: 2, labelKey: 'tasks.priority.high', activeClass: 'text-red-400 bg-red-400/15', inactiveClass: 'text-red-400/50 hover:text-red-400' },
  { value: 1, labelKey: 'tasks.priority.medium', activeClass: 'text-cyber-orange bg-cyber-orange/15', inactiveClass: 'text-cyber-orange/50 hover:text-cyber-orange' },
  { value: 0, labelKey: 'tasks.priority.low', activeClass: 'text-cyber-muted bg-cyber-muted/15', inactiveClass: 'text-cyber-muted/50 hover:text-cyber-muted' },
]

const STATUS_OPTIONS = [
  { value: 'TODO', labelKey: 'tasks.col.todo', activeClass: 'text-cyber-accent bg-cyber-accent/15', inactiveClass: 'text-cyber-accent/50 hover:text-cyber-accent' },
  { value: 'PROCESSING', labelKey: 'tasks.col.processing', activeClass: 'text-cyber-orange bg-cyber-orange/15', inactiveClass: 'text-cyber-orange/50 hover:text-cyber-orange' },
  { value: 'DONE', labelKey: 'tasks.col.done', activeClass: 'text-cyber-green bg-cyber-green/15', inactiveClass: 'text-cyber-green/50 hover:text-cyber-green' },
  { value: 'FAILED', labelKey: 'tasks.col.failed', activeClass: 'text-red-400 bg-red-400/15', inactiveClass: 'text-red-400/50 hover:text-red-400' },
]

const form = reactive({ title: '', priority: 0, status: 'TODO' })

watch(() => props.modelValue, (open) => {
  if (open) {
    if (props.editing) {
      form.title = props.editing.title
      form.priority = props.editing.priority
      form.status = props.editing.status
    } else {
      form.title = ''
      form.priority = 0
      form.status = 'TODO'
    }
  }
})

async function onSave() {
  const title = form.title.trim()
  if (!title) return
  const payload = { title, priority: form.priority, status: form.status }
  try {
    if (props.editing) {
      await fetch(`/api/tasks/${props.editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    emit('saved')
    emit('update:modelValue', false)
  } catch {
    // silently fail — error shown via system message
  }
}
</script>
```

---

### Task 4: Update TaskCard.vue

**Files:**
- Modify: `frontend/src/components/TaskCard.vue`
- Remove: `frontend/src/components/TaskCardMenu.vue`

- [ ] **Step 1: Replace TaskCard template and script**

Overwrite `frontend/src/components/TaskCard.vue`:

```vue
<template>
  <div
    class="p-2 select-none transition-colors duration-150"
    :class="cardBgClass(task.priority)"
  >
    <div class="text-cyber-text text-sm leading-snug font-mono">{{ task.title }}</div>

    <div class="flex items-center justify-between mt-1.5 gap-2">
      <div class="flex items-center gap-1.5">
        <span :class="['text-sm px-1.5 py-0.5 font-mono', priorityClass(task.priority)]">
          {{ priorityLabel(task.priority) }}
        </span>
        <span v-if="task.dueDate" class="text-sm text-cyber-muted/60 font-mono">
          {{ formatDate(task.dueDate) }}
        </span>
      </div>
      <div class="flex gap-1">
        <button
          @click.stop="$emit('edit', task)"
          class="text-sm px-1.5 py-0.5 font-mono text-cyber-accent border border-cyber-accent/50 hover:bg-cyber-accent/10 transition-colors duration-150"
        >{{ t('tasks.edit') }}</button>
        <button
          @click.stop="$emit('delete', task.id)"
          class="text-sm px-1.5 py-0.5 font-mono text-red-400 border border-red-400/50 hover:bg-red-400/10 transition-colors duration-150"
        >{{ t('tasks.menu.delete') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Task {
  id: number
  title: string
  description?: string | null
  status: string
  priority: number
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}

defineProps<{ task: Task }>()

const emit = defineEmits<{
  edit: [task: Task]
  delete: [id: number]
}>()

const { t } = useI18n()

function priorityLabel(p: number): string {
  if (p >= 2) return t('tasks.priority.high')
  if (p === 1) return t('tasks.priority.medium')
  return t('tasks.priority.low')
}

function cardBgClass(p: number): string {
  if (p >= 2) return 'bg-red-400/5 border-l-2 border-red-400'
  if (p === 1) return 'bg-cyber-orange/5 border-l-2 border-cyber-orange'
  return 'bg-cyber-dark border-l-2 border-transparent'
}

function priorityClass(p: number): string {
  if (p >= 2) return 'text-red-400 bg-red-400/20'
  if (p === 1) return 'text-cyber-orange bg-cyber-orange/20'
  return 'text-cyber-muted bg-cyber-muted/20'
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('vi-VN')
}
</script>
```

- [ ] **Step 2: Delete TaskCardMenu.vue**

Run: `rm frontend/src/components/TaskCardMenu.vue`

- [ ] **Step 3: Verify old file gone**

Run: `ls frontend/src/components/TaskCard*`
Expected: `TaskCard.vue` only (no TaskCardMenu.vue)

---

### Task 5: Update KanbanBoard.vue

**Files:**
- Modify: `frontend/src/components/KanbanBoard.vue`

- [ ] **Step 1: Add new props, emits, and responsive rendering**

Edit `frontend/src/components/KanbanBoard.vue`:

Replace the props definition (line 76-79):
```ts
const props = defineProps<{
  activeFilters: Set<number>
  mobileStatus?: string | null
  refreshKey?: number
}>()
```

Replace the emits definition (line 80-82):
```ts
const emit = defineEmits<{
  'ws-status': [connected: boolean]
  edit: [id: number]
  delete: [id: number]
}>()
```

Replace the template (lines 3-55) — conditionally render mobile single-column or desktop 4-column:

```vue
<template>
  <!-- Mobile: single column -->
  <div v-if="mobileStatus" class="flex-1 overflow-y-auto p-2 space-y-1.5">
    <div
      v-for="task in columnTasks[mobileStatus]"
      :key="task.id"
      v-show="shouldShow(task)"
    >
      <TaskCard
        :task="task"
        @edit="(id) => emit('edit', id)"
        @delete="(id) => emit('delete', id)"
      />
    </div>
  </div>

  <!-- Desktop: 4-column Kanban -->
  <div v-else class="flex flex-1 overflow-hidden">
    <div
      v-for="col in COLUMNS"
      :key="col.key"
      class="flex-1 flex flex-col min-w-0"
    >
      <div :class="['px-2 py-2 flex items-center gap-2 shrink-0', col.headerBgClass]">
        <span :class="['text-sm tracking-widest font-mono uppercase', col.headerClass]">
          {{ t(col.labelKey) }}
        </span>
        <span class="text-sm bg-cyber-accent/10 text-cyber-accent/50 px-1.5 rounded font-mono">
          {{ visibleCount(col.key) }}
        </span>
      </div>

      <VueDraggable
        v-model="columnTasks[col.key]"
        group="tasks"
        class="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 min-h-[40px]"
        @add="(e) => onAdd(e, col.key)"
      >
        <div
          v-for="task in columnTasks[col.key]"
          :key="task.id"
          v-show="shouldShow(task)"
        >
          <TaskCard
            :task="task"
            @edit="(id) => emit('edit', id)"
            @delete="(id) => emit('delete', id)"
          />
        </div>
      </VueDraggable>

      <div v-if="col.key === 'TODO'" class="px-2 pb-2 shrink-0">
        <button
          @click="$emit('add')"
           class="w-full text-sm font-mono text-cyber-muted bg-cyber-dark px-2 py-1.5 hover:text-cyber-accent transition-colors duration-150 text-left"
        >{{ t('tasks.add') }}</button>
      </div>
    </div>
  </div>
</template>
```

Remove the old `addingTask`, `newTaskTitle`, `onBlurNewTask`, `createTask` refs and functions (lines 99-106, lines 165-175).

Add a `watch` on `refreshKey` after the `shouldShow` function to re-fetch when triggered:

```ts
import { reactive, ref, onMounted, onUnmounted, watch } from 'vue'
// ... existing imports

watch(() => props.refreshKey, () => {
  fetchTasks()
})

async function fetchTasks() {
  try {
    const res = await fetch('/api/tasks')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    populateColumns(await res.json() as Task[])
  } catch {
    // board stays empty
  }
}
```

Replace the old onMounted fetch with a call to `fetchTasks()`:

```ts
onMounted(async () => {
  await fetchTasks()

  socket = io('/tasks')
  // ... rest unchanged
})
```

---

### Task 6: Update TasksView.vue

**Files:**
- Modify: `frontend/src/components/TasksView.vue`

- [ ] **Step 1: Rewrite TasksView.vue**

Overwrite `frontend/src/components/TasksView.vue`:

```vue
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <!-- Header with add button -->
    <div class="px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiClipboardList class="w-3 h-3 inline" /> {{ t('tasks.header') }}
      </span>
      <button
        @click="openAddModal"
        class="text-sm font-mono font-bold text-black bg-cyber-accent px-2 py-1 hover:bg-cyber-accent/80 transition-colors duration-150"
      >+ {{ t('tasks.add') }}</button>
    </div>

    <!-- Mobile status tabs -->
    <div class="flex sm:hidden border-b border-cyber-code-border">
      <button
        v-for="col in COLUMNS"
        :key="col.key"
        @click="mobileStatus = col.key"
        :class="[
          'flex-1 text-center py-2 text-sm font-mono transition-colors duration-150',
          mobileStatus === col.key ? col.tabActiveClass : col.tabInactiveClass,
        ]"
      >{{ t(col.labelKey) }}</button>
    </div>

    <!-- Desktop priority filter -->
    <div class="hidden sm:flex px-3 py-1.5 bg-cyber-dark/40 items-center gap-2 shrink-0">
      <span class="text-cyber-muted text-sm font-mono">{{ t('tasks.filter.label') }}</span>
      <button
        v-for="p in PRIORITY_FILTERS"
        :key="p.value"
        @click="toggleFilter(p.value)"
        :class="[
          'text-sm px-2 py-0.5 font-mono transition-colors duration-150',
          activeFilters.has(p.value) ? p.activeClass : p.inactiveClass,
        ]"
      >{{ t(p.labelKey) }}</button>
    </div>

    <KanbanBoard
      :active-filters="activeFilters"
      :mobile-status="isMobile ? mobileStatus : null"
      :refresh-key="refreshKey"
      class="flex-1 overflow-hidden"
      @ws-status="emit('ws-status', $event)"
      @edit="openEditModal"
      @delete="openDeleteConfirm"
    />

    <TaskFormModal
      v-model="showFormModal"
      :editing="editingTask"
      @saved="onTaskSaved"
    />

    <BaseConfirmModal
      v-model="showConfirmModal"
      :title="t('tasks.delete.confirm')"
      :message="t('tasks.delete.confirm')"
      @confirm="onDeleteConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiClipboardList } from 'vue-icons-plus/hi'
import KanbanBoard from './KanbanBoard.vue'
import TaskFormModal from './TaskFormModal.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'

interface Task {
  id: number
  title: string
  description?: string | null
  status: string
  priority: number
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}

const { t } = useI18n()
const activeFilters = reactive(new Set<number>())

const emit = defineEmits<{
  'ws-status': [connected: boolean]
}>()

const mobileQuery = window.matchMedia('(max-width: 767px)')
const isMobile = ref(mobileQuery.matches)
mobileQuery.addEventListener('change', (e) => { isMobile.value = e.matches })

const mobileStatus = ref('TODO')
const refreshKey = ref(0)

const showFormModal = ref(false)
const showConfirmModal = ref(false)
const editingTask = ref<Task | null>(null)
const deletingTaskId = ref<number | null>(null)

const COLUMNS = [
  { key: 'TODO',       labelKey: 'tasks.col.todo',       tabActiveClass: 'text-cyber-accent border-b-2 border-cyber-accent', tabInactiveClass: 'text-cyber-muted hover:text-cyber-accent' },
  { key: 'PROCESSING', labelKey: 'tasks.col.processing', tabActiveClass: 'text-cyber-orange border-b-2 border-cyber-orange', tabInactiveClass: 'text-cyber-muted hover:text-cyber-orange' },
  { key: 'DONE',       labelKey: 'tasks.col.done',       tabActiveClass: 'text-cyber-green border-b-2 border-cyber-green', tabInactiveClass: 'text-cyber-muted hover:text-cyber-green' },
  { key: 'FAILED',     labelKey: 'tasks.col.failed',     tabActiveClass: 'text-red-400 border-b-2 border-red-400',       tabInactiveClass: 'text-cyber-muted hover:text-red-400' },
]

const PRIORITY_FILTERS = [
  { value: 2, labelKey: 'tasks.priority.high', activeClass: 'text-red-400 bg-red-400/10', inactiveClass: 'text-red-400/40 hover:text-red-400' },
  { value: 1, labelKey: 'tasks.priority.medium', activeClass: 'text-cyber-orange bg-cyber-orange/10', inactiveClass: 'text-cyber-orange/40 hover:text-cyber-orange' },
  { value: 0, labelKey: 'tasks.priority.low', activeClass: 'text-cyber-muted bg-cyber-muted/10', inactiveClass: 'text-cyber-muted/40 hover:text-cyber-muted' },
]

function toggleFilter(priority: number) {
  if (activeFilters.has(priority)) activeFilters.delete(priority)
  else activeFilters.add(priority)
}

function openAddModal() {
  editingTask.value = null
  showFormModal.value = true
}

function openEditModal(task: Task) {
  editingTask.value = task
  showFormModal.value = true
}

function openDeleteConfirm(id: number) {
  deletingTaskId.value = id
  showConfirmModal.value = true
}

function onTaskSaved() {
  refreshKey.value++
}

async function onDeleteConfirmed() {
  if (deletingTaskId.value === null) return
  try {
    await fetch(`/api/tasks/${deletingTaskId.value}`, { method: 'DELETE' })
    refreshKey.value++
  } catch {
    // silently fail
  }
  deletingTaskId.value = null
}
</script>
```
<｜end▁of▁thinking｜>

<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="edit">
<｜｜DSML｜｜parameter name="filePath" string="true">C:\Users\doanp\Documents\GitHub\960513\docs\superpowers\plans\2026-06-08-tasksview-mobile-optimization.md