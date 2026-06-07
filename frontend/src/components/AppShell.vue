<template>
  <div class="flex h-screen bg-cyber-bg font-mono overflow-hidden">
    <SidebarNav :active-view="activeView" @navigate="activeView = $event" />
    <ChatPanel
      class="border-r border-cyber-border"
      style="width: 45%"
      @last-message="lastAgentMessage = $event"
    />
    <ArtifactsPanel class="flex-1" :last-message="lastAgentMessage" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SidebarNav from './SidebarNav.vue'
import ChatPanel from './ChatPanel.vue'
import ArtifactsPanel from './ArtifactsPanel.vue'

const activeView = ref<'chat' | 'tasks' | 'files'>('chat')
const lastAgentMessage = ref('')
</script>
