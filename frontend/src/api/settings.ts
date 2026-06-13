import { request, requestRaw } from './client'

export function listSettings() {
  return request<Record<string, string>>('/settings', { errorCode: 'settings.fetch_failed' })
}

export function updateSetting(key: string, value: string) {
  return requestRaw(`/settings/${key}`, { method: 'PATCH', body: { value } })
}
