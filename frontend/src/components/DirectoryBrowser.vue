<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 bg-foreground/40 z-50 flex items-center justify-center p-4" @click.self="emit('update:modelValue', false)">
      <div class="w-120 bg-surface border border-border rounded-lg shadow-xl flex flex-col" style="max-height: 80vh; max-width: 90vw">
        <div class="px-4 py-3 flex items-center justify-between shrink-0 border-b border-border">
          <span class="text-foreground text-sm font-sans truncate flex-1">{{ currentPath || t('cowork.browse.title') }}</span>
          <button @click="emit('update:modelValue', false)" class="text-muted-foreground text-base leading-none hover:text-foreground shrink-0 ml-2">✕</button>
        </div>
        <div class="overflow-y-auto flex-1 px-2 py-2">
          <div v-if="loading" class="text-muted-foreground text-sm text-center py-4">⟳ {{ t('cowork.browse.loading') }}</div>
          <div v-else-if="error" class="text-danger text-sm text-center py-4">{{ t('cowork.browse.error') }}</div>
          <div v-else-if="entries.length === 0 && !currentPath" class="text-muted-foreground text-sm text-center py-4">{{ t('cowork.browse.loading') }}</div>
          <div v-else-if="entries.length === 0" class="text-muted-foreground text-sm text-center py-4">{{ t('cowork.browse.empty') }}</div>
          <div v-else class="space-y-0.5">
            <div v-if="canGoUp"
              class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted transition-colors duration-150 text-primary text-sm font-sans"
              @click="goUp">
              <span>..</span>
              <span class="text-muted-foreground text-sm">{{ t('cowork.browse.parent') }}</span>
            </div>
            <div v-for="entry in entries" :key="entry.name"
              class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted transition-colors duration-150 text-muted-foreground text-sm font-sans"
              @click="navigate(entry.name)">
              <HiFolder class="w-4 h-4 text-primary shrink-0" />
              <span class="truncate">{{ entry.name }}</span>
            </div>
          </div>
        </div>
        <div class="px-3 py-3 border-t border-border bg-muted shrink-0">
          <button
            :disabled="!currentPath"
            @click="emit('select', currentPath)"
            class="w-full bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 rounded-lg transition-colors duration-150 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >{{ t('cowork.browse.select') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiFolder } from 'vue-icons-plus/hi'
import { browse, drives as apiDrives } from '../api/cowork'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; select: [path: string] }>()

const { t } = useI18n()

interface DirEntry {
  name: string
  isDirectory: boolean
}

const currentPath = ref('')
const entries = ref<DirEntry[]>([])
const loading = ref(false)
const error = ref(false)
const canGoUp = ref(false)
const pathStack = ref<string[]>([])
let abortController: AbortController | null = null

function joinPath(parent: string, child: string): string {
  if (!parent) return child
  const sep = parent.includes('\\') ? '\\' : '/'
  return parent.endsWith('\\') || parent.endsWith('/') ? parent + child : parent + sep + child
}

async function loadDrives() {
  abortController?.abort()
  abortController = new AbortController()
  loading.value = true
  error.value = false
  currentPath.value = ''
  canGoUp.value = false
  pathStack.value = []
  try {
    const driveList = await apiDrives(abortController.signal)
    entries.value = driveList.map(d => ({ name: d, isDirectory: true }))
  } catch { if (!abortController?.signal.aborted) error.value = true }
  loading.value = false
}

async function loadDirectory(dirPath: string) {
  abortController?.abort()
  abortController = new AbortController()
  loading.value = true
  error.value = false
  try {
    const data = await browse(dirPath, abortController.signal)
    currentPath.value = data.path
    entries.value = data.entries
  } catch { if (!abortController?.signal.aborted) error.value = true }
  loading.value = false
}

function navigate(name: string) {
  const target = joinPath(currentPath.value, name)
  pathStack.value.push(currentPath.value)
  canGoUp.value = true
  loadDirectory(target)
}

function goUp() {
  const prev = pathStack.value.pop()
  if (prev === '') {
    canGoUp.value = false
    loadDrives()
  } else if (prev) {
    loadDirectory(prev)
  }
}

watch(() => props.modelValue, (val) => {
  if (val) loadDrives()
})
</script>

