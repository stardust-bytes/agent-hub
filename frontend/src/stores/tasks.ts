import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/tasks'
import type { Task } from '../api/types'
import { errorCode } from '../api/client'

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    try { tasks.value = await api.listTasks() }
    catch (e) { error.value = errorCode(e) }
  }

  function upsert(task: Task) {
    const i = tasks.value.findIndex(t => t.id === task.id)
    if (i === -1) tasks.value.push(task)
    else tasks.value[i] = task
  }

  function removeLocal(id: number) {
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  async function updateStatus(id: number, status: Task['status']) {
    return api.updateTask(id, { status })
  }

  async function create(body: Partial<Task>) { return api.createTask(body) }
  async function update(id: number, body: Partial<Task>) { return api.updateTask(id, body) }
  async function remove(id: number) { await api.deleteTask(id); removeLocal(id) }

  return { tasks, error, load, upsert, removeLocal, updateStatus, create, update, remove }
})
