<template>
  <nav class="w-60 bg-cyber-dark flex flex-col items-stretch py-3 gap-1 shrink-0">
    <div class="flex items-center justify-center px-3 py-1 mb-1">
      <span class="font-['Press_Start_2P'] text-xl text-cyber-accent">Agent Hub</span>
    </div>

    <RouterLink
      v-for="item in sidebarItems"
      :key="item.name"
      :to="item.path"
      :class="[
        'w-full px-3 py-2 rounded flex items-center gap-2 transition-colors duration-150',
        route.name === item.name
          ? 'bg-cyber-accent/10 text-cyber-accent'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <span v-if="typeof item.icon === 'string'" class="w-4 h-4 shrink-0 flex items-center justify-center text-sm">{{ item.icon }}</span>
      <component v-else :is="item.icon" class="w-4 h-4 shrink-0" />
      <span class="text-sm font-mono truncate">{{ t(item.labelKey) }}</span>
    </RouterLink>

    <div class="flex-1" />

    <RouterLink
      :to="settingsNav.path"
      :class="[
        'w-full px-3 py-2 rounded flex items-center gap-2 transition-colors duration-150',
        route.name === 'settings'
          ? 'bg-cyber-accent/10 text-cyber-accent'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <HiCog class="w-4 h-4 shrink-0" />
      <span class="text-sm font-mono truncate">{{ t('nav.settings') }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { HiCog } from 'vue-icons-plus/hi'
import { sidebarItems, settingsNav } from '../config/navigation'

const { t } = useI18n()
const route = useRoute()
</script>
