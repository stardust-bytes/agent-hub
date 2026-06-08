<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiCog class="w-3 h-3 inline" /> {{ t('settings.header') }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">
        <div class="border-t border-cyber-accent/10 pt-4">
          <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('settings.info') }}</div>
          <div class="text-sm font-mono text-cyber-muted space-y-1">
            <div>{{ t('settings.version') }}: 0.1.0</div>
            <div :class="healthy ? 'text-cyber-green' : 'text-red-400'">
              ● {{ healthy ? t('health.ok') : t('health.error') }}
            </div>
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

const { t } = useI18n()
const healthy = ref(false)

onMounted(async () => {
  try {
    const healthRes = await fetch('/api/health')
    if (healthRes.ok) {
      const h = await healthRes.json() as { status: string }
      healthy.value = h.status === 'ok'
    }
  } catch { /* ignore */ }
})
</script>
