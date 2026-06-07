<!-- frontend/src/components/TaskCardMenu.vue -->
<template>
  <div class="absolute right-0 top-5 z-20 bg-cyber-dark border border-cyber-dim rounded min-w-[128px]">
    <div class="px-2 py-1.5 border-b border-cyber-border">
      <div class="text-[9px] text-cyber-accent/40 font-mono mb-1">{{ t('tasks.filter.label') }}</div>
      <div class="flex gap-1">
        <button
          v-for="p in PRIORITIES"
          :key="p.value"
          @click="$emit('update-priority', taskId, p.value)"
          :class="[
            'text-[8px] px-1.5 py-px rounded border font-mono transition-colors duration-150',
            p.value === currentPriority ? p.activeClass : p.inactiveClass,
          ]"
        >{{ t(p.labelKey) }}</button>
      </div>
    </div>
    <button
      @click="onDelete"
      class="w-full text-left px-2 py-1.5 text-xs font-mono text-red-400/70 hover:text-red-400 hover:bg-red-400/5 transition-colors duration-150"
    >{{ t('tasks.menu.delete') }}</button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  taskId: number
  currentPriority: number
}>()

const emit = defineEmits<{
  delete: []
  'update-priority': [id: number, priority: number]
}>()

const { t } = useI18n()

const PRIORITIES = [
  {
    value: 2,
    labelKey: 'tasks.priority.high',
    activeClass: 'text-red-400 border-red-400/50 bg-red-400/15',
    inactiveClass: 'text-red-400/50 border-red-400/20 hover:border-red-400/40',
  },
  {
    value: 1,
    labelKey: 'tasks.priority.medium',
    activeClass: 'text-cyber-orange border-cyber-orange/50 bg-cyber-orange/15',
    inactiveClass: 'text-cyber-orange/50 border-cyber-orange/20 hover:border-cyber-orange/40',
  },
  {
    value: 0,
    labelKey: 'tasks.priority.low',
    activeClass: 'text-cyber-accent border-cyber-dim bg-cyber-accent/15',
    inactiveClass: 'text-cyber-accent/50 border-cyber-border hover:border-cyber-dim',
  },
] as const

function onDelete() {
  if (window.confirm(t('tasks.menu.delete.confirm'))) {
    emit('delete')
  }
}
</script>
