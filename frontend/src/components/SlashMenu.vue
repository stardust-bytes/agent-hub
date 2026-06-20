<template>
  <div
    v-if="visible"
    class="absolute bottom-full left-0 right-0 mb-1 border border-cyber-accent/30 bg-cyber-dark overflow-hidden"
  >
    <div
      v-for="(cmd, i) in filteredCommands"
      :key="cmd.command"
      :class="i === selectedIndex ? 'bg-cyber-accent/20 text-cyber-text' : 'text-cyber-muted'"
      class="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm font-mono transition-colors duration-150 hover:bg-cyber-accent/10"
      @click="select(cmd.command)"
      @mouseenter="$emit('highlight', i)"
    >
      <span class="text-cyber-cyan shrink-0">{{ cmd.command }}</span>
      <span class="text-cyber-muted/60 truncate">{{ cmd.description }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentProfilesStore } from '../stores/agentProfiles'

const props = defineProps<{
  visible: boolean
  filter: string
  selectedIndex: number
}>()

const emit = defineEmits<{
  select: [command: string]
  highlight: [index: number]
}>()

const { t } = useI18n()
const agentProfiles = useAgentProfilesStore()

onMounted(() => {
  if (!agentProfiles.profiles.length) agentProfiles.load()
})

const commands = computed(() => [
  { command: '/plan', description: t('slash.plan') },
  { command: '/resume-plan', description: t('slash.resume_plan') },
  { command: '/help', description: t('slash.help') },
  { command: '/clear', description: t('slash.clear') },
  ...agentProfiles.profiles
    .filter(p => p.enabled)
    .map(p => ({ command: `/agent ${p.slug}`, description: p.name })),
])

const filteredCommands = computed(() =>
  commands.value.filter(c => c.command.startsWith(props.filter))
)

function select(command: string) {
  emit('select', command)
}
</script>
