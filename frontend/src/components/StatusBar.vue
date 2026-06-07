<!-- frontend/src/components/StatusBar.vue -->
<template>
  <div class="h-7 bg-[#161616] flex items-center justify-between px-3 shrink-0">
    <div class="flex items-center gap-3">
      <span class="text-[10px] font-mono text-[#888888]">
        <span class="text-cyber-blue">{{ modelName }}</span>
      </span>
      <span class="text-[10px] font-mono" :class="dbConnected ? 'text-cyber-green' : 'text-[#888888]'">
        [{{ dbConnected ? '✓' : '✗' }}] {{ t('status.db') }}
      </span>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-[10px] font-mono" :class="wsConnected ? 'text-cyber-green' : 'text-[#888888]'">
        {{ wsConnected ? '●' : '○' }} {{ wsConnected ? t('tasks.ws.connected') : t('tasks.ws.disconnected') }}
      </span>
      <span class="text-[10px] font-mono text-[#888888]">{{ time }}</span>
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
