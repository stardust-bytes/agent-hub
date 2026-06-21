<template>
  <div class="bg-white border border-gray-200 rounded-md text-sm">
    <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
      <span class="text-blue-700 text-sm font-semibold tracking-wide">PLAN</span>
      <span class="text-gray-900 flex-1 text-sm truncate">{{ plan.title }}</span>
      <span class="text-gray-500 text-sm shrink-0">{{ plan.steps.length }} steps</span>
    </div>

    <div class="px-3 py-2 space-y-0.5">
      <div v-for="step in sortedSteps" :key="step.id" class="flex gap-2 items-start">
        <span :class="prefixClass(step.status)" class="text-sm font-mono select-none shrink-0 w-6 leading-5">
          {{ stepPrefix(step.status) }}
        </span>
        <span :class="textClass(step.status)" class="text-sm break-words leading-5">{{ step.text }}</span>
      </div>
    </div>

    <div v-if="plan.status === 'PENDING'" class="flex gap-2 px-3 py-2 border-t border-gray-200">
      <button
        :disabled="streaming"
        @click="emit('approve', plan.id)"
        class="bg-green-600 text-white text-sm font-medium px-3 py-1 rounded-md transition-colors duration-150 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >&#9654; {{ t('plans.approve') }}</button>
      <button
        :disabled="streaming"
        @click="emit('reject', plan.id)"
        class="bg-white border border-gray-300 text-gray-700 text-sm px-3 py-1 rounded-md transition-colors duration-150 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >&#10005; {{ t('plans.reject') }}</button>
    </div>

    <div v-if="plan.status !== 'PENDING'" class="px-3 py-2 border-t border-gray-200">
      <div class="flex items-center justify-between">
        <span :class="statusClass(plan.status)" class="text-sm">
          {{ plan.status === 'INTERRUPTED' ? '⏸ ' + t('plans.status.interrupted') : t('plans.status.' + plan.status.toLowerCase()) }}
        </span>
        <button
          v-if="plan.status === 'INTERRUPTED'"
          @click="emit('resume', plan.id)"
          class="text-blue-600 text-sm font-medium px-2 py-0.5 rounded-md border border-blue-200 transition-colors duration-150 hover:bg-blue-50"
        >&#9654; {{ t('plans.resume') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface PlanStep {
  id: number
  order: number
  text: string
  status: string
}

interface PlanData {
  id: number
  title: string
  status: string
  steps: PlanStep[]
}

const props = defineProps<{
  plan: PlanData
  streaming: boolean
}>()

const emit = defineEmits<{
  approve: [planId: number]
  reject: [planId: number]
  resume: [planId: number]
}>()

const { t } = useI18n()

const sortedSteps = computed(() => [...props.plan.steps].sort((a, b) => a.order - b.order))

function stepPrefix(status: string): string {
  if (status === 'DONE') return '[✓]'
  if (status === 'DOING') return '[⟳]'
  if (status === 'FAILED') return '[✗]'
  return '[ ]'
}

function prefixClass(status: string): string {
  if (status === 'DONE') return 'text-green-600'
  if (status === 'DOING') return 'text-amber-600'
  if (status === 'FAILED') return 'text-red-600'
  return 'text-gray-400'
}

function textClass(status: string): string {
  if (status === 'DONE') return 'text-green-700'
  if (status === 'DOING') return 'text-amber-700'
  if (status === 'FAILED') return 'text-red-600'
  return 'text-gray-600'
}

function statusClass(status: string): string {
  if (status === 'EXECUTING') return 'text-amber-600'
  if (status === 'DONE') return 'text-green-600'
  if (status === 'FAILED') return 'text-red-600'
  if (status === 'INTERRUPTED') return 'text-blue-600'
  return 'text-gray-500'
}
</script>

