<template>
  <div class="flex flex-col h-full bg-cyber-bg font-mono overflow-hidden">
    <div class="flex items-center justify-between xl:pl-3 pl-10 px-3 h-[3rem] border-b border-cyber-code-border bg-cyber-dark shrink-0">
      <h1 class="text-xs text-cyber-accent font-mono tracking-wider">{{ t('agentOutput.header') }}</h1>
      <button
        @click="fetchFiles"
        class="text-cyber-muted hover:text-cyber-accent transition-colors duration-150 text-xs font-mono"
      >
        ⟳
      </button>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-cyber-muted text-sm font-mono">
      {{ t('chat.thinking') }}
    </div>

    <div v-else-if="files.length === 0" class="flex-1 flex items-center justify-center text-cyber-muted text-sm font-mono">
      {{ t('agentOutput.empty') }}
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div class="px-4 py-2 text-xs text-cyber-muted font-mono grid grid-cols-[1fr_80px_120px_60px] gap-2 border-b border-cyber-code-border">
        <span>{{ t('agentOutput.filename') }}</span>
        <span class="text-right">{{ t('agentOutput.size') }}</span>
        <span class="text-right">{{ t('agentOutput.modified') }}</span>
        <span></span>
      </div>

      <div v-for="file in files" :key="file.filename" class="px-4 py-2 text-xs font-mono grid grid-cols-[1fr_80px_120px_60px] gap-2 items-center border-b border-cyber-code-border hover:bg-cyber-row transition-colors duration-150">
        <span class="text-cyber-code-text truncate" :title="file.filename">{{ file.filename }}</span>
        <span class="text-cyber-muted text-right">{{ formatSize(file.size) }}</span>
        <span class="text-cyber-muted text-right">{{ formatDate(file.modifiedAt) }}</span>
        <a
          :href="`/api/agent-output/${encodeURIComponent(file.filename)}/download`"
          class="text-cyber-accent hover:text-cyber-link transition-colors duration-150 text-center"
          download
        >
          {{ t('agentOutput.download') }}
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface AgentOutputFile {
  filename: string
  size: number
  modifiedAt: string
}

const files = ref<AgentOutputFile[]>([])
const loading = ref(true)

async function fetchFiles() {
  loading.value = true
  try {
    const res = await fetch('/api/agent-output')
    if (res.ok) {
      files.value = await res.json()
    }
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
</script>

