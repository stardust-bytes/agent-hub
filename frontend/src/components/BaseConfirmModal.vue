<template>
  <BaseModal :model-value="modelValue" :closable="false" @update:model-value="$emit('update:modelValue', $event)">
    <template #header>
      <span class="text-gray-900 text-sm font-semibold">{{ title }}</span>
    </template>
    <div class="px-4 py-4">
      <p class="text-sm text-gray-600">{{ message }}</p>
    </div>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <button
          @click="$emit('update:modelValue', false)"
          class="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150"
        >{{ t('tasks.form.cancel') }}</button>
        <button
          @click="onConfirm"
          class="px-3 py-1.5 text-sm rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors duration-150"
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
