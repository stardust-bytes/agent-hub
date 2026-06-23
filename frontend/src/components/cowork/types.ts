export interface PlanStep {
  id: number
  order: number
  text: string
  status: string
}

export interface PlanData {
  id: number
  title: string
  status: string
  steps: PlanStep[]
}

export interface Message {
  role: 'user' | 'agent' | 'system' | 'tool' | 'plan'
  content: string
  timestamp: string
  typing?: boolean
  toolName?: string
  isResult?: boolean
  plan?: PlanData
  images?: { url: string; filename: string }[]
}

export interface ChatAttachment {
  id: string | number
  filename: string
  size: number
  mimeType: string
  url?: string
  status: 'uploading' | 'uploaded' | 'error'
}

export interface ProviderModelFlat {
  id: number
  name: string
  providerName: string
  providerId: number
}

export interface MessageSegment {
  type: 'markdown' | 'form'
  content: string
}
