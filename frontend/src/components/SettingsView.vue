<template>
  <div class="flex-1 flex flex-col bg-background overflow-hidden">
    <div class="mx-auto max-w-5xl w-full px-6 pt-5 pb-0">
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
          <HiCog class="w-4 h-4" />
        </div>
        <span class="text-base font-semibold text-foreground">{{ t('settings.header') }}</span>
      </div>
    </div>
    <div class="mx-auto max-w-5xl w-full px-6">
      <div class="flex gap-0 border-b border-border">
        <button v-for="tab in TABS" :key="tab.key"
          @click="router.push('/settings/' + tab.key)"
          class="font-sans text-sm px-3 py-1.5 transition-colors duration-150"
          :class="activeSettingsTab === tab.key ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'"
        >{{ t(tab.labelKey) }}</button>
      </div>
    </div>

    <UsageView v-if="activeSettingsTab === 'usage'" />
    <PermissionView v-else-if="activeSettingsTab === 'permissions'" />
    <div v-else class="flex-1 overflow-y-auto mx-auto max-w-5xl w-full px-6 py-6 space-y-4">
      <div class="border border-border rounded-lg bg-surface p-4 space-y-3">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
            <HiInformationCircle class="w-3.5 h-3.5" />
          </div>
          <span class="text-sm font-semibold text-foreground font-sans">{{ t('settings.info') }}</span>
        </div>
        <div class="text-sm font-sans text-muted-foreground space-y-1 pl-8">
          <div>{{ t('settings.version') }}: <span class="text-foreground">0.10.1</span></div>
          <div :class="healthy ? 'text-success' : 'text-danger'">
            ● {{ healthy ? t('health.ok') : t('health.error') }}
          </div>
        </div>
      </div>

      <div class="border border-border rounded-lg bg-surface p-4 space-y-3">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
            <HiCube class="w-3.5 h-3.5" />
          </div>
          <span class="text-sm font-semibold text-foreground font-sans">{{ t('settings.models') }}</span>
        </div>
        <div class="space-y-3 pl-8">
          <div>
            <label class="text-muted-foreground text-sm font-sans block mb-1">{{ t('settings.embedModel') }}</label>
            <BaseSelect v-model="embedModelId" :options="[{ value: '', label: t('settings.defaultOption') }, ...providers.map(p => ({ value: String(p.id), label: p.label }))]" @update:model-value="saveSetting('embed_model_id', $event as string)" />
          </div>
          <div>
            <label class="text-muted-foreground text-sm font-sans block mb-1">{{ t('settings.summaryModel') }}</label>
            <BaseSelect v-model="summaryModelId" :options="[{ value: '', label: t('settings.defaultOption') }, ...providers.map(p => ({ value: String(p.id), label: p.label }))]" @update:model-value="saveSetting('summary_model_id', $event as string)" />
          </div>
          <div v-if="saved" class="text-success text-sm font-sans">{{ t('settings.saved') }}</div>
          <div v-if="fetchError" class="text-danger text-sm font-sans mt-2">{{ t('settings.fetchError') }}</div>
        </div>
      </div>

      <div class="border border-border rounded-lg bg-surface p-4 space-y-3">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
            <HiUserGroup class="w-3.5 h-3.5" />
          </div>
          <span class="text-sm font-semibold text-foreground font-sans">{{ t('agents.header') }}</span>
        </div>
        <div class="pl-8">
          <label class="flex items-center gap-2 text-muted-foreground text-sm font-sans cursor-pointer">
            <BaseSwitch v-model="autoDispatch" @update:model-value="saveAutoDispatch" />
            {{ t('agents.autoDispatch') }}
          </label>
        </div>
      </div>

      <div class="border border-border rounded-lg bg-surface p-4 space-y-3">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
            <HiServer class="w-3.5 h-3.5" />
          </div>
          <span class="text-sm font-semibold text-foreground font-sans">{{ t('settings.mcpServers') }}</span>
        </div>
        <div class="pl-8 space-y-2">
          <div v-if="mcpServers.length === 0" class="text-muted-foreground/50 text-sm font-sans">
            {{ t('settings.noMcpServers') }}
          </div>
          <div v-for="server in mcpServers" :key="server.id"
            class="flex items-center justify-between py-1.5 px-2 bg-muted border border-border rounded-lg">
            <div>
              <div class="text-foreground text-sm font-sans">{{ server.name }}</div>
              <div class="text-muted-foreground/50 text-xs font-sans">{{ server.type }} &middot; {{ server.id }}</div>
            </div>
            <span :class="server.enabled ? 'text-success' : 'text-muted-foreground/50'"
              class="text-sm font-sans">{{ server.enabled ? t('settings.mcpOn') : t('settings.mcpOff') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { HiCog, HiInformationCircle, HiCube, HiUserGroup, HiServer } from 'vue-icons-plus/hi'
import { storeToRefs } from 'pinia'
import PermissionView from './PermissionView.vue'
import UsageView from './UsageView.vue'
import BaseSelect from './BaseSelect.vue'
import BaseSwitch from './BaseSwitch.vue'
import { getHealth } from '../api/health'
import { listSettings, updateSetting } from '../api/settings'
import { useProvidersStore } from '../stores/providers'

const TABS = [
  { key: 'general', labelKey: 'nav.settings' },
  { key: 'usage', labelKey: 'usage.header' },
  { key: 'permissions', labelKey: 'permissions.header' },
]

const props = defineProps<{ tab?: string }>()
const router = useRouter()
const { t } = useI18n()

const activeSettingsTab = computed(() => props.tab ?? 'general')

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





