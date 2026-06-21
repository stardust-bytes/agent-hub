<template>
  <div class="flex h-[1.75rem] shrink-0 items-center justify-between border-t border-border bg-surface px-3">
    <div class="flex items-center gap-3">
      <span class="flex items-center gap-1 text-xs" :class="backendOnline ? 'text-success' : 'text-muted-foreground'">
        {{ backendOnline ? '●' : '○' }} {{ t('status.backend') }}
      </span>
      <span class="flex items-center gap-1 text-xs" :class="dbConnected ? 'text-success' : 'text-muted-foreground'">
        [{{ dbConnected ? '✓' : '✗' }}] {{ t('status.db') }}
      </span>
      <span v-if="activeSubagents && activeSubagents > 0" class="flex items-center gap-1 text-xs text-primary">
        ● {{ activeSubagents }} {{ t('status.subagents') }}
      </span>
    </div>
    <span class="font-mono text-xs text-muted-foreground">{{ time }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getHealth } from '../api/health'

const { t } = useI18n()

defineProps<{
  dbConnected?: boolean
  activeSubagents?: number
}>()

const backendOnline = ref(false)
const time = ref(new Date().toLocaleTimeString('vi-VN', { hour12: false }))
let timer: ReturnType<typeof setInterval>
let healthTimer: ReturnType<typeof setInterval>

onMounted(() => {
  timer = setInterval(() => {
    time.value = new Date().toLocaleTimeString('vi-VN', { hour12: false })
  }, 1000)
  const checkHealth = async () => {
    try {
      await getHealth()
      backendOnline.value = true
    } catch {
      backendOnline.value = false
    }
  }
  checkHealth()
  healthTimer = setInterval(checkHealth, 15000)
})

onUnmounted(() => {
  clearInterval(timer)
  clearInterval(healthTimer)
})
</script>
