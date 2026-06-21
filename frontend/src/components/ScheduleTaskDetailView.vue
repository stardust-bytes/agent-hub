<template>
  <div class="flex flex-col bg-background min-w-0 h-full">
    <div class="mx-auto max-w-5xl w-full px-6 pt-4 pb-4">
      <div class="flex items-center gap-1 text-xs font-mono text-muted-foreground mb-2">
        <button @click="router.push('/tasks')" class="hover:text-primary transition-colors">{{ t('schedules.header') }}</button>
        <span class="text-input">/</span>
        <span class="text-foreground truncate">{{ task?.name || t('schedules.detail.loading') }}</span>
      </div>
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
          <HiPlay class="w-4 h-4" />
        </div>
        <span class="text-lg font-bold text-foreground tracking-tight truncate">{{ task?.name || t('schedules.detail.loading') }}</span>
        <span v-if="logs.length > 0" class="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">{{ logs.length }} runs</span>
        <div class="ml-auto flex gap-2">
          <button @click="runNow(task!.id)" class="text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors duration-150 px-2.5 py-1">{{ t('schedules.runNow') }}</button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto mx-auto max-w-5xl w-full px-6 pb-6 space-y-4">
      <div class="border border-border rounded-lg bg-surface p-3">
        <div class="grid grid-cols-2 gap-3 text-sm font-mono">
          <div><span class="text-muted-foreground">{{ t('schedules.form.name') }}:</span> <span class="text-foreground">{{ task?.name }}</span></div>
          <div><span class="text-muted-foreground">{{ t('schedules.form.description') }}:</span> <span class="text-foreground">{{ task?.description || '&mdash;' }}</span></div>
          <div><span class="text-muted-foreground">{{ t('schedules.frequency') }}:</span> <span class="text-foreground">{{ task ? t(`schedules.frequency.${task.frequency}`) : '' }} {{ scheduleTime(task) }}</span></div>
          <div><span class="text-muted-foreground">{{ t('schedules.model') }}:</span> <span class="text-foreground">{{ task?.modelId || '&mdash;' }}</span></div>
          <div><span class="text-muted-foreground">{{ t('schedules.form.projectPath') }}:</span> <span class="text-foreground">{{ task?.projectPath || '&mdash;' }}</span></div>
          <div><span class="text-muted-foreground">{{ t('schedules.timezone') }}:</span> <span class="text-foreground">{{ task?.timezone || 'UTC' }}</span></div>
          <div class="col-span-2"><span class="text-muted-foreground">{{ t('schedules.form.prompt') }}:</span></div>
          <div class="col-span-2 text-foreground bg-muted rounded-lg p-2 whitespace-pre-wrap text-sm font-mono">{{ task?.prompt }}</div>
        </div>
      </div>

      <div class="border border-border rounded-lg bg-surface overflow-hidden">
        <div class="px-3 py-2 border-b border-border">
          <span class="text-sm text-foreground font-semibold">{{ t('schedules.logs.header') }}</span>
        </div>
        <div v-if="logs.length === 0" class="px-3 py-4 text-sm text-muted-foreground font-mono text-center">{{ t('schedules.logs.empty') }}</div>
        <div v-for="log in logs" :key="log.id" @click="expandedLog = expandedLog === log.id ? null : log.id"
          class="px-3 py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 transition-colors duration-150">
          <div class="flex items-center gap-3 text-sm font-mono">
            <span class="text-muted-foreground shrink-0">{{ log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : '' }}</span>
            <span class="shrink-0" :class="log.status === 'SUCCESS' ? 'text-success' : log.status === 'FAILED' ? 'text-danger' : 'text-warning'">{{ log.status }}</span>
            <span v-if="log.startedAt && log.completedAt" class="text-muted-foreground shrink-0">{{ Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000) }}s</span>
            <span v-if="log.sessionId" class="text-primary/60 shrink-0">#{{ log.sessionId }}</span>
          </div>
          <div v-if="expandedLog === log.id && log.output" class="mt-2 text-sm text-foreground font-mono whitespace-pre-wrap bg-muted rounded-lg p-2 break-all">{{ log.output }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { HiPlay } from 'vue-icons-plus/hi'
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
