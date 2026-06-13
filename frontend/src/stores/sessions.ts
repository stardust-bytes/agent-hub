import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/sessions'
import type { SessionSummary } from '../api/types'
import { errorCode } from '../api/client'

export const useSessionsStore = defineStore('sessions', () => {
  const sessions = ref<SessionSummary[]>([])
  const error = ref<string | null>(null)

  async function load(mode?: string) {
    error.value = null
    try { sessions.value = await api.listSessions(mode) }
    catch (e) { error.value = errorCode(e) }
  }

  async function create(mode: string) {
    return (await api.createSession(mode)).id
  }

  async function remove(id: number) {
    await api.deleteSession(id)
    sessions.value = sessions.value.filter(s => s.id !== id)
  }

  return { sessions, error, load, create, remove }
})
