<template>
  <div class="shrink-0">
    <div class="max-w-60rem mx-auto w-full px-3 pb-3">
      <div class="bg-surface border border-input rounded-lg px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring transition-colors duration-150">
        <form @submit.prevent="onSubmit" class="flex items-center gap-2">
          <div class="relative flex-1">
            <input
              ref="inputEl"
              v-model="input"
              @keydown="onKeydown"
              class="flex-1 bg-transparent text-foreground text-sm outline-none font-mono placeholder-muted-foreground w-full"
              :placeholder="t('chat.placeholder')"
              :disabled="streaming"
              autocomplete="off"
              spellcheck="false"
            />
            <SlashMenu
              :visible="slashVisible"
              :commands="slashCommands"
              :selected-index="slashIndex"
              @select="applyCommand"
              @highlight="(i: number) => (slashIndex = i)"
            />
          </div>
          <button
            v-if="streaming"
            @click="emit('stop')"
            class="text-muted-foreground text-sm px-2 py-0.5 transition-colors duration-150 hover:text-foreground shrink-0"
          >{{ t('chat.stop') }}</button>
        </form>
        <div v-if="streaming" class="flex items-center gap-1 pt-2">
          <div
            v-for="i in 8" :key="i"
            class="w-1 h-1 bg-blue-600 rounded-full animate-dot-pulse"
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
          class="text-primary text-sm px-2 py-0.5 transition-colors duration-150 hover:text-primary"
        >{{ t('sessions.header') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelSelector from '../ModelSelector.vue'
import SlashMenu, { type SlashCommand } from '../SlashMenu.vue'
import { useAgentProfilesStore } from '../../stores/agentProfiles'
import type { ProviderModelFlat } from './types'

const props = defineProps<{
  streaming: boolean
  models: ProviderModelFlat[]
  modelId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelId', v: number | null): void
  (e: 'submit', text: string): void
  (e: 'stop'): void
  (e: 'openSessions'): void
}>()

const { t } = useI18n()
const inputEl = ref<HTMLInputElement | null>(null)
const input = ref('')
const slashVisible = ref(false)
const slashIndex = ref(0)

const profilesStore = useAgentProfilesStore()

const staticSlashCommands = computed<SlashCommand[]>(() => [
  { command: '/help', description: t('slash.help') },
  { command: '/clear', description: t('slash.clear') },
])

const slashCommands = computed<SlashCommand[]>(() => {
  const raw = input.value
  const prefix = raw.startsWith('/') ? raw : ''

  const fromProfiles: SlashCommand[] = profilesStore.profiles
    .filter(p => p.enabled)
    .map(p => ({
      command: `/agent ${p.slug}`,
      description: `${t('slash.agent')} — ${p.name}`,
    }))

  const all = [...staticSlashCommands.value, ...fromProfiles]

  if (!prefix) return all
  return all.filter(c => c.command.startsWith(prefix))
})

watch(input, () => {
  if (input.value.startsWith('/')) {
    slashVisible.value = true
    slashIndex.value = 0
  } else {
    slashVisible.value = false
  }
})

function onKeydown(e: KeyboardEvent) {
  if (!slashVisible.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    slashIndex.value = (slashIndex.value + 1) % slashCommands.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    slashIndex.value = (slashIndex.value - 1 + slashCommands.value.length) % slashCommands.value.length
  } else if (e.key === 'Enter' && slashCommands.value.length > 0) {
    e.preventDefault()
    applyCommand(slashCommands.value[slashIndex.value].command)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    slashVisible.value = false
  }
}

function applyCommand(cmd: string) {
  input.value = cmd + ' '
  slashVisible.value = false
  nextTick(() => {
    inputEl.value?.focus()
  })
}

onMounted(() => {
  inputEl.value?.focus()
  profilesStore.load()
})

function onSubmit() {
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  slashVisible.value = false
  emit('submit', text)
}
</script>
