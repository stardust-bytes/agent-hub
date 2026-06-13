<template>
  <div class="bg-cyber-modal-bg border border-cyber-accent/40 font-mono text-sm">
    <div class="flex items-center gap-2 px-3 py-2 border-b border-cyber-accent/20">
      <span class="text-cyber-cyan text-sm font-bold tracking-widest">PLAN</span>
      <span class="text-cyber-text flex-1 text-sm truncate">{{ plan.title }}</span>
      <span class="text-cyber-muted text-sm shrink-0">{{ plan.steps.length }} steps</span>
    </div>

    <div class="px-3 py-2 space-y-0.5">
      <div v-for="step in sortedSteps" :key="step.id" class="flex gap-2 items-start">
        <span :class="prefixClass(step.status)" class="text-sm select-none shrink-0 w-6 leading-5">
          {{ stepPrefix(step.status) }}
        </span>
        <span :class="textClass(step.status)" class="text-sm break-words leading-5">{{ step.text }}</span>
      </div>
    </div>

    <div v-if="plan.status === 'PENDING'" class="flex gap-2 px-3 py-2 border-t border-cyber-accent/20">
      <button
        :disabled="streaming"
        @click="emit('approve', plan.id)"
        class="bg-cyber-green text-black text-sm font-bold px-3 py-1 transition-colors duration-150 hover:bg-cyber-green/80 disabled:opacity-50 disabled:cursor-not-allowed"
      >&#9654; {{ t('plans.approve') }}</button>
      <button
        :disabled="streaming"
        @click="emit('reject', plan.id)"
        class="bg-transparent border border-cyber-muted/40 text-cyber-muted text-sm px-3 py-1 transition-colors duration-150 hover:text-cyber-text hover:border-cyber-muted disabled:opacity-50 disabled:cursor-not-allowed"
      >&#10005; {{ t('plans.reject') }}</button>
    </div>

    <div v-if="plan.status !== 'PENDING'" class="px-3 py-2 border-t border-cyber-accent/20">
      <div class="flex items-center justify-between">
        <span :class="statusClass(plan.status)" class="text-sm">
          {{ plan.status === 'INTERRUPTED' ? '⏸ ' + t('plans.status.interrupted') : t('plans.status.' + plan.status.toLowerCase()) }}
        </span>
        <button
          v-if="plan.status === 'INTERRUPTED'"
          @click="emit('resume', plan.id)"
          class="text-cyber-cyan text-sm font-bold px-2 py-0.5 border border-cyber-cyan/40 transition-colors duration-150 hover:bg-cyber-cyan/20"
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
  if (status === 'DONE') return 'text-cyber-green'
  if (status === 'DOING') return 'text-cyber-orange'
  if (status === 'FAILED') return 'text-red-400'
  return 'text-cyber-muted'
}

function textClass(status: string): string {
  if (status === 'DONE') return 'text-cyber-green'
  if (status === 'DOING') return 'text-cyber-orange'
  if (status === 'FAILED') return 'text-red-400'
  return 'text-cyber-muted'
}

function statusClass(status: string): string {
  if (status === 'EXECUTING') return 'text-cyber-orange'
  if (status === 'DONE') return 'text-cyber-green'
  if (status === 'FAILED') return 'text-red-400'
  if (status === 'INTERRUPTED') return 'text-cyber-cyan'
  return 'text-cyber-muted'
}
</script>

