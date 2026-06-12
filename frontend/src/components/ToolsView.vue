<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="xl:pl-3 pl-8 px-3 h-[3rem] bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        ⚡ {{ t('tools.header') }}
      </span>
    </div>
    <div class="flex-1 overflow-y-auto p-3">
      <div v-if="loading" class="text-cyber-muted text-sm font-mono">{{ t('tools.loading') }}</div>
      <table v-else-if="tools.length" class="w-full border-collapse font-mono text-sm">
        <thead>
          <tr class="border-b border-cyber-code-border text-cyber-muted">
            <th class="text-left py-2 px-2 w-20">{{ t('tools.status') }}</th>
            <th class="text-left py-2 px-2 w-40">{{ t('tools.name') }}</th>
            <th class="text-left py-2 px-2">{{ t('tools.description') }}</th>
            <th class="text-right py-2 px-2 w-24">{{ t('tools.action') }}</th>
            <th class="text-right py-2 px-2 w-24">{{ t('tools.config') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tool in tools" :key="tool.name" class="border-b border-cyber-code-border/50 hover:bg-cyber-dark/40 transition-colors duration-150">
            <td class="py-2 px-2">
              <span :class="tool.enabled ? 'text-cyber-green' : 'text-cyber-muted'" class="font-mono text-sm">
                {{ tool.enabled ? '●' : '○' }}
              </span>
            </td>
            <td class="py-2 px-2 text-cyber-text font-mono">{{ tool.name }}</td>
            <td class="py-2 px-2 text-cyber-muted/80 font-mono text-xs">{{ tool.description }}</td>
            <td class="py-2 px-2 text-right">
              <button
                @click="toggle(tool.name)"
                :class="tool.enabled ? 'text-cyber-orange hover:text-cyber-orange/80' : 'text-cyber-accent hover:text-cyber-accent/80'"
                class="text-sm font-mono transition-colors duration-150"
              >{{ tool.enabled ? t('tools.disable') : t('tools.enable') }}</button>
            </td>
            <td class="py-2 px-2 text-right">
              <button
                v-if="tool.configSchema"
                @click="openConfig(tool)"
                class="text-sm font-mono text-cyber-accent/70 hover:text-cyber-accent transition-colors duration-150"
              >{{ t('tools.config.edit') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="text-cyber-muted text-sm font-mono">{{ t('tools.no_tools') }}</div>
    </div>
  </div>
  <ToolConfigModal v-model="showConfigModal" :tool="configTool" @saved="fetchTools" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolConfigModal from './ToolConfigModal.vue'

interface Tool {
  name: string
  description: string
  configSchema?: string | null
  config?: string | null
  enabled: boolean
}

const { t } = useI18n()
const tools = ref<Tool[]>([])
const loading = ref(true)
const configTool = ref<Tool | null>(null)
const showConfigModal = ref(false)

async function fetchTools() {
  try {
    const res = await fetch('/api/tools')
    if (res.ok) tools.value = await res.json() as Tool[]
  } catch { /* ignore */ }
  loading.value = false
}

function openConfig(tool: Tool) {
  configTool.value = tool
  showConfigModal.value = true
}

async function toggle(name: string) {
  const tool = tools.value.find(t => t.name === name)
  if (!tool) return
  tool.enabled = !tool.enabled
  try {
    const res = await fetch(`/api/tools/${name}/toggle`, { method: 'PATCH' })
    if (!res.ok) tool.enabled = !tool.enabled
  } catch {
    tool.enabled = !tool.enabled
  }
}

onMounted(fetchTools)
</script>



