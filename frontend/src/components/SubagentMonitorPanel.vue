<template>
  <div v-if="visible" class="fixed inset-0 z-40 flex">
    <div class="fixed inset-0 bg-gray-900/40" @click="emit('close')"></div>
    <div class="relative w-full max-w-3xl mx-auto my-4 bg-white border border-gray-200 rounded-md shadow-xl flex flex-col overflow-hidden" style="max-height: calc(100vh - 2rem)">
      <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
        <span class="text-sm text-gray-900 font-semibold">{{ t('subagent.panel.header') }}</span>
        <span v-if="sessions.length" class="text-xs text-gray-500 font-mono">({{ sessions.length }})</span>
        <button @click="emit('close')" class="ml-auto text-gray-400 text-base leading-none hover:text-gray-700 transition-colors duration-150">✕</button>
      </div>

      <div ref="panelBody" class="flex-1 overflow-y-auto p-2 space-y-2">
        <div v-for="s in sessions" :key="s.id" class="border-l-2 pl-2 py-1.5" :class="s.status === 'running' ? 'border-green-500' : 'border-gray-200'">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs text-blue-600 font-mono">◈ {{ s.name }}</span>
            <span v-if="s.status === 'running'" class="text-xs text-green-600 font-mono">● {{ t('subagent.session.running') }}</span>
            <span v-else-if="s.status === 'completed'" class="text-xs text-green-600 font-mono">✓ {{ t('subagent.session.done') }}</span>
            <span v-else class="text-xs text-red-600 font-mono">✗ {{ t('subagent.session.failed') }}</span>
            <span class="text-xs text-gray-500 font-mono ml-auto">{{ elapsed(s) }}</span>
          </div>
          <div ref="logAreaRefs" :data-session-id="s.id" class="max-h-96 overflow-y-auto space-y-0.5">
            <div v-for="(log, li) in s.logs" :key="li" class="text-xs font-mono leading-relaxed">
              <div v-if="log.type === 'thinking'" class="text-gray-500">⟳ {{ log.text }}</div>
              <div v-else-if="log.type === 'toolCall'" class="text-amber-700 break-all">
                <span v-if="isToolLong(log.text)">
                  <span v-if="!logExpanded[log.id || '']">[⚙] {{ toolPreview(log.text) }}</span>
                  <span v-else>[⚙] {{ log.text }}</span>
                  <button @click="toggleLogExpand(log.id || '')" class="text-blue-600 hover:text-blue-700 ml-1 transition-colors duration-150">{{ logExpanded[log.id || ''] ? t('subagent.log.collapse') : t('subagent.log.view') }}</button>
                </span>
                <span v-else>[⚙] {{ log.text }}</span>
              </div>
              <div v-else-if="log.type === 'toolResult'" class="text-green-700 break-all">{{ toolPreview(log.text) }}</div>
              <div v-else-if="log.type === 'token'" class="text-gray-800">{{ log.text }}</div>
              <div v-else-if="log.type === 'error'" class="text-red-600">✗ {{ log.text }}</div>
              <div v-else-if="log.type === 'done'" class="text-green-600">✓ {{ t('subagent.session.done') }}</div>
            </div>
          </div>
        </div>
        <div v-if="!sessions.length" class="text-center text-gray-500 text-sm py-8">{{ t('subagent.panel.empty') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

export interface SubagentLogEntry {
  id?: string
  type: 'thinking' | 'toolCall' | 'toolResult' | 'token' | 'error' | 'done'
  text: string
  timestamp: string
  toolName?: string
}

export interface SubagentSession {
  id: string
  name: string
  status: 'running' | 'completed' | 'failed'
  logs: SubagentLogEntry[]
  startedAt: string
  startedAtMs: number
  completedAt?: string
}

const props = defineProps<{
  visible: boolean
  sessions: SubagentSession[]
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const panelBody = ref<HTMLElement | null>(null)
const logExpanded = reactive<Record<string, boolean>>({})

function isToolLong(content: string): boolean {
  return content.length > 120
}

function toolPreview(content: string): string {
  return content.length > 120 ? content.slice(0, 120) + '...' : content
}

function toggleLogExpand(id: string) {
  logExpanded[id] = !logExpanded[id]
}

function elapsed(s: SubagentSession): string {
  const start = s.startedAtMs
  const sec = Math.floor((Date.now() - start) / 1000)
  if (sec < 0) return '0s'
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

watch(() => props.sessions.length, async () => {
  await nextTick()
  if (panelBody.value) {
    panelBody.value.scrollTop = panelBody.value.scrollHeight
  }
})
</script>
