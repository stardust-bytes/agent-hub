<template>
  <div class="flex flex-col h-screen bg-cyber-bg font-mono overflow-hidden">
    <div class="flex flex-1 overflow-hidden">
      <SidebarNav :active-view="activeView" @navigate="activeView = $event" />
      <CoworkView    v-if="activeView === 'cowork'"   class="flex-1 overflow-hidden" @active-subagents-change="activeSubagents = $event" />
      <ToolsView     v-else-if="activeView === 'tools'"    class="flex-1 overflow-hidden" />
      <SettingsView   v-else-if="activeView === 'settings'"  class="flex-1 overflow-hidden" />
      <TasksView      v-else-if="activeView === 'tasks'"     class="flex-1 overflow-hidden" @ws-status="wsConnected = $event" />
      <ProvidersView  v-else-if="activeView === 'providers'"    class="flex-1 overflow-hidden" />
      <NotesView      v-else-if="activeView === 'notes'"        class="flex-1 overflow-hidden" />
      <AgentOutputView v-else-if="activeView === 'agent-output'" class="flex-1 overflow-hidden" />
      <!-- <PlansView      v-else-if="activeView === 'plans'"     class="flex-1 overflow-hidden" /> -->
      <ChatPanel      v-else                                  class="flex-1 overflow-hidden" @active-subagents-change="activeSubagents = $event" />
    </div>
    <BottomTabBar :active-view="activeView" @navigate="activeView = $event" />
    <StatusBar
      :db-connected="dbConnected"
      :ws-connected="wsConnected"
      :active-subagents="activeSubagents"
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
import ProvidersView from './ProvidersView.vue'
import ToolsView from './ToolsView.vue'
import NotesView from './NotesView.vue'
import PlansView from './PlansView.vue'
import CoworkView from './CoworkView.vue'
import AgentOutputView from './AgentOutputView.vue'
import StatusBar from './StatusBar.vue'

const activeView = ref<'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output'>('chat')
const dbConnected = ref(true)
const wsConnected = ref(false)
const activeSubagents = ref(0)
</script>
