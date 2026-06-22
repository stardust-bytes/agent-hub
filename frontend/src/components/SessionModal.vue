<template>
  <BaseModal v-model="show" closable max-height="480px" @update:model-value="onClose">
    <template #header>
      <div class="flex items-center gap-2">
        <span class="text-foreground text-sm font-semibold">{{ t('sessions.header') }}</span>
        <button
          @click="createSession"
          class="text-primary text-sm px-2 py-0.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/10 transition-colors duration-150"
        >{{ t('sessions.new') }}</button>
      </div>
    </template>

    <div v-if="sessions.length === 0" class="px-4 py-4 text-sm text-muted-foreground">
      {{ t('sessions.empty') }}
    </div>
    <div
      v-for="s in sessions"
      :key="s.id"
      class="px-4 py-2 flex items-center justify-between cursor-pointer transition-colors duration-150 border-b border-border"
      :class="s.id === currentSessionId
        ? 'bg-primary/10'
        : 'hover:bg-muted'"
      @click="selectSession(s.id)"
    >
      <div class="min-w-0 flex-1">
        <div class="text-sm text-foreground truncate">{{ s.title }}</div>
        <div class="text-xs text-muted-foreground mt-0.5 font-sans">
          {{ formatDate(s.createdAt) }} · {{ t('sessions.messages', { n: s._count.messages }) }}
        </div>
      </div>
      <button
        @click.stop="deleteSession(s.id)"
        class="text-muted-foreground text-sm ml-2 shrink-0 transition-colors duration-150 hover:text-danger"
      >✕</button>
    </div>

    <BaseConfirmModal
      v-model="showConfirmModal"
      :title="t('sessions.delete.confirm')"
      :message="t('sessions.delete.confirm')"
      @confirm="onDeleteConfirmed"
    />
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'
import { useSessionsStore } from '../stores/sessions'
import { storeToRefs } from 'pinia'

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
const sessionsStore = useSessionsStore()
const { sessions: storeSessions } = storeToRefs(sessionsStore)
const sessions = computed(() => storeSessions.value as unknown as SessionItem[])
const showConfirmModal = ref(false)
const deletingSessionId = ref<number | null>(null)
const show = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

function onClose() {
  emit('update:modelValue', false)
}

async function fetchSessions() {
  await sessionsStore.load()
}

async function createSession() {
  try {
    const id = await sessionsStore.create()
    await fetchSessions()
    emit('created', id)
    show.value = false
  } catch { /* ignore */ }
}

async function deleteSession(id: number) {
  deletingSessionId.value = id
  showConfirmModal.value = true
}

async function onDeleteConfirmed() {
  if (deletingSessionId.value === null) return
  const id = deletingSessionId.value
  try {
    await sessionsStore.remove(id)
    if (id === props.currentSessionId) {
      const first = sessions.value[0]
      if (first) emit('select', first.id)
    }
  } catch { /* ignore */ }
  deletingSessionId.value = null
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
