<template>
  <nav class="flex w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface px-2 py-3">
    <div v-for="group in navGroups" :key="group.labelKey" class="mb-1">
      <div class="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {{ t(group.labelKey) }}
      </div>
      <RouterLink
        v-for="item in group.items"
        :key="item.name"
        :to="item.path"
        :class="[
          'relative flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 transition-colors duration-150',
          isActive(item)
            ? 'bg-muted font-medium text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        ]"
      >
        <span v-if="isActive(item)" class="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary"></span>
        <span v-if="typeof item.icon === 'string'" class="flex h-4 w-4 shrink-0 items-center justify-center text-sm">{{ item.icon }}</span>
        <component v-else :is="item.icon" class="h-4 w-4 shrink-0" :class="isActive(item) ? 'text-primary' : 'text-muted-foreground'" />
        <span class="truncate text-sm">{{ t(item.labelKey) }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { navGroups, type NavItem } from '../config/navigation'

const { t } = useI18n()
const route = useRoute()

function isActive(item: NavItem): boolean {
  if (item.path.startsWith('/settings/')) return route.path === item.path
  return route.path === item.path || route.path.startsWith(item.path + '/')
}
</script>
