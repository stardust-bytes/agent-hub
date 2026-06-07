<!-- frontend/src/components/TaskCard.vue -->
<template>
  <div
    class="p-2 cursor-grab select-none relative group transition-colors duration-150"
    :class="cardBgClass(task.priority)"
  >
    <div class="flex items-start justify-between gap-1">
      <span class="text-[#EEEEEE] text-xs leading-snug flex-1 font-mono">{{ task.title }}</span>
      <button
        @click.stop="menuOpen = !menuOpen"
        class="opacity-0 group-hover:opacity-100 text-cyber-accent/40 text-sm font-mono hover:text-cyber-accent/70 shrink-0 leading-none transition-colors duration-150"
      >···</button>
    </div>

    <p v-if="task.description" class="text-[#888888]/60 text-[10px] mt-1 truncate font-mono">
      {{ task.description }}
    </p>

    <div class="flex items-center gap-1.5 mt-1.5">
      <span :class="['text-[9px] px-1.5 py-0.5 font-mono', priorityClass(task.priority)]">
        {{ priorityLabel(task.priority) }}
      </span>
      <span v-if="task.dueDate" class="text-[9px] text-[#888888]/60 font-mono">
        {{ formatDate(task.dueDate) }}
      </span>
    </div>

    <TaskCardMenu
      v-if="menuOpen"
      :task-id="task.id"
      :current-priority="task.priority"
      @delete="emit('delete', task.id); menuOpen = false"
      @update-priority="(id, p) => { emit('update-priority', id, p); menuOpen = false }"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TaskCardMenu from './TaskCardMenu.vue'

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

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  delete: [id: number]
  'update-priority': [id: number, priority: number]
}>()

const { t } = useI18n()
const menuOpen = ref(false)

function priorityLabel(p: number): string {
  if (p >= 2) return t('tasks.priority.high')
  if (p === 1) return t('tasks.priority.medium')
  return t('tasks.priority.low')
}

function cardBgClass(p: number): string {
  if (p >= 2) return 'bg-red-400/5 border-l-2 border-red-400'
  if (p === 1) return 'bg-[#FFA500]/5 border-l-2 border-[#FFA500]'
  return 'bg-cyber-dark border-l-2 border-transparent'
}

function priorityClass(p: number): string {
  if (p >= 2) return 'text-red-400 bg-red-400/20'
  if (p === 1) return 'text-[#FFA500] bg-[#FFA500]/20'
  return 'text-[#888888] bg-[#888888]/20'
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('vi-VN')
}
</script>
