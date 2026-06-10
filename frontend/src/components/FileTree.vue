<template>
  <div class="flex flex-col h-full bg-cyber-bg border-r border-cyber-code-border">
    <div class="px-3 py-2 text-xs text-cyber-accent font-mono border-b border-cyber-code-border shrink-0">
      {{ t('cowork.files') }}
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="text-xs text-cyber-muted font-mono px-3 py-2">{{ t('cowork.browse.loading') }}</div>
      <div v-else-if="error" class="text-xs text-red-400 font-mono px-3 py-2">{{ error }}</div>
      <div v-else class="py-1">
        <div
          v-for="entry in tree"
          :key="entry.path"
          :style="{ paddingLeft: entry.depth * 16 + 8 + 'px' }"
          class="flex items-center gap-1 px-2 py-0.5 cursor-pointer text-xs font-mono transition-colors duration-150"
          :class="selectedPath === entry.path ? 'bg-cyber-accent/10 text-cyber-accent' : 'text-cyber-text hover:bg-cyber-dark'"
          @click="onClick(entry)"
        >
          <span class="w-4 shrink-0 text-center">
            <template v-if="entry.isDirectory">{{ expanded[entry.path] ? '▼' : '▶' }}</template>
            <template v-else>📄</template>
          </span>
          <span class="truncate">{{ entry.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface TreeEntry {
  name: string
  path: string
  isDirectory: boolean
  depth: number
}

const props = defineProps<{
  projectPath: string
}>()

const emit = defineEmits<{
  fileSelect: [path: string]
}>()

const { t } = useI18n()

const tree = ref<TreeEntry[]>([])
const expanded = ref<Record<string, boolean>>({})
const loading = ref(false)
const error = ref('')
const selectedPath = ref<string | null>(null)

watch(() => props.projectPath, async (val) => {
  console.log('[FileTree] watch fired, projectPath:', val)
  if (val) await loadRoot(val)
}, { immediate: true })

async function loadRoot(projectPath: string) {
  console.log('[FileTree] loadRoot:', projectPath)
  loading.value = true
  error.value = ''
  try {
    const entries = await fetchChildren(projectPath, 0)
    console.log('[FileTree] entries loaded:', entries.length)
    tree.value = entries
  } catch (e) {
    console.error('[FileTree] loadRoot error:', e)
    error.value = t('cowork.browse.error')
  } finally {
    console.log('[FileTree] loading set to false')
    loading.value = false
  }
}

async function fetchChildren(dirPath: string, depth: number): Promise<TreeEntry[]> {
  const enc = encodeURIComponent(dirPath)
  console.log('[FileTree] fetching:', `/api/cowork/browse?path=${enc}`)
  const res = await fetch(`/api/cowork/browse?path=${enc}`)
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  const data = await res.json() as { entries: Array<{ name: string; isDirectory: boolean }> }
  return data.entries.map(e => ({
    name: e.name,
    path: dirPath.replace(/\/$/, '') + '/' + e.name,
    isDirectory: e.isDirectory,
    depth,
  }))
}

async function onClick(entry: TreeEntry) {
  if (entry.isDirectory) {
    const key = entry.path
    if (expanded.value[key]) {
      expanded.value[key] = false
      tree.value = tree.value.filter(e => !e.path.startsWith(key + '/') || e.path === key)
    } else {
      expanded.value[key] = true
      try {
        const children = await fetchChildren(entry.path, entry.depth + 1)
        const idx = tree.value.indexOf(entry)
        tree.value.splice(idx + 1, 0, ...children)
      } catch {
        expanded.value[key] = false
      }
    }
  } else {
    selectedPath.value = entry.path
    emit('fileSelect', entry.path)
  }
}
</script>
