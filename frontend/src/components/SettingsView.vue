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

        <div class="border-t border-cyber-accent/10 pt-4 mt-4">
          <h2 class="text-xs text-cyber-accent font-mono tracking-wider mb-2">{{ t('settings.oauth') }}</h2>
          <div class="space-y-2">
            <div>
              <label class="text-xs text-cyber-muted font-mono">{{ t('settings.oauthClientId') }}</label>
              <input v-model="oauthClientId" class="w-full bg-cyber-bg border border-cyber-code-border rounded px-2 py-1 text-xs text-cyber-code-text font-mono" />
            </div>
            <div>
              <label class="text-xs text-cyber-muted font-mono">{{ t('settings.oauthClientSecret') }}</label>
              <input v-model="oauthClientSecret" type="password" class="w-full bg-cyber-bg border border-cyber-code-border rounded px-2 py-1 text-xs text-cyber-code-text font-mono" />
            </div>
            <div>
              <label class="text-xs text-cyber-muted font-mono">{{ t('settings.oauthRedirectUri') }}</label>
              <input v-model="oauthRedirectUri" class="w-full bg-cyber-bg border border-cyber-code-border rounded px-2 py-1 text-xs text-cyber-code-text font-mono" />
            </div>
            <div class="flex gap-2">
              <button @click="saveOAuthConfig" class="px-3 py-1 text-xs font-mono rounded bg-cyber-accent text-white transition-colors duration-150 hover:bg-cyber-accent/80">
                {{ t('settings.oauthSave') }}
              </button>
              <button v-if="oauthConfigured" @click="authorizeGoogle" class="px-3 py-1 text-xs font-mono rounded border border-cyber-accent text-cyber-accent transition-colors duration-150 hover:bg-cyber-accent/10">
                {{ t('settings.oauthAuthorize') }}
              </button>
            </div>
            <p v-if="oauthStatus" class="text-xs font-mono" :class="oauthStatus.includes('✓') ? 'text-cyber-green' : 'text-cyber-orange'">{{ oauthStatus }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiCog } from 'vue-icons-plus/hi'
import MemoryView from './MemoryView.vue'
import PermissionView from './PermissionView.vue'
import UsageView from './UsageView.vue'

const { t } = useI18n()
const activeSettingsTab = ref('general')
const TABS = [
  { key: 'general', labelKey: 'settings.header' },
  { key: 'memories', labelKey: 'memory.title' },
  { key: 'usage', labelKey: 'usage.header' },
  { key: 'permissions', labelKey: 'permissions.header' },
]
const healthy = ref(false)

interface ProviderModelOption {
  id: number
  label: string
}

interface McpServerInfo {
  id: string
  name: string
  type: string
  enabled: boolean
}

const providers = ref<ProviderModelOption[]>([])
const embedModelId = ref<string>('')
const summaryModelId = ref<string>('')
const saved = ref(false)
const fetchError = ref(false)
const mcpServers = ref<McpServerInfo[]>([])
const oauthClientId = ref('')
const oauthClientSecret = ref('')
const oauthRedirectUri = ref(`${window.location.origin}/api/oauth/callback`)
const oauthConfigured = ref(false)
const oauthStatus = ref('')

onMounted(async () => {
  try {
    const healthRes = await fetch('/api/health')
    if (healthRes.ok) {
      const h = await healthRes.json() as { status: string }
      healthy.value = h.status === 'ok'
    }
  } catch { /* ignore */ }

  try {
    const [provRes, settingsRes] = await Promise.all([
      fetch('/api/providers/models'),
      fetch('/api/settings'),
    ])
    if (provRes.ok) {
      const models = await provRes.json() as Array<{ id: number; name: string; providerName: string }>
      providers.value = models.map(m => ({ id: m.id, label: `${m.providerName} / ${m.name}` }))
    }
    if (settingsRes.ok) {
      const settingsData = await settingsRes.json() as Record<string, string>
      embedModelId.value = settingsData['embed_model_id'] ?? ''
      summaryModelId.value = settingsData['summary_model_id'] ?? ''
      if (settingsData['mcp.servers']) {
        try {
          mcpServers.value = JSON.parse(settingsData['mcp.servers']) as McpServerInfo[]
        } catch { /* ignore malformed JSON */ }
      }
    }
  } catch { fetchError.value = true }

  try {
    const res = await fetch('/api/oauth/config')
    if (res.ok) {
      const config = await res.json()
      if (config) {
        oauthClientId.value = config.clientId || ''
        oauthClientSecret.value = config.clientSecret || ''
        oauthRedirectUri.value = config.redirectUri || `${window.location.origin}/api/oauth/callback`
        oauthConfigured.value = !!(config.tokens?.access_token)
        oauthStatus.value = oauthConfigured.value ? '✓ Authorized' : ''
      }
    }
  } catch {}
})

async function saveOAuthConfig() {
  try {
    const res = await fetch('/api/oauth/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: oauthClientId.value, clientSecret: oauthClientSecret.value, redirectUri: oauthRedirectUri.value }),
    })
    if (res.ok) oauthStatus.value = '✓ Config saved'
  } catch { oauthStatus.value = '✗ Save failed' }
}

async function authorizeGoogle() {
  try {
    const res = await fetch('/api/oauth/auth-url')
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank')
  } catch { oauthStatus.value = '✗ Authorization failed' }
}

async function saveSetting(key: string, value: string) {
  saved.value = false
  try {
    await fetch(`/api/settings/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } catch { /* ignore */ }
}
</script>




