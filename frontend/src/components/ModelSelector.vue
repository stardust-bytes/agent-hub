<template>
  <div class="relative">
    <button
      type="button"
      @click="showModal = true"
      :disabled="disabled"
      class="text-sm text-gray-700 px-2.5 py-1 rounded-md border border-gray-300 bg-white transition-colors duration-150 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed truncate"
    >{{ currentLabel || t('chat.no_provider') }}</button>

    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center p-4" @click.self="showModal = false">
        <div class="w-120 bg-white rounded-md border border-gray-200 shadow-xl flex flex-col" style="max-height: 70vh; max-width: 90vw">
          <div class="px-4 py-3 flex items-center justify-between shrink-0 border-b border-gray-200">
            <span class="text-gray-900 text-sm font-semibold">{{ t('providers.select_model') }}</span>
            <button @click="showModal = false" class="text-gray-400 text-base leading-none hover:text-gray-700">✕</button>
          </div>
          <div class="px-3 py-2 border-b border-gray-200">
            <input
              ref="filterInput"
              v-model="filter"
              class="w-full bg-white text-gray-900 text-sm px-2.5 py-1.5 rounded-md outline-none border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              :placeholder="t('providers.search_model')"
              autocomplete="off"
            />
          </div>
          <div class="overflow-y-auto flex-1 px-2 py-2">
            <div
              v-for="m in filteredModels"
              :key="m.id"
              class="flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-sm transition-colors duration-150"
              :class="m.id === modelValue ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'"
              @click="selectModel(m.id)"
            >
              <span class="truncate">{{ m.providerName }} / {{ m.name }}</span>
              <span v-if="m.id === modelValue" class="text-blue-600 shrink-0 ml-2">✓</span>
            </div>
            <div v-if="filteredModels.length === 0" class="text-gray-500 text-sm text-center py-4">{{ t('providers.no_models_found') }}</div>
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
