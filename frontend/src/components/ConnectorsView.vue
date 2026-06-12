<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">{{ t('connectors.header') }}</span>
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">

        <div v-for="connector in displayConnectors" :key="connector.type" class="mb-3">
          <div class="flex items-center justify-between px-3 h-[3rem] border border-cyber-code-border bg-cyber-dark">
            <div class="flex items-center gap-3 min-w-0">
              <img :src="`https://cdn.simpleicons.org/${connector.type === 'google' ? 'google' : connector.type}`" :alt="connector.name" class="w-5 h-5 shrink-0" />
              <span class="text-sm text-cyber-text font-mono truncate">{{ connector.name }}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-xs font-mono" :class="connector.enabled ? 'text-cyber-green' : 'text-cyber-muted'">
                {{ connector.enabled ? t('connectors.connected') : t('connectors.disconnected') }}
              </span>
              <button v-if="connector.type === 'google' && !connector.enabled" @click="connectGoogle"
                class="text-xs font-mono px-2 py-0.5 border border-cyber-code-border text-cyber-accent/40 hover:text-cyber-accent transition-colors duration-150">
                {{ t('connectors.connect') }}
              </button>
              <button v-if="connector.enabled" @click="disconnect(connector)"
                class="text-xs font-mono px-2 py-0.5 border border-cyber-code-border text-red-400/40 hover:text-red-400 transition-colors duration-150">
                {{ t('connectors.disconnect') }}
              </button>
            </div>
          </div>
          <div v-if="connector.enabled && connector.type === 'google'" class="border-x border-b border-cyber-code-border bg-cyber-bg/50">
            <div v-for="svc in googleServices" :key="svc.id" class="flex items-center justify-between px-6 py-2 border-b border-cyber-code-border last:border-b-0">
              <span class="text-xs font-mono text-cyber-text">{{ svc.label }}</span>
              <span class="text-xs font-mono text-cyber-green">● {{ t('connectors.connected') }} ({{ svc.toolCount }} tools)</span>
            </div>
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
  services: string
  config: string
  account: string | null
  enabled: boolean
}

const connectors = ref<Connector[]>([])

const googleServices = [
  { id: 'google_gmail', label: 'Gmail', toolCount: 5 },
  { id: 'google_calendar', label: 'Google Calendar', toolCount: 4 },
  { id: 'google_drive', label: 'Google Drive', toolCount: 4 },
]

const connectorTemplates = [
  { type: 'google', name: 'Google (Gmail, Calendar, Drive)' },
  { type: 'notion', name: 'Notion' },
  { type: 'slack', name: 'Slack' },
  { type: 'github', name: 'GitHub / GitLab' },
]

const displayConnectors = computed(() => {
  return connectorTemplates.map(t => {
    const saved = connectors.value.find(c => c.type === t.type)
    return saved ?? {
      id: '',
      name: t.name,
      type: t.type,
      services: '[]',
      config: '{}',
      account: null,
      enabled: false,
    }
  })
})

onMounted(async () => {
  await fetchConnectors()
})

async function fetchConnectors() {
  try {
    const res = await fetch('/api/connectors')
    if (res.ok) connectors.value = await res.json()
  } catch {}
}

async function connectGoogle() {
  const clientId = prompt('Enter Google Client ID:')
  if (!clientId) return
  const clientSecret = prompt('Enter Google Client Secret:')
  if (!clientSecret) return
  const redirectUri = window.location.origin + '/api/connectors/google/callback'

  try {
    const res = await fetch(`/api/connectors/google/auth-url?clientId=${encodeURIComponent(clientId)}&clientSecret=${encodeURIComponent(clientSecret)}&redirectUri=${encodeURIComponent(redirectUri)}`)
    const data = await res.json()
    if (data.url) {
      window.open(data.url, '_blank')
      setTimeout(() => fetchConnectors(), 5000)
    }
  } catch {}
}

async function disconnect(connector: Connector) {
  await fetch(`/api/connectors/${connector.id}`, {
    method: 'DELETE',
  })
  await fetchConnectors()
}
</script>
