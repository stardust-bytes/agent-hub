<template>
  <div
    v-if="visible && commands.length"
    class="absolute bottom-full left-0 right-0 mb-1 border border-cyber-accent/30 bg-cyber-dark overflow-hidden z-20"
  >
    <div
      v-for="(cmd, i) in commands"
      :key="cmd.command"
      :class="i === selectedIndex ? 'bg-cyber-accent/20 text-cyber-text' : 'text-cyber-muted'"
      class="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm font-mono transition-colors duration-150 hover:bg-cyber-accent/10"
      @mousedown.prevent="emit('select', cmd.command)"
      @mouseenter="emit('highlight', i)"
    >
      <span class="text-cyber-cyan shrink-0">{{ cmd.command }}</span>
      <span class="text-cyber-muted/60 truncate">{{ cmd.description }}</span>
    </div>
  </div>
</template>

<script lang="ts">
export interface SlashCommand {
  command: string
  description: string
}
</script>

<script setup lang="ts">
defineProps<{
  visible: boolean
  commands: SlashCommand[]
  selectedIndex: number
}>()

const emit = defineEmits<{
  select: [command: string]
  highlight: [index: number]
}>()
</script>
