<template>
  <div class="h-[1.75rem] bg-white border-t border-gray-200 flex items-center justify-between px-3 shrink-0">
    <div class="flex items-center gap-3">
      <span class="text-xs flex items-center gap-1" :class="backendOnline ? 'text-green-600' : 'text-gray-400'">
        {{ backendOnline ? '●' : '○' }} {{ t('status.backend') }}
      </span>
      <span class="text-xs flex items-center gap-1" :class="dbConnected ? 'text-green-600' : 'text-gray-400'">
        [{{ dbConnected ? '✓' : '✗' }}] {{ t('status.db') }}
      </span>
      <span v-if="activeSubagents && activeSubagents > 0" class="text-xs text-blue-600 flex items-center gap-1">
        ● {{ activeSubagents }} {{ t('status.subagents') }}
      </span>
    </div>
    <div class="flex items-center gap-3">
      <button
        @click="toggleLang"
        class="text-xs text-gray-500 hover:text-blue-600 transition-colors duration-150"
      >{{ t('nav.lang') }}</button>
      <span class="text-xs font-mono text-gray-500">{{ time }}</span>
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
