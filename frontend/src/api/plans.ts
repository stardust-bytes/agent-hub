import { request, requestRaw } from './client'

export interface PlanStep { id: number; order: number; text: string; status: string }
export interface PlanData { id: number; title: string; status: string; steps: PlanStep[] }

export function getPlan(id: number) {
  return request<PlanData>(`/plans/${id}`, { errorCode: 'plans.fetch_failed' })
}
export function getNextPlan(sessionId: number) {
  return request<{ found: boolean; plan?: PlanData; action?: string }>(`/plans/session/${sessionId}/next`, { errorCode: 'plans.fetch_failed' })
}
export function listSessionPlans(sessionId: number) {
  return request<PlanData[]>(`/plans/session/${sessionId}`, { errorCode: 'plans.fetch_failed' })
}
export function executePlan(planId: number, providerModelId: number, sessionId: number) {
  return requestRaw(`/agent/plans/${planId}/execute`, { method: 'POST', body: { providerModelId, sessionId } })
}
