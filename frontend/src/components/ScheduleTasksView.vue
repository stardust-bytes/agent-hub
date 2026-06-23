<template>
  <div class="flex flex-col bg-background min-w-0 h-full">
    <div class="mx-auto max-w-5xl w-full px-6 pt-5 pb-4">
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
          <HiClock class="w-4 h-4" />
        </div>
        <span class="text-base font-semibold text-foreground">{{ t('schedules.header') }}</span>
        <span v-if="tasks.length > 0" class="text-xs font-sans text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{{ tasks.length }} {{ t('schedules.active') }}</span>
        <div class="ml-auto">
          <button @click="openAddForm"
            class="text-sm rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors duration-150 px-2.5 py-1">
            {{ t('schedules.add') }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto mx-auto max-w-5xl w-full px-6 pb-6">
      <div v-if="tasks.length === 0" class="flex items-center justify-center h-full">
        <div class="text-sm text-muted-foreground font-sans">{{ t('schedules.empty') }}</div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3">
  <div v-for="task in tasks" :key="task.id"
    class="border border-border rounded-lg bg-surface p-3 cursor-pointer hover:border-input hover:shadow-sm transition-colors duration-150 flex flex-col"
    @click="router.push(`/tasks/${task.id}`)">
    <div class="flex items-center gap-2 mb-2">
      <div class="w-2 h-2 rounded-full shrink-0"
        :class="task.enabled ? 'bg-success' : 'bg-muted-foreground'"></div>
      <div class="text-sm text-foreground font-sans truncate flex-1">{{ task.name }}</div>
    </div>
    <div class="text-sm text-muted-foreground font-sans mb-2 flex items-center gap-1">
            <span class="px-1.5 rounded-full border border-border text-xs"
              :class="frequencyClass(task.frequency)">{{ t(`schedules.frequency.${task.frequency}`) }}</span>
            <span>{{ scheduleTime(task) }}</span>
          </div>
          <div class="text-sm text-muted-foreground/70 font-sans line-clamp-2 mb-2">{{ task.prompt }}</div>
          <div class="mb-3">
            <span v-if="task.logs?.[0]" class="text-xs font-sans rounded-full px-1.5 py-0.5"
              :class="statusBadgeClass(task.logs[0].status)">{{ statusLabel(task.logs[0].status) }}</span>
            <span v-else class="text-xs text-muted-foreground">—</span>
          </div>
          <div class="flex gap-1 mt-auto justify-end" @click.stop>
            <button @click="runNow(task.id)" :disabled="runningId === task.id"
              class="text-sm font-sans px-2.5 py-1 rounded-lg border border-primary/30 transition-colors duration-150"
              :class="runningId === task.id ? 'text-primary/50 cursor-not-allowed' : 'text-primary hover:bg-primary/10'">{{ runningId === task.id ? '⟳' : t('schedules.runNow') }}</button>
            <button @click="editTask(task)" class="text-sm text-muted-foreground font-sans px-2.5 py-1 rounded-lg border border-input transition-colors duration-150 hover:bg-muted hover:text-primary">{{ t('schedules.edit') }}</button>
            <button @click="confirmDelete(task)" class="text-sm px-1.5 py-0.5 font-sans text-danger rounded-lg border border-danger/40 hover:bg-danger/10 transition-colors duration-150">{{ t('schedules.delete') }}</button>
          </div>
        </div>
      </div>
    </div>

    <BaseModal v-model="showForm">
      <template #header>
        <span class="text-sm text-foreground font-sans">{{ editingTask ? t('schedules.edit') : t('schedules.add') }}</span>
      </template>
      <div class="p-3 space-y-3 max-w-xl">
        <div>
          <label class="text-sm text-muted-foreground font-sans block mb-1">{{ t('schedules.form.name') }}</label>
          <input v-model="form.name" class="w-full bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label class="text-sm text-muted-foreground font-sans block mb-1">{{ t('schedules.form.description') }}</label>
          <input v-model="form.description" class="w-full bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label class="text-sm text-muted-foreground font-sans block mb-1">{{ t('schedules.form.prompt') }}</label>
          <textarea v-model="form.prompt" rows="4" class="w-full bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring"></textarea>
        </div>
        <div>
          <label class="text-sm text-muted-foreground font-sans block mb-1">{{ t('schedules.frequency') }}</label>
          <BaseSelect v-model="form.frequency" :options="FREQUENCIES.map(f => ({ value: f, label: t(`schedules.frequency.${f}`) }))" within-dialog />
        </div>

        <!-- Time picker for non-manual -->
        <div v-if="form.frequency !== 'manual'" class="space-y-3">
          <div v-if="['daily','weekdays','weekly'].includes(form.frequency)" class="flex items-center gap-2">
            <div class="flex items-center gap-1">
              <span class="text-xs text-muted-foreground font-sans">HH</span>
              <BaseSelect v-model="form.cronHour" :options="Array.from({ length: 24 }, (_, i) => ({ value: i, label: String(i).padStart(2,'0') }))" within-dialog class="w-20" />
            </div>
            <span class="text-muted-foreground font-sans">:</span>
            <div class="flex items-center gap-1">
              <BaseSelect v-model="form.cronMinute" :options="Array.from({ length: 60 }, (_, i) => ({ value: i, label: String(i).padStart(2,'0') }))" within-dialog class="w-20" />
              <span class="text-xs text-muted-foreground font-sans">MM</span>
            </div>
          </div>

          <div v-if="form.frequency === 'hourly'" class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground font-sans">{{ t('schedules.form.atMinute') }}</span>
            <BaseSelect v-model="form.cronMinute" :options="Array.from({ length: 60 }, (_, i) => ({ value: i, label: String(i).padStart(2,'0') }))" within-dialog class="w-20" />
          </div>

          <div v-if="form.frequency === 'weekly'">
            <div class="text-sm text-muted-foreground font-sans mb-1">{{ t('schedules.form.days') }}</div>
            <div class="flex flex-wrap gap-2">
              <label v-for="(label, idx) in DAYS" :key="idx"
                class="flex items-center gap-1 px-2 py-1 border border-border cursor-pointer text-sm font-sans select-none rounded-lg transition-colors duration-150"
                :class="selectedDays.includes(idx) ? 'bg-primary/20 text-primary border-primary/40' : 'text-muted-foreground hover:text-foreground hover:border-primary/30'">
                <BaseCheckbox :value="idx" v-model="selectedDays" />
                {{ label }}
              </label>
            </div>
          </div>
        </div>

        <div class="text-sm text-muted-foreground font-sans" v-if="form.frequency !== 'manual'">
          {{ scheduleDesc }}
        </div>

        <!-- Model selector -->
        <div>
          <label class="text-sm text-muted-foreground font-sans block mb-1">{{ t('schedules.form.selectModel') }}</label>
          <BaseSelect v-model="form.modelId" :options="models.map(m => ({ value: m.id, label: `${m.providerName} / ${m.name}` }))" :placeholder="t('schedules.form.selectModel')" within-dialog />
        </div>

        <!-- Project path -->
        <div>
          <label class="text-sm text-muted-foreground font-sans block mb-1">{{ t('schedules.form.projectPath') }}</label>
          <BaseSelect v-model="form.projectPath" :options="[{ value: '', label: t('schedules.form.noProject') }, ...savedProjects.map(p => ({ value: p.path, label: `${p.name} (${p.path})` }))]" within-dialog />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button @click="showForm = false" class="text-sm text-muted-foreground font-sans px-3 py-1.5 border border-border rounded-lg transition-colors duration-150 hover:text-foreground">{{ t('tasks.form.cancel') }}</button>
          <button @click="saveTask" class="text-sm text-primary-foreground font-sans px-3 py-1.5 rounded-lg bg-primary transition-colors duration-150 hover:bg-primary/90">{{ t('tasks.form.save') }}</button>
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
import BaseSelect from './BaseSelect.vue'
import BaseCheckbox from './BaseCheckbox.vue'
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
const runningId = ref<number | null>(null)

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
  projectPath: '',
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
  form.value = { name: '', description: '', prompt: '', frequency: 'manual', cronMinute: 0, cronHour: 0, cronDayOfWeek: 0, cronDaysOfWeek: '', modelId: null, projectPath: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
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

function statusBadgeClass(status: string): string {
  if (status === 'SUCCESS') return 'bg-success/10 text-success'
  if (status === 'FAILED') return 'bg-danger/10 text-danger'
  return 'bg-warning/10 text-warning'
}

function statusLabel(status: string): string {
  const key = status === 'SUCCESS' ? 'schedules.status.success' : status === 'FAILED' ? 'schedules.status.failed' : 'schedules.status.running'
  return t(key)
}

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
    projectPath: task.projectPath ?? '',
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
    const body = { ...form.value, projectPath: form.value.projectPath || null }
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
  runningId.value = id
  try {
    await api.runTask(id)
    tasks.value = await api.listTasks()
  } catch { /* ignore */ }
  runningId.value = null
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
