<template>
  <nav class="flex sm:hidden items-center bg-cyber-dark border-t border-cyber-code-border h-[3rem] shrink-0">
    <button
      v-for="item in navItems"
      :key="item.view"
      :title="t(item.labelKey)"
      @click="$emit('navigate', item.view)"
      :class="[
        'flex flex-col items-center justify-center gap-0.5 flex-1 h-full font-mono text-[0.5rem] transition-colors duration-150',
        activeView === item.view
          ? 'text-cyber-accent bg-cyber-accent/10'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <component :is="item.icon" class="w-[1.125rem] h-[1.125rem]" />
      <span>{{ t(item.labelKey) }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiChatAlt2, HiClipboardList, HiFolder, HiCog } from 'vue-icons-plus/hi'

defineProps<{ activeView: 'chat' | 'tasks' | 'files' | 'settings' }>()
defineEmits<{ navigate: [view: 'chat' | 'tasks' | 'files' | 'settings'] }>()

const { t } = useI18n()

interface NavItem {
  view: 'chat' | 'tasks' | 'files' | 'settings'
  labelKey: string
  icon: Component
}

const navItems: NavItem[] = [
  { view: 'chat',     labelKey: 'nav.chat',     icon: HiChatAlt2 },
  { view: 'tasks',    labelKey: 'nav.tasks',     icon: HiClipboardList },
  { view: 'files',    labelKey: 'nav.files',     icon: HiFolder },
  { view: 'settings', labelKey: 'nav.settings',  icon: HiCog },
]
</script>
