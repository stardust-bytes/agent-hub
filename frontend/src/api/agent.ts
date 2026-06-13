import { request, requestRaw } from './client'

export interface YoloConfig {
  failClosed: boolean
  safeToolAllowlist: boolean
  disabledPatterns: string[]
}

export function getYoloConfig() {
  return request<YoloConfig>('/agent/yolo-config', { errorCode: 'agent.fetch_failed' })
}

export function setYoloConfig(body: YoloConfig) {
  return requestRaw('/agent/yolo-config', { method: 'PATCH', body })
}
