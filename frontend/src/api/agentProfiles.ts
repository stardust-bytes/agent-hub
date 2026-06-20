import { request } from './client'

export interface AgentProfile {
  id: number
  slug: string
  name: string
  description?: string | null
  systemPrompt: string
  allowedTools: string
  modelId?: number | null
  enabled: boolean
  builtin: boolean
}

type ProfileBody = Omit<AgentProfile, 'id' | 'builtin'>

export function listAgentProfiles() {
  return request<AgentProfile[]>('/agent-profiles', { errorCode: 'agents.fetch_failed' })
}
export function createAgentProfile(body: ProfileBody) {
  return request<AgentProfile>('/agent-profiles', { method: 'POST', body, errorCode: 'agents.save_failed' })
}
export function updateAgentProfile(id: number, body: Partial<ProfileBody>) {
  return request<AgentProfile>(`/agent-profiles/${id}`, { method: 'PATCH', body, errorCode: 'agents.save_failed' })
}
export function deleteAgentProfile(id: number) {
  return request<void>(`/agent-profiles/${id}`, { method: 'DELETE', errorCode: 'agents.delete_failed' })
}
