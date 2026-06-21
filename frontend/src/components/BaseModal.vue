<template>
  <TransitionRoot :show="modelValue" as="template">
    <Dialog as="div" class="relative z-50" @close="onClose">
      <TransitionChild
        as="template"
        enter="duration-150 ease-out" enter-from="opacity-0" enter-to="opacity-100"
        leave="duration-100 ease-in" leave-from="opacity-100" leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-900/40" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="duration-150 ease-out" enter-from="opacity-0 translate-y-1 sm:scale-95" enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="duration-100 ease-in" leave-from="opacity-100 translate-y-0 sm:scale-100" leave-to="opacity-0 translate-y-1 sm:scale-95"
          >
            <DialogPanel :class="panelClass" :style="panelStyle">
              <div v-if="$slots.header" class="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
                <slot name="header" />
                <button
                  v-if="closable"
                  @click="onClose"
                  class="text-gray-400 text-base leading-none transition-colors duration-150 hover:text-gray-700"
                  aria-label="Close"
                >✕</button>
              </div>
              <div class="overflow-y-auto flex-1">
                <slot />
              </div>
              <div v-if="$slots.footer" class="px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
                <slot name="footer" />
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Dialog, DialogPanel, TransitionRoot, TransitionChild } from '@headlessui/vue'

const props = defineProps<{
  modelValue: boolean
  closable?: boolean
  maxHeight?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>()

const SIZE_MAP: Record<string, string> = {
  sm: 'w-96',
  md: 'w-[32rem]',
  lg: 'w-[40rem]',
  xl: 'w-[48rem]',
}

const panelClass = computed(() =>
  `bg-white rounded-md border border-gray-200 shadow-xl flex flex-col max-w-[90vw] ${SIZE_MAP[props.size ?? 'md']}`,
)

const panelStyle = computed(() => ({ maxHeight: props.maxHeight ?? '85vh' }))

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function onClose() {
  emit('update:modelValue', false)
}
</script>
