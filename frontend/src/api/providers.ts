import { request } from './client'
import type { ProviderModelFlat } from './types'

export interface Provider {
  id: number
  name: string
  baseUrl: string | null
  models?: ProviderModelFlat[]
}

export function listProviders() {
  return request<Provider[]>('/providers', { errorCode: 'providers.fetch_failed' })
}

export function listModels() {
  return request<ProviderModelFlat[]>('/providers/models', { errorCode: 'providers.fetch_failed' })
}

export function createProvider(body: { name: string; baseUrl?: string; key?: string }) {
  return request<Provider>('/providers', { method: 'POST', body, errorCode: 'providers.save_failed' })
}

export function updateProvider(id: number, body: { name: string; baseUrl?: string; key?: string }) {
  return request<Provider>(`/providers/${id}`, { method: 'PATCH', body, errorCode: 'providers.save_failed' })
}

export function deleteProvider(id: number) {
  return request<void>(`/providers/${id}`, { method: 'DELETE', errorCode: 'providers.delete_failed' })
}

export function syncModels(providerId: number) {
  return request<void>(`/providers/${providerId}/sync-models`, { method: 'POST', errorCode: 'providers.sync_failed' })
}

export function addModel(providerId: number, body: { name: string }) {
  return request<ProviderModelFlat>(`/providers/${providerId}/models`, { method: 'POST', body, errorCode: 'providers.save_failed' })
}

export function deleteModel(providerId: number, modelId: number) {
  return request<void>(`/providers/${providerId}/models/${modelId}`, { method: 'DELETE', errorCode: 'providers.delete_failed' })
}
