<template>
  <nav class="w-[52px] bg-cyber-dark border-r border-cyber-border flex flex-col items-center py-3 gap-2 shrink-0">
    <HiTerminal class="text-cyber-accent w-5 h-5 mb-2" style="text-shadow: 0 0 8px #3B82F6" />

    <button
      v-for="item in navItems"
      :key="item.view"
      :title="t(item.labelKey)"
      @click="$emit('navigate', item.view)"
      :class="[
        'w-9 h-9 rounded flex items-center justify-center text-base transition-colors duration-150',
        activeView === item.view
          ? 'bg-cyber-accent/10 border border-cyber-dim text-cyber-accent'
          : 'border border-transparent text-cyber-accent/40 hover:text-cyber-accent/70'
      ]"
    >
      <component :is="item.icon" class="w-4 h-4" />
    </button>

    <div class="flex-1" />

    <button
      :title="t('nav.settings')"
      class="w-9 h-9 rounded flex items-center justify-center text-base border border-transparent text-cyber-accent/40 hover:text-cyber-accent/70"
    >
      <HiCog class="w-4 h-4" />
    </button>

    <button
      :title="locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'"
      @click="toggleLang"
      class="w-9 h-6 rounded flex items-center justify-center text-xs font-mono border border-cyber-dim text-cyber-accent hover:bg-cyber-accent/10 transition-colors duration-150"
    >
      {{ t('nav.lang') }}
    </button>

    <div
      :title="healthStatus"
      :class="['w-2 h-2 rounded-full mt-1 transition-colors duration-500', isHealthy ? 'bg-cyber-green' : 'bg-red-500']"
      :style="isHealthy ? 'box-shadow: 0 0 6px #22C55E' : ''"
    />
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Locale } from '../i18n'
import { HiTerminal, HiChatAlt2, HiClipboardList, HiFolder, HiCog } from 'vue-icons-plus/hi'

defineProps<{ activeView: 'chat' | 'tasks' | 'files' }>()
defineEmits<{ navigate: [view: 'chat' | 'tasks' | 'files'] }>()

const { t, locale } = useI18n()

interface NavItem {
  view: 'chat' | 'tasks' | 'files'
  labelKey: string
  icon: Component
}

const navItems: NavItem[] = [
  { view: 'chat',  labelKey: 'nav.chat',  icon: HiChatAlt2 },
  { view: 'tasks', labelKey: 'nav.tasks', icon: HiClipboardList },
  { view: 'files', labelKey: 'nav.files', icon: HiFolder },
]

const isHealthy = ref(false)
const healthStatus = ref(t('health.checking'))

function toggleLang() {
  const next: Locale = locale.value === 'vi' ? 'en' : 'vi'
  locale.value = next
  localStorage.setItem('workspace.lang', next)
}

onMounted(async () => {
  try {
    const res = await fetch('/api/health')
    const data = await res.json()
    isHealthy.value = data.status === 'ok'
    healthStatus.value = t('health.ok')
  } catch {
    healthStatus.value = t('health.error')
  }
})
</script>
