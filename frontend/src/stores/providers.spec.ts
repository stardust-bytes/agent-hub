import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProvidersStore } from './providers'
import * as api from '../api/providers'

describe('providers store', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.restoreAllMocks() })

  it('loads models once and caches them', async () => {
    const spy = vi.spyOn(api, 'listModels').mockResolvedValue([
      { id: 1, name: 'gpt', providerName: 'p', providerId: 1 },
    ])
    const store = useProvidersStore()
    await store.loadModels()
    await store.loadModels()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(store.models).toHaveLength(1)
  })

  it('force-reloads models when reload=true', async () => {
    const spy = vi.spyOn(api, 'listModels').mockResolvedValue([])
    const store = useProvidersStore()
    await store.loadModels()
    await store.loadModels(true)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('records an error code on failure', async () => {
    vi.spyOn(api, 'listModels').mockRejectedValue(Object.assign(new Error(), { code: 'providers.fetch_failed' }))
    const store = useProvidersStore()
    await store.loadModels()
    expect(store.error).toBe('providers.fetch_failed')
  })
})
