import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/memories'
import { errorCode } from '../api/client'

export const useMemoriesStore = defineStore('memories', () => {
  const memories = ref<api.Memory[]>([])
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    try { memories.value = await api.listMemories() }
    catch (e) { error.value = errorCode(e) }
  }

  async function create(body: { type: string; title: string; content: string }) { await api.createMemory(body); await load() }
  async function update(id: string, body: { type: string; title: string; content: string }) { await api.updateMemory(id, body); await load() }
  async function remove(id: string) { await api.deleteMemory(id); await load() }

  return { memories, error, load, create, update, remove }
})
