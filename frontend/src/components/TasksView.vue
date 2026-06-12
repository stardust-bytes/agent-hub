<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 h-[3rem] bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiClipboardList class="w-3 h-3 inline" /> {{ t('tasks.header') }}
      </span>
      <button
        @click="openAddModal"
        class="text-sm font-mono font-bold text-black bg-cyber-accent px-2 py-1 hover:bg-cyber-accent/80 transition-colors duration-150"
      >{{ t('tasks.add') }}</button>
    </div>

    <div class="flex sm:hidden border-b border-cyber-code-border">
      <button
        v-for="col in COLUMNS"
        :key="col.key"
        @click="mobileStatus = col.key"
        :class="[
          'flex-1 text-center py-2 text-sm font-mono transition-colors duration-150',
          mobileStatus === col.key ? col.tabActiveClass : col.tabInactiveClass,
        ]"
      >{{ t(col.labelKey) }}</button>
    </div>

    <div class="hidden sm:flex px-3 py-1.5 bg-cyber-dark/40 items-center gap-2 shrink-0">
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
      :mobile-status="isMobile ? mobileStatus : null"
      :refresh-key="refreshKey"
      class="flex-1 overflow-hidden"
      @ws-status="emit('ws-status', $event)"
      @edit="openEditModal"
      @delete="openDeleteConfirm"
    />

    <TaskFormModal
      v-model="showFormModal"
      :editing="editingTask"
      @saved="onTaskSaved"
    />

    <BaseConfirmModal
      v-model="showConfirmModal"
      :title="t('tasks.delete.confirm')"
      :message="t('tasks.delete.confirm')"
      @confirm="onDeleteConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiClipboardList } from 'vue-icons-plus/hi'
import KanbanBoard from './KanbanBoard.vue'
import TaskFormModal from './TaskFormModal.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'

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

const { t } = useI18n()
const activeFilters = reactive(new Set<number>())

const emit = defineEmits<{
  'ws-status': [connected: boolean]
}>()

const mobileQuery = window.matchMedia('(max-width: 767px)')
const isMobile = ref(mobileQuery.matches)
mobileQuery.addEventListener('change', (e) => { isMobile.value = e.matches })

const mobileStatus = ref('TODO')
const refreshKey = ref(0)

const showFormModal = ref(false)
const showConfirmModal = ref(false)
const editingTask = ref<Task | null>(null)
const deletingTaskId = ref<number | null>(null)

const COLUMNS = [
  { key: 'TODO',       labelKey: 'tasks.col.todo',       tabActiveClass: 'text-cyber-accent border-b-2 border-cyber-accent', tabInactiveClass: 'text-cyber-muted hover:text-cyber-accent' },
  { key: 'PROCESSING', labelKey: 'tasks.col.processing', tabActiveClass: 'text-cyber-orange border-b-2 border-cyber-orange', tabInactiveClass: 'text-cyber-muted hover:text-cyber-orange' },
  { key: 'DONE',       labelKey: 'tasks.col.done',       tabActiveClass: 'text-cyber-green border-b-2 border-cyber-green', tabInactiveClass: 'text-cyber-muted hover:text-cyber-green' },
  { key: 'FAILED',     labelKey: 'tasks.col.failed',     tabActiveClass: 'text-red-400 border-b-2 border-red-400',       tabInactiveClass: 'text-cyber-muted hover:text-red-400' },
]

const PRIORITY_FILTERS = [
  { value: 2, labelKey: 'tasks.priority.high', activeClass: 'text-red-400 bg-red-400/10', inactiveClass: 'text-red-400/40 hover:text-red-400' },
  { value: 1, labelKey: 'tasks.priority.medium', activeClass: 'text-cyber-orange bg-cyber-orange/10', inactiveClass: 'text-cyber-orange/40 hover:text-cyber-orange' },
  { value: 0, labelKey: 'tasks.priority.low', activeClass: 'text-cyber-muted bg-cyber-muted/10', inactiveClass: 'text-cyber-muted/40 hover:text-cyber-muted' },
]

function toggleFilter(priority: number) {
  if (activeFilters.has(priority)) activeFilters.delete(priority)
  else activeFilters.add(priority)
}

function openAddModal() {
  editingTask.value = null
  showFormModal.value = true
}

function openEditModal(task: Task) {
  editingTask.value = task
  showFormModal.value = true
}

function openDeleteConfirm(id: number) {
  deletingTaskId.value = id
  showConfirmModal.value = true
}

function onTaskSaved() {
  refreshKey.value++
}

async function onDeleteConfirmed() {
  if (deletingTaskId.value === null) return
  try {
    await fetch(`/api/tasks/${deletingTaskId.value}`, { method: 'DELETE' })
    refreshKey.value++
  } catch {
    // silently fail
  }
  deletingTaskId.value = null
}
</script>

