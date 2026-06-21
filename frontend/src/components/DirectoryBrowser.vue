<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center p-4" @click.self="emit('update:modelValue', false)">
      <div class="w-120 bg-white border border-gray-200 rounded-md shadow-xl flex flex-col" style="max-height: 80vh; max-width: 90vw">
        <div class="px-4 py-3 flex items-center justify-between shrink-0 border-b border-gray-200">
          <span class="text-gray-900 text-sm font-mono truncate flex-1">{{ currentPath || t('cowork.browse.title') }}</span>
          <button @click="emit('update:modelValue', false)" class="text-gray-400 text-base leading-none hover:text-gray-700 shrink-0 ml-2">✕</button>
        </div>
        <div class="overflow-y-auto flex-1 px-2 py-2">
          <div v-if="loading" class="text-gray-500 text-sm text-center py-4">⟳ {{ t('cowork.browse.loading') }}</div>
          <div v-else-if="error" class="text-red-600 text-sm text-center py-4">{{ t('cowork.browse.error') }}</div>
          <div v-else-if="entries.length === 0 && !currentPath" class="text-gray-500 text-sm text-center py-4">{{ t('cowork.browse.loading') }}</div>
          <div v-else-if="entries.length === 0" class="text-gray-500 text-sm text-center py-4">{{ t('cowork.browse.empty') }}</div>
          <div v-else class="space-y-0.5">
            <div v-if="canGoUp"
              class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-50 transition-colors duration-150 text-blue-600 text-sm font-mono"
              @click="goUp">
              <span>..</span>
              <span class="text-gray-500 text-sm">{{ t('cowork.browse.parent') }}</span>
            </div>
            <div v-for="entry in entries" :key="entry.name"
              class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-50 transition-colors duration-150 text-gray-700 text-sm font-mono"
              @click="navigate(entry.name)">
              <HiFolder class="w-4 h-4 text-blue-500 shrink-0" />
              <span class="truncate">{{ entry.name }}</span>
            </div>
          </div>
        </div>
        <div class="px-3 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
          <button
            :disabled="!currentPath"
            @click="emit('select', currentPath)"
            class="w-full bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors duration-150 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

