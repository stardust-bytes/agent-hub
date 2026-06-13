import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getHealth } from '../api/health'

export const useUiStore = defineStore('ui', () => {
  const dbConnected = ref(true)
  const wsConnected = ref(false)
  const activeSubagents = ref(0)
  const sidebarOpen = ref(false)

  async function refreshHealth() {
    try {
      const h = await getHealth()
      dbConnected.value = h.db === 'connected'
    } catch {
      dbConnected.value = false
    }
  }

  return { dbConnected, wsConnected, activeSubagents, sidebarOpen, refreshHealth }
})
