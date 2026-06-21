<template>
  <div class="flex-1 flex flex-col bg-gray-50 overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-white border-b border-gray-200 flex items-center shrink-0">
      <span class="text-gray-900 text-sm font-semibold flex items-center gap-2">
        <HiFolder class="w-4 h-4 text-gray-400" /> {{ t('files.header') }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-2xl mx-auto space-y-4">

        <!-- Upload zone -->
        <div
          class="border-2 border-dashed border-gray-300 rounded-md bg-white p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/40 transition-colors duration-150"
          @click="triggerUpload"
          @dragover.prevent
          @drop.prevent="onDrop"
        >
          <input ref="fileInput" type="file" class="hidden" multiple @change="onFileChange" />
          <p class="text-gray-600 text-sm">{{ t('files.dropzone') }}</p>
          <p class="text-gray-400 text-sm font-mono mt-1">.pdf .docx .txt .md .ts .js .py</p>
        </div>

        <!-- Filter -->
        <input
          v-model="filter"
          :placeholder="t('files.filter')"
          class="w-full bg-white text-gray-900 text-sm px-2.5 py-1.5 rounded-md border border-gray-300 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />

        <!-- File list -->
        <div v-if="files.length === 0" class="text-center text-gray-500 text-sm py-8">
          {{ t('files.empty') }}
        </div>
        <div v-for="f in filteredFiles" :key="f.id"
          class="flex items-center gap-3 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm font-mono"
        >
          <div class="flex-1 min-w-0">
            <div class="text-gray-900 truncate">{{ f.filename }}</div>
            <div v-if="f.status === 'error' && f.errorMessage" class="text-red-600 text-sm truncate mt-0.5">{{ f.errorMessage }}</div>
          </div>
          <span class="text-gray-500 shrink-0 w-16 text-right">{{ formatSize(f.size) }}</span>
          <span :class="statusClass(f.status)" class="shrink-0 w-20 text-center">{{ statusLabel(f.status) }}</span>
          <button @click="deleteFile(f.id)" class="text-gray-500 hover:text-red-600 shrink-0 transition-colors duration-150">{{ t('files.delete') }}</button>
        </div>



      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiFolder } from 'vue-icons-plus/hi'
import { listKnowledge, deleteKnowledge, uploadKnowledge } from '../api/knowledge'
import type { KnowledgeFile } from '../api/knowledge'

const { t } = useI18n()
const files = ref<KnowledgeFile[]>([])
const filter = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const filteredFiles = computed(() =>
  files.value.filter(f => f.filename.toLowerCase().includes(filter.value.toLowerCase()))
)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusClass(status: string): string {
  if (status === 'ready') return 'text-green-600'
  if (status === 'indexing') return 'text-amber-600'
  return 'text-red-600'
}

function statusLabel(status: string): string {
  if (status === 'ready') return t('files.status.ready')
  if (status === 'indexing') return t('files.status.indexing')
  return t('files.status.error')
}

function triggerUpload() { fileInput.value?.click() }

function onDrop(e: DragEvent) {
  if (e.dataTransfer?.files) uploadFiles(e.dataTransfer.files)
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files) uploadFiles(target.files)
}

async function uploadFiles(fileList: FileList) {
  for (const file of Array.from(fileList)) {
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await uploadKnowledge(form)
      if (res.ok) {
        await loadFiles()
        startPolling()
      }
    } catch { /* ignore */ }
  }
}

async function deleteFile(id: number) {
  try {
    await deleteKnowledge(id)
    files.value = files.value.filter(f => f.id !== id)
  } catch { /* ignore */ }
}

async function loadFiles() {
  try {
    files.value = await listKnowledge()
  } catch { /* ignore */ }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    const hasIndexing = files.value.some(f => f.status === 'indexing')
    if (!hasIndexing && pollTimer) { clearInterval(pollTimer); pollTimer = null; return }
    try {
      files.value = await listKnowledge()
    } catch { /* ignore */ }
  }, 2000)
}

onMounted(async () => {
  await loadFiles()
  if (files.value.some(f => f.status === 'indexing')) startPolling()
})

onUnmounted(() => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
})
</script>





