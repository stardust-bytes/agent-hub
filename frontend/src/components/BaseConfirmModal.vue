<template>
  <BaseModal :model-value="modelValue" :closable="false" @update:model-value="$emit('update:modelValue', $event)">
    <template #header>
      <span class="text-foreground text-sm font-semibold">{{ title }}</span>
    </template>
    <div class="px-4 py-4">
      <p class="text-sm text-muted-foreground">{{ message }}</p>
    </div>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <button
          @click="$emit('update:modelValue', false)"
          class="inline-flex items-center gap-1.5 rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-foreground transition-colors duration-150 hover:bg-muted"
        >{{ t('tasks.form.cancel') }}</button>
        <button
          @click="onConfirm"
          class="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-danger/90"
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
