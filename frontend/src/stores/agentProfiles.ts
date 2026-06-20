import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/agentProfiles'
import { errorCode } from '../api/client'

export const useAgentProfilesStore = defineStore('agentProfiles', () => {
  const profiles = ref<api.AgentProfile[]>([])
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    try { profiles.value = await api.listAgentProfiles() }
    catch (e) { error.value = errorCode(e) }
  }
  async function create(body: Parameters<typeof api.createAgentProfile>[0]) { await api.createAgentProfile(body); await load() }
  async function update(id: number, body: Parameters<typeof api.updateAgentProfile>[1]) { await api.updateAgentProfile(id, body); await load() }
  async function remove(id: number) { await api.deleteAgentProfile(id); await load() }

  return { profiles, error, load, create, update, remove }
})
