<template>
  <div class="flex flex-col bg-background min-w-0 h-full">
    <div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-border shrink-0 bg-surface">
      <HiClock class="w-4 h-4 text-muted-foreground" />
      <span class="text-sm text-foreground font-semibold">{{ t('schedules.header') }}</span>
      <button @click="openAddForm"
        class="ml-auto text-sm text-primary font-mono px-2.5 py-1 rounded-lg border border-primary/30 transition-colors duration-150 hover:bg-primary/10">
          {{ t('schedules.add') }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto mx-auto max-w-5xl px-6 py-6 w-full">
      <div v-if="tasks.length === 0" class="flex items-center justify-center h-full">
        <div class="text-sm text-muted-foreground font-mono">{{ t('schedules.empty') }}</div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
  <div v-for="task in tasks" :key="task.id"
    class="border border-border rounded-lg bg-surface p-3 cursor-pointer hover:border-input hover:shadow-sm transition-colors duration-150 flex flex-col"
    @click="router.push(`/tasks/${task.id}`)">
    <div class="flex items-center gap-2 mb-2">
      <div class="w-2 h-2 rounded-full shrink-0"
        :class="task.enabled ? 'bg-success' : 'bg-muted-foreground'"></div>
      <div class="text-sm text-foreground font-mono truncate flex-1">{{ task.name }}</div>
    </div>
    <div class="text-sm text-muted-foreground font-mono mb-2 flex items-center gap-1">
            <span class="px-1 border border-border text-xs"
              :class="frequencyClass(task.frequency)">{{ t(`schedules.frequency.${task.frequency}`) }}</span>
            <span>{{ scheduleTime(task) }}</span>
          </div>
          <div class="text-sm font-mono mb-3">
            <span v-if="task.logs?.[0]"
              :class="task.logs[0].status === 'SUCCESS' ? 'text-success' : task.logs[0].status === 'FAILED' ? 'text-danger' : 'text-warning'">
              {{ task.logs[0].status }}
            </span>
            <span v-else class="text-muted-foreground">—</span>
          </div>
          <div class="flex gap-1 mt-auto justify-end" @click.stop>
            <button @click="runNow(task.id)" class="text-sm text-primary font-mono px-2.5 py-1 rounded-lg border border-primary/30 transition-colors duration-150 hover:bg-primary/10">{{ t('schedules.runNow') }}</button>
            <button @click="editTask(task)" class="text-sm text-muted-foreground font-mono px-2.5 py-1 rounded-lg border border-input transition-colors duration-150 hover:bg-muted hover:text-primary">{{ t('schedules.edit') }}</button>
            <button @click="confirmDelete(task)" class="text-sm px-1.5 py-0.5 font-mono text-danger rounded-lg border border-danger/40 hover:bg-danger/10 transition-colors duration-150">{{ t('schedules.delete') }}</button>
          </div>
        </div>
      </div>
    </div>

    <BaseModal v-model="showForm">
      <template #header>
        <span class="text-sm text-foreground font-mono">{{ editingTask ? t('schedules.edit') : t('schedules.add') }}</span>
      </template>
      <div class="p-3 space-y-3 max-w-xl">
        <div>
          <label class="text-sm text-muted-foreground font-mono block mb-1">{{ t('schedules.form.name') }}</label>
          <input v-model="form.name" class="w-full bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label class="text-sm text-muted-foreground font-mono block mb-1">{{ t('schedules.form.description') }}</label>
          <input v-model="form.description" class="w-full bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label class="text-sm text-muted-foreground font-mono block mb-1">{{ t('schedules.form.prompt') }}</label>
          <textarea v-model="form.prompt" rows="4" class="w-full bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring"></textarea>
        </div>
        <div>
          <label class="text-sm text-muted-foreground font-mono block mb-1">{{ t('schedules.frequency') }}</label>
          <select v-model="form.frequency"
            class="w-full bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring">
            <option v-for="f in FREQUENCIES" :key="f" :value="f">{{ t(`schedules.frequency.${f}`) }}</option>
          </select>
        </div>

        <!-- Time picker for non-manual -->
        <div v-if="form.frequency !== 'manual'" class="space-y-3">
          <div v-if="['daily','weekdays','weekly'].includes(form.frequency)" class="flex items-center gap-2">
            <div class="flex items-center gap-1">
              <span class="text-xs text-muted-foreground font-mono">HH</span>
              <select v-model.number="form.cronHour"
                class="bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring">
                <option v-for="h in 24" :key="h-1" :value="h-1">{{ String(h-1).padStart(2,'0') }}</option>
              </select>
            </div>
            <span class="text-muted-foreground font-mono">:</span>
            <div class="flex items-center gap-1">
              <select v-model.number="form.cronMinute"
                class="bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring">
                <option v-for="m in 60" :key="m-1" :value="m-1">{{ String(m-1).padStart(2,'0') }}</option>
              </select>
              <span class="text-xs text-muted-foreground font-mono">MM</span>
            </div>
          </div>

          <div v-if="form.frequency === 'hourly'" class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground font-mono">{{ t('schedules.form.atMinute') }}</span>
            <select v-model.number="form.cronMinute"
              class="bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring">
              <option v-for="m in 60" :key="m-1" :value="m-1">{{ String(m-1).padStart(2,'0') }}</option>
            </select>
          </div>

          <div v-if="form.frequency === 'weekly'">
            <div class="text-sm text-muted-foreground font-mono mb-1">{{ t('schedules.form.days') }}</div>
            <div class="flex flex-wrap gap-2">
              <label v-for="(label, idx) in DAYS" :key="idx"
                class="flex items-center gap-1 px-2 py-1 border border-border cursor-pointer text-sm font-mono select-none rounded-lg transition-colors duration-150"
                :class="selectedDays.includes(idx) ? 'bg-primary/20 text-primary border-primary/40' : 'text-muted-foreground hover:text-foreground hover:border-primary/30'">
                <input type="checkbox" :value="idx" v-model="selectedDays" class="sr-only" />
                {{ label }}
              </label>
            </div>
          </div>
        </div>

        <div class="text-sm text-muted-foreground font-mono" v-if="form.frequency !== 'manual'">
          {{ scheduleDesc }}
        </div>

        <!-- Model selector -->
        <div>
          <label class="text-sm text-muted-foreground font-mono block mb-1">{{ t('schedules.form.selectModel') }}</label>
          <select v-model.number="form.modelId"
            class="w-full bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring">
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.providerName }} / {{ m.name }}</option>
          </select>
        </div>

        <!-- Project path -->
        <div>
          <label class="text-sm text-muted-foreground font-mono block mb-1">{{ t('schedules.form.projectPath') }}</label>
          <select v-model="form.projectPath"
            class="w-full bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring">
            <option :value="null">{{ t('schedules.form.noProject') }}</option>
            <option v-for="p in savedProjects" :key="p.id" :value="p.path">{{ p.name }} ({{ p.path }})</option>
          </select>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button @click="showForm = false" class="text-sm text-muted-foreground font-mono px-3 py-1.5 border border-border rounded-lg transition-colors duration-150 hover:text-foreground">{{ t('tasks.form.cancel') }}</button>
          <button @click="saveTask" class="text-sm text-primary-foreground font-mono px-3 py-1.5 rounded-lg bg-primary transition-colors duration-150 hover:bg-primary/90">{{ t('tasks.form.save') }}</button>
        </div>
      </template>
    </BaseModal>

    <BaseConfirmModal v-model="showConfirm" :title="t('schedules.deleteConfirm')" :message="t('schedules.deleteConfirm')" @confirm="onDeleteConfirmed" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { HiClock } from 'vue-icons-plus/hi'
