<template>
  <div class="flex-1 flex flex-col bg-background overflow-hidden">
    <div class="flex-1 overflow-y-auto mx-auto max-w-5xl px-6 py-6 w-full space-y-6">
      <div>
        <div class="text-muted-foreground text-sm font-sans mb-2">{{ t('permissions.mode.header') }}</div>
        <select v-model="permissionMode"
          class="w-full bg-surface text-foreground text-sm font-sans border border-input rounded-lg px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-ring">
          <option v-for="m in PERMISSION_MODES" :key="m" :value="m">{{ t(`permissions.mode.${m}`) }}</option>
        </select>
      </div>

      <div class="mt-4">
        <div class="text-muted-foreground text-sm font-sans mb-2">{{ t('permissions.requireApproval.header') }}</div>
        <div class="text-sm text-muted-foreground font-sans mb-2">{{ t('permissions.requireApproval.hint') }}</div>
        <div class="space-y-1">
          <div v-for="tool in ALL_TOOLS" :key="tool" class="flex items-center gap-2 py-1">
            <input type="checkbox" :checked="requireApprovalTools.includes(tool)"
              @change="toggleApprovalTool(tool)" class="accent-blue-600" />
            <span class="text-foreground text-sm font-sans">{{ tool }}</span>
          </div>
        </div>
      </div>

      <div v-if="permissionMode === 'auto'">
        <div class="text-muted-foreground text-sm font-sans mb-2">{{ t('permissions.yolo.config') }}</div>
        <div class="space-y-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="yoloConfig.failClosed" @change="saveYoloConfig" class="accent-blue-600" />
            <span class="text-foreground text-sm font-sans">{{ t('permissions.yolo.failClosed') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="yoloConfig.safeToolAllowlist" @change="saveYoloConfig" class="accent-blue-600" />
            <span class="text-foreground text-sm font-sans">{{ t('permissions.yolo.safeTools') }}</span>
          </label>
        </div>
      </div>

      <div v-if="permissionMode === 'auto'">
        <div class="text-muted-foreground text-sm font-sans mb-2">{{ t('permissions.rules.header') }}</div>
        <div class="space-y-1">
          <div v-for="rule in BLOCK_RULES" :key="rule.category" class="flex items-center gap-2 py-1">
            <input type="checkbox" :checked="!yoloConfig.disabledPatterns.includes(rule.category)"
              @change="toggleRule(rule.category)" class="accent-blue-600" />
            <span class="text-foreground text-sm font-sans">{{ t(`permissions.rules.${rule.category}`) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getYoloConfig, setYoloConfig } from '../api/agent'
import { getPermissions, updatePermissions } from '../api/agent'

const { t } = useI18n()

const PERMISSION_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'dontAsk', 'auto', 'plan']

const ALL_TOOLS = [
  'run_command',
  'delete_tasks', 'delete_note',
  'delete_knowledge', 'grep', 'glob',
]

const BLOCK_RULES = [
  { category: 'interpreters' },
  { category: 'package_runners' },
  { category: 'shells' },
  { category: 'eval' },
  { category: 'network' },
  { category: 'cloud_clis' },
  { category: 'git_destructive' },
  { category: 'irreversible' },
  { category: 'write_scripts' },
  { category: 'permission_bypass' },
]

const permissionMode = ref('default')
const requireApprovalTools = ref<string[]>([])

const yoloConfig = ref({
  failClosed: true,
  safeToolAllowlist: true,
  disabledPatterns: [] as string[],
})

onMounted(async () => {
  try {
    const data = await getYoloConfig()
    yoloConfig.value = { ...yoloConfig.value, ...data }
  } catch { /* ignore */ }
  try {
    const config = await getPermissions()
    permissionMode.value = config.permissionMode ?? 'default'
    requireApprovalTools.value = config.requireApprovalTools ?? []
  } catch { /* ignore */ }
})

watch(permissionMode, async (val) => {
  try {
    await updatePermissions({ permissionMode: val })
  } catch { /* ignore */ }
})

function toggleRule(category: string) {
  const idx = yoloConfig.value.disabledPatterns.indexOf(category)
  if (idx >= 0) yoloConfig.value.disabledPatterns.splice(idx, 1)
  else yoloConfig.value.disabledPatterns.push(category)
  saveYoloConfig()
}

async function saveYoloConfig() {
  try {
    await setYoloConfig({
      disabledPatterns: yoloConfig.value.disabledPatterns,
      failClosed: yoloConfig.value.failClosed,
      safeToolAllowlist: yoloConfig.value.safeToolAllowlist,
    })
  } catch { /* ignore */ }
}

async function toggleApprovalTool(tool: string) {
  const idx = requireApprovalTools.value.indexOf(tool)
  if (idx >= 0) requireApprovalTools.value.splice(idx, 1)
  else requireApprovalTools.value.push(tool)
  try {
    await updatePermissions({ requireApprovalTools: [...requireApprovalTools.value] })
  } catch { /* ignore */ }
}
</script>





