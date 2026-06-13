<template>
  <div class="flex flex-col bg-cyber-bg min-w-0 h-full">
    <div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-cyber-code-border shrink-0 bg-cyber-dark">
      <HiDocumentText class="w-3 h-3 text-cyber-accent" />
      <span class="text-sm text-cyber-accent font-mono">{{ t('notes.header') }}</span>
      <button @click="openAdd"
        class="ml-auto text-sm text-cyber-accent font-mono px-2 py-0.5 border border-cyber-accent/30 transition-colors duration-150 hover:bg-cyber-accent/10">
        {{ t('notes.add') }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="notes.length === 0" class="flex items-center justify-center h-full text-sm font-mono text-cyber-muted">{{ t('notes.empty') }}</div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
        <div v-for="note in notes" :key="note.id"
          class="border border-cyber-code-border bg-cyber-dark p-3 flex flex-col gap-2">
          <div class="text-sm font-mono text-cyber-text font-semibold truncate">{{ note.title }}</div>
          <div class="text-sm font-mono text-cyber-muted line-clamp-2">{{ note.content }}</div>
          <div class="text-sm font-mono text-cyber-muted/50">{{ new Date(note.updatedAt).toLocaleTimeString('vi-VN', { hour12: false }) }}</div>
          <div class="flex justify-end gap-1 mt-auto pt-1">
            <button @click="openEdit(note)" class="text-sm px-1.5 py-0.5 font-mono text-cyber-accent border border-cyber-accent/50 hover:bg-cyber-accent/10 transition-colors duration-150">{{ t('notes.edit') }}</button>
            <button @click="deleteNote(note.id)" class="text-sm px-1.5 py-0.5 font-mono text-red-400 border border-red-400/50 hover:bg-red-400/10 transition-colors duration-150">{{ t('notes.delete') }}</button>
          </div>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiDocumentText } from 'vue-icons-plus/hi'
import { io, Socket } from 'socket.io-client'
import NoteModal from './NoteModal.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'
import { useNotesStore } from '../stores/notes'

const { t } = useI18n()
const notesStore = useNotesStore()

interface Note {
  id: number
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

const notes = computed(() => notesStore.notes as Note[])
const showModal = ref(false)
const showConfirmModal = ref(false)
const deletingNoteId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const editTitle = ref('')
const editContent = ref('')
let socket: Socket | null = null

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
  try {
    if (editingId.value) {
      await notesStore.update(editingId.value, { title, content })
    } else {
      await notesStore.create({ title, content })
    }
  } catch { /* ignore */ }
}

async function deleteNote(id: number) {
  deletingNoteId.value = id
  showConfirmModal.value = true
}

async function onDeleteConfirmed() {
  if (deletingNoteId.value === null) return
  try {
    await notesStore.remove(deletingNoteId.value)
  } catch { /* ignore */ }
  deletingNoteId.value = null
}

onMounted(() => {
  notesStore.load()
  socket = io('/notes')
  socket.on('note:created', () => notesStore.load())
  socket.on('note:updated', () => notesStore.load())
  socket.on('note:deleted', () => notesStore.load())
})

onUnmounted(() => {
  socket?.disconnect()
})
</script>

