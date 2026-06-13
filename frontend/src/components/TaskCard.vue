<template>
  <div
    class="p-2 select-none transition-colors duration-150"
    :class="cardBgClass(task.priority)"
  >
    <div class="text-cyber-text text-sm leading-snug font-mono">{{ task.title }}</div>
    <div v-if="task.description" class="text-sm font-mono text-cyber-muted line-clamp-2">{{ task.description }}</div>

    <div class="flex items-center justify-between mt-1.5 gap-2">
      <div class="flex items-center gap-1.5">
        <span :class="['text-sm px-1.5 py-0.5 font-mono', priorityClass(task.priority)]">
          {{ priorityLabel(task.priority) }}
        </span>
        <span v-if="task.dueDate" class="text-sm text-cyber-muted/60 font-mono">
          {{ formatDate(task.dueDate) }}
        </span>
      </div>
      <div class="flex gap-1">
        <button
          @click.stop="$emit('edit', task)"
          class="text-sm px-1.5 py-0.5 font-mono text-cyber-accent border border-cyber-accent/50 hover:bg-cyber-accent/10 transition-colors duration-150"
        >{{ t('tasks.edit') }}</button>
        <button
          @click.stop="$emit('delete', task.id)"
          class="text-sm px-1.5 py-0.5 font-mono text-red-400 border border-red-400/50 hover:bg-red-400/10 transition-colors duration-150"
        >{{ t('tasks.menu.delete') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Task {
  id: number
  title: string
  description?: string | null
  status: string
  priority: number
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}

defineProps<{ task: Task }>()

const emit = defineEmits<{
  edit: [task: Task]
  delete: [id: number]
}>()

const { t } = useI18n()

function priorityLabel(p: number): string {
  if (p >= 2) return t('tasks.priority.high')
  if (p === 1) return t('tasks.priority.medium')
  return t('tasks.priority.low')
}

function cardBgClass(p: number): string {
  if (p >= 2) return 'bg-red-400/10 border-l-2 border-red-400'
  if (p === 1) return 'bg-cyber-orange/10 border-l-2 border-cyber-orange'
  return 'bg-cyber-modal-bg border-l-2 border-transparent'
}

function priorityClass(p: number): string {
  if (p >= 2) return 'text-red-400 bg-red-400/20'
  if (p === 1) return 'text-cyber-orange bg-cyber-orange/20'
  return 'text-cyber-muted bg-cyber-muted/20'
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('vi-VN')
}
</script>

