<template>
  <div class="flex flex-col h-full bg-cyber-bg border-l border-cyber-code-border">
    <div class="flex items-center justify-between px-3 py-2 border-b border-cyber-code-border shrink-0">
      <span class="text-sm text-cyber-accent font-mono">{{ t('cowork.artifacts') }}</span>
      <button @click="emit('close')" class="text-cyber-muted text-sm font-mono hover:text-cyber-accent">✕</button>
    </div>
    <div class="flex-1 overflow-y-auto px-3 py-2 space-y-3">
      <div v-if="fileContent !== null" class="border border-cyber-code-border">
        <div class="bg-cyber-dark px-2 py-1 text-sm text-cyber-muted font-mono border-b border-cyber-code-border">
          📄 {{ fileName }}
        </div>
        <pre class="text-sm text-cyber-code-text font-mono p-2 whitespace-pre-wrap break-all max-h-60 overflow-y-auto bg-cyber-code-bg">{{ fileContent }}</pre>
      </div>

      <div v-for="plan in plans" :key="plan.id" class="border border-cyber-accent/40">
        <div class="bg-cyber-dark px-2 py-1 text-sm text-cyber-cyan font-mono border-b border-cyber-accent/20">
          PLAN: {{ plan.title }}
        </div>
        <div class="px-2 py-1 space-y-0.5">
          <div v-for="step in plan.steps" :key="step.id" class="flex items-center gap-2 text-sm font-mono">
            <span :class="step.status === 'DONE' ? 'text-cyber-green' : step.status === 'DOING' ? 'text-cyber-orange' : step.status === 'FAILED' ? 'text-red-400' : 'text-cyber-muted'">
              {{ step.status === 'DONE' ? '[✓]' : step.status === 'DOING' ? '[⟳]' : step.status === 'FAILED' ? '[✗]' : '[ ]' }}
            </span>
            <span :class="step.status === 'DONE' ? 'text-cyber-green' : 'text-cyber-code-text'">{{ step.text }}</span>
          </div>
        </div>
      </div>

      <div v-for="(result, i) in toolResults" :key="i" class="border border-cyber-code-border">
        <div class="bg-cyber-dark px-2 py-1 text-sm text-cyber-orange font-mono border-b border-cyber-code-border">
          ⚙ {{ result.toolName }}
        </div>
        <pre class="text-sm text-cyber-code-text font-mono p-2 whitespace-pre-wrap break-all max-h-40 overflow-y-auto bg-cyber-code-bg">{{ result.content }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface PlanStep { id: number; order: number; text: string; status: string }
interface PlanData { id: number; title: string; status: string; steps: PlanStep[] }
interface ToolResult { toolName: string; content: string }

defineProps<{
  visible: boolean
  fileContent: string | null
  fileName: string
  plans: PlanData[]
  toolResults: ToolResult[]
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
</script>
