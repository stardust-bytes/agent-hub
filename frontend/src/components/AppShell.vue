<template>
  <div class="flex flex-col h-screen bg-cyber-bg font-mono overflow-hidden">
    <div class="flex flex-1 overflow-hidden">
      <SidebarNav :active-view="activeView" @navigate="activeView = $event" />
      <SettingsView v-if="activeView === 'settings'" class="flex-1 overflow-hidden" />
      <TasksView v-else-if="activeView === 'tasks'" class="flex-1 overflow-hidden" />
      <ChatPanel v-else class="flex-1 overflow-hidden" />
    </div>
    <StatusBar
      :model-name="modelName"
      :db-connected="dbConnected"
      :ws-connected="wsConnected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SidebarNav from './SidebarNav.vue'
import ChatPanel from './ChatPanel.vue'
import TasksView from './TasksView.vue'
import SettingsView from './SettingsView.vue'
import StatusBar from './StatusBar.vue'

const activeView = ref<'chat' | 'tasks' | 'files' | 'settings'>('chat')
const modelName = ref('llama3.2')
const dbConnected = ref(true)
const wsConnected = ref(false)
</script>
