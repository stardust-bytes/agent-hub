import { describe, it, expect, vi } from 'vitest'
import { parseSseStream, type SseCallbacks } from './useChatStream'

function readerFrom(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const enc = new TextEncoder()
  let i = 0
  return {
    read: async () => i < chunks.length
      ? { done: false, value: enc.encode(chunks[i++]) }
      : { done: true, value: undefined },
    releaseLock: () => {},
    cancel: async () => {},
    closed: Promise.resolve(undefined),
  } as unknown as ReadableStreamDefaultReader<Uint8Array>
}

function spyCallbacks(): SseCallbacks {
  return {
    onToken: vi.fn(), onToolCall: vi.fn(), onToolResult: vi.fn(),
    onThinking: vi.fn(), onPlan: vi.fn(), onPlanStepUpdate: vi.fn(),
    onPlanInterrupted: vi.fn(), onSubagent: vi.fn(),
    onDelegateProgress: vi.fn(), onDelegateResult: vi.fn(),
    onError: vi.fn(), onDone: vi.fn(),
  }
}

describe('parseSseStream', () => {
  it('emits tokens in order', async () => {
    const cb = spyCallbacks()
    await parseSseStream(readerFrom(['data: {"token":"Hel"}\n', 'data: {"token":"lo"}\n', 'data: [DONE]\n']), cb)
    expect((cb.onToken as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0])).toEqual(['Hel', 'lo'])
    expect(cb.onDone).toHaveBeenCalledOnce()
  })

  it('routes a tool call with parsed args', async () => {
    const cb = spyCallbacks()
    await parseSseStream(readerFrom(['data: {"toolCall":{"name":"read","args":{"path":"a"}}}\n', 'data: [DONE]\n']), cb)
    expect(cb.onToolCall).toHaveBeenCalledWith('read', { path: 'a' })
  })

  it('handles a payload split across chunks', async () => {
    const cb = spyCallbacks()
    await parseSseStream(readerFrom(['data: {"tok', 'en":"x"}\n', 'data: [DONE]\n']), cb)
    expect(cb.onToken).toHaveBeenCalledWith('x')
  })

  it('skips malformed json lines without throwing', async () => {
    const cb = spyCallbacks()
    await parseSseStream(readerFrom(['data: {bad\n', 'data: {"token":"ok"}\n', 'data: [DONE]\n']), cb)
    expect(cb.onToken).toHaveBeenCalledWith('ok')
  })

  it('routes error events', async () => {
    const cb = spyCallbacks()
    await parseSseStream(readerFrom(['data: {"error":"boom"}\n']), cb)
    expect(cb.onError).toHaveBeenCalledWith('boom')
  })
})
