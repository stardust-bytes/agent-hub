<template>
  <nav class="flex md:hidden items-center bg-cyber-dark border-t border-cyber-code-border h-[3rem] shrink-0">
    <button
      v-for="item in navItems"
      :key="item.view"
      :title="t(item.labelKey)"
      @click="$emit('navigate', item.view)"
      :class="[
        'flex flex-col items-center justify-center gap-0.5 flex-1 h-full font-mono text-sm transition-colors duration-150',
        activeView === item.view
          ? 'text-cyber-accent bg-cyber-accent/10'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <span v-if="typeof item.icon === 'string'" class="w-[1.125rem] h-[1.125rem] flex items-center justify-center">{{ item.icon }}</span>
      <component v-else :is="item.icon" class="w-[1.125rem] h-[1.125rem]" />
      <span>{{ t(item.labelKey) }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiChatAlt2, HiClipboardList, HiFolder, HiCog, HiLightningBolt, HiDocumentText, HiCode } from 'vue-icons-plus/hi'

defineProps<{ activeView: 'chat' | 'cowork' | 'tasks' | 'files' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' }>()
defineEmits<{ navigate: [view: 'chat' | 'cowork' | 'tasks' | 'files' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans'] }>()

const { t } = useI18n()

interface NavItem {
  view: 'chat' | 'cowork' | 'tasks' | 'files' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans'
  labelKey: string
  icon: Component | string
}

const navItems: NavItem[] = [
  { view: 'chat',      labelKey: 'nav.chat',      icon: HiChatAlt2 },
  { view: 'cowork',    labelKey: 'nav.cowork',    icon: HiCode },
  { view: 'tasks',     labelKey: 'nav.tasks',     icon: HiClipboardList },
  { view: 'files',     labelKey: 'nav.files',     icon: HiFolder },
  { view: 'plans',     labelKey: 'nav.plans',     icon: '📋' },
  { view: 'tools',     labelKey: 'nav.tools',     icon: HiLightningBolt },
  { view: 'providers', labelKey: 'nav.providers', icon: HiCog },
  { view: 'notes',     labelKey: 'nav.notes',     icon: HiDocumentText },
  { view: 'settings',  labelKey: 'nav.settings',  icon: HiCog },
]
</script>
