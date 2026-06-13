import { request } from './client'

export interface AgentOutputFile {
  filename: string
  size: number
  modifiedAt: string
}

export function listOutputs() {
  return request<AgentOutputFile[]>('/agent-output', { errorCode: 'agentOutput.fetch_failed' })
}

export function deleteOutput(filename: string) {
  return request<void>(`/agent-output/${encodeURIComponent(filename)}`, { method: 'DELETE', errorCode: 'agentOutput.delete_failed' })
}
