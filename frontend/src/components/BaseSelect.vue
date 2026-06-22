<template>
  <Listbox
    :model-value="modelValue"
    :disabled="disabled"
    as="div"
    class="relative inline-block text-left"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <ListboxButton
      class="inline-flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-surface px-2.5 py-1 text-sm text-foreground transition-colors duration-150 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span class="truncate" :class="{ 'text-muted-foreground': !currentLabel }">{{ currentLabel || placeholder }}</span>
      <HiChevronDown class="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
    </ListboxButton>

    <transition
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <ListboxOptions
        class="absolute z-50 mt-1 max-h-60 min-w-full overflow-auto rounded-lg border border-border bg-elevated py-1 shadow-lg focus:outline-none"
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
              active ? 'bg-primary/10 text-primary' : 'text-foreground',
            ]"
          >
            <span class="truncate">{{ opt.label }}</span>
            <span v-if="selected" class="text-primary shrink-0">✓</span>
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
