<template>
  <nav class="w-[52px] bg-cyber-dark border-r border-cyber-border flex flex-col items-center py-3 gap-2 shrink-0">
    <div class="text-cyber-accent text-lg mb-2 font-mono" style="text-shadow: 0 0 8px #00d4ff">◈</div>

    <button
      v-for="item in navItems"
      :key="item.view"
      :title="item.label"
      @click="$emit('navigate', item.view)"
      :class="[
        'w-9 h-9 rounded flex items-center justify-center text-base transition-colors duration-150',
        activeView === item.view
          ? 'bg-cyber-accent/10 border border-cyber-dim text-cyber-accent'
          : 'border border-transparent text-cyber-accent/40 hover:text-cyber-accent/70'
      ]"
    >
      {{ item.icon }}
    </button>

    <div class="flex-1" />

    <button
      title="Settings"
      class="w-9 h-9 rounded flex items-center justify-center text-base border border-transparent text-cyber-accent/40 hover:text-cyber-accent/70"
    >
      ⚙️
    </button>

    <div
      :title="healthStatus"
      :class="['w-2 h-2 rounded-full mt-1 transition-colors duration-500', isHealthy ? 'bg-cyber-accent' : 'bg-red-500']"
      :style="isHealthy ? 'box-shadow: 0 0 6px #00d4ff' : ''"
    />
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

defineProps<{ activeView: string }>()
defineEmits<{ navigate: [view: string] }>()

const navItems = [
  { view: 'chat',  label: 'Chat',  icon: '💬' },
  { view: 'tasks', label: 'Tasks', icon: '📋' },
  { view: 'files', label: 'Files', icon: '📁' },
]

const isHealthy = ref(false)
const healthStatus = ref('Checking backend...')

onMounted(async () => {
  try {
    const res = await fetch('/api/health')
    const data = await res.json()
    isHealthy.value = data.status === 'ok'
    healthStatus.value = `Backend: ${data.status} · DB: ${data.db}`
  } catch {
    healthStatus.value = 'Backend unreachable'
  }
})
</script>
