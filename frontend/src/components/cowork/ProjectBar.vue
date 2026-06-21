<template>
  <div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-gray-200 shrink-0 bg-white">
    <span class="w-2 h-2 rounded-full shrink-0" :class="projectPath ? 'bg-green-500' : 'bg-gray-300'"></span>
    <div class="relative">
      <button @click="showProjectMenu = !showProjectMenu" class="flex items-center gap-1 text-sm text-gray-700 truncate max-w-60 hover:bg-gray-50 transition-colors duration-150 border border-gray-300 rounded-md px-2.5 py-1">
        {{ projectPath ? projectPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() : t('cowork.project.select') }}
        <svg class="w-3 h-3 shrink-0 text-gray-400" :class="showProjectMenu ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div v-if="showProjectMenu" class="fixed inset-0 z-40" @click="showProjectMenu = false"></div>
      <div v-if="showProjectMenu" class="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden">
        <button @click="emit('browseDirectory'); showProjectMenu = false" class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center gap-2 border-b border-gray-200">
          <span>📁</span> {{ t('cowork.connect.browse') }}
        </button>
        <div v-for="project in savedProjects" :key="project.id" class="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 border-b border-gray-200">
          <button @click="emit('selectProject', project.path); showProjectMenu = false" class="flex-1 text-left truncate">{{ project.name }}</button>
          <button @click="emit('deleteProject', project.id)" class="text-gray-400 hover:text-red-600 transition-colors duration-150 shrink-0 ml-2 text-sm">✕</button>
        </div>
        <button @click="showSaveModal = true; showProjectMenu = false" class="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-gray-50 transition-colors duration-150 flex items-center gap-2">
          <span>+</span> {{ t('cowork.project.saveAs') }}
        </button>
      </div>
    </div>
    <button v-if="projectPath" @click="emit('disconnect')" class="text-sm text-red-600 px-2.5 py-1 rounded-md border border-red-300 transition-colors duration-150 hover:bg-red-50">✕ {{ t('cowork.disconnect') }}</button>
    <div class="flex items-center gap-2 ml-auto">
      <button v-if="subagentCount != null && subagentCount > 0" @click="emit('toggleSubagentMonitor')" class="text-sm text-blue-600 px-2.5 py-1 rounded-md border border-blue-200 transition-colors duration-150 hover:bg-blue-50">◈ {{ subagentCount }}</button>
      <button v-if="projectPath" @click="emit('toggleArtifacts')" class="text-sm text-gray-600 px-2.5 py-1 rounded-md border border-gray-300 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900">{{ t('cowork.artifacts') }}</button>
    </div>
    <BaseModal v-model="showSaveModal" :closable="false">
      <template #header><span class="text-sm text-gray-900 font-semibold">{{ t('cowork.project.saveAs') }}</span></template>
      <div class="p-4">
        <input v-model="saveProjectName" @keyup.enter="onSave" class="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" :placeholder="t('cowork.project.name')" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button @click="showSaveModal = false" class="text-sm text-gray-700 px-3 py-1.5 border border-gray-300 rounded-md transition-colors duration-150 hover:bg-gray-50">{{ t('tasks.form.cancel') }}</button>
          <button @click="onSave" class="text-sm text-white px-3 py-1.5 bg-blue-600 rounded-md transition-colors duration-150 hover:bg-blue-700">{{ t('cowork.project.save') }}</button>
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
