import { request } from './client'

export interface SkillItem {
  name: string
  description: string
  content: string
}

export function listSkills(): Promise<SkillItem[]> {
  return request('/skills')
}

export function getSkill(name: string): Promise<SkillItem> {
  return request(`/skills/${encodeURIComponent(name)}`)
}

export function createSkill(data: SkillItem): Promise<SkillItem> {
  return request('/skills', { method: 'POST', body: data })
}

export function updateSkill(name: string, data: SkillItem): Promise<SkillItem> {
  return request(`/skills/${encodeURIComponent(name)}`, { method: 'PATCH', body: data })
}

export function deleteSkill(name: string): Promise<void> {
  return request(`/skills/${encodeURIComponent(name)}`, { method: 'DELETE' })
}
