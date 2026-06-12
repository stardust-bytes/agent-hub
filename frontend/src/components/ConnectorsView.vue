<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">{{ t('connectors.header') }}</span>
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">

        <div v-for="connector in connectors" :key="connector.id" class="flex items-center justify-between px-3 h-[3rem] border border-cyber-code-border mb-2 bg-cyber-dark">
          <div class="flex items-center gap-3 min-w-0">
            <img :src="connector.icon" :alt="connector.name" class="w-5 h-5 shrink-0" />
            <span class="text-sm text-cyber-text font-mono truncate">{{ connector.name }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs font-mono" :class="connector.connected ? 'text-cyber-green' : 'text-cyber-muted'">{{ connector.connected ? t('connectors.connected') : t('connectors.disconnected') }}</span>
            <button @click="toggleConnector(connector)" class="text-xs font-mono px-2 py-0.5 border border-cyber-code-border transition-colors duration-150" :class="connector.connected ? 'text-red-400/40 hover:text-red-400' : 'text-cyber-accent/40 hover:text-cyber-accent'">{{ connector.connected ? t('connectors.disconnect') : t('connectors.connect') }}</button>
          </div>
        </div>

        <div v-if="editingConnector" class="mt-4 border border-cyber-code-border p-4 bg-cyber-dark">
          <div class="text-sm text-cyber-accent font-mono mb-3">{{ editingConnector.name }}</div>
          <div class="space-y-2">
            <div>
              <label class="text-xs text-cyber-muted font-mono">{{ t('connectors.clientId') }}</label>
              <input v-model="oauthClientId" class="w-full bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-code-text font-mono mt-1" />
            </div>
            <div>
              <label class="text-xs text-cyber-muted font-mono">{{ t('connectors.clientSecret') }}</label>
              <input v-model="oauthClientSecret" type="password" class="w-full bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-code-text font-mono mt-1" />
            </div>
            <div>
              <label class="text-xs text-cyber-muted font-mono">{{ t('connectors.redirectUri') }}</label>
              <input v-model="oauthRedirectUri" class="w-full bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-code-text font-mono mt-1" />
            </div>
            <div class="flex gap-2 pt-1">
              <button @click="saveOAuthConfig" class="text-xs text-white font-mono px-3 py-1.5 bg-cyber-accent rounded transition-colors duration-150 hover:bg-cyber-accent/80">{{ t('connectors.save') }}</button>
              <button v-if="oauthConfigured" @click="authorizeGoogle" class="text-xs text-cyber-accent font-mono px-3 py-1.5 border border-cyber-accent rounded transition-colors duration-150 hover:bg-cyber-accent/10">{{ t('connectors.authorize') }}</button>
              <button @click="editingConnector = null; editingConnectorId = ''" class="text-xs text-cyber-muted font-mono px-3 py-1.5 border border-cyber-code-border rounded transition-colors duration-150 hover:text-cyber-text">{{ t('tasks.form.cancel') }}</button>
            </div>
            <div v-if="oauthStatus" class="text-xs font-mono" :class="oauthStatus.includes('✓') ? 'text-cyber-green' : 'text-cyber-orange'">{{ oauthStatus }}</div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Connector {
  id: string
  name: string
  icon: string
  connected: boolean
}

const connectors = ref<Connector[]>([
  { id: 'google', name: 'Google (Gmail, Calendar, Drive)', icon: 'https://cdn.simpleicons.org/google', connected: false },
  { id: 'slack', name: 'Slack', icon: 'https://cdn.simpleicons.org/slack', connected: false },
  { id: 'jira', name: 'Jira / Linear', icon: 'https://cdn.simpleicons.org/jira', connected: false },
  { id: 'github', name: 'GitHub / GitLab', icon: 'https://cdn.simpleicons.org/github', connected: false },
  { id: 'notion', name: 'Notion', icon: 'https://cdn.simpleicons.org/notion', connected: false },
  { id: 'confluence', name: 'Confluence', icon: 'https://cdn.simpleicons.org/confluence', connected: false },
])

const editingConnectorId = ref('')
const editingConnector = ref<Connector | null>(null)
const oauthClientId = ref('')
const oauthClientSecret = ref('')
const oauthRedirectUri = ref(`${window.location.origin}/api/oauth/callback`)
const oauthConfigured = ref(false)
const oauthStatus = ref('')

async function toggleConnector(connector: Connector) {
  if (connector.connected) {
    connector.connected = false
    editingConnector.value = null
    editingConnectorId.value = ''
    return
  }
  editingConnectorId.value = connector.id
  editingConnector.value = connector
  oauthStatus.value = ''
  if (connector.id === 'google') {
    try {
      const res = await fetch('/api/oauth/config')
      if (res.ok) {
        const config = await res.json()
        if (config) {
          oauthClientId.value = config.clientId || ''
          oauthClientSecret.value = config.clientSecret || ''
          oauthRedirectUri.value = config.redirectUri || `${window.location.origin}/api/oauth/callback`
          oauthConfigured.value = !!(config.tokens?.access_token)
          connector.connected = oauthConfigured.value
          oauthStatus.value = oauthConfigured.value ? '✓ Authorized' : ''
        }
      }
    } catch {}
  }
}

async function saveOAuthConfig() {
  if (!editingConnector.value) return
  try {
    const res = await fetch('/api/oauth/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: oauthClientId.value, clientSecret: oauthClientSecret.value, redirectUri: oauthRedirectUri.value }),
    })
    if (res.ok) {
      oauthStatus.value = '✓ Config saved'
      oauthConfigured.value = true
    }
  } catch { oauthStatus.value = '✗ Save failed' }
}

async function authorizeGoogle() {
  try {
    const res = await fetch('/api/oauth/auth-url')
    const data = await res.json()
    if (data.url) {
      window.open(data.url, '_blank')
      const c = connectors.value.find(c => c.id === 'google')
      if (c) c.connected = true
    }
  } catch { oauthStatus.value = '✗ Authorization failed' }
}
</script>
