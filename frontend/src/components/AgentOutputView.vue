<template>
  <div class="flex flex-col h-full bg-cyber-bg font-mono overflow-hidden">
    <div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-cyber-code-border shrink-0 bg-cyber-dark">
      <HiDownload class="w-3 h-3 text-cyber-accent" />
      <span class="text-sm text-cyber-accent font-mono">{{ t('agentOutput.header') }}</span>
      <button @click="fetchFiles" class="ml-auto text-sm text-cyber-accent font-mono px-2 py-0.5 border border-cyber-accent/30 transition-colors duration-150 hover:bg-cyber-accent/10">⟳ {{ t('agentOutput.refresh') }}</button>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-cyber-muted text-sm font-mono">
      {{ t('chat.thinking') }}
    </div>

    <div v-else-if="files.length === 0" class="flex-1 flex items-center justify-center text-cyber-muted text-sm font-mono">
      {{ t('agentOutput.empty') }}
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
        <div v-for="file in files" :key="file.filename"
          class="border border-cyber-code-border bg-cyber-dark p-3 flex flex-col gap-2">
          <div class="text-sm font-mono text-cyber-code-text truncate" :title="file.filename">{{ file.filename }}</div>
          <div class="text-sm font-mono text-cyber-muted">{{ formatSize(file.size) }} · {{ formatDate(file.modifiedAt) }}</div>
          <div class="flex justify-end gap-1 mt-auto">
            <a :href="`/api/agent-output/${encodeURIComponent(file.filename)}/download`"
              class="text-sm px-1.5 py-0.5 font-mono text-cyber-accent border border-cyber-accent/50 hover:bg-cyber-accent/10 transition-colors duration-150"
              download>
              {{ t('agentOutput.download') }}
            </a>
            <button @click="deleteFile(file.filename)"
              class="text-sm px-1.5 py-0.5 font-mono text-red-400 border border-red-400/50 hover:bg-red-400/10 transition-colors duration-150">
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


