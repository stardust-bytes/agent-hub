import { request } from './client'

export function getHealth() {
  return request<{ status: string; db: string }>('/health', { errorCode: 'health.error' })
}
