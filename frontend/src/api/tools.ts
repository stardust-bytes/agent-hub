import { request, requestRaw } from './client'

export interface Tool {
  name: string
  description: string
  configSchema?: string | null
  config?: string | null
  enabled: boolean
}

export function listTools() {
  return request<Tool[]>('/tools', { errorCode: 'tools.fetch_failed' })
}

export function toggleTool(name: string) {
  return requestRaw(`/tools/${name}/toggle`, { method: 'PATCH' })
}

export function saveToolConfig(name: string, config: Record<string, string>) {
  return requestRaw(`/tools/${name}/config`, { method: 'PATCH', body: { config } })
}
