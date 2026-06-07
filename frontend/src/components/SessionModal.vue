<template>
  <BaseModal v-model="show" closable max-height="480px" @update:model-value="onClose">
    <template #header>
      <span class="text-cyber-accent text-xs font-mono tracking-widest">{{ t('sessions.header') }}</span>
      <button
        @click="createSession"
        class="text-cyber-accent/70 text-xs font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent"
      >{{ t('sessions.new') }}</button>
    </template>

    <div v-if="sessions.length === 0" class="px-3 py-4 text-xs text-cyber-accent/40 font-mono">
      {{ t('sessions.empty') }}
    </div>
    <div
      v-for="s in sessions"
      :key="s.id"
      class="px-3 py-2 flex items-center justify-between cursor-pointer transition-colors duration-150"
      :class="s.id === currentSessionId
        ? 'bg-cyber-accent/10'
        : 'hover:bg-[#1a1a2e]'"
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
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

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
const show = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

function onClose() {
  emit('update:modelValue', false)
}

async function fetchSessions() {
  try {
    const res = await fetch('/api/sessions')
    if (!res.ok) return
    sessions.value = (await res.json()) as SessionItem[]
  } catch { /* ignore */ }
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
    show.value = false
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
  show.value = false
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN')
}

watch(() => props.modelValue, (val) => {
  if (val) fetchSessions()
})
</script>
