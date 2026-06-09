<template>
  <nav class="w-60 bg-cyber-dark hidden md:flex flex-col items-stretch py-3 gap-1 shrink-0">
    <div class="flex items-center justify-center gap-2 px-3 py-1 mb-1">
      <img src="/logo.png" class="w-6 h-6 shrink-0" alt="171305" />
      <span class="text-sm text-cyber-accent font-bold font-mono truncate">171305</span>
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
      <span class="text-sm font-mono truncate">{{ t(item.labelKey) }}</span>
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
      <span class="text-sm font-mono truncate">{{ t('nav.settings') }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiChatAlt2, HiClipboardList, HiFolder, HiCog, HiLightningBolt, HiDocumentText } from 'vue-icons-plus/hi'

defineProps<{ activeView: 'chat' | 'tasks' | 'files' | 'settings' | 'providers' | 'tools' | 'notes' }>()
defineEmits<{ navigate: [view: 'chat' | 'tasks' | 'files' | 'settings' | 'providers' | 'tools' | 'notes'] }>()

const { t } = useI18n()

interface NavItem {
  view: 'chat' | 'tasks' | 'files' | 'providers' | 'tools' | 'notes'
  labelKey: string
  icon: Component
}

const navItems: NavItem[] = [
  { view: 'chat',      labelKey: 'nav.chat',      icon: HiChatAlt2 },
  { view: 'tasks',     labelKey: 'nav.tasks',     icon: HiClipboardList },
  { view: 'notes', labelKey: 'nav.notes', icon: HiDocumentText },
  { view: 'files',     labelKey: 'nav.files',     icon: HiFolder },
  { view: 'tools',     labelKey: 'nav.tools',     icon: HiLightningBolt },
  { view: 'providers', labelKey: 'nav.providers', icon: HiCog },
]
</script>
