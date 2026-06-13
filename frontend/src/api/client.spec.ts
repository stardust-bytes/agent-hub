import { describe, it, expect, vi, afterEach } from 'vitest'
import { request, AppError } from './client'

afterEach(() => { vi.restoreAllMocks() })

describe('request', () => {
  it('prepends /api and parses JSON on success', async () => {
    const json = vi.fn().mockResolvedValue({ ok: 1 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json }))
    const result = await request<{ ok: number }>('/health')
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({ method: 'GET' }))
    expect(result).toEqual({ ok: 1 })
  })

  it('serializes a JSON body and sets the content-type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue({}) })
    vi.stubGlobal('fetch', fetchMock)
    await request('/tasks', { method: 'POST', body: { title: 'x' } })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ title: 'x' }))
  })

  it('throws AppError with the given code on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: vi.fn() }))
    await expect(request('/health', { errorCode: 'health.failed' }))
      .rejects.toMatchObject({ code: 'health.failed' } as Partial<AppError>)
  })

  it('throws AppError with code network_error when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    await expect(request('/health')).rejects.toMatchObject({ code: 'errors.network' })
  })
})
