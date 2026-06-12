<template>
  <div class="flex flex-col h-screen bg-cyber-bg font-mono overflow-hidden">
    <div class="flex flex-1 overflow-hidden">
      <SidebarNav :active-view="activeView" @navigate="onNavigate" class="hidden xl:flex" />

      <div v-if="sidebarOpen" class="fixed inset-0 z-40 xl:hidden" @click="sidebarOpen = false">
        <div class="absolute inset-0 bg-black/60"></div>
        <div class="relative h-full" @click.stop>
          <SidebarNav :active-view="activeView" @navigate="onNavigate" class="h-full" />
        </div>
      </div>

      <button @click="sidebarOpen = !sidebarOpen" class="fixed top-0 left-0 z-50 xl:hidden w-8 h-[3rem] flex items-center justify-center bg-cyber-dark border-r border-b border-cyber-code-border text-cyber-muted hover:text-cyber-accent transition-colors duration-150 text-sm font-mono">
        {{ sidebarOpen ? '✕' : '☰' }}
      </button>

      <div class="flex-1 flex overflow-hidden">
        <CoworkView    v-if="activeView === 'cowork'"   class="flex-1 overflow-hidden" @active-subagents-change="activeSubagents = $event" />
        <ToolsView     v-else-if="activeView === 'tools'"    class="flex-1 overflow-hidden" />
        <SettingsView   v-else-if="activeView === 'settings'"  class="flex-1 overflow-hidden" />
        <TasksView      v-else-if="activeView === 'tasks'"     class="flex-1 overflow-hidden" @ws-status="wsConnected = $event" />
        <ProvidersView  v-else-if="activeView === 'providers'"    class="flex-1 overflow-hidden" />
        <NotesView      v-else-if="activeView === 'notes'"        class="flex-1 overflow-hidden" />
        <AgentOutputView v-else-if="activeView === 'agent-output'" class="flex-1 overflow-hidden" />
        <ChatPanel      v-else                                  class="flex-1 overflow-hidden" @active-subagents-change="activeSubagents = $event" />
      </div>
    </div>
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
import ChatPanel from './ChatPanel.vue'
import TasksView from './TasksView.vue'
import SettingsView from './SettingsView.vue'
import ProvidersView from './ProvidersView.vue'
import ToolsView from './ToolsView.vue'
import NotesView from './NotesView.vue'
import CoworkView from './CoworkView.vue'
import AgentOutputView from './AgentOutputView.vue'
import StatusBar from './StatusBar.vue'

const activeView = ref<'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output'>('cowork')
const sidebarOpen = ref(false)
const dbConnected = ref(true)
const wsConnected = ref(false)
const activeSubagents = ref(0)

function onNavigate(view: 'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output') {
  activeView.value = view
  sidebarOpen.value = false
}
</script>
