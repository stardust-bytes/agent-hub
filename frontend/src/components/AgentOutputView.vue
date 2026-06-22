<template>
  <div class="flex flex-col h-full bg-background font-sans overflow-hidden">
    <div class="mx-auto max-w-5xl w-full px-6 pt-5 pb-4">
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
          <HiDownload class="w-4 h-4" />
        </div>
        <span class="text-base font-semibold text-foreground">{{ t('agentOutput.header') }}</span>
        <span v-if="files.length > 0" class="text-xs font-sans text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{{ files.length }}</span>
        <div class="ml-auto">
          <button @click="fetchFiles" class="text-sm rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors duration-150 px-2.5 py-1">⟳ {{ t('agentOutput.refresh') }}</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-muted-foreground text-sm font-sans">
      {{ t('chat.thinking') }}
    </div>

    <div v-else-if="files.length === 0" class="flex-1 flex items-center justify-center text-muted-foreground text-sm font-sans">
      {{ t('agentOutput.empty') }}
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3 px-6 pb-6">
        <div v-for="file in files" :key="file.filename"
          class="border border-border rounded-lg bg-surface p-3 flex flex-col gap-2">
          <div class="text-sm font-sans text-foreground truncate" :title="file.filename">{{ file.filename }}</div>
          <div class="text-sm font-sans text-muted-foreground">{{ formatSize(file.size) }} · {{ formatDate(file.modifiedAt) }}</div>
          <div class="flex justify-end gap-1 mt-auto">
            <a :href="`/api/agent-output/${encodeURIComponent(file.filename)}/download`"
              class="text-sm px-1.5 py-0.5 font-sans text-primary rounded-lg border border-primary/30 hover:bg-primary/10 transition-colors duration-150"
              download>
              {{ t('agentOutput.download') }}
            </a>
            <button @click="deleteFile(file.filename)"
              class="text-sm px-1.5 py-0.5 font-sans text-danger rounded-lg border border-danger/40 hover:bg-danger/10 transition-colors duration-150">
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


