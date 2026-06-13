import { request } from './client'

export interface AgentOutputFile {
  filename: string
  size: number
  modifiedAt: string
}

export function listOutputs() {
  return request<AgentOutputFile[]>('/agent-output', { errorCode: 'agentOutput.fetch_failed' })
}
