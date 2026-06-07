<!-- frontend/src/components/SessionModal.vue -->
<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-cyber-dark/80 z-50 flex items-center justify-center"
      @click.self="$emit('update:modelValue', false)"
    >
      <div class="w-80 bg-cyber-bg border border-cyber-border flex flex-col max-h-[480px]">
        <div class="px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0">
          <span class="text-cyber-accent text-xs font-mono tracking-widest">{{ t('sessions.header') }}</span>
          <div class="flex items-center gap-2">
            <button
              @click="createSession"
              class="text-cyber-accent/70 text-xs font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent"
            >{{ t('sessions.new') }}</button>
            <button
              @click="$emit('update:modelValue', false)"
              class="text-cyber-accent/50 text-xs font-mono transition-colors duration-150 hover:text-cyber-accent"
            >✕</button>
          </div>
        </div>

        <div class="overflow-y-auto flex-1">
          <div v-if="sessions.length === 0" class="px-3 py-4 text-xs text-cyber-accent/40 font-mono">
            {{ t('sessions.empty') }}
          </div>
          <div
            v-for="s in sessions"
            :key="s.id"
            class="px-3 py-2 border-b border-cyber-border flex items-center justify-between cursor-pointer transition-colors duration-150 hover:bg-cyber-dark"
            :class="s.id === currentSessionId
              ? 'border-l-2 border-l-cyber-accent'
              : 'border-l-2 border-l-transparent'"
            @click="selectSession(s.id)"
          >
            <div class="min-w-0 flex-1">
              <div class="text-xs font-mono text-slate-100 truncate">{{ s.title }}</div>
              <div class="text-[10px] font-mono text-cyber-accent/40 mt-0.5">
                {{ formatDate(s.createdAt) }} · {{ t('sessions.messages', { n: s._count.messages }) }}
              </div>
            </div>
            <button
              @click.stop="deleteSession(s.id)"
              class="text-cyber-accent/30 text-xs font-mono ml-2 shrink-0 transition-colors duration-150 hover:text-red-400"
            >✕</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface SessionItem {
  id: number
  title: string
  createdAt: string
  _count: { messages: number }
}

const props = defineProps<{
  modelValue: boolean
  currentSessionId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', sessionId: number): void
  (e: 'created', sessionId: number): void
}>()

const { t } = useI18n()
const sessions = ref<SessionItem[]>([])

async function fetchSessions() {
  try {
    const res = await fetch('/api/sessions')
    if (!res.ok) return
    sessions.value = (await res.json()) as SessionItem[]
  } catch { /* ignore fetch errors */ }
}

async function createSession() {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) return
    const session = (await res.json()) as SessionItem
    await fetchSessions()
    emit('created', session.id)
    emit('update:modelValue', false)
  } catch { /* ignore */ }
}

async function deleteSession(id: number) {
  if (!confirm(t('sessions.delete.confirm'))) return
  try {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    await fetchSessions()
    if (id === props.currentSessionId) {
      const first = sessions.value[0]
      if (first) emit('select', first.id)
    }
  } catch { /* ignore */ }
}

function selectSession(id: number) {
  emit('select', id)
  emit('update:modelValue', false)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN')
}

watch(() => props.modelValue, (val) => {
  if (val) fetchSessions()
})
</script>
