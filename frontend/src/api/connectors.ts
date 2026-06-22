import { request } from './client'

export interface Connector {
  id: string
  type: string
  config: string
  account: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export function listConnectors() {
  return request<Connector[]>('/connectors', { errorCode: 'connectors.fetch_failed' })
}

export function upsertConnector(type: string, data: { name?: string; config?: Record<string, unknown>; enabled?: boolean }) {
  return request<Connector>('/connectors', {
    method: 'POST',
    body: { type, ...data },
    errorCode: 'connectors.upsert_failed',
  })
}

export function updateConnector(id: string, data: { config?: Record<string, unknown>; enabled?: boolean }) {
  return request<Connector>(`/connectors/${id}`, {
    method: 'PATCH',
    body: data,
    errorCode: 'connectors.upsert_failed',
  })
}

export function getOAuthUrl(type: string) {
  return request<{ url: string }>(`/connectors/oauth/auth-url?type=${encodeURIComponent(type)}`, { errorCode: 'connectors.oauth_failed' })
}

export function confirmOAuth(state: string, code: string) {
  return request<{ ok: boolean }>('/connectors/oauth/confirm', {
    method: 'POST',
    body: { state, code },
    errorCode: 'connectors.oauth_confirm_failed',
  })
}

export function deleteConnector(id: string) {
  return request<void>(`/connectors/${id}`, { method: 'DELETE', errorCode: 'connectors.delete_failed' })
}
