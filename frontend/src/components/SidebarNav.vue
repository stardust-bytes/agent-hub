<template>
  <nav class="w-32 bg-cyber-dark hidden sm:flex flex-col items-stretch py-3 gap-1 shrink-0">
    <div class="flex items-center gap-2 px-3 py-1 mb-1">
      <HiTerminal class="text-cyber-accent w-5 h-5 shrink-0" />
      <span class="text-xs text-cyber-accent/50 truncate">workspace</span>
    </div>

    <button
      v-for="item in navItems"
      :key="item.view"
      @click="$emit('navigate', item.view)"
      :class="[
        'w-full px-3 py-2 rounded flex items-center gap-2 transition-colors duration-150',
        activeView === item.view
          ? 'bg-cyber-accent/10 text-cyber-accent'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <component :is="item.icon" class="w-4 h-4 shrink-0" />
      <span class="text-xs truncate">{{ t(item.labelKey) }}</span>
    </button>

    <div class="flex-1" />

    <button
      @click="$emit('navigate', 'settings')"
      class="w-full px-3 py-2 rounded flex items-center gap-2 text-cyber-muted hover:text-cyber-accent transition-colors duration-150"
    >
      <HiCog class="w-4 h-4 shrink-0" />
      <span class="text-xs truncate">{{ t('nav.settings') }}</span>
    </button>

    <button
      :title="locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'"
      @click="toggleLang"
      class="w-9 h-6 rounded flex items-center justify-center text-xs font-mono text-cyber-muted hover:text-cyber-accent transition-colors duration-150 self-center"
    >
      {{ t('nav.lang') }}
    </button>

    <div
      :title="healthStatus"
      :class="['w-2 h-2 rounded-full mt-1 transition-colors duration-500 self-center', isHealthy ? 'bg-cyber-green' : 'bg-red-500']"
    />
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Locale } from '../i18n'
import { HiTerminal, HiChatAlt2, HiClipboardList, HiFolder, HiCog } from 'vue-icons-plus/hi'

defineProps<{ activeView: 'chat' | 'tasks' | 'files' | 'settings' }>()
defineEmits<{ navigate: [view: 'chat' | 'tasks' | 'files' | 'settings'] }>()

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
