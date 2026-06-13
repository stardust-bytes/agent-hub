import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/providers'
import type { ProviderModelFlat } from '../api/types'
import { AppError } from '../api/client'

export const useProvidersStore = defineStore('providers', () => {
  const models = ref<ProviderModelFlat[]>([])
  const providers = ref<api.Provider[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)

  function extractErrorCode(e: unknown): string {
    if (e instanceof AppError) return e.code
    if (e !== null && typeof e === 'object' && 'code' in e && typeof (e as Record<string, unknown>).code === 'string') {
      return (e as Record<string, unknown>).code as string
    }
    return 'errors.request'
  }

  async function loadModels(reload = false) {
    if (loaded.value && !reload) return
    error.value = null
    try {
      models.value = await api.listModels()
      loaded.value = true
    } catch (e) {
      error.value = extractErrorCode(e)
    }
  }

  async function loadProviders() {
    error.value = null
    try {
      providers.value = await api.listProviders()
    } catch (e) {
      error.value = extractErrorCode(e)
    }
  }

  return { models, providers, loaded, error, loadModels, loadProviders }
})
