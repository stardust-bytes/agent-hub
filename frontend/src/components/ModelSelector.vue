<template>
  <BaseSelect
    :model-value="modelValue"
    :options="models"
    :disabled="disabled || models.length === 0"
    :placeholder="models.length === 0 ? t('chat.model.offline') : undefined"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseSelect from './BaseSelect.vue'

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
