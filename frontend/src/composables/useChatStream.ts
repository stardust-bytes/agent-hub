export interface PlanStep { id: number; order: number; text: string; status: string }
export interface PlanData { id: number; title: string; status: string; steps: PlanStep[] }

export interface SubagentEvent {
  done?: boolean
  token?: string
  toolCall?: { name: string; args: Record<string, unknown> }
  toolResult?: { name: string; result: string }
  thinking?: string
  toolApprovalRequired?: { id: string; name: string; args: Record<string, unknown> }
  subagentName?: string
  subagentRunId?: string
}

export interface SseCallbacks {
  onToken: (token: string) => void
  onToolCall: (name: string, args: Record<string, unknown>) => void
  onToolResult: (name: string, result: string) => void
  onToolApprovalRequired?: (id: string, name: string, args: Record<string, unknown>) => void
  onThinking: (text: string) => void
  onPlan: (plan: PlanData) => void
  onPlanStepUpdate: (planId: number, stepId: number, status: string) => void
  onPlanInterrupted: (planId: number, reason: string) => void
  onSubagent: (ev: SubagentEvent) => void
  onDelegateProgress: (index: number, subtask: string, status: string) => void
  onDelegateResult: (count: number) => void
  onError: (error: string) => void
  onDone: () => void
}

export async function parseSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  cb: SseCallbacks,
): Promise<void> {
  const decoder = new TextDecoder()
  let buf = ''
  let done = false
  while (!done) {
    const { done: streamDone, value } = await reader.read()
    if (streamDone) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)
      if (payload === '[DONE]') { cb.onDone(); done = true; break }
      try {
        const p = JSON.parse(payload) as Record<string, unknown>
        if (p.error) { cb.onError(String(p.error)); done = true; break }
        else if (p.toolApprovalRequired) { const { id, name, args } = p.toolApprovalRequired as { id: string; name: string; args: Record<string, unknown> }; cb.onToolApprovalRequired?.(id, name, args) }
        else if (p.subagent) cb.onSubagent(p as unknown as SubagentEvent)
        else if (p.toolCall) { const tc = p.toolCall as { name: string; args: Record<string, unknown> }; cb.onToolCall(tc.name, tc.args) }
        else if (p.toolResult) { const tr = p.toolResult as { name: string; result: string }; cb.onToolResult(tr.name, tr.result) }
        else if (p.thinking) cb.onThinking(String(p.thinking))
        else if (p.plan) cb.onPlan(p.plan as PlanData)
        else if (p.planStepUpdate) { const u = p.planStepUpdate as { planId: number; stepId: number; status: string }; cb.onPlanStepUpdate(u.planId, u.stepId, u.status) }
        else if (p.planInterrupted) { const i = p.planInterrupted as { planId: number; reason: string }; cb.onPlanInterrupted(i.planId, i.reason) }
        else if (p.delegateProgress) { const d = p.delegateProgress as { index: number; subtask: string; status: string }; cb.onDelegateProgress(d.index, d.subtask, d.status) }
        else if (p.delegateResult) { const d = p.delegateResult as { count: number }; cb.onDelegateResult(d.count) }
        else if (p.token) cb.onToken(String(p.token))
      } catch { /* skip malformed */ }
    }
  }
}