import BaseModal from './BaseModal.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'
import * as api from '../api/scheduleTasks'
import * as coworkApi from '../api/cowork'
import type { ScheduleTask } from '../api/scheduleTasks'
import { useProvidersStore } from '../stores/providers'
import type { ProviderModelFlat } from '../api/types'

const { t } = useI18n()

const FREQUENCIES = ['manual', 'hourly', 'daily', 'weekdays', 'weekly']
const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const router = useRouter()

const models = ref<ProviderModelFlat[]>([])
const savedProjects = ref<{ id: string; name: string; path: string }[]>([])

const tasks = ref<ScheduleTask[]>([])
const showForm = ref(false)
const showConfirm = ref(false)
const editingTask = ref<ScheduleTask | null>(null)
const expandedLogs = ref<number | null>(null)
const deletingTask = ref<ScheduleTask | null>(null)

const form = ref({
  name: '',
  description: '',
  prompt: '',
  frequency: 'manual',
  cronMinute: 0,
  cronHour: 0,
  cronDayOfWeek: 0,
  cronDaysOfWeek: '',
  modelId: null as number | null,
  projectPath: null as string | null,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
})

const selectedDays = ref<number[]>([])

watch(selectedDays, (days) => {
  if (days.length > 0) {
    form.value.cronDaysOfWeek = days.sort((a, b) => a - b).join(',')
  } else {
    form.value.cronDaysOfWeek = ''
  }
})

