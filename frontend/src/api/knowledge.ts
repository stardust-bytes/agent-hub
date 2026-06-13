import { request, requestRaw } from './client'

export interface KnowledgeFile {
  id: number
  filename: string
  size: number
  mimeType: string
  status: string
  chunkCount: number
  createdAt: string
  errorMessage?: string
}

export function listKnowledge() {
  return request<KnowledgeFile[]>('/knowledge', { errorCode: 'knowledge.fetch_failed' })
}

export function deleteKnowledge(id: number) {
  return requestRaw(`/knowledge/${id}`, { method: 'DELETE' })
}

// FormData must NOT get a JSON Content-Type header — the browser sets the
// multipart boundary automatically. requestRaw always adds application/json,
// so this endpoint bypasses it and calls fetch directly.
export function uploadKnowledge(form: FormData) {
  return fetch('/api/knowledge/upload', { method: 'POST', body: form })
}
