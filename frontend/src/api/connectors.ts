import { request } from './client'

export interface Connector {
  id: string
  type: string
  connected: boolean
}

export function listConnectors() {
  return request<Connector[]>('/connectors', { errorCode: 'connectors.fetch_failed' })
}

export function getOAuthUrl(type: string) {
  return request<{ url: string }>(`/connectors/oauth/auth-url?type=${encodeURIComponent(type)}`, { errorCode: 'connectors.oauth_failed' })
}

export function deleteConnector(id: string) {
  return request<void>(`/connectors/${id}`, { method: 'DELETE', errorCode: 'connectors.delete_failed' })
}
