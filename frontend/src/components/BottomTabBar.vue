<template>
  <nav class="flex md:hidden items-center bg-cyber-dark border-t border-cyber-code-border h-[3rem] shrink-0">
    <RouterLink
      v-for="item in bottomItems"
      :key="item.name"
      :to="item.path"
      :title="t(item.labelKey)"
      :class="[
        'flex flex-col items-center justify-center gap-0.5 flex-1 h-full font-mono text-sm transition-colors duration-150',
        route.name === item.name
          ? 'text-cyber-accent bg-cyber-accent/10'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <span v-if="typeof item.icon === 'string'" class="w-[1.125rem] h-[1.125rem] flex items-center justify-center">{{ item.icon }}</span>
      <component v-else :is="item.icon" class="w-[1.125rem] h-[1.125rem]" />
      <span>{{ t(item.labelKey) }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { bottomItems } from '../config/navigation'

const { t } = useI18n()
const route = useRoute()
</script>
