import { request } from './client'

export interface PlanStep { id: number; order: number; text: string; status: string }
export interface PlanData { id: number; title: string; status: string; steps: PlanStep[] }

export function getPlan(id: number) {
  return request<PlanData>(`/plans/${id}`, { errorCode: 'plans.fetch_failed' })
}
