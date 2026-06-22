import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/connectors'
import { errorCode } from '../api/client'

export const useConnectorsStore = defineStore('connectors', () => {
  const connectors = ref<api.Connector[]>([])
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    try { connectors.value = await api.listConnectors() }
    catch (e) { error.value = errorCode(e) }
  }

  async function upsert(type: string, data: { name?: string; config?: Record<string, unknown>; enabled?: boolean }) {
    await api.upsertConnector(type, data)
    await load()
  }

  async function remove(id: string) { await api.deleteConnector(id); await load() }

  return { connectors, error, load, upsert, remove }
})
