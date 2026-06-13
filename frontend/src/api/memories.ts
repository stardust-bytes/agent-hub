import { request, requestRaw } from './client'

export interface Memory {
  id: string
  type: string
  title: string
  content: string
  metadata?: string
  sessionId?: number | null
  createdAt: string
}

export function listMemories() {
  return request<Memory[]>('/memories', { errorCode: 'memories.fetch_failed' })
}

export function createMemory(body: { type: string; title: string; content: string }) {
  return requestRaw('/memories', { method: 'POST', body })
}

export function updateMemory(id: string, body: { type: string; title: string; content: string }) {
  return requestRaw(`/memories/${id}`, { method: 'PATCH', body })
}

export function deleteMemory(id: string) {
  return requestRaw(`/memories/${id}`, { method: 'DELETE' })
}
