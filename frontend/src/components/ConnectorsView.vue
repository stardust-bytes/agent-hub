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
      <div class="max-w-xl">

        <div v-for="connector in displayConnectors" :key="connector.type" class="flex items-center justify-between px-3 h-[3rem] border border-border rounded-lg mb-2 bg-surface">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-sm text-foreground font-mono truncate">{{ connector.name }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-sm font-mono" :class="connector.enabled ? 'text-success' : 'text-muted-foreground'">
              {{ connector.enabled ? t('connectors.connected') : t('connectors.disconnected') }}
            </span>
            <button v-if="!connector.enabled" @click="connect(connector.type)"
              class="text-sm font-mono px-2.5 py-1 rounded-lg border border-green-600/30 text-success hover:bg-green-50 transition-colors duration-150">
              {{ t('connectors.connect') }}
            </button>
            <button v-if="connector.enabled" @click="disconnect(connector)"
              class="text-sm px-1.5 py-0.5 font-mono text-danger rounded-lg border border-danger/40 hover:bg-danger/10 transition-colors duration-150">
              {{ t('connectors.disconnect') }}
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectorsStore } from '../stores/connectors'
import { getOAuthUrl } from '../api/connectors'

const { t } = useI18n()
const connectorsStore = useConnectorsStore()

interface Connector {
  id: string
  name: string
  type: string
  config: string
  account: string | null
  enabled: boolean
}

const connectorTemplates = [
  { type: 'google_gmail', name: 'Gmail' },
  { type: 'google_calendar', name: 'Google Calendar' },
  { type: 'google_drive', name: 'Google Drive' },
  { type: 'google_sheets', name: 'Google Sheets' },
]

const displayConnectors = computed(() => {
  return connectorTemplates.map(tmpl => {
    const saved = connectorsStore.connectors.find(c => c.type === tmpl.type) as Connector | undefined
    return {
      ...(saved ?? { id: '', config: '{}', account: null, enabled: false }),
      name: tmpl.name,
      type: tmpl.type,
    }
  })
})

onMounted(async () => {
  await connectorsStore.load()
})

async function connect(type: string) {
  try {
    const data = await getOAuthUrl(type)
    if (data.url) {
      window.open(data.url, '_blank')
    }
  } catch {}
}

async function disconnect(connector: Connector) {
  await connectorsStore.remove(connector.id)
}
</script>

