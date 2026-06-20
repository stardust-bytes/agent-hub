<template>
  <div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-cyber-code-border shrink-0 bg-cyber-dark">
    <span class="w-2 h-2 rounded-full shrink-0" :class="projectPath ? 'bg-cyber-green' : 'bg-cyber-muted'"></span>
    <div class="relative">
      <button @click="showProjectMenu = !showProjectMenu" class="flex items-center gap-1 text-sm text-cyber-text font-mono truncate max-w-60 hover:text-cyber-accent transition-colors duration-150 border border-cyber-code-border rounded px-2 py-0.5">
        {{ projectPath ? projectPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() : t('cowork.project.select') }}
        <svg class="w-3 h-3 shrink-0" :class="showProjectMenu ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div v-if="showProjectMenu" class="fixed inset-0 z-40" @click="showProjectMenu = false"></div>
      <div v-if="showProjectMenu" class="absolute top-full left-0 mt-1 w-72 bg-cyber-dark border border-cyber-code-border rounded z-50">
        <button @click="emit('browseDirectory'); showProjectMenu = false" class="w-full text-left px-3 py-2 text-sm text-cyber-text font-mono hover:bg-cyber-accent/10 transition-colors duration-150 flex items-center gap-2 border-b border-cyber-code-border">
          <span>📁</span> {{ t('cowork.connect.browse') }}
        </button>
        <div v-for="project in savedProjects" :key="project.id" class="flex items-center px-3 py-2 text-sm text-cyber-text font-mono hover:bg-cyber-accent/10 transition-colors duration-150 border-b border-cyber-code-border">
          <button @click="emit('selectProject', project.path); showProjectMenu = false" class="flex-1 text-left truncate">{{ project.name }}</button>
          <button @click="emit('deleteProject', project.id)" class="text-cyber-muted hover:text-red-400 transition-colors duration-150 shrink-0 ml-2 text-sm">✕</button>
        </div>
        <button @click="showSaveModal = true; showProjectMenu = false" class="w-full text-left px-3 py-2 text-sm text-cyber-accent font-mono hover:bg-cyber-accent/10 transition-colors duration-150 flex items-center gap-2">
          <span>+</span> {{ t('cowork.project.saveAs') }}
        </button>
      </div>
    </div>
    <button v-if="projectPath" @click="emit('disconnect')" class="text-sm text-red-400 font-mono px-2 py-0.5 border border-red-400/40 transition-colors duration-150 hover:bg-red-400/10">✕ {{ t('cowork.disconnect') }}</button>
    <div class="flex items-center gap-2 ml-auto">
      <button v-if="subagentCount != null && subagentCount > 0" @click="emit('toggleSubagentMonitor')" class="text-sm text-cyber-cyan font-mono px-2 py-0.5 border border-cyber-cyan/30 transition-colors duration-150 hover:bg-cyber-cyan/10">◈ {{ subagentCount }}</button>
      <button v-if="projectPath" @click="emit('toggleArtifacts')" class="text-sm text-cyber-muted font-mono px-2 py-0.5 border border-cyber-code-border transition-colors duration-150 hover:text-cyber-accent hover:border-cyber-accent/40">{{ t('cowork.artifacts') }}</button>
    </div>
    <BaseModal v-model="showSaveModal" :closable="false">
      <template #header><span class="text-sm text-cyber-text font-mono">{{ t('cowork.project.saveAs') }}</span></template>
      <div class="p-3">
        <input v-model="saveProjectName" @keyup.enter="onSave" class="w-full bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-code-text font-mono" :placeholder="t('cowork.project.name')" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button @click="showSaveModal = false" class="text-sm text-cyber-muted font-mono px-3 py-1.5 border border-cyber-code-border rounded transition-colors duration-150 hover:text-cyber-text">{{ t('tasks.form.cancel') }}</button>
          <button @click="onSave" class="text-sm text-white font-mono px-3 py-1.5 bg-cyber-accent rounded transition-colors duration-150 hover:bg-cyber-accent/80">{{ t('cowork.project.save') }}</button>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '../BaseModal.vue'

interface SavedProject {
  id: string
  name: string
  path: string
}

defineProps<{
  projectPath: string | null
  savedProjects: SavedProject[]
  subagentCount?: number
}>()

const emit = defineEmits<{
  browseDirectory: []
  selectProject: [path: string]
  deleteProject: [id: string]
  saveProject: [name: string]
  toggleArtifacts: []
  toggleSubagentMonitor: []
  disconnect: []
}>()

const { t } = useI18n()

const showProjectMenu = ref(false)
const showSaveModal = ref(false)
const saveProjectName = ref('')

function onSave() {
  if (!saveProjectName.value) return
  emit('saveProject', saveProjectName.value)
  saveProjectName.value = ''
  showSaveModal.value = false
}
</script>
