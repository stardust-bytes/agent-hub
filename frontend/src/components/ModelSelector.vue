<template>
  <select
    :value="modelValue"
    :disabled="disabled || models.length === 0"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    class="bg-cyber-dark border border-cyber-border text-xs font-mono text-slate-100 rounded px-2 py-0.5 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
  >
    <option v-if="models.length === 0" value="" disabled>{{ t('chat.model.offline') }}</option>
    <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
  </select>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  models: string[]
  modelValue: string
  disabled: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
</script>
