<template>
  <button
    type="button"
    @click="ui.toggleTheme()"
    :title="ui.theme === 'dark' ? t('topbar.theme.light') : t('topbar.theme.dark')"
    class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
  >
    <HiSun v-if="ui.theme === 'dark'" class="h-4 w-4" />
    <HiMoon v-else class="h-4 w-4" />
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { HiSun, HiMoon } from 'vue-icons-plus/hi'
import { useUiStore } from '../stores/ui'

const { t } = useI18n()
const ui = useUiStore()
</script>
