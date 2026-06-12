<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="xl:pl-3 pl-8 px-3 h-[3rem] bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiShieldCheck class="w-3 h-3 inline" /> {{ t('permissions.header') }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-6">
      <div>
        <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('permissions.mode.header') }}</div>
        <select v-model="permissionMode"
          class="w-full bg-cyber-dark text-cyber-text text-sm font-mono rounded border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent">
          <option v-for="m in PERMISSION_MODES" :key="m" :value="m">{{ t(`permissions.mode.${m}`) }}</option>
        </select>
      </div>

      <div v-if="permissionMode === 'auto'">
        <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('permissions.yolo.config') }}</div>
        <div class="space-y-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="yoloConfig.failClosed" @change="saveYoloConfig" class="accent-cyber-accent" />
            <span class="text-cyber-text text-xs font-mono">{{ t('permissions.yolo.failClosed') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="yoloConfig.safeToolAllowlist" @change="saveYoloConfig" class="accent-cyber-accent" />
            <span class="text-cyber-text text-xs font-mono">{{ t('permissions.yolo.safeTools') }}</span>
          </label>
        </div>
      </div>

      <div v-if="permissionMode === 'auto'">
        <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('permissions.rules.header') }}</div>
        <div class="space-y-1">
          <div v-for="rule in BLOCK_RULES" :key="rule.category" class="flex items-center gap-2 py-1">
            <input type="checkbox" :checked="!yoloConfig.disabledPatterns.includes(rule.category)"
              @change="toggleRule(rule.category)" class="accent-cyber-accent" />
            <span class="text-cyber-text text-xs font-mono">{{ t(`permissions.rules.${rule.category}`) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiShieldCheck } from 'vue-icons-plus/hi'

const { t } = useI18n()

const PERMISSION_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'dontAsk', 'auto', 'plan']

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

const yoloConfig = ref({
  failClosed: true,
  safeToolAllowlist: true,
  disabledPatterns: [] as string[],
})

onMounted(async () => {
  try {
    const res = await fetch('/api/agent/yolo-config')
    if (res.ok) {
      const data = await res.json() as { disabledPatterns?: string[]; failClosed?: boolean; safeToolAllowlist?: boolean }
      yoloConfig.value = { ...yoloConfig.value, ...data }
    }
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
    await fetch('/api/agent/yolo-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disabledPatterns: yoloConfig.value.disabledPatterns,
        failClosed: yoloConfig.value.failClosed,
        safeToolAllowlist: yoloConfig.value.safeToolAllowlist,
      }),
    })
  } catch { /* ignore */ }
}
</script>



