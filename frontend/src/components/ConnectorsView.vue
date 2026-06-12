<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">{{ t('connectors.header') }}</span>
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">

        <div v-for="connector in displayConnectors" :key="connector.type" class="flex items-center justify-between px-3 h-[3rem] border border-cyber-code-border mb-2 bg-cyber-dark">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-sm text-cyber-text font-mono truncate">{{ connector.name }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs font-mono" :class="connector.enabled ? 'text-cyber-green' : 'text-cyber-muted'">
              {{ connector.enabled ? t('connectors.connected') : t('connectors.disconnected') }}
            </span>
            <button v-if="!connector.enabled" @click="connect(connector.type)"
              class="text-xs font-mono px-2 py-0.5 border border-cyber-code-border text-cyber-accent/40 hover:text-cyber-accent transition-colors duration-150">
              {{ t('connectors.connect') }}
            </button>
            <button v-if="connector.enabled" @click="disconnect(connector)"
              class="text-xs font-mono px-2 py-0.5 border border-cyber-code-border text-red-400/40 hover:text-red-400 transition-colors duration-150">
              {{ t('connectors.disconnect') }}
            </button>
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
  account: string | null
  enabled: boolean
}

const connectors = ref<Connector[]>([])

const connectorTemplates = [
  { type: 'google_gmail', name: 'Gmail' },
  { type: 'google_calendar', name: 'Google Calendar' },
  { type: 'google_drive', name: 'Google Drive' },
]

const displayConnectors = computed(() => {
  return connectorTemplates.map(t => {
    const saved = connectors.value.find(c => c.type === t.type)
    return saved ?? {
      id: '',
      name: t.name,
      type: t.type,
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

async function connect(type: string) {
  const clientId = prompt('Enter Google Client ID:')
  if (!clientId) return
  const clientSecret = prompt('Enter Google Client Secret:')
  if (!clientSecret) return
  const redirectUri = window.location.origin + '/api/connectors/oauth/callback'

  try {
    const res = await fetch(`/api/connectors/oauth/auth-url?type=${encodeURIComponent(type)}&clientId=${encodeURIComponent(clientId)}&clientSecret=${encodeURIComponent(clientSecret)}&redirectUri=${encodeURIComponent(redirectUri)}`)
    const data = await res.json()
    if (data.url) {
      window.open(data.url, '_blank')
      setTimeout(() => fetchConnectors(), 5000)
    }
  } catch {}
}

async function disconnect(connector: Connector) {
  await fetch(`/api/connectors/${connector.id}`, { method: 'DELETE' })
  await fetchConnectors()
}
</script>
