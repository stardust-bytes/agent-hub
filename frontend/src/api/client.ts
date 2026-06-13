export class AppError extends Error {
  constructor(public code: string, public status?: number) {
    super(code)
    this.name = 'AppError'
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  errorCode?: string
  signal?: AbortSignal
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, errorCode = 'errors.request', signal } = options
  const init: RequestInit = { method, signal }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  let res: Response
  try {
    res = await fetch(`/api${path}`, init)
  } catch {
    throw new AppError('errors.network')
  }
  if (!res.ok) {
    throw new AppError(errorCode, res.status)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function requestRaw(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, signal } = options
  const init: RequestInit = { method, signal }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return fetch(`/api${path}`, init)
}
