<template>
  <div class="shrink-0">
    <div class="max-w-60rem mx-auto w-full px-3 pb-3">
      <div class="bg-cyber-dark px-3 py-2">
        <form @submit.prevent="onSubmit" class="flex items-center gap-2">
          <div class="relative flex-1">
            <input
              ref="inputEl"
              v-model="input"
              class="flex-1 bg-transparent text-cyber-text text-sm outline-none font-mono placeholder-cyber-muted/40 caret-white w-full"
              :placeholder="t('chat.placeholder')"
              :disabled="streaming"
              autocomplete="off"
              spellcheck="false"
            />
          </div>
          <button
            v-if="streaming"
            @click="emit('stop')"
            class="text-cyber-accent/80 text-sm font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent shrink-0"
          >{{ t('chat.stop') }}</button>
        </form>
        <div v-if="streaming" class="flex items-center gap-1 pt-2">
          <div
            v-for="i in 8" :key="i"
            class="w-1 h-1 bg-cyber-accent rounded-full animate-dot-pulse"
            :style="{ animationDelay: `${(i - 1) * 0.15}s` }"
          />
        </div>
      </div>
      <div class="flex items-center justify-between pt-2">
        <div class="flex items-center gap-2">
          <ModelSelector
            :model-value="modelId"
            :models="models"
            :disabled="streaming"
            @update:model-value="(v: number | null) => emit('update:modelId', v)"
          />
        </div>
        <button
          @click="emit('openSessions')"
          class="text-cyber-accent/70 text-sm font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent"
        >{{ t('sessions.header') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelSelector from '../ModelSelector.vue'
import type { ProviderModelFlat } from './types'

defineProps<{
  streaming: boolean
  models: ProviderModelFlat[]
  modelId: number | null
  mode: 'chat' | 'agent'
}>()

const emit = defineEmits<{
  'update:modelId': [v: number | null]
  'update:mode': [m: 'chat' | 'agent']
  submit: [text: string]
  stop: []
  openSessions: []
}>()

const { t } = useI18n()
const inputEl = ref<HTMLInputElement | null>(null)
const input = ref('')

onMounted(() => {
  inputEl.value?.focus()
})

function onSubmit() {
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  emit('submit', text)
}
</script>
