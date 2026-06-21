import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getHealth } from '../api/health'

type Theme = 'light' | 'dark'

export const useUiStore = defineStore('ui', () => {
  const dbConnected = ref(true)
  const activeSubagents = ref(0)
  const sidebarOpen = ref(false)
  const theme = ref<Theme>('light')

  function applyTheme(value: Theme) {
    theme.value = value
    document.documentElement.classList.toggle('dark', value === 'dark')
    localStorage.setItem('workspace.theme', value)
  }

  function toggleTheme() {
    applyTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function initTheme() {
    const stored = localStorage.getItem('workspace.theme') as Theme | null
    const prefersDark = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    applyTheme(stored ?? (prefersDark ? 'dark' : 'light'))
  }

  async function refreshHealth() {
    try {
      const h = await getHealth()
      dbConnected.value = h.db === 'connected'
    } catch {
      dbConnected.value = false
    }
  }

  return { dbConnected, activeSubagents, sidebarOpen, theme, toggleTheme, initTheme, refreshHealth }
})
