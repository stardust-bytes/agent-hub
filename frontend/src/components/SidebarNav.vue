<template>
  <nav class="w-60 bg-white border-r border-gray-200 flex flex-col items-stretch py-3 px-2 gap-0.5 shrink-0">
    <div class="flex items-center gap-2 px-3 py-2 mb-2">
      <span class="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white text-sm font-bold shrink-0">A</span>
      <div class="flex flex-col leading-tight">
        <span class="text-sm font-semibold text-gray-900">Agent Hub</span>
        <span class="text-xs font-mono text-gray-500">Code 171305</span>
      </div>
    </div>

    <RouterLink
      v-for="item in sidebarItems"
      :key="item.name"
      :to="item.path"
      :class="[
        'w-full px-3 py-1.5 rounded-md flex items-center gap-2.5 transition-colors duration-150',
        route.name === item.name
          ? 'bg-gray-100 text-gray-900 font-medium'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      ]"
    >
      <span v-if="typeof item.icon === 'string'" class="w-4 h-4 shrink-0 flex items-center justify-center text-sm" :class="route.name === item.name ? 'text-blue-600' : 'text-gray-400'">{{ item.icon }}</span>
      <component v-else :is="item.icon" class="w-4 h-4 shrink-0" :class="route.name === item.name ? 'text-blue-600' : 'text-gray-400'" />
      <span class="text-sm truncate">{{ t(item.labelKey) }}</span>
    </RouterLink>

    <div class="flex-1" />

    <RouterLink
      :to="settingsNav.path"
      :class="[
        'w-full px-3 py-1.5 rounded-md flex items-center gap-2.5 transition-colors duration-150',
        route.name === 'settings'
          ? 'bg-gray-100 text-gray-900 font-medium'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      ]"
    >
      <HiCog class="w-4 h-4 shrink-0" :class="route.name === 'settings' ? 'text-blue-600' : 'text-gray-400'" />
      <span class="text-sm truncate">{{ t('nav.settings') }}</span>
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
