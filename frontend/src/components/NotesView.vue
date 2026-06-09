<template>
  <div class="flex-1 bg-cyber-bg p-4 overflow-y-auto">
    <h1 class="text-cyber-cyan text-sm font-mono mb-4">{{ t('notes.header') }}</h1>
    <p class="text-cyber-muted text-sm font-mono">{{ t('notes.empty') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>
