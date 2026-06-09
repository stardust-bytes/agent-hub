<template>
  <div class="flex-1 flex min-h-0 bg-cyber-bg">
    <div class="w-80 shrink-0 border-r border-cyber-code-border overflow-y-auto p-3 space-y-2">
      <div class="flex items-center justify-between mb-3">
        <div class="text-sm font-mono text-cyber-accent font-bold">{{ t('notes.header') }} ({{ notes.length }})</div>
        <button @click="startNew" class="text-sm font-mono text-cyber-accent/70 hover:text-cyber-accent transition-colors duration-150">{{ t('notes.add') }}</button>
      </div>
      <div v-if="notes.length === 0" class="text-sm font-mono text-cyber-muted text-center py-8">{{ t('notes.empty') }}</div>
      <div
        v-for="note in notes"
        :key="note.id"
        class="flex items-start gap-1"
      >
        <button
          @click="selectNote(note)"
          :class="['flex-1 text-left px-3 py-2 rounded transition-colors duration-150', selectedId === note.id ? 'bg-cyber-accent/10 border border-cyber-accent/30' : 'bg-cyber-dark hover:bg-cyber-dark/80 border border-transparent']"
        >
          <div class="text-sm font-mono text-cyber-text font-semibold truncate">{{ note.title }}</div>
          <div class="text-xs font-mono text-cyber-muted mt-0.5 truncate">{{ note.content }}</div>
          <div class="text-xs font-mono text-cyber-muted/50 mt-0.5">{{ new Date(note.updatedAt).toLocaleTimeString('vi-VN', { hour12: false }) }}</div>
        </button>
        <button @click="deleteNote(note.id)" class="text-xs font-mono text-cyber-muted/50 hover:text-red-400 px-1 py-2 shrink-0 transition-colors duration-150">{{ t('notes.delete') }}</button>
      </div>
    </div>

    <div class="flex-1 flex flex-col p-3 min-w-0">
      <div v-if="!editing" class="flex-1 flex items-center justify-center text-sm font-mono text-cyber-muted">{{ t('notes.empty') }}</div>
      <template v-else>
        <input
          v-model="editTitle"
          class="w-full bg-transparent text-cyber-text text-lg font-mono font-semibold outline-none mb-3 placeholder-cyber-muted/40"
          :placeholder="t('notes.form.title')"
        />
        <textarea
          v-model="editContent"
          class="flex-1 w-full bg-cyber-dark text-cyber-text text-sm font-mono outline-none p-3 resize-none placeholder-cyber-muted/40"
          :placeholder="t('notes.form.content')"
        />
        <div class="flex items-center gap-2 mt-3">
          <button @click="saveNote" class="text-sm font-mono text-cyber-accent px-3 py-1 rounded border border-cyber-accent/30 hover:bg-cyber-accent/10 transition-colors duration-150">{{ t('notes.form.save') }}</button>
          <button @click="cancelEdit" class="text-sm font-mono text-cyber-muted px-3 py-1 rounded hover:text-cyber-text transition-colors duration-150">{{ t('notes.form.cancel') }}</button>
          <button v-if="selectedId" @click="deleteCurrentNote" class="text-sm font-mono text-red-400 px-3 py-1 rounded hover:bg-red-400/10 transition-colors duration-150 ml-auto">{{ t('notes.delete') }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { io, Socket } from 'socket.io-client'

const { t } = useI18n()

interface Note {
  id: number
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

const notes = ref<Note[]>([])
const selectedId = ref<number | null>(null)
const editTitle = ref('')
const editContent = ref('')
const editing = ref(false)
let socket: Socket | null = null

async function fetchNotes() {
  try {
    const res = await fetch('/api/notes')
    if (res.ok) notes.value = await res.json()
  } catch { /* ignore */ }
}

function selectNote(note: Note) {
  selectedId.value = note.id
  editTitle.value = note.title
  editContent.value = note.content
  editing.value = true
}

function startNew() {
  selectedId.value = null
  editTitle.value = ''
  editContent.value = ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  selectedId.value = null
  editTitle.value = ''
  editContent.value = ''
}

async function saveNote() {
  if (!editTitle.value.trim()) return
  const body = { title: editTitle.value.trim(), content: editContent.value.trim() }
  try {
    if (selectedId.value) {
      await fetch(`/api/notes/${selectedId.value}`, {
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
    cancelEdit()
  } catch { /* ignore */ }
}

async function deleteNote(id: number) {
  if (!confirm(t('notes.delete.confirm'))) return
  try {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (selectedId.value === id) cancelEdit()
    await fetchNotes()
  } catch { /* ignore */ }
}

async function deleteCurrentNote() {
  if (!selectedId.value) return
  await deleteNote(selectedId.value)
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
