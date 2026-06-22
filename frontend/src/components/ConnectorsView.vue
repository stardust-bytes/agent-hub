<template>
  <div class="flex-1 flex flex-col bg-background overflow-hidden">
    <div class="mx-auto max-w-5xl w-full px-6 pt-5 pb-4">
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
        </div>
        <span class="text-base font-semibold text-foreground">{{ t('connectors.header') }}</span>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto mx-auto max-w-5xl w-full px-6 pb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">

        <div v-for="connector in displayConnectors" :key="connector.type" class="flex items-center justify-between px-3 h-[3rem] border border-border rounded-lg bg-surface">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-sm text-foreground font-sans truncate">{{ connector.name }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-sm font-sans" :class="connector.enabled ? 'text-success' : 'text-muted-foreground'">
              {{ connector.enabled ? t('connectors.connected') : t('connectors.disconnected') }}
            </span>
            <button v-if="!connector.enabled" @click="handleConnect(connector)"
              class="text-sm font-sans px-2.5 py-1 rounded-lg border border-green-600/30 text-success hover:bg-green-50 transition-colors duration-150">
              {{ t('connectors.connect') }}
            </button>
            <button v-if="connector.enabled" @click="handleDisconnect(connector)"
              class="text-sm px-1.5 py-0.5 font-sans text-danger rounded-lg border border-danger/40 hover:bg-danger/10 transition-colors duration-150">
              {{ t('connectors.disconnect') }}
            </button>
          </div>
        </div>

      </div>

      <div v-if="showTokenModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showTokenModal = false">
        <div class="w-full max-w-md rounded-xl bg-elevated p-5 shadow-xl border border-border">
          <h3 class="text-sm font-semibold text-foreground mb-3">{{ t('connectors.token_title', { name: tokenConnectorName }) }}</h3>
          <p class="text-xs text-muted-foreground mb-3">{{ t('connectors.token_hint', { name: tokenConnectorName }) }}</p>
          <input v-model="tokenInput" type="password" :placeholder="t('connectors.token_placeholder')"
            class="w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring mb-3" />
          <div class="flex items-center justify-end gap-2">
            <button @click="showTokenModal = false; tokenInput = ''"
              class="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors duration-150 hover:bg-muted">
              {{ t('connectors.cancel') }}
            </button>
            <button @click="saveTokenConnector()" :disabled="!tokenInput.trim()"
              class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 disabled:opacity-50">
              {{ t('connectors.connect') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="showOAuthKeyModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showOAuthKeyModal = false">
        <div class="w-full max-w-md rounded-xl bg-elevated p-5 shadow-xl border border-border">
          <h3 class="text-sm font-semibold text-foreground mb-3">{{ t('connectors.oauth_key_title', { name: oauthKeyConnectorName }) }}</h3>
          <p class="text-xs text-muted-foreground mb-3">{{ t('connectors.oauth_key_hint') }}</p>
          <label class="text-xs text-muted-foreground font-sans mb-1 block">Client ID</label>
          <input v-model="oauthClientId" type="text" placeholder="Client ID"
            class="w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring mb-3" />
          <label class="text-xs text-muted-foreground font-sans mb-1 block">Client Secret</label>
          <input v-model="oauthClientSecret" type="password" placeholder="Client Secret"
            class="w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring mb-3" />
          <div class="flex items-center justify-end gap-2">
            <button @click="showOAuthKeyModal = false; oauthClientId = ''; oauthClientSecret = ''"
              class="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors duration-150 hover:bg-muted">
              {{ t('connectors.cancel') }}
            </button>
            <button @click="saveOAuthKeyConnector()" :disabled="!oauthClientId.trim() || !oauthClientSecret.trim()"
              class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 disabled:opacity-50">
              {{ t('connectors.connect') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectorsStore } from '../stores/connectors'
import { getOAuthUrl } from '../api/connectors'

const { t } = useI18n()
const connectorsStore = useConnectorsStore()

interface ConnectorItem {
  id: string
  name: string
  type: string
  config: string
  account: string | null
  enabled: boolean
}

const oauthConnectors = [
  { type: 'google_gmail', name: 'Gmail' },
  { type: 'google_calendar', name: 'Google Calendar' },
  { type: 'google_drive', name: 'Google Drive' },
  { type: 'google_sheets', name: 'Google Sheets' },
]

const tokenConnectors = [
  { type: 'github', name: 'GitHub' },
  { type: 'slack', name: 'Slack' },
  { type: 'notion', name: 'Notion' },
]

const allConnectorTemplates = [...oauthConnectors, ...tokenConnectors]

const displayConnectors = computed(() => {
  return allConnectorTemplates.map(tmpl => {
    const saved = connectorsStore.connectors.find(c => c.type === tmpl.type) as ConnectorItem | undefined
    return {
      ...(saved ?? { id: '', config: '{}', account: null, enabled: false }),
      name: tmpl.name,
      type: tmpl.type,
    }
  })
})

const showTokenModal = ref(false)
const tokenInput = ref('')
const tokenConnectorType = ref('')
const tokenConnectorName = ref('')

const showOAuthKeyModal = ref(false)
const oauthClientId = ref('')
const oauthClientSecret = ref('')
const oauthKeyConnectorType = ref('')
const oauthKeyConnectorName = ref('')

onMounted(async () => {
  await connectorsStore.load()
})

async function handleConnect(connector: ConnectorItem) {
  const isOAuth = oauthConnectors.some(c => c.type === connector.type)
  if (isOAuth) {
    let config: Record<string, unknown> = {}
    try { config = JSON.parse(connector.config) } catch {}
    if (config.clientId && config.clientSecret) {
      await oauthConnect(connector.type)
    } else {
      oauthKeyConnectorType.value = connector.type
      oauthKeyConnectorName.value = connector.name
      oauthClientId.value = ''
      oauthClientSecret.value = ''
      showOAuthKeyModal.value = true
    }
  } else {
    tokenConnectorType.value = connector.type
    tokenConnectorName.value = connector.name
    tokenInput.value = ''
    showTokenModal.value = true
  }
}

async function saveOAuthKeyConnector() {
  await connectorsStore.upsert(oauthKeyConnectorType.value, {
    name: oauthKeyConnectorName.value,
    config: { clientId: oauthClientId.value.trim(), clientSecret: oauthClientSecret.value.trim() },
    enabled: false,
  })
  showOAuthKeyModal.value = false
  const type = oauthKeyConnectorType.value
  oauthClientId.value = ''
  oauthClientSecret.value = ''
  await oauthConnect(type)
}

async function oauthConnect(type: string) {
  try {
    const data = await getOAuthUrl(type)
    if (data.url) {
      window.open(data.url, '_blank')
    }
  } catch {}
}

async function saveTokenConnector() {
  await connectorsStore.upsert(tokenConnectorType.value, {
    name: tokenConnectorName.value,
    config: { token: tokenInput.value.trim() },
    enabled: true,
  })
  showTokenModal.value = false
  tokenInput.value = ''
}

async function handleDisconnect(connector: ConnectorItem) {
  if (connector.id) {
    await connectorsStore.remove(connector.id)
  }
}
</script>
