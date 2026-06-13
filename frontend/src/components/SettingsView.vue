<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiCog class="w-3 h-3 inline" /> {{ t('settings.header') }}
      </span>
    </div>

    <div class="flex border-b border-cyber-code-border shrink-0">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        @click="activeSettingsTab = tab.key"
        :class="[
          'text-sm px-3 py-1.5 font-mono transition-colors duration-150',
          activeSettingsTab === tab.key
            ? 'text-cyber-accent border-b-2 border-cyber-accent'
            : 'text-cyber-muted hover:text-cyber-accent',
        ]"
      >{{ t(tab.labelKey) }}</button>
    </div>

    <MemoryView v-if="activeSettingsTab === 'memories'" />
    <UsageView v-else-if="activeSettingsTab === 'usage'" />
    <ProvidersView v-else-if="activeSettingsTab === 'providers'" />
    <ToolsView v-else-if="activeSettingsTab === 'tools'" />
    <PermissionView v-else-if="activeSettingsTab === 'permissions'" />
    <div v-else class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">
        <div class="border-t border-cyber-accent/10 pt-4">
          <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('settings.info') }}</div>
          <div class="text-sm font-mono text-cyber-muted space-y-1">
            <div>{{ t('settings.version') }}: 0.6.3</div>
            <div :class="healthy ? 'text-cyber-green' : 'text-red-400'">
              ● {{ healthy ? t('health.ok') : t('health.error') }}
            </div>
          </div>
        </div>

        <div class="border-t border-cyber-accent/10 pt-4 mt-4">
          <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('settings.models') }}</div>
          <div class="space-y-3">
            <div>
              <label class="text-cyber-muted text-xs font-mono block mb-1">{{ t('settings.embedModel') }}</label>
              <select v-model="embedModelId" @change="saveSetting('embed_model_id', embedModelId)"
                class="w-full bg-cyber-dark text-cyber-text text-sm font-mono rounded border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent">
                <option value="">{{ t('settings.defaultOption') }}</option>
                <option v-for="p in providers" :key="p.id" :value="String(p.id)">{{ p.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-cyber-muted text-xs font-mono block mb-1">{{ t('settings.summaryModel') }}</label>
              <select v-model="summaryModelId" @change="saveSetting('summary_model_id', summaryModelId)"
                class="w-full bg-cyber-dark text-cyber-text text-sm font-mono rounded border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent">
                <option value="">{{ t('settings.defaultOption') }}</option>
                <option v-for="p in providers" :key="p.id" :value="String(p.id)">{{ p.label }}</option>
              </select>
            </div>
            <div v-if="saved" class="text-cyber-green text-xs font-mono">{{ t('settings.saved') }}</div>
            <div v-if="fetchError" class="text-red-400 text-xs font-mono mt-2">{{ t('settings.fetchError') }}</div>
          </div>
        </div>

        <div class="border-t border-cyber-accent/10 pt-4 mt-4">
          <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('settings.mcpServers') }}</div>
          <div v-if="mcpServers.length === 0" class="text-cyber-muted/50 text-xs font-mono">
            {{ t('settings.noMcpServers') }}
          </div>
          <div v-for="server in mcpServers" :key="server.id"
            class="flex items-center justify-between py-1.5 px-2 bg-cyber-dark border border-cyber-code-border rounded mb-1">
            <div>
              <div class="text-cyber-text text-xs font-mono">{{ server.name }}</div>
              <div class="text-cyber-muted/50 text-2xs font-mono">{{ server.type }} &middot; {{ server.id }}</div>
            </div>
            <span :class="server.enabled ? 'text-cyber-green' : 'text-cyber-muted/50'"
              class="text-xs font-mono">{{ server.enabled ? t('settings.mcpOn') : t('settings.mcpOff') }}</span>
          </div>
        </div>


      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiCog } from 'vue-icons-plus/hi'
import { storeToRefs } from 'pinia'
import MemoryView from './MemoryView.vue'
import PermissionView from './PermissionView.vue'
import UsageView from './UsageView.vue'
import ProvidersView from './ProvidersView.vue'
import ToolsView from './ToolsView.vue'
import { getHealth } from '../api/health'
import { listSettings, updateSetting } from '../api/settings'
import { useProvidersStore } from '../stores/providers'

const { t } = useI18n()
const activeSettingsTab = ref('general')
const TABS = [
  { key: 'general', labelKey: 'settings.header' },
  { key: 'providers', labelKey: 'providers.header' },
  { key: 'tools', labelKey: 'tools.header' },
  { key: 'memories', labelKey: 'memory.title' },
  { key: 'usage', labelKey: 'usage.header' },
  { key: 'permissions', labelKey: 'permissions.header' },
]
const healthy = ref(false)

interface McpServerInfo {
  id: string
  name: string
  type: string
  enabled: boolean
}

const providersStore = useProvidersStore()
const { models } = storeToRefs(providersStore)

const providers = computed(() =>
  models.value.map(m => ({ id: m.id, label: `${m.providerName} / ${m.name}` }))
)

const embedModelId = ref<string>('')
const summaryModelId = ref<string>('')
const saved = ref(false)
const fetchError = ref(false)
const mcpServers = ref<McpServerInfo[]>([])

onMounted(async () => {
  try {
    const h = await getHealth()
    healthy.value = h.status === 'ok'
  } catch { /* ignore */ }

  try {
    await providersStore.loadModels()
    const settingsData = await listSettings()
    embedModelId.value = settingsData['embed_model_id'] ?? ''
    summaryModelId.value = settingsData['summary_model_id'] ?? ''
    if (settingsData['mcp.servers']) {
      try {
        mcpServers.value = JSON.parse(settingsData['mcp.servers']) as McpServerInfo[]
      } catch { /* ignore malformed JSON */ }
    }
  } catch { fetchError.value = true }
})

async function saveSetting(key: string, value: string) {
  saved.value = false
  try {
    await updateSetting(key, value)
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } catch { /* ignore */ }
}
</script>




