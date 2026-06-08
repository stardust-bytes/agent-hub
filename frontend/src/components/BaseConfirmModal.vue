<template>
  <BaseModal :model-value="modelValue" :closable="false" @update:model-value="$emit('update:modelValue', $event)">
    <template #header>
      <span class="text-cyber-text text-sm font-mono">{{ title }}</span>
    </template>
    <div class="px-3 py-4">
      <p class="text-sm text-cyber-muted font-mono">{{ message }}</p>
    </div>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <button
          @click="$emit('update:modelValue', false)"
          class="px-3 py-1.5 text-sm font-mono text-cyber-muted bg-cyber-dark hover:text-cyber-text transition-colors duration-150"
        >{{ t('tasks.form.cancel') }}</button>
        <button
          @click="onConfirm"
          class="px-3 py-1.5 text-sm font-mono text-white bg-red-500/80 hover:bg-red-500 transition-colors duration-150"
        >{{ t('tasks.delete.confirm.btn') }}</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

defineProps<{
  modelValue: boolean
  title: string
  message: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

const { t } = useI18n()

function onConfirm() {
  emit('confirm')
  emit('update:modelValue', false)
}
</script>
