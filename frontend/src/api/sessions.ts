import { request } from './client'
import type { SessionSummary, StoredMessage } from './types'

export function listSessions(mode?: string) {
  const q = mode ? `?mode=${encodeURIComponent(mode)}` : ''
  return request<SessionSummary[]>(`/sessions${q}`, { errorCode: 'sessions.fetch_failed' })
}

export function createSession() {
  return request<{ id: number }>('/sessions', { method: 'POST', errorCode: 'sessions.create_failed' })
}

export function deleteSession(id: number) {
  return request<void>(`/sessions/${id}`, { method: 'DELETE', errorCode: 'sessions.delete_failed' })
}

export function getSessionMessages(id: number) {
  return request<StoredMessage[]>(`/sessions/${id}/messages`, { errorCode: 'sessions.fetch_failed' })
}
