export interface ProviderModelFlat {
  id: number
  name: string
  providerName: string
  providerId: number
}

export interface SessionSummary {
  id: number
  title: string
  createdAt: string
  mode: string
  _count?: { messages: number }
}

export interface StoredMessage {
  role: string
  content: string
  createdAt: string
  toolName?: string
  isResult?: boolean
}

export interface Task {
  id: number
  title: string
  description?: string | null
  status: 'TODO' | 'PROCESSING' | 'DONE' | 'FAILED'
  priority: number
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}
