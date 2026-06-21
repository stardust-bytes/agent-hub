<template>
  <header class="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
    <button
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground xl:hidden"
      :title="t('topbar.menu')"
      @click="emit('toggle-sidebar')"
    >
      <HiMenu class="h-5 w-5" />
    </button>

    <RouterLink to="/cowork" class="flex items-center gap-2 shrink-0">
      <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">A</span>
      <span class="hidden text-sm font-semibold text-foreground sm:block">Agent Hub</span>
    </RouterLink>

    <button
      type="button"
      class="ml-2 flex h-9 max-w-md flex-1 items-center gap-2 rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40"
      @click="emit('open-search')"
    >
      <HiSearch class="h-4 w-4 shrink-0" />
      <span class="truncate">{{ t('topbar.search') }}</span>
      <kbd class="ml-auto hidden rounded border border-border px-1.5 py-0.5 font-mono text-xs sm:block">⌘K</kbd>
    </button>

    <div class="ml-auto flex items-center gap-1">
      <ThemeToggle />
      <button
        type="button"
        class="flex h-8 items-center rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        @click="toggleLang"
      >{{ t('nav.lang') }}</button>
      <RouterLink
        to="/settings/general"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :title="t('nav.settings')"
      >
        <HiCog class="h-4 w-4" />
      </RouterLink>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { HiMenu, HiSearch, HiCog } from 'vue-icons-plus/hi'
import ThemeToggle from './ThemeToggle.vue'
import type { Locale } from '../i18n'

const { t, locale } = useI18n()

const emit = defineEmits<{ 'open-search': []; 'toggle-sidebar': [] }>()

function toggleLang() {
  const next: Locale = locale.value === 'vi' ? 'en' : 'vi'
  locale.value = next
  localStorage.setItem('workspace.lang', next)
}
</script>
