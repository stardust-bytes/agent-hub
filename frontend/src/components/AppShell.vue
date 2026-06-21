<template>
  <div class="flex flex-col h-screen bg-gray-50 text-gray-900 overflow-hidden">
    <div class="flex flex-1 overflow-hidden">
      <SidebarNav class="hidden xl:flex" />

      <div v-if="ui.sidebarOpen" class="fixed inset-0 z-40 xl:hidden" @click="ui.sidebarOpen = false">
        <div class="absolute inset-0 bg-gray-900/30"></div>
        <div class="relative h-full" @click.stop>
          <SidebarNav class="h-full" />
        </div>
      </div>

      <button @click="ui.sidebarOpen = !ui.sidebarOpen" class="fixed top-0 left-0 z-50 xl:hidden w-8 h-[3rem] flex items-center justify-center bg-white border-r border-b border-gray-200 text-gray-500 hover:text-blue-600 transition-colors duration-150 text-sm">
        {{ ui.sidebarOpen ? '✕' : '☰' }}
      </button>

      <div class="flex-1 flex overflow-hidden">
        <router-view class="flex-1 overflow-hidden" />
      </div>
    </div>
    <BottomTabBar class="md:hidden" />
    <StatusBar
      :db-connected="ui.dbConnected"
      :active-subagents="ui.activeSubagents"
    />
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import SidebarNav from './SidebarNav.vue'
import BottomTabBar from './BottomTabBar.vue'
import StatusBar from './StatusBar.vue'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
const route = useRoute()

watch(() => route.fullPath, () => { ui.sidebarOpen = false })
</script>
