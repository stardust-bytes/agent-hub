<template>
  <RadioGroup
    :model-value="modelValue"
    :disabled="disabled"
    as="div"
    class="flex flex-col gap-1"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <RadioGroupLabel v-if="label" class="text-sm text-muted-foreground font-sans mb-1">
      {{ label }}
    </RadioGroupLabel>
    <RadioGroupOption
      v-for="opt in normalized"
      :key="opt.value"
      :value="opt.value"
      v-slot="{ active, checked }"
      as="template"
    >
      <div
        :class="[
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer text-sm font-sans transition-colors duration-150',
          checked
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-input text-foreground hover:border-primary/40 hover:bg-muted',
          active && !checked ? 'ring-1 ring-ring' : '',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ]"
      >
        <div
          class="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors duration-150"
          :class="checked ? 'border-primary' : 'border-input'"
        >
          <div v-if="checked" class="w-2 h-2 rounded-full bg-primary" />
        </div>
        <RadioGroupLabel as="span" class="text-sm">
          {{ opt.label }}
        </RadioGroupLabel>
      </div>
    </RadioGroupOption>
  </RadioGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RadioGroup, RadioGroupOption, RadioGroupLabel } from '@headlessui/vue'

interface RadioOption {
  value: string | number
  label: string
}

function isOption(opt: string | number | RadioOption): opt is RadioOption {
  return typeof opt === 'object' && 'value' in opt && 'label' in opt
}

const props = defineProps<{
  modelValue: string | number
  options: (string | number | RadioOption)[]
  label?: string
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const normalized = computed<RadioOption[]>(() =>
  props.options.map((opt) =>
    isOption(opt) ? opt : { value: opt, label: String(opt) },
  ),
)
</script>
