<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 h-[3rem] bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-xs tracking-widest font-mono">
        <HiClipboardList class="w-3 h-3 inline" /> {{ t('plans.header') }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-2xl mx-auto space-y-3">
        <div v-if="plans.length === 0" class="text-center text-cyber-muted text-sm font-mono py-8">
          {{ t('plans.empty') }}
        </div>
        <div v-for="plan in plans" :key="plan.id"
          class="bg-cyber-dark border border-cyber-border rounded p-3 space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono" :class="statusDot(plan.status)">{{ statusIcon(plan.status) }}</span>
              <span class="text-cyber-text text-sm font-mono">{{ plan.title }}</span>
            </div>
            <span class="text-cyber-muted text-[10px] font-mono">{{ statusLabel(plan.status) }}</span>
          </div>

          <div class="h-1 bg-cyber-bg rounded overflow-hidden" v-if="plan.steps.length > 0">
            <div class="h-full bg-cyber-accent transition-all duration-500" :style="{ width: progressPercent(plan) + '%' }"></div>
          </div>

          <div class="text-cyber-muted text-[10px] font-mono">
            {{ doneCount(plan) }}/{{ plan.steps.length }} {{ t('plans.steps') }}
          </div>

          <div class="space-y-1">
            <div v-for="step in plan.steps" :key="step.id"
              class="flex items-center gap-2 text-xs font-mono">
              <span :class="stepIconClass(step.status)">{{ stepIcon(step.status) }}</span>
              <span :class="stepTextClass(step.status)">{{ step.text }}</span>
            </div>
          </div>

          <div v-if="plan.status === 'APPROVED'" class="pt-1">
            <button @click="execute(plan.id)"
              class="px-3 py-1 text-xs font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 transition-colors duration-150">
              {{ t('plans.execute') }}
            </button>
          </div>
          <div v-else-if="plan.status === 'INTERRUPTED' || plan.status === 'EXECUTING'" class="pt-1">
            <button @click="execute(plan.id)"
              class="px-3 py-1 text-xs font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 transition-colors duration-150">
              {{ t('plans.resume') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiClipboardList } from 'vue-icons-plus/hi'

interface PlanStep {
  id: number
  order: number
  text: string
  status: string
}

interface Plan {
  id: number
  title: string
  status: string
  steps: PlanStep[]
}

const { t } = useI18n()
const plans = ref<Plan[]>([])
let pollTimer: ReturnType<typeof setInterval> | null = null

function statusDot(status: string): string {
  if (status === 'EXECUTING') return 'text-cyber-orange'
  if (status === 'INTERRUPTED') return 'text-red-400'
  if (status === 'DONE') return 'text-cyber-green'
  return 'text-cyber-muted'
}

function statusIcon(status: string): string {
  if (status === 'EXECUTING') return '⟳'
  if (status === 'INTERRUPTED') return '◷'
  if (status === 'DONE') return '✓'
  return '○'
}

function statusLabel(status: string): string {
  if (status === 'EXECUTING') return t('plans.executing')
  if (status === 'INTERRUPTED') return t('plans.interrupted')
  if (status === 'DONE') return t('plans.done')
  if (status === 'APPROVED') return t('plans.approved')
  if (status === 'PENDING') return t('plans.pending')
  return status
}

function stepIcon(status: string): string {
  if (status === 'DONE') return '✓'
  if (status === 'FAILED') return '✗'
  if (status === 'DOING') return '⟳'
  return '○'
}

function stepIconClass(status: string): string {
  if (status === 'DONE') return 'text-cyber-green'
  if (status === 'FAILED') return 'text-red-400'
  if (status === 'DOING') return 'text-cyber-orange'
  return 'text-cyber-muted'
}

function stepTextClass(status: string): string {
  if (status === 'DONE') return 'text-cyber-muted line-through'
  if (status === 'FAILED') return 'text-red-400/80'
  return 'text-cyber-text'
}

function doneCount(plan: Plan): number {
  return plan.steps.filter(s => s.status === 'DONE').length
}

function progressPercent(plan: Plan): number {
  if (plan.steps.length === 0) return 0
  return Math.round((doneCount(plan) / plan.steps.length) * 100)
}

async function execute(planId: number) {
  try {
    const res = await fetch(`/api/agent/plans/${planId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerModelId: Number(localStorage.getItem('workspace.modelId')),
        sessionId: Number(localStorage.getItem('workspace.sessionId')),
      }),
    })
    if (res.ok) {
      startPolling()
    }
  } catch { /* ignore */ }
}

async function loadPlans() {
  const sessionId = localStorage.getItem('workspace.sessionId')
  if (!sessionId) return
  try {
    const res = await fetch(`/api/plans/session/${sessionId}`)
    if (res.ok) plans.value = await res.json() as Plan[]
  } catch { /* ignore */ }
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(loadPlans, 3000)
}

onMounted(loadPlans)

onUnmounted(() => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
})
</script>

