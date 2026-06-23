<template>
  <div
    class="shrink-0"
    @dragover.prevent="onDragOver"
    @drop.prevent="onDrop"
  >
    <div class="max-w-60rem mx-auto w-full px-3 pb-3">
      <div class="bg-surface border border-input rounded-lg px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring transition-colors duration-150"
        :class="{ 'border-primary/50 bg-primary/[0.02]': dragOver }">
        <div v-if="attachments.length > 0" class="flex flex-wrap gap-1.5 pb-2 border-b border-border mb-2">
          <div
            v-for="att in attachments" :key="att.id"
            class="group flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs"
          >
            <HiPhotograph class="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span class="text-foreground max-w-[120px] truncate">{{ att.filename }}</span>
            <span v-if="att.status === 'uploading'" class="text-warning flex items-center gap-1">
              <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ t('chat.attachment.uploading') }}
            </span>
            <span v-else-if="att.status === 'uploaded'" class="text-success">✓</span>
            <span v-else class="text-danger">✗</span>
            <button
              v-if="att.status === 'error'"
              @click="retryUpload(att.id)"
              class="ml-0.5 text-warning hover:text-warning transition-colors"
              :title="t('chat.attachment.retry')"
            >
              <HiRefresh class="w-3 h-3" />
            </button>
            <button
              v-else
              @click="removeAttachment(att.id)"
              :disabled="att.status === 'uploading'"
              class="ml-0.5 text-muted-foreground hover:text-danger transition-colors disabled:opacity-30"
            >
              <HiTrash class="w-3 h-3" />
            </button>
          </div>
        </div>
        <form @submit.prevent="onSubmit" class="flex items-center gap-2">
          <button
            type="button"
            @click="openFilePicker"
            :disabled="streaming"
            class="shrink-0 text-muted-foreground hover:text-foreground transition-colors duration-150 disabled:opacity-40"
          >
            <HiPaperClip class="w-4 h-4" />
          </button>
          <input
            ref="fileInputEl"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            @change="onFileSelected"
            class="hidden"
          />
          <div class="relative flex-1">
            <input
              ref="inputEl"
              v-model="input"
              @keydown="onKeydown"
              class="flex-1 bg-transparent text-foreground text-sm outline-none font-sans placeholder-muted-foreground w-full"
              :placeholder="t('chat.placeholder')"
              :disabled="streaming"
              autocomplete="off"
              spellcheck="false"
            />
            <SlashMenu
              :visible="slashVisible"
              :commands="slashCommands"
              :selected-index="slashIndex"
              @select="applyCommand"
              @highlight="(i: number) => (slashIndex = i)"
            />
          </div>
          <button
            v-if="streaming"
            @click="emit('stop')"
            class="text-muted-foreground text-sm px-2 py-0.5 transition-colors duration-150 hover:text-foreground shrink-0"
          >{{ t('chat.stop') }}</button>
        </form>
        <div v-if="streaming" class="flex items-center gap-1 pt-2">
          <div
            v-for="i in 8" :key="i"
            class="w-1 h-1 bg-blue-600 rounded-full animate-dot-pulse"
            :style="{ animationDelay: `${(i - 1) * 0.15}s` }"
          />
        </div>
      </div>
      <div class="flex items-center justify-between pt-2">
        <div class="flex items-center gap-2">
          <ModelSelector
            :model-value="modelId"
            :models="models"
            :disabled="streaming"
            @update:model-value="(v: number | null) => emit('update:modelId', v)"
          />
        </div>
        <button
          @click="emit('openSessions')"
          class="inline-flex items-center gap-1.5 rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-foreground transition-colors duration-150 hover:bg-muted"
        >{{ t('sessions.header') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiPaperClip, HiPhotograph, HiTrash, HiRefresh } from 'vue-icons-plus/hi'
import ModelSelector from '../ModelSelector.vue'
import SlashMenu, { type SlashCommand } from '../SlashMenu.vue'
import { useAgentProfilesStore } from '../../stores/agentProfiles'
import { listSkills } from '../../api/skills'
import type { ProviderModelFlat, ChatAttachment } from './types'

const FILE_SIZE_LIMIT = 20 * 1024 * 1024
const MAX_CONCURRENT_UPLOADS = 3

const props = defineProps<{
  streaming: boolean
  models: ProviderModelFlat[]
  modelId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelId', v: number | null): void
  (e: 'submit', text: string, fileIds: number[], images?: { url: string; filename: string }[]): void
  (e: 'stop'): void
  (e: 'openSessions'): void
}>()

const { t } = useI18n()
const inputEl = ref<HTMLInputElement | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)
const input = ref('')
const slashVisible = ref(false)
const slashIndex = ref(0)
const attachments = ref<ChatAttachment[]>([])
const fileMap = new Map<string | number, File>()
const dragOver = ref(false)

