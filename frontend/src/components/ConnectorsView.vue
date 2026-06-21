<template>
  <div class="flex-1 flex flex-col bg-gray-50 overflow-hidden">
    <div class="xl:pl-3 pl-10 px-3 h-[3rem] bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
      <span class="text-gray-900 text-sm font-semibold">{{ t('connectors.header') }}</span>
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">

        <div v-for="connector in displayConnectors" :key="connector.type" class="flex items-center justify-between px-3 h-[3rem] border border-gray-200 rounded-md mb-2 bg-white">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-sm text-gray-900 font-mono truncate">{{ connector.name }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-sm font-mono" :class="connector.enabled ? 'text-green-600' : 'text-gray-500'">
              {{ connector.enabled ? t('connectors.connected') : t('connectors.disconnected') }}
            </span>
            <button v-if="!connector.enabled" @click="connect(connector.type)"
              class="text-sm font-mono px-2.5 py-1 rounded-md border border-green-600/30 text-green-600 hover:bg-green-50 transition-colors duration-150">
              {{ t('connectors.connect') }}
            </button>
            <button v-if="connector.enabled" @click="disconnect(connector)"
              class="text-sm px-1.5 py-0.5 font-mono text-red-600 rounded-md border border-red-300 hover:bg-red-50 transition-colors duration-150">
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

