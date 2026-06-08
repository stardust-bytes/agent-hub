<template>
  <nav class="w-32 bg-cyber-dark hidden sm:flex flex-col items-stretch py-3 gap-1 shrink-0">
    <div class="flex items-center justify-center gap-2 px-3 py-1 mb-1">
      <span class="text-xs text-cyber-accent font-bold truncate">960513-wp</span>
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
      :class="[
        'w-full px-3 py-2 rounded flex items-center gap-2 transition-colors duration-150',
        activeView === 'settings'
          ? 'bg-cyber-accent/10 text-cyber-accent'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <HiCog class="w-4 h-4 shrink-0" />
      <span class="text-xs truncate">{{ t('nav.settings') }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiChatAlt2, HiClipboardList, HiFolder, HiCog } from 'vue-icons-plus/hi'

defineProps<{ activeView: 'chat' | 'tasks' | 'files' | 'settings' | 'providers' }>()
defineEmits<{ navigate: [view: 'chat' | 'tasks' | 'files' | 'settings' | 'providers'] }>()

const { t } = useI18n()

interface NavItem {
  view: 'chat' | 'tasks' | 'files' | 'providers'
  labelKey: string
  icon: Component
}

const navItems: NavItem[] = [
  { view: 'chat',      labelKey: 'nav.chat',      icon: HiChatAlt2 },
  { view: 'tasks',     labelKey: 'nav.tasks',     icon: HiClipboardList },
  { view: 'files',     labelKey: 'nav.files',     icon: HiFolder },
  { view: 'providers', labelKey: 'nav.providers', icon: HiCog },
]
</script>
