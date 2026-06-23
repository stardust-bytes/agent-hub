<template>
  <Switch
    :model-value="modelValue"
    :disabled="disabled"
    as="template"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <button
      :class="[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-surface',
        modelValue ? 'bg-primary' : 'bg-input',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ]"
    >
      <span
        :class="[
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-150',
          modelValue ? 'translate-x-[18px]' : 'translate-x-[3px]',
        ]"
      />
    </button>
  </Switch>
</template>

<script setup lang="ts">
import { Switch } from '@headlessui/vue'

defineProps<{
  modelValue: boolean
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
