<template>
  <div class="flex flex-col h-screen bg-cyber-bg font-mono overflow-hidden">
    <div class="flex flex-1 overflow-hidden">
      <SidebarNav :active-view="activeView" @navigate="activeView = $event" />
      <FilesView v-if="activeView === 'files'" class="flex-1 overflow-hidden" />
      <SettingsView v-else-if="activeView === 'settings'" class="flex-1 overflow-hidden" />
      <TasksView v-else-if="activeView === 'tasks'" class="flex-1 overflow-hidden" @ws-status="wsConnected = $event" />
      <ChatPanel v-else class="flex-1 overflow-hidden" />
    </div>
    <BottomTabBar :active-view="activeView" @navigate="activeView = $event" />
    <StatusBar
      :db-connected="dbConnected"
      :ws-connected="wsConnected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SidebarNav from './SidebarNav.vue'
import BottomTabBar from './BottomTabBar.vue'
import ChatPanel from './ChatPanel.vue'
import TasksView from './TasksView.vue'
import SettingsView from './SettingsView.vue'
import FilesView from './FilesView.vue'
import StatusBar from './StatusBar.vue'

const activeView = ref<'chat' | 'tasks' | 'files' | 'settings'>('chat')
const dbConnected = ref(true)
const wsConnected = ref(false)
</script>
