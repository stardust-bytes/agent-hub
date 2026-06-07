<template>
  <div class="flex h-screen bg-cyber-bg font-mono overflow-hidden">
    <SidebarNav :active-view="activeView" @navigate="activeView = $event" />
    <ChatPanel
      class="mx-auto border-x border-cyber-border"
      style="width: 45%; max-width: 48rem"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SidebarNav from './SidebarNav.vue'
import ChatPanel from './ChatPanel.vue'

const activeView = ref<'chat' | 'tasks' | 'files'>('chat')
</script>
