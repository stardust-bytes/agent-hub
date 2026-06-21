<template>
  <div v-show="visible" class="flex flex-col h-full bg-white border-l border-gray-200">
    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
      <span class="text-sm text-gray-900 font-semibold">{{ t('cowork.artifacts') }}</span>
      <button @click="emit('close')" class="text-gray-400 text-base leading-none hover:text-gray-700">✕</button>
    </div>
    <div class="flex-1 overflow-y-auto px-3 py-2 space-y-3">
      <div v-if="fileContent === null && plans.length === 0 && toolResults.length === 0" class="text-sm text-gray-500 text-center pt-8">{{ t('cowork.no_artifacts') }}</div>
      <div v-if="fileContent !== null" class="border border-gray-200 rounded-md overflow-hidden">
        <div class="bg-gray-50 px-3 py-1.5 text-sm text-gray-600 font-mono border-b border-gray-200">
          📄 {{ fileName }}
        </div>
        <pre class="text-sm text-gray-800 font-mono p-3 whitespace-pre-wrap break-all max-h-60 overflow-y-auto bg-gray-50">{{ fileContent }}</pre>
      </div>

      <div v-for="plan in plans" :key="plan.id" class="border border-gray-200 rounded-md overflow-hidden">
        <div class="bg-gray-50 px-3 py-1.5 text-sm text-blue-700 font-semibold border-b border-gray-200">
          PLAN: {{ plan.title }}
        </div>
        <div class="px-3 py-2 space-y-0.5">
          <div v-for="step in plan.steps" :key="step.id" class="flex gap-2 items-start text-sm">
            <span :class="step.status === 'DONE' ? 'text-green-600' : step.status === 'DOING' ? 'text-amber-600' : step.status === 'FAILED' ? 'text-red-600' : 'text-gray-400'" class="shrink-0 w-6 text-sm leading-5 font-mono">
              {{ step.status === 'DONE' ? '[✓]' : step.status === 'DOING' ? '[⟳]' : step.status === 'FAILED' ? '[✗]' : '[ ]' }}
            </span>
            <span :class="step.status === 'DONE' ? 'text-green-700' : 'text-gray-800'">{{ step.text }}</span>
          </div>
        </div>
      </div>

      <div v-for="(result, i) in toolResults" :key="i" class="border border-gray-200 rounded-md overflow-hidden">
        <div class="bg-gray-50 px-3 py-1.5 text-sm text-amber-700 font-mono border-b border-gray-200">
          ⚙ {{ result.toolName }}
        </div>
        <pre class="text-sm text-gray-800 font-mono p-3 whitespace-pre-wrap break-all max-h-40 overflow-y-auto bg-gray-50">{{ result.content }}</pre>
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

