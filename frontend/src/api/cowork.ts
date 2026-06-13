import { request, requestRaw } from './client'

export interface CoworkProject {
  id: string
  name: string
  path: string
}

export interface BrowseEntry {
  name: string
  isDirectory: boolean
}

export interface BrowseResult {
  path: string
  entries: BrowseEntry[]
}

export interface ReadFileResult {
  content: string
  filename: string
}

export function getProject() {
  return request<{ projectPath: string | null }>('/cowork/project', { errorCode: 'cowork.fetch_failed' })
}

export function listProjects() {
  return request<CoworkProject[]>('/cowork/projects', { errorCode: 'cowork.fetch_failed' })
}

export function setProject(path: string) {
  return requestRaw('/cowork/project', { method: 'POST', body: { path } })
}

export function saveProject(name: string, path: string) {
  return requestRaw('/cowork/projects', { method: 'POST', body: { name, path } })
}

export function deleteProject(id: string) {
  return requestRaw(`/cowork/projects/${id}`, { method: 'DELETE' })
}

export function readFile(path: string) {
  return request<ReadFileResult>(`/cowork/read-file?path=${encodeURIComponent(path)}`, { errorCode: 'cowork.fetch_failed' })
}

export function clearProject() {
  return requestRaw('/cowork/project', { method: 'DELETE' })
}

export function browse(path: string, signal?: AbortSignal) {
  return request<BrowseResult>(`/cowork/browse?path=${encodeURIComponent(path)}`, { errorCode: 'cowork.fetch_failed', signal })
}
