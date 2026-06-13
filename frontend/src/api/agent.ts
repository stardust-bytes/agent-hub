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

export interface PermissionsConfig {
  defaultPolicy: 'allow' | 'deny'
  allowedTools: string[]
  deniedTools: string[]
  permissionMode: string
  requireApprovalTools: string[]
}

export function getPermissions() {
  return request<PermissionsConfig>('/agent/permissions')
}

export function updatePermissions(body: Partial<PermissionsConfig>) {
  return request<PermissionsConfig>('/agent/permissions', { method: 'PATCH', body })
}
