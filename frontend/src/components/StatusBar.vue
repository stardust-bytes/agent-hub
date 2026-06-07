<!-- frontend/src/components/StatusBar.vue -->
<template>
  <div class="h-[1.75rem] bg-cyber-status flex items-center justify-between px-3 shrink-0">
    <div class="flex items-center gap-3">
      <span class="text-[0.625rem] font-mono text-cyber-muted">
        <span class="text-cyber-blue">{{ modelName }}</span>
      </span>
      <span class="text-[0.625rem] font-mono" :class="dbConnected ? 'text-cyber-green' : 'text-cyber-muted'">
        [{{ dbConnected ? '✓' : '✗' }}] {{ t('status.db') }}
      </span>
      <span class="text-[0.625rem] font-mono text-cyber-accent/50">
        {{ ollamaOnline ? 'ollama' : 'stub' }}
      </span>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-[0.625rem] font-mono" :class="wsConnected ? 'text-cyber-green' : 'text-cyber-muted'">
        {{ wsConnected ? '●' : '○' }} {{ wsConnected ? t('tasks.ws.connected') : t('tasks.ws.disconnected') }}
      </span>
      <span class="text-[0.625rem] font-mono text-cyber-muted">{{ time }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  modelName?: string
  dbConnected?: boolean
  wsConnected?: boolean
  ollamaOnline?: boolean
}>()

const time = ref(new Date().toLocaleTimeString('vi-VN', { hour12: false }))
let timer: ReturnType<typeof setInterval>

onMounted(() => {
  timer = setInterval(() => {
    time.value = new Date().toLocaleTimeString('vi-VN', { hour12: false })
  }, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>
