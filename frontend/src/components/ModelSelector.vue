<template>
  <BaseSelect
    :model-value="modelValue !== null ? String(modelValue) : ''"
    :options="selectOptions"
    :disabled="disabled || selectOptions.length === 0"
    :placeholder="selectOptions.length === 0 ? t('chat.no_provider') : undefined"
    @update:model-value="$emit('update:modelValue', $event ? Number($event) : null)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseSelect from './BaseSelect.vue'

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

defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()

const selectOptions = computed(() =>
  props.models.map(m => ({
    value: String(m.id),
    label: `${m.providerName} / ${m.name}`,
  }))
)
</script>
