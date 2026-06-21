<template>
  <div class="flex-1 flex flex-col bg-background overflow-hidden">
    <div class="flex-1 overflow-y-auto mx-auto max-w-5xl px-6 py-6 w-full">
      <div v-if="providers.length === 0" class="text-muted-foreground text-sm py-4">
        {{ t('providers.empty') }}
      </div>

      <div
        v-for="provider in providers"
        :key="provider.id"
        class="mb-2 border border-border rounded-lg overflow-hidden"
      >
        <div
          @click="toggleExpand(provider.id)"
          class="flex items-center justify-between px-3 h-[3rem] bg-surface cursor-pointer hover:bg-muted transition-colors duration-150"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-muted-foreground text-sm font-sans shrink-0">{{ expanded.has(provider.id) ? '▼' : '▶' }}</span>
            <span class="text-foreground text-sm font-medium truncate">{{ provider.name }}</span>
            <span class="text-xs font-sans text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">{{ provider.type }}</span>
            <span v-if="provider.baseUrl" class="text-sm text-muted-foreground font-sans truncate hidden sm:block">{{ provider.baseUrl }}</span>
          </div>
          <div class="flex items-center gap-3 shrink-0 ml-2">
            <button @click.stop="syncModels(provider.id)" :disabled="syncing === provider.id" class="text-muted-foreground text-sm font-sans hover:text-primary transition-colors duration-150 disabled:opacity-30">{{ syncing === provider.id ? '⟳' : '⟳' }}</button>
            <button @click.stop="openEditModal(provider)" class="text-muted-foreground text-sm font-sans hover:text-primary transition-colors duration-150">✎</button>
            <button @click.stop="confirmDeleteProvider(provider)" class="text-muted-foreground text-sm font-sans hover:text-danger transition-colors duration-150">✕</button>
          </div>
        </div>

        <div v-if="expanded.has(provider.id)" class="px-3 py-2 bg-muted border-t border-border">
          <div class="text-xs text-muted-foreground tracking-wide font-semibold mb-2">MODELS</div>

          <div v-if="provider.models.length === 0" class="text-muted-foreground text-sm mb-1">—</div>
          <div
            v-for="model in provider.models"
            :key="model.id"
            class="flex items-center justify-between py-0.5"
          >
            <span class="text-sm text-foreground font-sans">{{ model.name }}</span>
            <button
              @click="deleteModel(provider.id, model.id)"
              class="text-muted-foreground text-sm font-sans hover:text-danger transition-colors duration-150 ml-2"
            >✕</button>
          </div>

          <div v-if="addingModelFor === provider.id" class="flex items-center gap-2 mt-2">
            <input
              ref="modelInputEl"
              v-model="newModelName"
              @keyup.enter="submitAddModel(provider.id)"
              @keyup.escape="addingModelFor = null"
              class="flex-1 bg-surface text-sm font-sans text-foreground px-2.5 py-1 rounded-lg outline-none border border-input focus:border-primary focus:ring-1 focus:ring-ring"
              :placeholder="t('providers.models.placeholder')"
              autocomplete="off"
            />
            <button @click="submitAddModel(provider.id)" class="text-primary text-sm font-sans hover:text-primary/70">✓</button>
            <button @click="addingModelFor = null" class="text-muted-foreground text-sm font-sans hover:text-foreground">✕</button>
          </div>
          <button
            v-else
            @click="startAddModel(provider.id)"
            class="text-primary/60 text-sm font-sans hover:text-primary transition-colors duration-150 mt-1 block"
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




