<template>
  <div class="flex flex-col h-full bg-gray-50 font-mono overflow-hidden">
    <div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-gray-200 shrink-0 bg-white">
      <HiDownload class="w-4 h-4 text-gray-400" />
      <span class="text-sm text-gray-900 font-semibold">{{ t('agentOutput.header') }}</span>
      <button @click="fetchFiles" class="ml-auto text-sm text-blue-600 font-mono px-2.5 py-1 rounded-md border border-blue-600/30 transition-colors duration-150 hover:bg-blue-50">⟳ {{ t('agentOutput.refresh') }}</button>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-500 text-sm font-mono">
      {{ t('chat.thinking') }}
    </div>

    <div v-else-if="files.length === 0" class="flex-1 flex items-center justify-center text-gray-500 text-sm font-mono">
      {{ t('agentOutput.empty') }}
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
        <div v-for="file in files" :key="file.filename"
          class="border border-gray-200 rounded-md bg-white p-3 flex flex-col gap-2">
          <div class="text-sm font-mono text-gray-800 truncate" :title="file.filename">{{ file.filename }}</div>
          <div class="text-sm font-mono text-gray-500">{{ formatSize(file.size) }} · {{ formatDate(file.modifiedAt) }}</div>
          <div class="flex justify-end gap-1 mt-auto">
            <a :href="`/api/agent-output/${encodeURIComponent(file.filename)}/download`"
              class="text-sm px-1.5 py-0.5 font-mono text-blue-600 rounded-md border border-blue-600/30 hover:bg-blue-50 transition-colors duration-150"
              download>
              {{ t('agentOutput.download') }}
            </a>
            <button @click="deleteFile(file.filename)"
              class="text-sm px-1.5 py-0.5 font-mono text-red-600 rounded-md border border-red-300 hover:bg-red-50 transition-colors duration-150">
              {{ t('agentOutput.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <BaseConfirmModal
      v-model="showConfirm"
      :title="t('agentOutput.deleteConfirm')"
      :message="t('agentOutput.deleteConfirm')"
      @confirm="onDeleteConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiDownload } from 'vue-icons-plus/hi'
import BaseConfirmModal from './BaseConfirmModal.vue'
import { listOutputs, deleteOutput } from '../api/agentOutput'
import type { AgentOutputFile } from '../api/agentOutput'

const { t } = useI18n()

const files = ref<AgentOutputFile[]>([])
const loading = ref(true)
const showConfirm = ref(false)
const deletingFilename = ref('')

async function fetchFiles() {
  loading.value = true
  try {
    files.value = await listOutputs()
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}${t('agentOutput.bytes')}`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}${t('agentOutput.kb')}`
  return `${(bytes / (1024 * 1024)).toFixed(1)}${t('agentOutput.mb')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(fetchFiles)

async function deleteFile(filename: string) {
  deletingFilename.value = filename
  showConfirm.value = true
}

async function onDeleteConfirmed() {
  try {
    await deleteOutput(deletingFilename.value)
    files.value = files.value.filter(f => f.filename !== deletingFilename.value)
  } catch { /* ignore */ }
  deletingFilename.value = ''
}
</script>


