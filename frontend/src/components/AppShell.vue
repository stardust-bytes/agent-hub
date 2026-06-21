<template>
  <div class="flex h-screen flex-col overflow-hidden bg-background text-foreground">
    <TopBar @open-search="paletteOpen = true" @toggle-sidebar="ui.sidebarOpen = !ui.sidebarOpen" />

    <div class="flex flex-1 overflow-hidden">
      <SidebarNav class="hidden xl:flex" />

      <div v-if="ui.sidebarOpen" class="fixed inset-0 z-40 xl:hidden" @click="ui.sidebarOpen = false">
        <div class="absolute inset-0 bg-foreground/40"></div>
        <div class="relative h-full" @click.stop>
          <SidebarNav class="h-full" />
        </div>
      </div>

      <div class="flex flex-1 overflow-hidden">
        <router-view class="flex-1 overflow-hidden" />
      </div>
    </div>

    <StatusBar :db-connected="ui.dbConnected" :active-subagents="ui.activeSubagents" />
    <CommandPalette v-model:open="paletteOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import TopBar from './TopBar.vue'
import SidebarNav from './SidebarNav.vue'
import StatusBar from './StatusBar.vue'
import CommandPalette from './CommandPalette.vue'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
const route = useRoute()
const paletteOpen = ref(false)

watch(() => route.fullPath, () => { ui.sidebarOpen = false })

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteOpen.value = !paletteOpen.value
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>
