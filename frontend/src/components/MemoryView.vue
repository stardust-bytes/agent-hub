<template>
  <div class="flex-1 flex flex-col bg-background overflow-hidden">
    <div class="flex items-center gap-2 px-3 py-1.5 bg-background border-b border-border shrink-0">
      <span class="text-muted-foreground text-sm">{{ t('tasks.filter.label') }}</span>
      <button
        v-for="f in TYPE_FILTERS"
        :key="f.value"
        @click="activeType = activeType === f.value ? '' : f.value"
        :class="[
          'text-sm px-2 py-0.5 rounded-lg transition-colors duration-150',
          activeType === f.value ? 'text-blue-700 bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-muted',
        ]"
      >{{ t(f.labelKey) }}</button>
      <input
        v-model="searchQuery"
        :placeholder="t('memory.searchPlaceholder')"
        class="ml-auto bg-surface text-foreground text-sm rounded-lg border border-input px-2.5 py-1 outline-none focus:border-primary focus:ring-1 focus:ring-ring w-48"
      />
    </div>

    <div class="flex-1 overflow-y-auto mx-auto max-w-5xl px-6 py-6 w-full">
      <div v-if="loading" class="text-muted-foreground/50 text-sm font-mono text-center py-8">
        {{ t('chat.thinking') }}
      </div>
      <div v-else-if="memories.length === 0" class="text-muted-foreground/50 text-sm font-mono text-center py-8">
        {{ t('memory.empty') }}
      </div>
      <div v-for="mem in filteredMemories" :key="mem.id"
        class="border border-border rounded-lg bg-surface p-3 flex flex-col gap-2 mb-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-sm font-mono" :class="typeColor(mem.type)">{{ typeLabel(mem.type) }}</span>
          <span class="text-foreground text-sm font-mono truncate">{{ mem.title }}</span>
          <span v-if="isAutoExtracted(mem)" class="text-muted-foreground/40 text-xs font-mono">{{ t('memory.auto_extracted') }}</span>
        </div>
        <div class="text-muted-foreground/80 text-sm font-mono line-clamp-2">{{ mem.content }}</div>
        <div class="flex justify-end gap-1 mt-auto pt-1">
          <button @click="openEditModal(mem)" class="text-sm px-1.5 py-0.5 font-mono text-primary rounded-lg border border-primary/30 hover:bg-primary/10 transition-colors duration-150">{{ t('memory.edit') }}</button>
          <button @click="openDeleteConfirm(mem.id)" class="text-sm px-1.5 py-0.5 font-mono text-danger rounded-lg border border-danger/40 hover:bg-danger/10 transition-colors duration-150">{{ t('memory.delete') }}</button>
        </div>
      </div>
    </div>

    <BaseModal v-model="showFormModal">
      <template #header><span class="text-foreground text-sm font-mono">{{ editing ? t('memory.edit') : t('memory.create') }}</span></template>
      <div class="p-3 space-y-3">
          <div>
            <label class="text-muted-foreground text-sm font-mono block mb-1">{{ t('memory.form.type') }}</label>
            <BaseSelect v-model="formType" :options="typeFilterOptions" />
          </div>
          <div>
            <label class="text-muted-foreground text-sm font-mono block mb-1">{{ t('memory.form.title') }}</label>
            <input v-model="formTitle"
              class="w-full bg-surface text-foreground text-sm font-mono border border-input rounded-lg px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label class="text-muted-foreground text-sm font-mono block mb-1">{{ t('memory.form.content') }}</label>
            <textarea v-model="formContent" rows="4"
              class="w-full bg-surface text-foreground text-sm font-mono border border-input rounded-lg px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-ring resize-none"
            ></textarea>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button @click="showFormModal = false"
            class="text-sm font-mono text-muted-foreground px-3 py-1 hover:text-foreground transition-colors duration-150"
          >{{ t('tasks.form.cancel') }}</button>
          <button @click="saveMemory"
            class="text-sm font-mono font-bold text-primary-foreground bg-primary px-4 py-1 rounded-lg hover:bg-primary/90 transition-colors duration-150"
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
  const colors: Record<string, string> = { USER: 'text-success', FEEDBACK: 'text-warning', PROJECT: 'text-primary', REFERENCE: 'text-muted-foreground' }
  return colors[type] || 'text-muted-foreground'
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





