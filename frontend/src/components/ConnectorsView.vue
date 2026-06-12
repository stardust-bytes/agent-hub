<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">{{ t('connectors.header') }}</span>
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">

        <div v-for="connector in connectors" :key="connector.type" class="flex items-center justify-between px-3 h-[3rem] border border-cyber-code-border mb-2 bg-cyber-dark">
          <div class="flex items-center gap-3 min-w-0">
            <img :src="`https://cdn.simpleicons.org/${connector.type}`" :alt="connector.name" class="w-5 h-5 shrink-0" />
            <span class="text-sm text-cyber-text font-mono truncate">{{ connector.name }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs font-mono" :class="connector.enabled ? 'text-cyber-green' : 'text-cyber-muted'">{{ connector.enabled ? t('connectors.connected') : t('connectors.disconnected') }}</span>
            <button @click="toggleConnector(connector)" class="text-xs font-mono px-2 py-0.5 border border-cyber-code-border transition-colors duration-150" :class="connector.enabled ? 'text-red-400/40 hover:text-red-400' : 'text-cyber-accent/40 hover:text-cyber-accent'">{{ connector.enabled ? t('connectors.disconnect') : t('connectors.connect') }}</button>
          </div>
        </div>

        <div v-if="editingConnector" class="mt-4 border border-cyber-code-border p-4 bg-cyber-dark">
          <div class="text-sm text-cyber-accent font-mono mb-3">{{ editingConnector.name }}</div>
          <div class="space-y-2">
            <div v-for="(field, key) in configFields" :key="key">
              <label class="text-xs text-cyber-muted font-mono">{{ (field as any).label }}</label>
              <input v-model="(configValues as any)[key]" :type="(field as any).type || 'text'" class="w-full bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-code-text font-mono mt-1" />
            </div>
            <div class="flex gap-2 pt-1">
              <button @click="saveConnector" class="text-xs text-white font-mono px-3 py-1.5 bg-cyber-accent rounded transition-colors duration-150 hover:bg-cyber-accent/80">{{ t('connectors.save') }}</button>
              <button v-if="editingConnector.type === 'google' && oauthConfigured" @click="authorizeGoogle" class="text-xs text-cyber-accent font-mono px-3 py-1.5 border border-cyber-accent rounded transition-colors duration-150 hover:bg-cyber-accent/10">{{ t('connectors.authorize') }}</button>
              <button @click="editingConnector = null" class="text-xs text-cyber-muted font-mono px-3 py-1.5 border border-cyber-code-border rounded transition-colors duration-150 hover:text-cyber-text">{{ t('tasks.form.cancel') }}</button>
            </div>
            <div v-if="oauthStatus" class="text-xs font-mono" :class="oauthStatus.includes('✓') ? 'text-cyber-green' : 'text-cyber-orange'">{{ oauthStatus }}</div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Connector {
  id: string
  name: string
  type: string
  config: string
  enabled: boolean
}

const connectors = ref<Connector[]>([])
const editingConnector = ref<Connector | null>(null)
const configValues = ref<Record<string, string>>({})
const oauthConfigured = ref(false)
const oauthStatus = ref('')

const configFields = computed(() => {
  if (!editingConnector.value) return {}
  const type = editingConnector.value.type
  if (type === 'google') {
    return {
      clientId: { label: 'Client ID' },
      clientSecret: { label: 'Client Secret', type: 'password' },
      redirectUri: { label: 'Redirect URI' },
    }
  }
  if (type === 'slack') {
    return {
      botToken: { label: 'Bot Token', type: 'password' },
      signingSecret: { label: 'Signing Secret', type: 'password' },
    }
  }
  if (type === 'jira') {
    return {
      instanceUrl: { label: 'Instance URL' },
      email: { label: 'Email' },
      apiToken: { label: 'API Token', type: 'password' },
    }
  }
  if (type === 'github') {
    return {
      token: { label: 'Personal Access Token', type: 'password' },
    }
  }
  if (type === 'notion' || type === 'confluence') {
    return {
      apiKey: { label: 'API Key', type: 'password' },
      workspace: { label: 'Workspace' },
    }
  }
  return {}
})

const connectorTemplates = [
  { type: 'google', name: 'Google (Gmail, Calendar, Drive)' },
  { type: 'slack', name: 'Slack' },
  { type: 'jira', name: 'Jira / Linear' },
  { type: 'github', name: 'GitHub / GitLab' },
  { type: 'notion', name: 'Notion' },
  { type: 'confluence', name: 'Confluence' },
]

onMounted(async () => {
  await fetchConnectors()
})

async function fetchConnectors() {
  try {
    const res = await fetch('/api/connectors')
    if (res.ok) {
      const data: Connector[] = await res.json()
      connectors.value = data
    }
  } catch {}
}

async function toggleConnector(connector: Connector) {
  if (connector.enabled) {
    await fetch(`/api/connectors/${connector.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })
    connector.enabled = false
    editingConnector.value = null
    return
  }

  const template = connectorTemplates.find(t => t.type === connector.type)
  editingConnector.value = connector
  oauthStatus.value = ''
  oauthConfigured.value = false

  const parsed = connector.config ? JSON.parse(connector.config) : {}
  configValues.value = {}
  for (const key of Object.keys(configFields.value)) {
    configValues.value[key] = parsed[key] || ''
  }

  if (connector.type === 'google') {
    oauthConfigured.value = !!(parsed.tokens?.access_token)
    if (oauthConfigured.value) {
      connector.enabled = true
      oauthStatus.value = '✓ Authorized'
    }
  }
}

async function saveConnector() {
  if (!editingConnector.value) return
  const config: Record<string, unknown> = {}
  for (const key of Object.keys(configValues.value)) {
    config[key] = configValues.value[key]
  }

  const existing = connectors.value.find(c => c.type === editingConnector.value?.type)
  if (existing) {
    await fetch(`/api/connectors/${existing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, enabled: true }),
    })
  } else {
    await fetch('/api/connectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: editingConnector.value.type, name: editingConnector.value.name, config, enabled: true }),
    })
  }
  oauthStatus.value = '✓ Config saved'
  await fetchConnectors()
}

async function authorizeGoogle() {
  try {
    const res = await fetch('/api/oauth/auth-url')
    const data = await res.json()
    if (data.url) {
      window.open(data.url, '_blank')
      const c = connectors.value.find(c => c.type === 'google')
      if (c) c.enabled = true
      oauthConfigured.value = true
    }
  } catch { oauthStatus.value = '✗ Authorization failed' }
}
</script>
