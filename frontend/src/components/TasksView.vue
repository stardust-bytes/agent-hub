<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 border-b border-cyber-border bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-orange text-xs tracking-widest font-mono">
        <HiClipboardList class="w-3 h-3 inline" /> {{ t('tasks.header') }}
      </span>
      <span :class="['text-xs font-mono', wsConnected ? 'text-cyber-green' : 'text-cyber-accent/30']">
        {{ wsConnected ? t('tasks.ws.connected') : t('tasks.ws.disconnected') }}
      </span>
    </div>

    <div class="px-3 py-1.5 border-b border-cyber-border/50 bg-cyber-dark/40 flex items-center gap-2 shrink-0">
      <span class="text-cyber-accent/40 text-[9px] font-mono">{{ t('tasks.filter.label') }}</span>
      <button
        v-for="p in PRIORITY_FILTERS"
        :key="p.value"
        @click="toggleFilter(p.value)"
        :class="[
          'text-[9px] px-2 py-0.5 rounded border font-mono transition-colors duration-150',
          activeFilters.has(p.value) ? p.activeClass : p.inactiveClass,
        ]"
      >{{ t(p.labelKey) }}</button>
    </div>

    <KanbanBoard
      :active-filters="activeFilters"
      class="flex-1 overflow-hidden"
      @ws-status="wsConnected = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiClipboardList } from 'vue-icons-plus/hi'
import KanbanBoard from './KanbanBoard.vue'

const { t } = useI18n()
const wsConnected = ref(false)
const activeFilters = reactive(new Set<number>())

const PRIORITY_FILTERS = [
  {
    value: 2,
    labelKey: 'tasks.priority.high',
    activeClass: 'text-red-400 border-red-400/50 bg-red-400/10',
    inactiveClass: 'text-red-400/40 border-red-400/20 hover:border-red-400/40',
  },
  {
    value: 1,
    labelKey: 'tasks.priority.medium',
    activeClass: 'text-cyber-orange border-cyber-orange/50 bg-cyber-orange/10',
    inactiveClass: 'text-cyber-orange/40 border-cyber-orange/20 hover:border-cyber-orange/40',
  },
  {
    value: 0,
    labelKey: 'tasks.priority.low',
    activeClass: 'text-cyber-accent border-cyber-dim bg-cyber-accent/10',
    inactiveClass: 'text-cyber-accent/40 border-cyber-border hover:border-cyber-dim',
  },
] as const

function toggleFilter(priority: number) {
  if (activeFilters.has(priority)) activeFilters.delete(priority)
  else activeFilters.add(priority)
}
</script>
