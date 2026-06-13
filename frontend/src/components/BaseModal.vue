<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-cyber-dark/80 z-50 flex items-center justify-center"
    >
      <div :class="modalClass" :style="{ maxHeight, 'max-width': '90vw' }">
        <div v-if="$slots.header" class="px-3 py-2 bg-cyber-modal-bg flex items-center justify-between shrink-0">
          <slot name="header" />
          <button
            v-if="closable"
            @click="$emit('update:modelValue', false)"
            class="text-cyber-accent/50 text-sm font-mono transition-colors duration-150 hover:text-cyber-accent"
          >✕</button>
        </div>
        <div class="overflow-y-auto flex-1">
          <slot />
        </div>
        <div v-if="$slots.footer" class="px-3 py-2 bg-cyber-modal-bg shrink-0">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

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

const modalClass = `bg-cyber-modal-bg border-t border-cyber-orange flex flex-col ${SIZE_MAP[props.size ?? 'md']}`

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
    emit('update:modelValue', false)
  }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    window.addEventListener('keydown', onKeydown)
  } else {
    window.removeEventListener('keydown', onKeydown)
  }
}, { immediate: true })

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>
