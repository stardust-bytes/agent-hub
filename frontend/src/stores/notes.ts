import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/notes'
import { errorCode } from '../api/client'

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<api.Note[]>([])
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    try { notes.value = await api.listNotes() }
    catch (e) { error.value = errorCode(e) }
  }

  async function create(body: { title: string; content: string }) { await api.createNote(body); await load() }
  async function update(id: number, body: { title: string; content: string }) { await api.updateNote(id, body); await load() }
  async function remove(id: number) { await api.deleteNote(id); await load() }

  return { notes, error, load, create, update, remove }
})
