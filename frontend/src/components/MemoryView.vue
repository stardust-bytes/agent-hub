<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiSave class="w-3 h-3 inline" /> {{ t('memory.title') }}
      </span>
      <button
        @click="openAddModal"
        class="text-sm font-mono font-bold text-black bg-cyber-accent px-2 py-1 hover:bg-cyber-accent/80 transition-colors duration-150"
      >{{ t('memory.create') }}</button>
    </div>

    <div class="xl:pl-3 pl-10 px-3 py-1.5 bg-cyber-dark/40 flex items-center gap-2 shrink-0">
      <span class="text-cyber-muted text-sm font-mono">{{ t('tasks.filter.label') }}</span>
      <button
        v-for="f in TYPE_FILTERS"
        :key="f.value"
        @click="activeType = activeType === f.value ? '' : f.value"
        :class="[
          'text-sm px-2 py-0.5 font-mono transition-colors duration-150',
          activeType === f.value ? 'text-cyber-accent bg-cyber-accent/10' : 'text-cyber-muted/50 hover:text-cyber-accent',
        ]"
      >{{ t(f.labelKey) }}</button>
      <input
        v-model="searchQuery"
        :placeholder="t('memory.searchPlaceholder')"
        class="ml-auto bg-cyber-dark text-cyber-text text-sm font-mono  border border-cyber-code-border px-2 py-1 outline-none focus:border-cyber-accent w-48"
      />
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="text-cyber-muted/50 text-sm font-mono text-center py-8">
        {{ t('chat.thinking') }}
      </div>
      <div v-else-if="memories.length === 0" class="text-cyber-muted/50 text-sm font-mono text-center py-8">
        {{ t('memory.empty') }}
      </div>
      <div v-for="mem in filteredMemories" :key="mem.id"
        class="border border-cyber-code-border bg-cyber-dark p-3 flex flex-col gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-sm font-mono" :class="typeColor(mem.type)">{{ typeLabel(mem.type) }}</span>
          <span class="text-cyber-text text-sm font-mono truncate">{{ mem.title }}</span>
          <span v-if="isAutoExtracted(mem)" class="text-cyber-muted/40 text-2xs font-mono">{{ t('memory.auto_extracted') }}</span>
        </div>
        <div class="text-cyber-muted/80 text-sm font-mono line-clamp-2">{{ mem.content }}</div>
        <div class="flex justify-end gap-1 mt-auto pt-1">
          <button @click="openEditModal(mem)" class="text-sm px-1.5 py-0.5 font-mono text-cyber-accent border border-cyber-accent/50 hover:bg-cyber-accent/10 transition-colors duration-150">{{ t('memory.edit') }}</button>
          <button @click="openDeleteConfirm(mem.id)" class="text-sm px-1.5 py-0.5 font-mono text-red-400 border border-red-400/50 hover:bg-red-400/10 transition-colors duration-150">{{ t('memory.delete') }}</button>
        </div>
      </div>
    </div>

    <BaseModal v-model="showFormModal">
      <template #header>{{ editing ? t('memory.edit') : t('memory.create') }}</template>
      <div class="p-3 space-y-3">
          <div>
            <label class="text-cyber-muted text-sm font-mono block mb-1">{{ t('memory.form.type') }}</label>
            <BaseSelect v-model="formType" :options="typeFilterOptions" />
          </div>
          <div>
            <label class="text-cyber-muted text-sm font-mono block mb-1">{{ t('memory.form.title') }}</label>
            <input v-model="formTitle"
              class="w-full bg-cyber-dark text-cyber-text text-sm font-mono  border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent"
            />
          </div>
          <div>
            <label class="text-cyber-muted text-sm font-mono block mb-1">{{ t('memory.form.content') }}</label>
            <textarea v-model="formContent" rows="4"
              class="w-full bg-cyber-dark text-cyber-text text-sm font-mono  border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent resize-none"
            ></textarea>
        </div>
      </div>
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
import { HiSave } from 'vue-icons-plus/hi'
import BaseModal from './BaseModal.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'
import BaseSelect from './BaseSelect.vue'
import { useMemoriesStore } from '../stores/memories'

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
const memoriesStore = useMemoriesStore()

const memories = computed(() => memoriesStore.memories as Memory[])
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
  await memoriesStore.load()
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
      await memoriesStore.update(editing.value.id, body)
    } else {
      await memoriesStore.create(body)
    }
    showFormModal.value = false
  } catch { /* ignore */ }
}

async function onDeleteConfirmed() {
  if (!deletingId.value) return
  try {
    await memoriesStore.remove(deletingId.value)
  } catch { /* ignore */ }
  deletingId.value = null
}

onMounted(fetchMemories)
</script>





