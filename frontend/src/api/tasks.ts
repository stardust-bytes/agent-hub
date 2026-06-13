import { request } from './client'
import type { Task } from './types'

export function listTasks() {
  return request<Task[]>('/tasks', { errorCode: 'tasks.fetch_failed' })
}

export function createTask(body: Partial<Task>) {
  return request<Task>('/tasks', { method: 'POST', body, errorCode: 'tasks.save_failed' })
}

export function updateTask(id: number, body: Partial<Task>) {
  return request<Task>(`/tasks/${id}`, { method: 'PATCH', body, errorCode: 'tasks.save_failed' })
}

export function deleteTask(id: number) {
  return request<void>(`/tasks/${id}`, { method: 'DELETE', errorCode: 'tasks.delete_failed' })
}
