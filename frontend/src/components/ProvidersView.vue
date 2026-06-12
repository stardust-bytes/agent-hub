<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">⚡ {{ t('providers.header') }}</span>
      <button
        @click="openAddModal"
        class="text-cyber-accent text-sm font-mono hover:bg-cyber-accent/10 px-2 py-0.5 transition-colors duration-150"
      >{{ t('providers.add') }}</button>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3">
      <div v-if="providers.length === 0" class="text-cyber-muted text-sm font-mono py-4">
        {{ t('providers.empty') }}
      </div>

      <div
        v-for="provider in providers"
        :key="provider.id"
        class="mb-2 border border-cyber-accent/10"
      >
        <div
          @click="toggleExpand(provider.id)"
          class="flex items-center justify-between xl:pl-3 pl-10 px-3 h-[3rem] bg-cyber-dark cursor-pointer hover:bg-cyber-accent/5 transition-colors duration-150"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-cyber-accent/60 text-sm font-mono shrink-0">{{ expanded.has(provider.id) ? '▼' : '▶' }}</span>
            <span class="text-slate-100 text-sm font-mono truncate">{{ provider.name }}</span>
            <span class="text-sm font-mono text-cyber-accent/50 border border-cyber-accent/20 px-1 shrink-0">{{ provider.type }}</span>
            <span v-if="provider.baseUrl" class="text-sm text-cyber-muted font-mono truncate hidden sm:block">{{ provider.baseUrl }}</span>
          </div>
          <div class="flex items-center gap-3 shrink-0 ml-2">
            <button @click.stop="syncModels(provider.id)" :disabled="syncing === provider.id" class="text-cyber-accent/40 text-sm font-mono hover:text-cyber-accent transition-colors duration-150 disabled:opacity-30">{{ syncing === provider.id ? '⟳' : '⟳' }}</button>
            <button @click.stop="openEditModal(provider)" class="text-cyber-accent/40 text-sm font-mono hover:text-cyber-accent transition-colors duration-150">✎</button>
            <button @click.stop="confirmDeleteProvider(provider)" class="text-red-400/40 text-sm font-mono hover:text-red-400 transition-colors duration-150">✕</button>
          </div>
        </div>

        <div v-if="expanded.has(provider.id)" class="px-3 py-2 bg-cyber-bg border-t border-cyber-accent/5">
          <div class="text-sm text-cyber-accent/50 tracking-widest font-mono mb-2">MODELS</div>

          <div v-if="provider.models.length === 0" class="text-cyber-muted text-sm font-mono mb-1">—</div>
          <div
            v-for="model in provider.models"
            :key="model.id"
            class="flex items-center justify-between py-0.5"
          >
            <span class="text-sm text-slate-300 font-mono">{{ model.name }}</span>
            <button
              @click="deleteModel(provider.id, model.id)"
              class="text-red-400/40 text-sm font-mono hover:text-red-400 transition-colors duration-150 ml-2"
            >✕</button>
          </div>

          <div v-if="addingModelFor === provider.id" class="flex items-center gap-2 mt-2">
            <input
              ref="modelInputEl"
              v-model="newModelName"
              @keyup.enter="submitAddModel(provider.id)"
              @keyup.escape="addingModelFor = null"
              class="flex-1 bg-cyber-dark text-sm font-mono text-slate-100 px-2 py-0.5 outline-none border border-cyber-accent/30"
              :placeholder="t('providers.models.placeholder')"
              autocomplete="off"
            />
            <button @click="submitAddModel(provider.id)" class="text-cyber-accent text-sm font-mono hover:text-cyber-accent/70">✓</button>
            <button @click="addingModelFor = null" class="text-cyber-muted text-sm font-mono hover:text-slate-100">✕</button>
          </div>
          <button
            v-else
            @click="startAddModel(provider.id)"
            class="text-cyber-accent/60 text-sm font-mono hover:text-cyber-accent transition-colors duration-150 mt-1 block"
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
import { ref, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import ProviderFormModal from './ProviderFormModal.vue'

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

const providers = ref<Provider[]>([])
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
    await fetch(`/api/providers/${providerId}/sync-models`, { method: 'POST' })
    await loadProviders()
  } catch { /* ignore */ }
  syncing.value = null
}

async function loadProviders() {
  try {
    const res = await fetch('/api/providers')
    if (res.ok) providers.value = await res.json() as Provider[]
  } catch { /* ignore */ }
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
    await fetch(`/api/providers/${provider.id}`, { method: 'DELETE' })
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
    const res = await fetch(`/api/providers/${providerId}/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      await loadProviders()
      addingModelFor.value = null
      newModelName.value = ''
    }
  } catch { /* ignore */ }
}

async function deleteModel(providerId: number, modelId: number) {
  if (!confirm(t('providers.models.delete.confirm'))) return
  try {
    await fetch(`/api/providers/${providerId}/models/${modelId}`, { method: 'DELETE' })
    await loadProviders()
  } catch { /* ignore */ }
}

onMounted(loadProviders)
</script>




