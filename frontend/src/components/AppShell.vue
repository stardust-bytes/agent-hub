<template>
  <div class="flex h-screen bg-cyber-bg font-mono overflow-hidden">
    <SidebarNav :active-view="activeView" @navigate="activeView = $event" />
    <TasksView v-if="activeView === 'tasks'" class="flex-1" />
    <ChatPanel
      v-else
      class="mx-auto border-x border-cyber-border"
      style="width: 45%; max-width: 48rem"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SidebarNav from './SidebarNav.vue'
import ChatPanel from './ChatPanel.vue'
import TasksView from './TasksView.vue'

const activeView = ref<'chat' | 'tasks' | 'files'>('chat')
</script>
