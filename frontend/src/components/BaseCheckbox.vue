<template>
  <label
    class="inline-flex items-center gap-2 cursor-pointer group select-none"
    :class="[disabled && 'opacity-50 cursor-not-allowed']"
  >
    <div
      class="relative flex items-center justify-center w-4 h-4 rounded border transition-colors duration-150 shrink-0"
      :class="isChecked
        ? 'bg-primary border-primary'
        : 'border-input group-hover:border-primary/60 bg-surface'"
    >
      <input
        type="checkbox"
        class="sr-only"
        :checked="isChecked"
        :disabled="disabled"
        :value="itemValue"
        @change="onChange"
      />
      <svg
        v-if="isChecked"
        class="w-3 h-3 text-primary-foreground pointer-events-none"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="2 6 5 9 10 3" />
      </svg>
    </div>
    <span v-if="$slots.default || label" class="text-sm text-foreground font-sans">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue?: boolean | (string | number)[]
  checked?: boolean
  value?: string | number
  label?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean | (string | number)[]]
  'change': [value: boolean]
}>()

const itemValue = computed(() => props.value ?? '')

const isChecked = computed(() => {
  if (props.checked !== undefined) return props.checked
  if (Array.isArray(props.modelValue)) {
    return props.value !== undefined && props.modelValue.includes(props.value)
  }
  return !!props.modelValue
})

function onChange(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  emit('change', checked)
  if (Array.isArray(props.modelValue) && props.value !== undefined) {
    const arr = props.modelValue
    const next = checked
      ? [...arr, props.value]
      : arr.filter(v => v !== props.value)
    emit('update:modelValue', next)
  } else {
    emit('update:modelValue', checked)
  }
}
</script>
