<template>
  <div class="flex items-center gap-3 px-6 py-3 shrink-0 border-b border-border">
    <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
    </div>
    <span class="w-2 h-2 rounded-full shrink-0" :class="projectPath ? 'bg-success' : 'bg-border'"></span>
    <div class="relative min-w-0">
      <button @click="showProjectMenu = !showProjectMenu" class="flex items-center gap-1 text-sm font-sans truncate max-w-60 hover:bg-muted transition-colors duration-150 border border-input rounded-lg px-2.5 py-1">
        <span v-if="projectPath" class="truncate">
          <span class="text-foreground font-medium">{{ projectPath.replace(/\\/g, '/').split('/').filter(Boolean).shift() }}</span>
          <span class="text-muted-foreground">/{{ projectPath.replace(/\\/g, '/').split('/').filter(Boolean).slice(1).join('/') }}</span>
        </span>
        <span v-else class="text-muted-foreground">{{ t('cowork.project.select') }}</span>
        <svg class="w-3 h-3 shrink-0 text-muted-foreground" :class="showProjectMenu ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div v-if="showProjectMenu" class="fixed inset-0 z-40" @click="showProjectMenu = false"></div>
      <div v-if="showProjectMenu" class="absolute top-full left-0 mt-1 w-72 bg-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden">
        <button @click="emit('browseDirectory'); showProjectMenu = false" class="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors duration-150 flex items-center gap-2 border-b border-border">
          <span>📁</span> {{ t('cowork.connect.browse') }}
        </button>
        <div v-for="project in savedProjects" :key="project.id" class="flex items-center px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors duration-150 border-b border-border">
          <button @click="emit('selectProject', project.path); showProjectMenu = false" class="flex-1 text-left truncate">{{ project.name }}</button>
          <button @click="emit('deleteProject', project.id)" class="text-muted-foreground hover:text-danger transition-colors duration-150 shrink-0 ml-2 text-sm">✕</button>
        </div>
        <button @click="showSaveModal = true; showProjectMenu = false" class="w-full text-left px-3 py-2 text-sm text-primary hover:bg-muted transition-colors duration-150 flex items-center gap-2">
          <span>+</span> {{ t('cowork.project.saveAs') }}
        </button>
      </div>
    </div>
    <button v-if="projectPath" @click="emit('disconnect')" class="text-sm text-danger px-2.5 py-1 rounded-lg border border-danger/40 transition-colors duration-150 hover:bg-danger/10 shrink-0">✕ {{ t('cowork.disconnect') }}</button>
    <div class="flex items-center gap-2 ml-auto shrink-0">
      <button v-if="subagentCount != null && subagentCount > 0" @click="emit('toggleSubagentMonitor')" class="text-sm text-muted-foreground px-2.5 py-1 rounded-lg border border-input transition-colors duration-150 hover:bg-muted hover:text-foreground flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
        <span>{{ subagentCount }} {{ t('cowork.subagent.monitor') }}</span>
      </button>
      <button v-if="projectPath" @click="emit('toggleArtifacts')" class="text-sm text-muted-foreground px-2.5 py-1 rounded-lg border border-input transition-colors duration-150 hover:bg-muted hover:text-foreground">{{ t('cowork.artifacts') }}</button>
    </div>
    <BaseModal v-model="showSaveModal" :closable="false">
      <template #header><span class="text-sm text-foreground font-semibold">{{ t('cowork.project.saveAs') }}</span></template>
      <div class="p-4">
        <input v-model="saveProjectName" @keyup.enter="onSave" class="w-full bg-surface border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring" :placeholder="t('cowork.project.name')" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button @click="showSaveModal = false" class="text-sm text-muted-foreground px-3 py-1.5 border border-input rounded-lg transition-colors duration-150 hover:bg-muted">{{ t('tasks.form.cancel') }}</button>
          <button @click="onSave" class="text-sm text-primary-foreground px-3 py-1.5 bg-primary rounded-lg transition-colors duration-150 hover:bg-primary/90">{{ t('cowork.project.save') }}</button>
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
