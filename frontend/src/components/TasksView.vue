<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiClipboardList class="w-3 h-3 inline" /> {{ t('tasks.header') }}
      </span>
    </div>

    <div class="px-3 py-1.5 bg-cyber-dark/40 flex items-center gap-2 shrink-0">
      <span class="text-cyber-muted text-sm font-mono">{{ t('tasks.filter.label') }}</span>
      <button
        v-for="p in PRIORITY_FILTERS"
        :key="p.value"
        @click="toggleFilter(p.value)"
        :class="[
          'text-sm px-2 py-0.5 font-mono transition-colors duration-150',
          activeFilters.has(p.value) ? p.activeClass : p.inactiveClass,
        ]"
      >{{ t(p.labelKey) }}</button>
    </div>

    <KanbanBoard
      :active-filters="activeFilters"
      class="flex-1 overflow-hidden"
      @ws-status="emit('ws-status', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiClipboardList } from 'vue-icons-plus/hi'
import KanbanBoard from './KanbanBoard.vue'

const { t } = useI18n()
const activeFilters = reactive(new Set<number>())

const emit = defineEmits<{
  'ws-status': [connected: boolean]
}>()

const PRIORITY_FILTERS = [
  {
    value: 2,
    labelKey: 'tasks.priority.high',
    activeClass: 'text-red-400 bg-red-400/10',
    inactiveClass: 'text-red-400/40 hover:text-red-400',
  },
  {
    value: 1,
    labelKey: 'tasks.priority.medium',
    activeClass: 'text-cyber-orange bg-cyber-orange/10',
    inactiveClass: 'text-cyber-orange/40 hover:text-cyber-orange',
  },
  {
    value: 0,
    labelKey: 'tasks.priority.low',
    activeClass: 'text-cyber-muted bg-cyber-muted/10',
    inactiveClass: 'text-cyber-muted/40 hover:text-cyber-muted',
  },
] as const

function toggleFilter(priority: number) {
  if (activeFilters.has(priority)) activeFilters.delete(priority)
  else activeFilters.add(priority)
}
</script>
