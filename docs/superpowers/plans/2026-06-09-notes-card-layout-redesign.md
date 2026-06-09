# Notes Card Layout Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign NotesView from split-panel to responsive card grid with modal-based editing.

**Architecture:** Rewrite NotesView to use `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for cards. New NoteModal component wrapping BaseModal for add/edit forms.

**Tech Stack:** Vue 3, TailwindCSS, BaseModal

---

### Task 1: Add i18n keys for edit button + modal title

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add to vi.json**

After `notes.delete.confirm`:
```json
  "notes.edit": "Sửa",
```

- [ ] **Step 2: Add to en.json**

After `notes.delete.confirm`:
```json
  "notes.edit": "Edit",
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npx vue-tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add notes.edit i18n key"
```

---

### Task 2: Create NoteModal component

**Files:**
- Create: `frontend/src/components/NoteModal.vue`

- [ ] **Step 1: Create NoteModal.vue**

```vue
<template>
  <BaseModal
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    closable
    max-height="90vh"
  >
    <template #header>
      <span class="text-sm font-mono text-cyber-accent">{{ editingId ? t('notes.edit') : t('notes.add') }}</span>
    </template>
    <div class="p-3 flex flex-col gap-3" style="min-height:50vh;max-width:70rem;width:70rem;max-width:90vw">
      <input
        v-model="title"
        class="w-full bg-cyber-dark text-cyber-text text-lg font-mono font-semibold outline-none px-3 py-2 placeholder-cyber-muted/40"
        :placeholder="t('notes.form.title')"
      />
      <textarea
        v-model="content"
        class="flex-1 w-full bg-cyber-dark text-cyber-text text-sm font-mono outline-none p-3 resize-none placeholder-cyber-muted/40"
        style="min-height:30vh"
        :placeholder="t('notes.form.content')"
      />
    </div>
    <template #footer>
      <div class="flex items-center gap-2 px-3 py-2">
        <button
          @click="save"
          class="text-sm font-mono text-cyber-accent px-3 py-1 rounded border border-cyber-accent/30 hover:bg-cyber-accent/10 transition-colors duration-150"
        >{{ t('notes.form.save') }}</button>
        <button
          @click="cancel"
          class="text-sm font-mono text-cyber-muted px-3 py-1 rounded hover:text-cyber-text transition-colors duration-150"
        >{{ t('notes.form.cancel') }}</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  editingId: number | null
  initialTitle?: string
  initialContent?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [title: string, content: string]
}>()

const title = ref('')
const content = ref('')

watch(() => props.modelValue, (val) => {
  if (val) {
    title.value = props.initialTitle ?? ''
    content.value = props.initialContent ?? ''
  }
})

function save() {
  if (!title.value.trim()) return
  emit('save', title.value.trim(), content.value.trim())
  emit('update:modelValue', false)
}

function cancel() {
  emit('update:modelValue', false)
}
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npx vue-tsc --noEmit && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NoteModal.vue
git commit -m "feat: add NoteModal component for add/edit notes"
```

---

### Task 3: Rewrite NotesView to card grid + modal

**Files:**
- Modify: `frontend/src/components/NotesView.vue` (full rewrite)

- [ ] **Step 1: Replace NotesView.vue entirely**

Current file (146 lines) → replace with:

```vue
<template>
  <div class="flex-1 flex flex-col min-h-0 bg-cyber-bg p-3">
    <div class="flex items-center justify-between mb-3">
      <div class="text-sm font-mono text-cyber-accent font-bold">{{ t('notes.header') }} ({{ notes.length }})</div>
      <button @click="openAdd" class="text-sm font-mono text-cyber-accent/70 hover:text-cyber-accent transition-colors duration-150">{{ t('notes.add') }}</button>
    </div>

    <div v-if="notes.length === 0" class="flex-1 flex items-center justify-center text-sm font-mono text-cyber-muted">{{ t('notes.empty') }}</div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto">
      <div
        v-for="note in notes"
        :key="note.id"
        class="bg-cyber-dark rounded p-3 flex flex-col gap-2"
      >
        <div class="text-sm font-mono text-cyber-text font-semibold truncate">{{ note.title }}</div>
        <div class="text-xs font-mono text-cyber-muted line-clamp-2">{{ note.content }}</div>
        <div class="text-xs font-mono text-cyber-muted/50">{{ new Date(note.updatedAt).toLocaleTimeString('vi-VN', { hour12: false }) }}</div>
        <div class="flex items-center gap-3 mt-auto pt-1">
          <button @click="openEdit(note)" class="text-xs font-mono text-cyber-accent/70 hover:text-cyber-accent transition-colors duration-150">{{ t('notes.edit') }}</button>
          <button @click="deleteNote(note.id)" class="text-xs font-mono text-cyber-muted/50 hover:text-red-400 transition-colors duration-150">{{ t('notes.delete') }}</button>
        </div>
      </div>
    </div>

    <NoteModal
      v-model="showModal"
      :editing-id="editingId"
      :initial-title="editTitle"
      :initial-content="editContent"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { io, Socket } from 'socket.io-client'
import NoteModal from './NoteModal.vue'

const { t } = useI18n()

interface Note {
  id: number
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

const notes = ref<Note[]>([])
const showModal = ref(false)
const editingId = ref<number | null>(null)
const editTitle = ref('')
const editContent = ref('')
let socket: Socket | null = null

async function fetchNotes() {
  try {
    const res = await fetch('/api/notes')
    if (res.ok) notes.value = await res.json()
  } catch { /* ignore */ }
}

function openAdd() {
  editingId.value = null
  editTitle.value = ''
  editContent.value = ''
  showModal.value = true
}

function openEdit(note: Note) {
  editingId.value = note.id
  editTitle.value = note.title
  editContent.value = note.content
  showModal.value = true
}

async function handleSave(title: string, content: string) {
  const body = { title, content }
  try {
    if (editingId.value) {
      await fetch(`/api/notes/${editingId.value}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    await fetchNotes()
  } catch { /* ignore */ }
}

async function deleteNote(id: number) {
  if (!confirm(t('notes.delete.confirm'))) return
  try {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    await fetchNotes()
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchNotes()
  socket = io('/notes')
  socket.on('note:created', () => fetchNotes())
  socket.on('note:updated', () => fetchNotes())
  socket.on('note:deleted', () => fetchNotes())
})

onUnmounted(() => {
  socket?.disconnect()
})
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npx vue-tsc --noEmit && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NotesView.vue
git commit -m "feat: redesign NotesView with card grid and modal editing"
```