const hasUploadingAttachments = computed(() => attachments.value.some(a => a.status === 'uploading'))

const profilesStore = useAgentProfilesStore()
const skills = ref<Array<{ name: string; description: string }>>([])

onMounted(async () => {
  try { skills.value = await listSkills() } catch {}
})

const staticSlashCommands = computed<SlashCommand[]>(() => [
  { command: '/help', description: t('slash.help') },
  { command: '/clear', description: t('slash.clear') },
])

const slashCommands = computed<SlashCommand[]>(() => {
  const raw = input.value
  const prefix = raw.startsWith('/') ? raw : ''

  const fromProfiles: SlashCommand[] = profilesStore.profiles
    .filter(p => p.enabled)
    .map(p => ({
      command: `/agent:${p.slug}`,
      description: `${t('slash.agent')} — ${p.name}`,
    }))

  const fromSkills: SlashCommand[] = skills.value.map(s => ({
    command: `/skill:${s.name}`,
    description: s.description,
  }))

  const all = [...staticSlashCommands.value, ...fromProfiles, ...fromSkills]

  if (!prefix) return all
  return all.filter(c => c.command.startsWith(prefix))
})

watch(input, () => {
  if (input.value.startsWith('/')) {
    slashVisible.value = true
    slashIndex.value = 0
  } else {
    slashVisible.value = false
  }
})

function onKeydown(e: KeyboardEvent) {
  if (!slashVisible.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    slashIndex.value = (slashIndex.value + 1) % slashCommands.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    slashIndex.value = (slashIndex.value - 1 + slashCommands.value.length) % slashCommands.value.length
  } else if (e.key === 'Enter' && slashCommands.value.length > 0) {
    e.preventDefault()
    applyCommand(slashCommands.value[slashIndex.value].command)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    slashVisible.value = false
  }
}

function applyCommand(cmd: string) {
  input.value = cmd + ' '
  slashVisible.value = false
  nextTick(() => {
    inputEl.value?.focus()
  })
}

onMounted(() => {
  inputEl.value?.focus()
  profilesStore.load()
})

function openFilePicker() {
  fileInputEl.value?.click()
}

function onFileSelected(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  enqueueFiles(Array.from(files))
  if (fileInputEl.value) {
    fileInputEl.value.value = ''
  }
}

function enqueueFiles(files: File[]) {
  const pending: { file: File; entry: ChatAttachment }[] = []
  for (const file of files) {
    if (file.size > FILE_SIZE_LIMIT || !file.type.startsWith('image/')) continue
    const id = uid()
    const entry: ChatAttachment = { id, filename: file.name, size: file.size, mimeType: file.type, status: 'uploading' }
    attachments.value.push(entry)
    fileMap.set(id, file)
    pending.push({ file, entry })
  }
  processQueue(pending)
}

async function processQueue(pending: { file: File; entry: ChatAttachment }[]) {
  const concurrency = MAX_CONCURRENT_UPLOADS
  let index = 0
  async function worker() {
    while (index < pending.length) {
      const item = pending[index++]
      await uploadFile(item.file, item.entry)
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, pending.length) }, () => worker())
  await Promise.all(workers)
}

async function uploadFile(file: File, entry: ChatAttachment) {
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/chat/upload', { method: 'POST', body: form })
    if (!res.ok) throw new Error('upload failed')
    const data = await res.json()
    entry.id = data.id
    entry.url = data.url
    entry.status = 'uploaded'
  } catch {
    entry.status = 'error'
  }
}

function retryUpload(id: string | number) {
  const entry = attachments.value.find(a => a.id === id)
  if (!entry || entry.status !== 'error') return
  const file = fileMap.get(id)
  if (!file) return
  entry.status = 'uploading'
  uploadFile(file, entry)
}

function removeAttachment(id: string | number) {
  const idx = attachments.value.findIndex(a => a.id === id)
  if (idx !== -1) {
    fileMap.delete(id)
    attachments.value.splice(idx, 1)
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function onDragOver(e: DragEvent) {
  dragOver.value = true
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  enqueueFiles(Array.from(files))
}

function onSubmit() {
  const text = input.value.trim()
  if (!text && attachments.value.length === 0) return
  if (hasUploadingAttachments.value) return

  const uploaded = attachments.value.filter(a => a.status === 'uploaded')
  const fileIds = uploaded.map(a => Number(a.id))
  const images = uploaded.map(a => ({ url: a.url!, filename: a.filename }))
  input.value = ''
  slashVisible.value = false
  attachments.value = []
  fileMap.clear()
  emit('submit', text, fileIds, images.length > 0 ? images : undefined)
}
</script>