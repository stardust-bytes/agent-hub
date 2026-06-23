<template>
  <Listbox
    :model-value="modelValue"
    :disabled="disabled"
    as="div"
    class="relative w-full text-left"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <span ref="buttonWrapperRef" class="block w-full">
      <ListboxButton
        class="inline-flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-surface px-2.5 py-1 text-sm text-foreground transition-colors duration-150 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed h-8"
      >
        <span class="truncate" :class="{ 'text-muted-foreground': !currentLabel }">{{ currentLabel || placeholder }}</span>
        <HiChevronDown class="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
      </ListboxButton>
    </span>

    <transition
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <ListboxOptions
        :style="{
          position: 'fixed',
          top: dropdownTop + 'px',
          left: dropdownLeft + 'px',
          width: dropdownWidth + 'px',
          zIndex: withinDialog ? 100 : 50,
        }"
        class="mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-elevated py-1 shadow-lg"
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
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue'
import { HiChevronDown } from 'vue-icons-plus/hi'

interface SelectOption {
  value: string | number
  label: string
}

function isOption(opt: string | number | SelectOption): opt is SelectOption {
  return typeof opt === 'object' && 'value' in opt && 'label' in opt
}

const props = defineProps<{
  modelValue: string | number | null
  options: (string | number | SelectOption)[]
  disabled?: boolean
  placeholder?: string
  withinDialog?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string | number | null]
}>()

const buttonWrapperRef = ref<HTMLElement | null>(null)
const dropdownTop = ref(0)
const dropdownLeft = ref(0)
const dropdownWidth = ref(0)

function updatePosition() {
  if (!buttonWrapperRef.value) return
  const rect = buttonWrapperRef.value.getBoundingClientRect()
  dropdownTop.value = rect.bottom
  dropdownLeft.value = rect.left
  dropdownWidth.value = rect.width
}

function onScrollOrResize() {
  updatePosition()
}

onMounted(() => {
  updatePosition()
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
})

const normalized = computed<SelectOption[]>(() =>
  props.options.map((opt) =>
    isOption(opt) ? opt : { value: opt, label: String(opt) },
  ),
)

const currentLabel = computed(() => normalized.value.find((o) => o.value === props.modelValue)?.label ?? '')
</script>
