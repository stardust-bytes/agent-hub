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

    <BaseConfirmModal
      v-model="showConfirmModal"
      :title="t('notes.delete.confirm')"
      :message="t('notes.delete.confirm')"
      @confirm="onDeleteConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { io, Socket } from 'socket.io-client'
import NoteModal from './NoteModal.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'

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
const showConfirmModal = ref(false)
const deletingNoteId = ref<number | null>(null)
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
  deletingNoteId.value = id
  showConfirmModal.value = true
}

async function onDeleteConfirmed() {
  if (deletingNoteId.value === null) return
  try {
    await fetch(`/api/notes/${deletingNoteId.value}`, { method: 'DELETE' })
    await fetchNotes()
  } catch { /* ignore */ }
  deletingNoteId.value = null
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
