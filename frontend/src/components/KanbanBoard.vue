<!-- frontend/src/components/KanbanBoard.vue -->
<template>
  <div v-if="mobileStatus" class="flex-1 overflow-y-auto p-2 space-y-1.5">
    <div
      v-for="task in columnTasks[mobileStatus]"
      :key="task.id"
      v-show="shouldShow(task)"
    >
      <TaskCard
        :task="task"
        @edit="(task) => emit('edit', task)"
        @delete="(id) => emit('delete', id)"
      />
    </div>
  </div>

  <div v-else class="flex flex-1 overflow-hidden">
    <div
      v-for="col in COLUMNS"
      :key="col.key"
      class="flex-1 flex flex-col min-w-0 border border-cyber-dark"
    >
      <div :class="['px-2 py-2 flex items-center gap-2 shrink-0', col.headerBgClass]">
        <span :class="['text-sm tracking-widest font-mono uppercase', col.headerClass]">
          {{ t(col.labelKey) }}
        </span>
        <span class="text-sm bg-cyber-accent/10 text-cyber-accent/50 px-1.5 rounded font-mono">
          {{ visibleCount(col.key) }}
        </span>
      </div>

      <VueDraggable
        v-model="columnTasks[col.key]"
        group="tasks"
        class="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 min-h-[40px]"
        @add="(e) => onAdd(e, col.key)"
      >
        <div
          v-for="task in columnTasks[col.key]"
          :key="task.id"
          v-show="shouldShow(task)"
        >
          <TaskCard
            :task="task"
            @edit="(task) => emit('edit', task)"
            @delete="(id) => emit('delete', id)"
          />
        </div>
      </VueDraggable>

      <div v-if="col.key === 'TODO'" class="px-2 pb-2 shrink-0">
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted, onUnmounted, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { io, Socket } from 'socket.io-client'
import { useI18n } from 'vue-i18n'
import TaskCard from './TaskCard.vue'

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

const props = defineProps<{
  activeFilters: Set<number>
  mobileStatus?: string | null
  refreshKey?: number
}>()

const emit = defineEmits<{
  'ws-status': [connected: boolean]
  edit: [task: Task]
  delete: [id: number]
}>()

const { t } = useI18n()

const STATUS_KEYS = ['TODO', 'PROCESSING', 'DONE', 'FAILED'] as const

const COLUMNS = [
  { key: 'TODO',       labelKey: 'tasks.col.todo',       headerClass: 'text-cyber-accent', headerBgClass: 'bg-cyber-accent/8'    },
  { key: 'PROCESSING', labelKey: 'tasks.col.processing', headerClass: 'text-cyber-orange',  headerBgClass: 'bg-cyber-orange/8'  },
  { key: 'DONE',       labelKey: 'tasks.col.done',       headerClass: 'text-cyber-green',  headerBgClass: 'bg-cyber-green/8'      },
  { key: 'FAILED',     labelKey: 'tasks.col.failed',     headerClass: 'text-red-400',      headerBgClass: 'bg-red-400/8'         },
]

const columnTasks = reactive<Record<string, Task[]>>({
  TODO: [], PROCESSING: [], DONE: [], FAILED: [],
})

let socket: Socket | null = null

watch(() => props.refreshKey, () => {
  fetchTasks()
})

function shouldShow(task: Task): boolean {
  return props.activeFilters.size === 0 || props.activeFilters.has(task.priority)
}

function visibleCount(status: string): number {
  return (columnTasks[status] ?? []).filter(t => shouldShow(t)).length
}

function populateColumns(tasks: Task[]) {
  for (const key of STATUS_KEYS) columnTasks[key] = []
  for (const task of tasks) {
    if (columnTasks[task.status]) columnTasks[task.status].push(task)
  }
}

async function onAdd(evt: { newIndex?: number }, newStatus: string) {
  if (evt.newIndex === undefined) return
  const task = columnTasks[newStatus][evt.newIndex]
  if (!task || task.status === newStatus) return

  const oldStatus = task.status
  task.status = newStatus

  try {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch {
    task.status = oldStatus
    columnTasks[newStatus] = columnTasks[newStatus].filter(t => t.id !== task.id)
    columnTasks[oldStatus].push(task)
  }
}

async function fetchTasks() {
  try {
    const res = await fetch('/api/tasks')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    populateColumns(await res.json() as Task[])
  } catch {
    // board stays empty
  }
}

onMounted(async () => {
  await fetchTasks()

  socket = io('/tasks')
  socket.on('connect', () => emit('ws-status', true))
  socket.on('disconnect', () => emit('ws-status', false))

  socket.on('task:created', (task: Task) => {
    if (columnTasks[task.status]) columnTasks[task.status].push(task)
  })

  socket.on('task:updated', (task: Task) => {
    for (const key of STATUS_KEYS) {
      const idx = columnTasks[key].findIndex(t => t.id === task.id)
      if (idx !== -1) { columnTasks[key].splice(idx, 1); break }
    }
    if (columnTasks[task.status]) columnTasks[task.status].push(task)
  })

  socket.on('task:deleted', ({ id }: { id: number }) => {
    for (const key of STATUS_KEYS) {
      const idx = columnTasks[key].findIndex(t => t.id === id)
      if (idx !== -1) { columnTasks[key].splice(idx, 1); break }
    }
  })
})

onUnmounted(() => {
  socket?.disconnect()
})
</script>
