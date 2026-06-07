<template>
  <div class="relative inline-flex items-center">
    <select
      :value="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      class="bg-cyber-dark text-xs font-mono text-slate-100 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 appearance-none pr-5 px-2 py-1"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options" :key="isOption(opt) ? opt.value : opt" :value="isOption(opt) ? opt.value : opt">
        {{ isOption(opt) ? opt.label : opt }}
      </option>
    </select>
    <HiChevronDown class="absolute right-1.5 pointer-events-none text-slate-100/60 w-3 h-3" />
  </div>
</template>

<script setup lang="ts">
import { HiChevronDown } from 'vue-icons-plus/hi'
interface SelectOption {
  value: string
  label: string
}

function isOption(opt: string | SelectOption): opt is SelectOption {
  return typeof opt === 'object' && 'value' in opt && 'label' in opt
}

defineProps<{
  modelValue: string
  options: (string | SelectOption)[]
  disabled?: boolean
  placeholder?: string | undefined
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
