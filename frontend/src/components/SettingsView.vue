<!-- frontend/src/components/SettingsView.vue -->
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-xs tracking-widest font-mono">
        <HiCog class="w-3 h-3 inline" /> {{ t('settings.header') }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">
        <div class="mb-4">
          <label class="text-[#888888] text-[10px] font-mono block mb-1">{{ t('settings.ollamaUrl') }}</label>
          <div class="flex gap-2">
            <input
              v-model="ollamaUrl"
              class="flex-1 bg-cyber-dark text-[#EEEEEE] text-sm px-2 py-1.5 font-mono outline-none"
              :disabled="saving === 'ollama.baseUrl'"
            />
            <button
              @click="save('ollama.baseUrl', ollamaUrl)"
              :disabled="saving === 'ollama.baseUrl'"
              class="px-3 py-1.5 text-xs font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 transition-colors duration-150"
            >{{ saved === 'ollama.baseUrl' ? t('settings.saved') : t('settings.save') }}</button>
          </div>
        </div>

        <div class="mb-6">
          <label class="text-[#888888] text-[10px] font-mono block mb-1">{{ t('settings.defaultModel') }}</label>
          <div class="flex gap-2 items-center">
            <input
              v-model="defaultModel"
              class="flex-1 bg-cyber-dark text-[#EEEEEE] text-sm px-2 py-1.5 font-mono outline-none"
              :disabled="saving === 'ollama.defaultModel'"
            />
            <button
              @click="save('ollama.defaultModel', defaultModel)"
              :disabled="saving === 'ollama.defaultModel'"
              class="px-3 py-1.5 text-xs font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 transition-colors duration-150"
            >{{ saved === 'ollama.defaultModel' ? t('settings.saved') : t('settings.save') }}</button>
          </div>
        </div>

        <div class="border-t border-cyber-accent/10 pt-4">
          <div class="text-[#888888] text-[10px] font-mono mb-2">{{ t('settings.info') }}</div>
          <div class="text-xs font-mono text-[#888888] space-y-1">
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

const ollamaUrl = ref('')
const defaultModel = ref('')
const saving = ref<string | null>(null)
const saved = ref<string | null>(null)
const healthy = ref(false)

async function save(key: string, value: string) {
  saving.value = key
  try {
    const res = await fetch(`/api/settings/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    saved.value = key
    setTimeout(() => { if (saved.value === key) saved.value = null }, 2000)
  } catch { /* ignore */ }
  saving.value = null
}

onMounted(async () => {
  try {
    const [settingsRes, healthRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/health'),
    ])
    if (settingsRes.ok) {
      const data = await settingsRes.json() as { ollama: { baseUrl: string; defaultModel: string } }
      ollamaUrl.value = data.ollama.baseUrl
      defaultModel.value = data.ollama.defaultModel
    }
    if (healthRes.ok) {
      const h = await healthRes.json() as { status: string }
      healthy.value = h.status === 'ok'
    }
  } catch { /* ignore */ }
})
</script>