function resetForm() {
  form.value = { name: '', description: '', prompt: '', frequency: 'manual', cronMinute: 0, cronHour: 0, cronDayOfWeek: 0, cronDaysOfWeek: '', modelId: null, projectPath: null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
  selectedDays.value = []
}

function openAddForm() {
  editingTask.value = null
  resetForm()
  if (models.value.length > 0) {
    form.value.modelId = models.value[0].id
  }
  showForm.value = true
}

const scheduleDesc = computed(() => {
  const f = form.value.frequency
  const mm = String(form.value.cronMinute).padStart(2, '0')
  const hh = String(form.value.cronHour).padStart(2, '0')
  if (f === 'hourly') return t('schedules.hint.hourly', { m: mm })
  const time = `${hh}:${mm}`
  if (f === 'daily') return t('schedules.hint.daily', { time })
  if (f === 'weekdays') return t('schedules.hint.weekdays', { time })
  if (f === 'weekly') {
    const days = selectedDays.value.length > 0
      ? selectedDays.value.map(d => DAYS[d]).join(', ')
      : DAYS[form.value.cronDayOfWeek || 0]
    return t('schedules.hint.weekly', { day: days, time })
  }
  return ''
})

function frequencyClass(f: string) {
  if (f === 'manual') return 'text-muted-foreground'
  if (f === 'hourly') return 'text-primary'
  if (f === 'daily') return 'text-success'
  if (f === 'weekdays') return 'text-warning'
  return 'text-primary'
}

function scheduleTime(task: { frequency: string; cronHour: number | null; cronMinute: number | null; cronDayOfWeek: number | null; cronDaysOfWeek: string | null; timezone: string | null }): string {
  const mm = String(task.cronMinute ?? 0).padStart(2, '0')
  const hh = String(task.cronHour ?? 0).padStart(2, '0')
  if (task.frequency === 'hourly') return `:${mm}`
  if (task.frequency === 'daily') return `${hh}:${mm}`
  if (task.frequency === 'weekdays') return `${hh}:${mm}`
  if (task.frequency === 'weekly') {
    const days = task.cronDaysOfWeek
      ? task.cronDaysOfWeek.split(',').map(Number).map(d => DAYS[d]).join(',')
      : DAYS[task.cronDayOfWeek ?? 0]
    return `${days} ${hh}:${mm}`
  }
  return ''
}

onMounted(async () => {
  try { tasks.value = await api.listTasks() } catch { /* ignore */ }
  try { savedProjects.value = await coworkApi.listProjects() } catch { /* ignore */ }
  const ps = useProvidersStore()
  try {
    await ps.loadModels()
    models.value = ps.models
    if (models.value.length > 0 && form.value.modelId === null) {
      form.value.modelId = models.value[0].id
    }
  } catch { /* ignore */ }
})

function toggleLogs(id: number) {
  expandedLogs.value = expandedLogs.value === id ? null : id
}

function editTask(task: ScheduleTask) {
  editingTask.value = task
  form.value = {
    name: task.name,
    description: task.description ?? '',
    prompt: task.prompt,
    frequency: task.frequency,
    cronMinute: task.cronMinute ?? 0,
    cronHour: task.cronHour ?? 0,
    cronDayOfWeek: task.cronDayOfWeek ?? 0,
    cronDaysOfWeek: task.cronDaysOfWeek ?? '',
    modelId: task.modelId ?? null,
    projectPath: task.projectPath ?? null,
    timezone: task.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
  if (task.cronDaysOfWeek) {
    selectedDays.value = task.cronDaysOfWeek.split(',').map(Number)
  } else if (task.cronDayOfWeek != null) {
    selectedDays.value = [task.cronDayOfWeek]
  } else {
    selectedDays.value = []
  }
  showForm.value = true
}

async function saveTask() {
  try {
    const body = { ...form.value }
    if (editingTask.value) {
      const updated = await api.updateTask(editingTask.value.id, body)
      const idx = tasks.value.findIndex(t => t.id === editingTask.value!.id)
      if (idx >= 0) tasks.value[idx] = updated
    } else {
      const created = await api.createTask(body)
      tasks.value.unshift(created)
    }
    showForm.value = false
    resetForm()
    editingTask.value = null
  } catch { /* ignore */ }
}

async function runNow(id: number) {
  try {
    await api.runTask(id)
    tasks.value = await api.listTasks()
  } catch { /* ignore */ }
}

function confirmDelete(task: ScheduleTask) {
  deletingTask.value = task
  showConfirm.value = true
}

async function onDeleteConfirmed() {
  if (!deletingTask.value) return
  try {
    await api.deleteTask(deletingTask.value.id)
    tasks.value = tasks.value.filter(t => t.id !== deletingTask.value!.id)
  } catch { /* ignore */ }
  deletingTask.value = null
}
</script>
