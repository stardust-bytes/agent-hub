<template>
  <div class="flex-1 overflow-y-auto px-4 py-4 bg-cyber-bg">
    <div class="max-w-xl">
      <div v-for="connector in connectors" :key="connector.id" class="flex items-center justify-between px-3 h-[3rem] border border-cyber-code-border mb-2 bg-cyber-dark">
        <div class="flex items-center gap-3 min-w-0">
          <span class="text-lg shrink-0">{{ connector.icon }}</span>
          <span class="text-sm text-cyber-text font-mono truncate">{{ connector.name }}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span v-if="connector.connected" class="text-xs text-cyber-green font-mono">Connected</span>
          <span v-else class="text-xs text-cyber-muted font-mono">Disconnected</span>
          <button @click="toggleConnector(connector.id)" :class="connector.connected ? 'text-red-400/40 hover:text-red-400' : 'text-cyber-accent/40 hover:text-cyber-accent'" class="text-sm font-mono transition-colors duration-150 px-2 py-0.5 border border-cyber-code-border">{{ connector.connected ? 'Disconnect' : 'Connect' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Connector {
  id: string
  name: string
  icon: string
  connected: boolean
}

const connectors = ref<Connector[]>([
  { id: 'google', name: 'Google (Gmail, Calendar, Drive)', icon: '🔴', connected: false },
  { id: 'slack', name: 'Slack', icon: '💬', connected: false },
  { id: 'jira', name: 'Jira / Linear', icon: '🎯', connected: false },
  { id: 'github', name: 'GitHub / GitLab', icon: '🐙', connected: false },
  { id: 'notion', name: 'Notion', icon: '📝', connected: false },
  { id: 'confluence', name: 'Confluence', icon: '📄', connected: false },
])

async function toggleConnector(id: string) {
  const c = connectors.value.find(c => c.id === id)
  if (!c) return
  if (id === 'google') {
    try {
      const res = await fetch('/api/oauth/auth-url')
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
    } catch {}
  }
}
</script>
