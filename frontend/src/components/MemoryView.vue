<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 h-[3rem] bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiSave class="w-3 h-3 inline" /> {{ t('memory.title') }}
      </span>
      <button
        @click="openAddModal"
        class="text-sm font-mono font-bold text-black bg-cyber-accent px-2 py-1 hover:bg-cyber-accent/80 transition-colors duration-150"
      >{{ t('memory.create') }}</button>
    </div>

    <div class="px-3 py-1.5 bg-cyber-dark/40 flex items-center gap-2 shrink-0">
      <span class="text-cyber-muted text-xs font-mono">{{ t('tasks.filter.label') }}</span>
      <button
        v-for="f in TYPE_FILTERS"
        :key="f.value"
        @click="activeType = activeType === f.value ? '' : f.value"
        :class="[
          'text-xs px-2 py-0.5 font-mono transition-colors duration-150',
          activeType === f.value ? 'text-cyber-accent bg-cyber-accent/10' : 'text-cyber-muted/50 hover:text-cyber-accent',
        ]"
      >{{ t(f.labelKey) }}</button>
      <input
        v-model="searchQuery"
        :placeholder="t('memory.searchPlaceholder')"
        class="ml-auto bg-cyber-dark text-cyber-text text-xs font-mono rounded border border-cyber-code-border px-2 py-1 outline-none focus:border-cyber-accent w-48"
      />
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="text-cyber-muted/50 text-xs font-mono text-center py-8">
        {{ t('chat.thinking') }}
      </div>
      <div v-else-if="memories.length === 0" class="text-cyber-muted/50 text-xs font-mono text-center py-8">
        {{ t('memory.empty') }}
      </div>
      <div v-for="mem in filteredMemories" :key="mem.id"
        class="border-b border-cyber-code-border px-3 py-2 hover:bg-cyber-dark/40 transition-colors duration-150">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xs font-mono" :class="typeColor(mem.type)">{{ typeLabel(mem.type) }}</span>
            <span class="text-cyber-text text-sm font-mono truncate">{{ mem.title }}</span>
            <span v-if="isAutoExtracted(mem)" class="text-cyber-muted/40 text-2xs font-mono">{{ t('memory.auto_extracted') }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button @click="openEditModal(mem)" class="text-cyber-muted/50 hover:text-cyber-accent transition-colors duration-150">
              <HiPencil class="w-3 h-3" />
            </button>
            <button @click="openDeleteConfirm(mem.id)" class="text-cyber-muted/50 hover:text-red-400 transition-colors duration-150">
              <HiTrash class="w-3 h-3" />
            </button>
          </div>
        </div>
        <div class="text-cyber-muted/80 text-xs font-mono mt-0.5 line-clamp-2">{{ mem.content }}</div>
      </div>
    </div>

    <BaseModal v-model="showFormModal">
      <template #header>{{ editing ? t('memory.edit') : t('memory.create') }}</template>
      <template #body>
        <div class="space-y-3">
          <div>
            <label class="text-cyber-muted text-xs font-mono block mb-1">{{ t('memory.form.type') }}</label>
            <BaseSelect v-model="formType" :options="typeFilterOptions" />
          </div>
          <div>
            <label class="text-cyber-muted text-xs font-mono block mb-1">{{ t('memory.form.title') }}</label>
            <input v-model="formTitle"
              class="w-full bg-cyber-dark text-cyber-text text-sm font-mono rounded border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent"
            />
          </div>
          <div>
            <label class="text-cyber-muted text-xs font-mono block mb-1">{{ t('memory.form.content') }}</label>
            <textarea v-model="formContent" rows="4"
              class="w-full bg-cyber-dark text-cyber-text text-sm font-mono rounded border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent resize-none"
            ></textarea>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button @click="showFormModal = false"
            class="text-sm font-mono text-cyber-muted px-3 py-1 hover:text-cyber-text transition-colors duration-150"
          >{{ t('tasks.form.cancel') }}</button>
          <button @click="saveMemory"
            class="text-sm font-mono font-bold text-black bg-cyber-accent px-4 py-1 hover:bg-cyber-accent/80 transition-colors duration-150"
          >{{ t('tasks.form.save') }}</button>
        </div>
      </template>
    </BaseModal>

    <BaseConfirmModal
      v-model="showConfirmModal"
      :title="t('memory.delete')"
      :message="t('memory.deleteConfirm')"
      @confirm="onDeleteConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiSave, HiPencil, HiTrash } from 'vue-icons-plus/hi'
import BaseModal from './BaseModal.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'
import BaseSelect from './BaseSelect.vue'

interface Memory {
  id: string
  type: string
  title: string
  content: string
  metadata?: string
  sessionId?: number | null
  createdAt: string
}

const { t } = useI18n()
const memories = ref<Memory[]>([])
const loading = ref(true)
const activeType = ref('')
const searchQuery = ref('')
const showFormModal = ref(false)
const showConfirmModal = ref(false)
const editing = ref<Memory | null>(null)
const deletingId = ref<string | null>(null)
const formType = ref('USER')
const formTitle = ref('')
const formContent = ref('')

const TYPE_FILTERS = [
  { value: 'USER', labelKey: 'memory.type.user' },
  { value: 'FEEDBACK', labelKey: 'memory.type.feedback' },
  { value: 'PROJECT', labelKey: 'memory.type.project' },
  { value: 'REFERENCE', labelKey: 'memory.type.reference' },
]

const typeFilterOptions = computed(() => TYPE_FILTERS.map(f => ({ value: f.value, label: t(f.labelKey) })))

const filteredMemories = computed(() => {
  let items = memories.value
  if (activeType.value) items = items.filter(m => m.type === activeType.value)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    items = items.filter(m => m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q))
  }
  return items
})

function typeColor(type: string): string {
  const colors: Record<string, string> = { USER: 'text-cyber-green', FEEDBACK: 'text-cyber-orange', PROJECT: 'text-cyber-cyan', REFERENCE: 'text-cyber-muted' }
  return colors[type] || 'text-cyber-muted'
}

function typeLabel(type: string): string {
  const key = `memory.type.${type.toLowerCase()}`
  return t(key)
}

function isAutoExtracted(mem: Memory): boolean {
  if (!mem.metadata) return false
  try {
    const meta = JSON.parse(mem.metadata) as { source?: string }
    return meta.source === 'auto-extract'
  } catch { return false }
}

async function fetchMemories() {
  loading.value = true
  try {
    const res = await fetch('/api/memories')
    if (res.ok) memories.value = await res.json() as Memory[]
  } catch { /* ignore */ }
  loading.value = false
}

function openAddModal() {
  editing.value = null
  formType.value = 'USER'
  formTitle.value = ''
  formContent.value = ''
  showFormModal.value = true
}

function openEditModal(mem: Memory) {
  editing.value = mem
  formType.value = mem.type
  formTitle.value = mem.title
  formContent.value = mem.content
  showFormModal.value = true
}

function openDeleteConfirm(id: string) {
  deletingId.value = id
  showConfirmModal.value = true
}

async function saveMemory() {
  const body = { type: formType.value, title: formTitle.value, content: formContent.value }
  try {
    if (editing.value) {
      await fetch(`/api/memories/${editing.value.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    showFormModal.value = false
    await fetchMemories()
  } catch { /* ignore */ }
}

async function onDeleteConfirmed() {
  if (!deletingId.value) return
  try {
    await fetch(`/api/memories/${deletingId.value}`, { method: 'DELETE' })
    await fetchMemories()
  } catch { /* ignore */ }
  deletingId.value = null
}

onMounted(fetchMemories)
</script>

