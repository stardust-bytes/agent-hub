import { describe, it, expect, vi } from 'vitest'
import { loadSessionMessages, type StoredMessage } from './useSessionMessages'
import type { PlanData } from '../components/cowork/types'

describe('loadSessionMessages', () => {
  const now = () => '12:00:00'

  it('maps assistant role to agent', async () => {
    const stored: StoredMessage[] = [
      { role: 'assistant', content: 'hello', createdAt: '2024-01-01T00:00:00Z' },
    ]
    const result = await loadSessionMessages(1, () => Promise.resolve(stored), () => Promise.reject(), now)
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('agent')
    expect(result[0].content).toBe('hello')
  })

  it('maps user role as-is', async () => {
    const stored: StoredMessage[] = [
      { role: 'user', content: 'hi', createdAt: '2024-01-01T00:00:00Z' },
    ]
    const result = await loadSessionMessages(1, () => Promise.resolve(stored), () => Promise.reject(), now)
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('user')
  })

  it('maps tool messages correctly', async () => {
    const stored: StoredMessage[] = [
      { role: 'user', content: 'do something', createdAt: '2024-01-01T00:00:00Z' },
      { role: 'assistant', content: 'thinking...', createdAt: '2024-01-01T00:00:01Z', toolName: 'read_file', isResult: false },
      { role: 'assistant', content: 'file content', createdAt: '2024-01-01T00:00:02Z', toolName: 'read_file', isResult: true },
    ]
    const result = await loadSessionMessages(1, () => Promise.resolve(stored), () => Promise.reject(), now)
    expect(result).toHaveLength(3)
    expect(result[0].role).toBe('user')
    expect(result[1].role).toBe('tool')
    expect(result[1].toolName).toBe('read_file')
    expect(result[1].isResult).toBe(false)
    expect(result[2].role).toBe('tool')
    expect(result[2].toolName).toBe('read_file')
    expect(result[2].isResult).toBe(true)
  })

  it('maps plan messages with fresh status', async () => {
    const planId = 42
    const stored: StoredMessage[] = [
      { role: 'plan', content: JSON.stringify({ id: planId, title: 'Test', status: 'EXECUTING', steps: [{ id: 1, order: 1, text: 'Step 1', status: 'DONE' }] }), createdAt: '2024-01-01T00:00:00Z' },
    ]
    const getPlan = vi.fn().mockResolvedValue({ id: planId, title: 'Test', status: 'DONE', steps: [{ id: 1, order: 1, text: 'Step 1', status: 'DONE' }] } as PlanData)
    const result = await loadSessionMessages(1, () => Promise.resolve(stored), getPlan, now)
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('plan')
    expect(result[0].plan?.status).toBe('DONE')
  })

  it('transitions EXECUTING to DONE when all steps are done', async () => {
    const planId = 42
    const stored: StoredMessage[] = [
      { role: 'plan', content: JSON.stringify({ id: planId, title: 'Test', status: 'EXECUTING', steps: [{ id: 1, order: 1, text: 'Step 1', status: 'DONE' }] }), createdAt: '2024-01-01T00:00:00Z' },
    ]
    const getPlan = vi.fn().mockRejectedValue(new Error('not found'))
    const result = await loadSessionMessages(1, () => Promise.resolve(stored), getPlan, now)
    expect(result[0].plan?.status).toBe('DONE')
  })

  it('keeps EXECUTING when some steps are not done', async () => {
    const planId = 42
    const stored: StoredMessage[] = [
      { role: 'plan', content: JSON.stringify({ id: planId, title: 'Test', status: 'EXECUTING', steps: [{ id: 1, order: 1, text: 'Step 1', status: 'DOING' }, { id: 2, order: 2, text: 'Step 2', status: 'DONE' }] }), createdAt: '2024-01-01T00:00:00Z' },
    ]
    const getPlan = vi.fn().mockRejectedValue(new Error('not found'))
    const result = await loadSessionMessages(1, () => Promise.resolve(stored), getPlan, now)
    expect(result[0].plan?.status).toBe('EXECUTING')
  })

  it('handles system messages', async () => {
    const stored: StoredMessage[] = [
      { role: 'system', content: 'agent started', createdAt: '2024-01-01T00:00:00Z' },
    ]
    const result = await loadSessionMessages(1, () => Promise.resolve(stored), () => Promise.reject(), now)
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('system')
    expect(result[0].content).toBe('agent started')
  })

  it('handles malformed plan content gracefully', async () => {
    const stored: StoredMessage[] = [
      { role: 'plan', content: 'not-json', createdAt: '2024-01-01T00:00:00Z' },
    ]
    const result = await loadSessionMessages(1, () => Promise.resolve(stored), () => Promise.reject(), now)
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('system')
  })
})
