import type { Message, PlanData, PlanStep } from '../components/chat/types'

export interface StoredMessage {
  role: string
  content: string
  createdAt: string
  toolName?: string
  isResult?: boolean
}

function dateToTimestamp(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('vi-VN', { hour12: false })
}

export async function loadSessionMessages(
  sessionId: number,
  getSessionMessages: (id: number) => Promise<StoredMessage[]>,
  getPlan: (id: number) => Promise<PlanData>,
  now: () => string,
): Promise<Message[]> {
  const history = await getSessionMessages(sessionId)
  const result: Message[] = []

  for (const msg of history) {
    if (msg.toolName != null) {
      result.push({
        role: 'tool',
        content: msg.content,
        timestamp: dateToTimestamp(msg.createdAt),
        toolName: msg.toolName,
        isResult: msg.isResult ?? false,
      })
    } else if (msg.role === 'system') {
      result.push({
        role: 'system',
        content: msg.content,
        timestamp: dateToTimestamp(msg.createdAt),
      })
    } else if (msg.role === 'plan') {
      try {
        const planData = JSON.parse(msg.content) as PlanData
        const planForDisplay: PlanData = {
          ...planData,
          steps: planData.steps.map(s => ({ ...s })),
        }
        try {
          const fresh = await getPlan(planData.id)
          planForDisplay.status = fresh.status
          if (fresh.steps) {
            for (const fs of fresh.steps) {
              const step = planForDisplay.steps.find(s => s.id === fs.id)
              if (step) step.status = fs.status
            }
          }
        } catch { /* use saved data */ }
        if (planForDisplay.status === 'EXECUTING' && planForDisplay.steps.every(s => s.status === 'DONE' || s.status === 'FAILED')) {
          planForDisplay.status = 'DONE'
        }
        result.push({
          role: 'plan',
          content: '',
          timestamp: dateToTimestamp(msg.createdAt),
          plan: planForDisplay,
        })
      } catch {
        result.push({ role: 'system', content: msg.content, timestamp: dateToTimestamp(msg.createdAt) })
      }
    } else {
      const mappedRole = msg.role === 'assistant' ? 'agent' : msg.role
      result.push({
        role: mappedRole as 'user' | 'agent',
        content: msg.content,
        timestamp: dateToTimestamp(msg.createdAt),
      })
    }
  }

  return result
}
