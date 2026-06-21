<template>
  <div v-show="visible" class="flex flex-col h-full bg-surface border-l border-border">
    <div class="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
      <span class="text-sm text-foreground font-semibold">{{ t('cowork.artifacts') }}</span>
      <button @click="emit('close')" class="text-muted-foreground text-base leading-none hover:text-foreground">✕</button>
    </div>
    <div class="flex-1 overflow-y-auto px-3 py-2 space-y-3">
      <div v-if="fileContent === null && plans.length === 0 && toolResults.length === 0" class="text-sm text-muted-foreground text-center pt-8">{{ t('cowork.no_artifacts') }}</div>
      <div v-if="fileContent !== null" class="border border-border rounded-lg overflow-hidden">
        <div class="bg-muted px-3 py-1.5 text-sm text-muted-foreground font-sans border-b border-border">
          📄 {{ fileName }}
        </div>
        <pre class="text-sm text-foreground font-sans p-3 whitespace-pre-wrap break-all max-h-60 overflow-y-auto bg-muted">{{ fileContent }}</pre>
      </div>

      <div v-for="plan in plans" :key="plan.id" class="border border-border rounded-lg overflow-hidden">
        <div class="bg-muted px-3 py-1.5 text-sm text-primary font-semibold border-b border-border">
          PLAN: {{ plan.title }}
        </div>
        <div class="px-3 py-2 space-y-0.5">
          <div v-for="step in plan.steps" :key="step.id" class="flex gap-2 items-start text-sm">
            <span :class="step.status === 'DONE' ? 'text-success' : step.status === 'DOING' ? 'text-warning' : step.status === 'FAILED' ? 'text-danger' : 'text-muted-foreground'" class="shrink-0 w-6 text-sm leading-5 font-sans">
              {{ step.status === 'DONE' ? '[✓]' : step.status === 'DOING' ? '[⟳]' : step.status === 'FAILED' ? '[✗]' : '[ ]' }}
            </span>
            <span :class="step.status === 'DONE' ? 'text-success' : 'text-foreground'">{{ step.text }}</span>
          </div>
        </div>
      </div>

      <div v-for="(result, i) in toolResults" :key="i" class="border border-border rounded-lg overflow-hidden">
        <div class="bg-muted px-3 py-1.5 text-sm text-warning font-sans border-b border-border">
          ⚙ {{ result.toolName }}
        </div>
        <pre class="text-sm text-foreground font-sans p-3 whitespace-pre-wrap break-all max-h-40 overflow-y-auto bg-muted">{{ result.content }}</pre>
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

