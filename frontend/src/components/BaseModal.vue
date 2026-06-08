<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-cyber-dark/80 z-50 flex items-center justify-center"
      @click.self="$emit('update:modelValue', false)"
    >
      <div class="w-80 bg-cyber-modal-bg border-t border-cyber-orange flex flex-col" :style="{ maxHeight }">
        <div v-if="$slots.header" class="px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0">
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
        <div v-if="$slots.footer" class="px-3 py-2 bg-cyber-dark shrink-0">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  closable?: boolean
  maxHeight?: string
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
