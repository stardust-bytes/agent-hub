import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/providers'
import type { ProviderModelFlat } from '../api/types'
import { errorCode } from '../api/client'

export const useProvidersStore = defineStore('providers', () => {
  const models = ref<ProviderModelFlat[]>([])
  const providers = ref<api.Provider[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)

  async function loadModels(reload = false) {
    if (loaded.value && !reload) return
    error.value = null
    try {
      models.value = await api.listModels()
      loaded.value = true
    } catch (e) {
      error.value = errorCode(e)
    }
  }

  async function loadProviders() {
    error.value = null
    try {
      providers.value = await api.listProviders()
    } catch (e) {
      error.value = errorCode(e)
    }
  }

  return { models, providers, loaded, error, loadModels, loadProviders }
})
