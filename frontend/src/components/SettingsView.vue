<template>
  <div class="flex-1 flex flex-col bg-gray-50 overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-white border-b border-gray-200 flex items-center shrink-0">
      <span class="text-gray-900 text-sm font-semibold flex items-center gap-2">
        <HiCog class="w-4 h-4 text-gray-400" /> {{ t('settings.header') }}
      </span>
    </div>

    <div class="flex border-b border-gray-200 shrink-0">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        @click="router.push('/settings/' + tab.key)"
        :class="[
          'text-sm px-3 py-1.5 font-mono transition-colors duration-150',
          activeSettingsTab === tab.key
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-500 hover:text-blue-600',
        ]"
      >{{ t(tab.labelKey) }}</button>
    </div>

    <MemoryView v-if="activeSettingsTab === 'memories'" />
    <UsageView v-else-if="activeSettingsTab === 'usage'" />
    <ProvidersView v-else-if="activeSettingsTab === 'providers'" />
    <AgentsView v-else-if="activeSettingsTab === 'agents'" />
    <ToolsView v-else-if="activeSettingsTab === 'tools'" />
    <PermissionView v-else-if="activeSettingsTab === 'permissions'" />
    <div v-else class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">
        <div class="border-t border-gray-200 pt-4">
          <div class="text-gray-500 text-sm font-mono mb-2">{{ t('settings.info') }}</div>
          <div class="text-sm font-mono text-gray-500 space-y-1">
            <div>{{ t('settings.version') }}: 0.10.1</div>
            <div :class="healthy ? 'text-green-600' : 'text-red-600'">
              ● {{ healthy ? t('health.ok') : t('health.error') }}
            </div>
          </div>
        </div>

        <div class="border-t border-gray-200 pt-4 mt-4">
          <div class="text-gray-500 text-sm font-mono mb-2">{{ t('settings.models') }}</div>
          <div class="space-y-3">
            <div>
              <label class="text-gray-500 text-sm font-mono block mb-1">{{ t('settings.embedModel') }}</label>
              <select v-model="embedModelId" @change="saveSetting('embed_model_id', embedModelId)"
                class="w-full bg-white text-gray-900 text-sm font-mono  border border-gray-300 rounded-md px-2.5 py-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value="">{{ t('settings.defaultOption') }}</option>
                <option v-for="p in providers" :key="p.id" :value="String(p.id)">{{ p.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-gray-500 text-sm font-mono block mb-1">{{ t('settings.summaryModel') }}</label>
              <select v-model="summaryModelId" @change="saveSetting('summary_model_id', summaryModelId)"
                class="w-full bg-white text-gray-900 text-sm font-mono  border border-gray-300 rounded-md px-2.5 py-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value="">{{ t('settings.defaultOption') }}</option>
                <option v-for="p in providers" :key="p.id" :value="String(p.id)">{{ p.label }}</option>
              </select>
            </div>
            <div v-if="saved" class="text-green-600 text-sm font-mono">{{ t('settings.saved') }}</div>
            <div v-if="fetchError" class="text-red-600 text-sm font-mono mt-2">{{ t('settings.fetchError') }}</div>
          </div>
        </div>

        <div class="border-t border-gray-200 pt-4 mt-4">
          <div class="text-gray-500 text-sm font-mono mb-2">{{ t('agents.header') }}</div>
          <label class="flex items-center gap-2 text-gray-500 text-sm font-mono cursor-pointer">
            <input type="checkbox" v-model="autoDispatch" @change="saveAutoDispatch" class="accent-blue-600" />
            {{ t('agents.autoDispatch') }}
          </label>
        </div>

        <div class="border-t border-gray-200 pt-4 mt-4">
          <div class="text-gray-500 text-sm font-mono mb-2">{{ t('settings.mcpServers') }}</div>
          <div v-if="mcpServers.length === 0" class="text-gray-500/50 text-sm font-mono">
            {{ t('settings.noMcpServers') }}
          </div>
          <div v-for="server in mcpServers" :key="server.id"
            class="flex items-center justify-between py-1.5 px-2 bg-white border border-gray-200  mb-1">
            <div>
              <div class="text-gray-900 text-sm font-mono">{{ server.name }}</div>
              <div class="text-gray-500/50 text-xs font-mono">{{ server.type }} &middot; {{ server.id }}</div>
            </div>
            <span :class="server.enabled ? 'text-green-600' : 'text-gray-500/50'"
              class="text-sm font-mono">{{ server.enabled ? t('settings.mcpOn') : t('settings.mcpOff') }}</span>
          </div>
        </div>


      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { HiCog } from 'vue-icons-plus/hi'
import { storeToRefs } from 'pinia'
import MemoryView from './MemoryView.vue'
import PermissionView from './PermissionView.vue'
import UsageView from './UsageView.vue'
import ProvidersView from './ProvidersView.vue'
import ToolsView from './ToolsView.vue'
import AgentsView from './AgentsView.vue'
import { getHealth } from '../api/health'
import { listSettings, updateSetting } from '../api/settings'
import { useProvidersStore } from '../stores/providers'

const props = defineProps<{ tab?: string }>()

const { t } = useI18n()
const router = useRouter()

const TABS = [
  { key: 'general', labelKey: 'settings.header' },
  { key: 'providers', labelKey: 'providers.header' },
  { key: 'agents', labelKey: 'agents.header' },
  { key: 'tools', labelKey: 'tools.header' },
  { key: 'memories', labelKey: 'memory.title' },
  { key: 'usage', labelKey: 'usage.header' },
  { key: 'permissions', labelKey: 'permissions.header' },
]

const TAB_KEYS = new Set(TABS.map(t => t.key))

function resolveTab(tab: string | undefined): string {
  return tab && TAB_KEYS.has(tab) ? tab : 'general'
}

const activeSettingsTab = ref(resolveTab(props.tab))

watch(() => props.tab, (val) => {
  activeSettingsTab.value = resolveTab(val)
})

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
const autoDispatch = ref(true)

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
    autoDispatch.value = settingsData['agent.autoDispatch'] !== 'false'
    if (settingsData['mcp.servers']) {
      try {
        mcpServers.value = JSON.parse(settingsData['mcp.servers']) as McpServerInfo[]
      } catch { /* ignore malformed JSON */ }
    }
  } catch { fetchError.value = true }
})

async function saveAutoDispatch() {
  try { await updateSetting('agent.autoDispatch', autoDispatch.value ? 'true' : 'false') }
  catch { /* ignore */ }
}

async function saveSetting(key: string, value: string) {
  saved.value = false
  try {
    await updateSetting(key, value)
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } catch { /* ignore */ }
}
</script>





