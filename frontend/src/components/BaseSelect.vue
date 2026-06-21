<template>
  <Listbox
    :model-value="modelValue"
    :disabled="disabled"
    as="div"
    class="relative inline-block text-left"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <ListboxButton
      class="inline-flex w-full items-center justify-between gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span class="truncate" :class="{ 'text-gray-400': !currentLabel }">{{ currentLabel || placeholder }}</span>
      <HiChevronDown class="w-3.5 h-3.5 shrink-0 text-gray-400" />
    </ListboxButton>

    <transition
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <ListboxOptions
        class="absolute z-50 mt-1 max-h-60 min-w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg focus:outline-none"
      >
        <ListboxOption
          v-for="opt in normalized"
          :key="opt.value"
          :value="opt.value"
          v-slot="{ active, selected }"
          as="template"
        >
          <li
            :class="[
              'flex items-center justify-between gap-2 px-3 py-1.5 text-sm cursor-pointer',
              active ? 'bg-blue-50 text-blue-700' : 'text-gray-700',
            ]"
          >
            <span class="truncate">{{ opt.label }}</span>
            <span v-if="selected" class="text-blue-600 shrink-0">✓</span>
          </li>
        </ListboxOption>
      </ListboxOptions>
    </transition>
  </Listbox>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue'
import { HiChevronDown } from 'vue-icons-plus/hi'

interface SelectOption {
  value: string
  label: string
}

function isOption(opt: string | SelectOption): opt is SelectOption {
  return typeof opt === 'object' && 'value' in opt && 'label' in opt
}

const props = defineProps<{
  modelValue: string
  options: (string | SelectOption)[]
  disabled?: boolean
  placeholder?: string | undefined
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const normalized = computed<SelectOption[]>(() =>
  props.options.map((opt) => (isOption(opt) ? opt : { value: opt, label: opt })),
)

const currentLabel = computed(() => normalized.value.find((o) => o.value === props.modelValue)?.label ?? '')
</script>
