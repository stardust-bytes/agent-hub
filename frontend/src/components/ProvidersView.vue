<template>
  <div class="flex-1 flex flex-col bg-gray-50 overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
      <span class="text-gray-900 text-sm font-semibold">{{ t('providers.header') }}</span>
      <button
        @click="openAddModal"
        class="text-blue-600 text-sm rounded-md border border-blue-600/30 hover:bg-blue-50 px-2.5 py-1 transition-colors duration-150"
      >{{ t('providers.add') }}</button>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3">
      <div v-if="providers.length === 0" class="text-gray-500 text-sm py-4">
        {{ t('providers.empty') }}
      </div>

      <div
        v-for="provider in providers"
        :key="provider.id"
        class="mb-2 border border-gray-200 rounded-md overflow-hidden"
      >
        <div
          @click="toggleExpand(provider.id)"
          class="flex items-center justify-between xl:pl-3 pl-10 px-3 h-[3rem] bg-white cursor-pointer hover:bg-gray-50 transition-colors duration-150"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-gray-400 text-sm font-mono shrink-0">{{ expanded.has(provider.id) ? '▼' : '▶' }}</span>
            <span class="text-gray-900 text-sm font-medium truncate">{{ provider.name }}</span>
            <span class="text-xs font-mono text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 shrink-0">{{ provider.type }}</span>
            <span v-if="provider.baseUrl" class="text-sm text-gray-500 font-mono truncate hidden sm:block">{{ provider.baseUrl }}</span>
          </div>
          <div class="flex items-center gap-3 shrink-0 ml-2">
            <button @click.stop="syncModels(provider.id)" :disabled="syncing === provider.id" class="text-gray-400 text-sm font-mono hover:text-blue-600 transition-colors duration-150 disabled:opacity-30">{{ syncing === provider.id ? '⟳' : '⟳' }}</button>
            <button @click.stop="openEditModal(provider)" class="text-gray-400 text-sm font-mono hover:text-blue-600 transition-colors duration-150">✎</button>
            <button @click.stop="confirmDeleteProvider(provider)" class="text-gray-400 text-sm font-mono hover:text-red-600 transition-colors duration-150">✕</button>
          </div>
        </div>

        <div v-if="expanded.has(provider.id)" class="px-3 py-2 bg-gray-50 border-t border-gray-200">
          <div class="text-xs text-gray-500 tracking-wide font-semibold mb-2">MODELS</div>

          <div v-if="provider.models.length === 0" class="text-gray-500 text-sm mb-1">—</div>
          <div
            v-for="model in provider.models"
            :key="model.id"
            class="flex items-center justify-between py-0.5"
          >
            <span class="text-sm text-gray-700 font-mono">{{ model.name }}</span>
            <button
              @click="deleteModel(provider.id, model.id)"
              class="text-gray-400 text-sm font-mono hover:text-red-600 transition-colors duration-150 ml-2"
            >✕</button>
          </div>

          <div v-if="addingModelFor === provider.id" class="flex items-center gap-2 mt-2">
            <input
              ref="modelInputEl"
              v-model="newModelName"
              @keyup.enter="submitAddModel(provider.id)"
              @keyup.escape="addingModelFor = null"
              class="flex-1 bg-white text-sm font-mono text-gray-900 px-2.5 py-1 rounded-md outline-none border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              :placeholder="t('providers.models.placeholder')"
              autocomplete="off"
            />
            <button @click="submitAddModel(provider.id)" class="text-blue-600 text-sm font-mono hover:text-blue-600/70">✓</button>
            <button @click="addingModelFor = null" class="text-gray-500 text-sm font-mono hover:text-gray-900">✕</button>
          </div>
          <button
            v-else
            @click="startAddModel(provider.id)"
            class="text-blue-600/60 text-sm font-mono hover:text-blue-600 transition-colors duration-150 mt-1 block"
          >{{ t('providers.models.add') }}</button>
        </div>
      </div>
    </div>

    <ProviderFormModal
      v-model="showModal"
      :editing="editingProvider"
      @saved="loadProviders"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import ProviderFormModal from './ProviderFormModal.vue'
import { useProvidersStore } from '../stores/providers'
import * as providersApi from '../api/providers'

interface ProviderModel {
  id: number
  name: string
}

interface Provider {
  id: number
  name: string
  type: string
  baseUrl: string | null
  key: string | null
  models: ProviderModel[]
}

const { t } = useI18n()
const providersStore = useProvidersStore()

const providers = computed(() => providersStore.providers as unknown as Provider[])
const expanded = ref<Set<number>>(new Set())
const showModal = ref(false)
const editingProvider = ref<Provider | null>(null)
const addingModelFor = ref<number | null>(null)
const newModelName = ref('')
const modelInputEl = ref<HTMLInputElement | null>(null)
const syncing = ref<number | null>(null)

async function syncModels(providerId: number) {
  syncing.value = providerId
  try {
    await providersApi.syncModels(providerId)
    await loadProviders()
  } catch { /* ignore */ }
  syncing.value = null
}

async function loadProviders() {
  await providersStore.loadProviders()
}

function toggleExpand(id: number) {
  if (expanded.value.has(id)) {
    expanded.value.delete(id)
  } else {
    expanded.value.add(id)
  }
}

function openAddModal() {
  editingProvider.value = null
  showModal.value = true
}

function openEditModal(provider: Provider) {
  editingProvider.value = provider
  showModal.value = true
}

async function confirmDeleteProvider(provider: Provider) {
  if (!confirm(t('providers.delete.confirm'))) return
  try {
    await providersApi.deleteProvider(provider.id)
    await loadProviders()
  } catch { /* ignore */ }
}

function startAddModel(providerId: number) {
  addingModelFor.value = providerId
  newModelName.value = ''
  nextTick(() => modelInputEl.value?.focus())
}

async function submitAddModel(providerId: number) {
  const name = newModelName.value.trim()
  if (!name) return
  try {
    await providersApi.addModel(providerId, { name })
    await loadProviders()
    addingModelFor.value = null
    newModelName.value = ''
  } catch { /* ignore */ }
}

async function deleteModel(providerId: number, modelId: number) {
  if (!confirm(t('providers.models.delete.confirm'))) return
  try {
    await providersApi.deleteModel(providerId, modelId)
    await loadProviders()
  } catch { /* ignore */ }
}

onMounted(loadProviders)
</script>




