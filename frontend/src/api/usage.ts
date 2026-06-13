import { request } from './client'

export interface UsageTotal {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  requestCount: number
}

export interface SessionUsage {
  sessionId: number
  sessionTitle: string
  modelName: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export function getUsage() {
  return request<UsageTotal>('/usage', { errorCode: 'usage.fetch_failed' })
}

export function getUsageSessions() {
  return request<SessionUsage[]>('/usage/sessions', { errorCode: 'usage.fetch_failed' })
}
