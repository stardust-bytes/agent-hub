<template>
  <div class="relative">
    <button
      @click="showModal = true"
      :disabled="disabled"
      class="text-sm font-mono text-cyber-accent px-2 py-0.5 border border-cyber-accent/40 transition-colors duration-150 hover:bg-cyber-accent/10 disabled:opacity-50 disabled:cursor-not-allowed truncate"
    >{{ currentLabel || t('chat.no_provider') }}</button>

    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 bg-cyber-dark/80 z-50 flex items-center justify-center">
        <div class="w-120 bg-cyber-modal-bg border border-cyber-border flex flex-col" style="max-height: 70vh; max-width: 90vw">
          <div class="px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0 border-b border-cyber-border">
            <span class="text-cyber-text text-sm font-mono">{{ t('providers.select_model') }}</span>
            <button @click="showModal = false" class="text-cyber-muted text-sm font-mono hover:text-cyber-accent">✕</button>
          </div>
          <div class="px-3 py-2 border-b border-cyber-border">
            <input
              ref="filterInput"
              v-model="filter"
              class="w-full bg-cyber-dark text-cyber-text text-sm px-2 py-1 font-mono outline-none border border-cyber-accent/20"
              :placeholder="t('providers.search_model')"
              autocomplete="off"
            />
          </div>
          <div class="overflow-y-auto flex-1 px-3 py-2">
            <div
              v-for="m in filteredModels"
              :key="m.id"
              class="flex items-center justify-between px-2 py-1.5 cursor-pointer font-mono text-sm transition-colors duration-150"
              :class="m.id === modelValue ? 'bg-cyber-accent/15 text-cyber-accent' : 'text-cyber-text hover:bg-cyber-dark'"
              @click="selectModel(m.id)"
            >
              <span class="truncate">{{ m.providerName }} / {{ m.name }}</span>
              <span v-if="m.id === modelValue" class="text-cyber-accent shrink-0 ml-2">✓</span>
            </div>
            <div v-if="filteredModels.length === 0" class="text-cyber-muted text-sm font-mono text-center py-4">{{ t('providers.no_models_found') }}</div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

interface ProviderModelFlat {
  id: number
  name: string
  providerName: string
  providerId: number
}

const props = defineProps<{
  models: ProviderModelFlat[]
  modelValue: number | null
  disabled: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()
const showModal = ref(false)
const filter = ref('')
const filterInput = ref<HTMLInputElement | null>(null)

const currentLabel = computed(() => {
  if (props.modelValue === null) return null
  const m = props.models.find(x => x.id === props.modelValue)
  return m ? `${m.providerName} / ${m.name}` : null
})

const filteredModels = computed(() => {
  const q = filter.value.toLowerCase()
  return props.models.filter(m =>
    m.name.toLowerCase().includes(q) || m.providerName.toLowerCase().includes(q)
  )
})

function selectModel(id: number) {
  emit('update:modelValue', id)
  showModal.value = false
  filter.value = ''
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showModal.value) showModal.value = false
}

onUnmounted(() => window.removeEventListener('keydown', onKeydown))

watch(showModal, (val) => {
  if (val) {
    nextTick(() => filterInput.value?.focus())
    window.addEventListener('keydown', onKeydown)
  } else {
    window.removeEventListener('keydown', onKeydown)
  }
})
</script>
