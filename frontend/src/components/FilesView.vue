<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiFolder class="w-3 h-3 inline" /> {{ t('files.header') }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-2xl mx-auto space-y-4">

        <!-- Upload zone -->
        <div
          class="border-2 border-dashed border-cyber-accent/20 rounded p-6 text-center cursor-pointer hover:border-cyber-accent/40 transition-colors duration-150"
          @click="triggerUpload"
          @dragover.prevent
          @drop.prevent="onDrop"
        >
          <input ref="fileInput" type="file" class="hidden" multiple @change="onFileChange" />
          <p class="text-cyber-muted text-sm font-mono">{{ t('files.dropzone') }}</p>
          <p class="text-cyber-muted/60 text-sm font-mono mt-1">.pdf .docx .txt .md .ts .js .py</p>
        </div>

        <!-- Filter -->
        <input
          v-model="filter"
          :placeholder="t('files.filter')"
          class="w-full bg-cyber-dark text-cyber-text text-sm px-2 py-1.5 font-mono outline-none"
        />

        <!-- File list -->
        <div v-if="files.length === 0" class="text-center text-cyber-muted text-sm font-mono py-8">
          {{ t('files.empty') }}
        </div>
        <div v-for="f in filteredFiles" :key="f.id"
          class="flex items-center gap-3 bg-cyber-dark px-3 py-2 text-sm font-mono"
        >
          <span class="flex-1 text-cyber-text truncate">{{ f.filename }}</span>
          <span class="text-cyber-muted shrink-0 w-16 text-right">{{ formatSize(f.size) }}</span>
          <span :class="statusClass(f.status)" class="shrink-0 w-20 text-center">{{ statusLabel(f.status) }}</span>
          <button @click="deleteFile(f.id)" class="text-cyber-muted hover:text-red-400 shrink-0 transition-colors duration-150">{{ t('files.delete') }}</button>
        </div>

        <!-- Codebase watcher -->
        <div class="border-t border-cyber-accent/10 pt-4">
          <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('files.watch.title') }}</div>
          <div class="flex gap-2 items-center">
            <span class="text-cyber-muted text-sm font-mono">{{ t('files.watch.path') }}</span>
            <input v-model="watchDir" placeholder="/workspace" class="flex-1 bg-cyber-dark text-cyber-text text-sm px-2 py-1.5 font-mono outline-none" />
            <button @click="toggleWatch" class="px-3 py-1.5 text-sm font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 transition-colors duration-150">{{ t('files.watch.btn') }}</button>
          </div>
          <div v-if="watching" class="text-cyber-green text-sm font-mono mt-1">{{ t('files.watch.status') }} ({{ indexedCount }} files)</div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiFolder } from 'vue-icons-plus/hi'

interface KnowledgeFile {
  id: number
  filename: string
  size: number
  mimeType: string
  status: string
  chunkCount: number
  createdAt: string
}

const { t } = useI18n()
const files = ref<KnowledgeFile[]>([])
const filter = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const watchDir = ref('')
const watching = ref(false)
const indexedCount = ref(0)

const filteredFiles = computed(() =>
  files.value.filter(f => f.filename.toLowerCase().includes(filter.value.toLowerCase()))
)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusClass(status: string): string {
  if (status === 'ready') return 'text-cyber-green'
  if (status === 'indexing') return 'text-cyber-orange'
  return 'text-red-400'
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
      await fetch('/api/knowledge/upload', { method: 'POST', body: form })
      await loadFiles()
      startPolling()
    } catch { /* ignore */ }
  }
}

async function deleteFile(id: number) {
  try {
    await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
    files.value = files.value.filter(f => f.id !== id)
  } catch { /* ignore */ }
}

async function loadFiles() {
  try {
    const res = await fetch('/api/knowledge')
    if (res.ok) files.value = await res.json() as KnowledgeFile[]
  } catch { /* ignore */ }
}

async function toggleWatch() {
  if (!watchDir.value.trim()) return
  try {
    await fetch('/api/knowledge/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory: watchDir.value }),
    })
    watching.value = true
  } catch { /* ignore */ }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    const hasIndexing = files.value.some(f => f.status === 'indexing')
    if (!hasIndexing && pollTimer) { clearInterval(pollTimer); pollTimer = null; return }
    try {
      const res = await fetch('/api/knowledge')
      if (res.ok) files.value = await res.json()
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
