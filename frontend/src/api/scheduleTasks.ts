import { request } from './client'

export interface ScheduleTask {
  id: number
  name: string
  description: string | null
  prompt: string
  frequency: string
  cronMinute: number | null
  cronHour: number | null
  cronDayOfWeek: number | null
  cronDaysOfWeek: string | null
  modelId: number | null
  projectPath: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
  logs?: ScheduleTaskLog[]
}

export interface ScheduleTaskLog {
  id: number
  taskId: number
  sessionId: number | null
  status: string
  output: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export function listTasks() {
  return request<ScheduleTask[]>('/schedule-tasks', { errorCode: 'schedules.fetch_failed' })
}

export function createTask(body: Partial<ScheduleTask>) {
  return request<ScheduleTask>('/schedule-tasks', { method: 'POST', body, errorCode: 'schedules.save_failed' })
}

export function updateTask(id: number, body: Partial<ScheduleTask>) {
  return request<ScheduleTask>(`/schedule-tasks/${id}`, { method: 'PATCH', body, errorCode: 'schedules.save_failed' })
}

export function deleteTask(id: number) {
  return request<void>(`/schedule-tasks/${id}`, { method: 'DELETE', errorCode: 'schedules.delete_failed' })
}

export function runTask(id: number) {
  return request<ScheduleTaskLog>(`/schedule-tasks/${id}/run`, { method: 'POST', errorCode: 'schedules.run_failed' })
}

export function getTaskLogs(id: number) {
  return request<ScheduleTaskLog[]>(`/schedule-tasks/${id}/logs`, { errorCode: 'schedules.fetch_failed' })
}
