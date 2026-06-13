<template>
  <div class="flex flex-col bg-cyber-bg min-w-0 h-full">
    <div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-cyber-code-border shrink-0 bg-cyber-dark">
      <button @click="router.push('/tasks')" class="flex items-center gap-1 text-sm text-cyber-muted font-mono hover:text-cyber-accent transition-colors duration-150"><HiArrowLeft class="w-3 h-3" /> {{ t('schedules.detail.back') }}</button>
      <span class="text-sm text-cyber-accent font-mono ml-2 truncate">{{ task?.name || t('schedules.detail.loading') }}</span>
      <div class="ml-auto flex gap-1">
        <button @click="runNow(task!.id)" class="flex items-center gap-1 text-sm text-cyber-accent/70 font-mono px-2 py-0.5 border border-cyber-code-border transition-colors duration-150 hover:text-cyber-accent"><HiPlay class="w-3 h-3" /> {{ t('schedules.runNow') }}</button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-4">
      <div class="border border-cyber-code-border bg-cyber-dark p-3">
        <div class="grid grid-cols-2 gap-3 text-sm font-mono">
          <div><span class="text-cyber-muted">{{ t('schedules.form.name') }}:</span> <span class="text-cyber-text">{{ task?.name }}</span></div>
          <div><span class="text-cyber-muted">{{ t('schedules.form.description') }}:</span> <span class="text-cyber-text">{{ task?.description || '&mdash;' }}</span></div>
          <div><span class="text-cyber-muted">{{ t('schedules.frequency') }}:</span> <span class="text-cyber-text">{{ task ? t(`schedules.frequency.${task.frequency}`) : '' }} {{ scheduleTime(task) }}</span></div>
          <div><span class="text-cyber-muted">{{ t('schedules.model') }}:</span> <span class="text-cyber-text">{{ task?.modelId || '&mdash;' }}</span></div>
          <div><span class="text-cyber-muted">{{ t('schedules.form.projectPath') }}:</span> <span class="text-cyber-text">{{ task?.projectPath || '&mdash;' }}</span></div>
          <div><span class="text-cyber-muted">{{ t('schedules.timezone') }}:</span> <span class="text-cyber-text">{{ task?.timezone || 'UTC' }}</span></div>
          <div class="col-span-2"><span class="text-cyber-muted">{{ t('schedules.form.prompt') }}:</span></div>
          <div class="col-span-2 text-cyber-text bg-cyber-code-bg p-2 whitespace-pre-wrap text-sm font-mono">{{ task?.prompt }}</div>
        </div>
      </div>

      <div class="border border-cyber-code-border bg-cyber-dark">
        <div class="px-3 py-2 border-b border-cyber-code-border">
          <span class="text-sm text-cyber-accent font-mono">{{ t('schedules.logs.header') }}</span>
        </div>
        <div v-if="logs.length === 0" class="px-3 py-4 text-sm text-cyber-muted font-mono text-center">{{ t('schedules.logs.empty') }}</div>
        <div v-for="log in logs" :key="log.id" @click="expandedLog = expandedLog === log.id ? null : log.id"
          class="px-3 py-2 border-b border-cyber-code-border last:border-0 cursor-pointer hover:bg-cyber-bg/30 transition-colors duration-150">
          <div class="flex items-center gap-3 text-sm font-mono">
            <span class="text-cyber-muted shrink-0">{{ log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : '' }}</span>
            <span class="shrink-0" :class="log.status === 'SUCCESS' ? 'text-cyber-green' : log.status === 'FAILED' ? 'text-red-400' : 'text-cyber-orange'">{{ log.status }}</span>
            <span v-if="log.startedAt && log.completedAt" class="text-cyber-muted shrink-0">{{ Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000) }}s</span>
            <span v-if="log.sessionId" class="text-cyber-accent/60 shrink-0">#{{ log.sessionId }}</span>
          </div>
          <div v-if="expandedLog === log.id && log.output" class="mt-2 text-sm text-cyber-text font-mono whitespace-pre-wrap bg-cyber-code-bg p-2 break-all">{{ log.output }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { HiArrowLeft, HiPlay } from 'vue-icons-plus/hi'
import * as api from '../api/scheduleTasks'
import type { ScheduleTask, ScheduleTaskLog } from '../api/scheduleTasks'

const props = defineProps<{ id: string }>()
const router = useRouter()
const { t } = useI18n()

const task = ref<ScheduleTask | null>(null)
const logs = ref<ScheduleTaskLog[]>([])
const expandedLog = ref<number | null>(null)

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function scheduleTime(t: ScheduleTask | null): string {
  if (!t) return ''
  const mm = String(t.cronMinute ?? 0).padStart(2, '0')
  const hh = String(t.cronHour ?? 0).padStart(2, '0')
  if (t.frequency === 'hourly') return `:${mm}`
  if (t.frequency === 'daily') return `${hh}:${mm}`
  if (t.frequency === 'weekdays') return `${hh}:${mm}`
  if (t.frequency === 'weekly') {
    const days = t.cronDaysOfWeek
      ? t.cronDaysOfWeek.split(',').map(Number).map(d => DAYS[d]).join(',')
      : DAYS[t.cronDayOfWeek ?? 0]
    return `${days} ${hh}:${mm}`
  }
  return ''
}

onMounted(async () => {
  try {
    const tasks = await api.listTasks()
    task.value = tasks.find((t: ScheduleTask) => t.id === Number(props.id)) ?? null
  } catch { /* ignore */ }
  try {
    logs.value = await api.getTaskLogs(Number(props.id))
  } catch { /* ignore */ }
})

async function runNow(id: number) {
  try {
    await api.runTask(id)
    logs.value = await api.getTaskLogs(Number(props.id))
  } catch { /* ignore */ }
}
</script>
