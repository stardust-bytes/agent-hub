import { request } from './client'

export interface Note {
  id: number
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export function listNotes() {
  return request<Note[]>('/notes', { errorCode: 'notes.fetch_failed' })
}

export function createNote(body: { title: string; content: string }) {
  return request<Note>('/notes', { method: 'POST', body, errorCode: 'notes.save_failed' })
}

export function updateNote(id: number, body: { title: string; content: string }) {
  return request<Note>(`/notes/${id}`, { method: 'PATCH', body, errorCode: 'notes.save_failed' })
}

export function deleteNote(id: number) {
  return request<void>(`/notes/${id}`, { method: 'DELETE', errorCode: 'notes.delete_failed' })
}
