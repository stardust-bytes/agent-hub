<template>
  <div class="h-[1.75rem] bg-cyber-status flex items-center justify-between px-3 shrink-0">
    <div class="flex items-center gap-3">
      <span class="text-sm font-mono" :class="backendOnline ? 'text-cyber-green' : 'text-cyber-muted'">
        {{ backendOnline ? '●' : '○' }} {{ t('status.backend') }}
      </span>
      <span class="text-sm font-mono" :class="dbConnected ? 'text-cyber-green' : 'text-cyber-muted'">
        [{{ dbConnected ? '✓' : '✗' }}] {{ t('status.db') }}
      </span>
      <span v-if="activeSubagents && activeSubagents > 0" class="text-sm font-mono text-cyber-cyan">
        ● {{ activeSubagents }} {{ t('status.subagents') }}
      </span>
    </div>
    <div class="flex items-center gap-3">
      <button
        @click="toggleLang"
        class="text-sm font-mono text-cyber-muted hover:text-cyber-accent transition-colors duration-150"
      >{{ t('nav.lang') }}</button>
      <span class="text-sm font-mono text-cyber-muted">{{ time }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Locale } from '../i18n'
import { getHealth } from '../api/health'

const { t, locale } = useI18n()

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

function toggleLang() {
  const next: Locale = locale.value === 'vi' ? 'en' : 'vi'
  locale.value = next
  localStorage.setItem('workspace.lang', next)
}

onUnmounted(() => {
  clearInterval(timer)
  clearInterval(healthTimer)
})
</script>
