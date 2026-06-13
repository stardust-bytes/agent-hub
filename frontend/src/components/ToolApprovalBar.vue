<template>
  <div class="border border-cyber-orange/60 bg-cyber-dark px-3 py-2 mx-3 mb-2 rounded">
    <div class="flex items-center gap-2 mb-1">
      <HiShieldExclamation class="w-3 h-3 text-cyber-orange shrink-0" />
      <span class="text-xs text-cyber-orange font-mono">
        Tool '{{ name }}' {{ t('approval.required') }}
      </span>
    </div>
    <div class="text-2xs text-cyber-muted font-mono mb-2 break-all">
      {{ t('approval.args') }}: {{ args }}
    </div>
    <div class="w-full h-1 bg-cyber-code-border mb-2 rounded">
      <div class="h-full bg-cyber-orange rounded transition-all duration-1000 linear"
        :style="{ width: (remaining / total * 100) + '%' }"></div>
    </div>
    <div class="flex items-center justify-between">
      <div class="text-2xs text-cyber-muted font-mono">{{ remaining }}s / {{ total }}s</div>
      <div class="flex gap-2">
        <button @click="emit('approve', id)"
          class="text-xs text-white font-mono px-2 py-1 bg-cyber-accent rounded transition-colors duration-150 hover:bg-cyber-accent/80">
          {{ t('approval.allow') }}
        </button>
        <button @click="emit('deny', id)"
          class="text-xs text-cyber-text font-mono px-2 py-1 border border-cyber-code-border rounded transition-colors duration-150 hover:bg-cyber-dark">
          {{ t('approval.deny') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { HiShieldExclamation } from 'vue-icons-plus/hi'

defineProps<{
  id: string
  name: string
  args: string
  remaining: number
  total: number
}>()

const emit = defineEmits<{
  (e: 'approve', id: string): void
  (e: 'deny', id: string): void
}>()

const { t } = useI18n()
</script>
