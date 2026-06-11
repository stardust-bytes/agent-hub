<template>
  <div class="bg-cyber-modal-bg border border-cyber-accent/40 font-mono text-sm">
    <div class="flex items-center gap-2 px-3 py-2 border-b border-cyber-accent/20">
      <span class="text-cyber-cyan text-xs font-bold tracking-widest">PARALLEL</span>
      <span class="text-cyber-text flex-1 text-xs truncate">{{ t('delegate.task') }}</span>
    </div>

    <div class="px-3 py-2 space-y-1">
      <div class="text-cyber-text text-xs mb-2">{{ delegation.task }}</div>
      <div class="text-cyber-muted text-xs mb-1">{{ t('delegate.subtasks') }}:</div>
      <div v-for="(subtask, i) in delegation.subtasks" :key="i" class="flex gap-2 items-start">
        <span class="text-cyber-muted text-xs select-none shrink-0">{{ i + 1 }}.</span>
        <span class="text-cyber-text text-xs break-words leading-5">{{ subtask }}</span>
      </div>
    </div>

    <div class="flex gap-2 px-3 py-2 border-t border-cyber-accent/20">
      <button
        :disabled="disabled"
        @click="emit('choose', { requestId: delegation.requestId, mode: 'parallel' })"
        class="bg-cyber-accent text-black text-xs font-bold px-3 py-1 transition-colors duration-150 hover:bg-cyber-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
      >&#9654; {{ t('delegate.parallel') }}</button>
      <button
        :disabled="disabled"
        @click="emit('choose', { requestId: delegation.requestId, mode: 'sequential' })"
        class="bg-transparent border border-cyber-muted/40 text-cyber-muted text-xs px-3 py-1 transition-colors duration-150 hover:text-cyber-text hover:border-cyber-muted disabled:opacity-50 disabled:cursor-not-allowed"
      >&#8594; {{ t('delegate.sequential') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface DelegateData {
  requestId: string
  task: string
  subtasks: string[]
}

interface ChoosePayload {
  requestId: string
  mode: 'parallel' | 'sequential'
}

const props = defineProps<{
  delegation: DelegateData
  disabled: boolean
}>()

const emit = defineEmits<{
  choose: [payload: ChoosePayload]
}>()

const { t } = useI18n()
</script>
