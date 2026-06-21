<template>
  <div class="flex-1 flex flex-col bg-background overflow-hidden">
    <div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-border shrink-0 bg-surface">
      <HiClipboardList class="w-4 h-4 text-muted-foreground" />
      <span class="text-lg font-semibold text-foreground">{{ t('plans.header') }}</span>
    </div>

    <div class="flex-1 overflow-y-auto mx-auto max-w-5xl px-6 py-6 w-full">
      <div class="max-w-2xl mx-auto space-y-3">
        <div v-if="plans.length === 0" class="text-center text-muted-foreground text-sm font-mono py-8">
          {{ t('plans.empty') }}
        </div>
        <div v-for="plan in plans" :key="plan.id"
          class="bg-surface border border-border rounded-lg p-3 space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm font-mono" :class="statusDot(plan.status)">{{ statusIcon(plan.status) }}</span>
              <span class="text-foreground text-sm font-mono">{{ plan.title }}</span>
            </div>
            <span class="text-muted-foreground text-[10px] font-mono">{{ statusLabel(plan.status) }}</span>
          </div>

          <div class="h-1 bg-muted rounded-lg overflow-hidden" v-if="plan.steps.length > 0">
            <div class="h-full bg-primary transition-all duration-500" :style="{ width: progressPercent(plan) + '%' }"></div>
          </div>

          <div class="text-muted-foreground text-[10px] font-mono">
            {{ doneCount(plan) }}/{{ plan.steps.length }} {{ t('plans.steps') }}
          </div>

          <div class="space-y-1">
            <div v-for="step in plan.steps" :key="step.id"
              class="flex items-center gap-2 text-sm font-mono">
              <span :class="stepIconClass(step.status)">{{ stepIcon(step.status) }}</span>
              <span :class="stepTextClass(step.status)">{{ step.text }}</span>
            </div>
          </div>

          <div v-if="plan.status === 'APPROVED'" class="pt-1">
            <button @click="execute(plan.id)"
              class="px-3 py-1 text-sm font-mono text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors duration-150">
              {{ t('plans.execute') }}
            </button>
          </div>
          <div v-else-if="plan.status === 'INTERRUPTED' || plan.status === 'EXECUTING'" class="pt-1">
            <button @click="execute(plan.id)"
              class="px-3 py-1 text-sm font-mono text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors duration-150">
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
import { listSessionPlans, executePlan } from '../api/plans'

interface Plan {
  id: number
  title: string
  status: string
  steps: { id: number; order: number; text: string; status: string }[]
}

const { t } = useI18n()
const plans = ref<Plan[]>([])
let pollTimer: ReturnType<typeof setInterval> | null = null

function statusDot(status: string): string {
  if (status === 'EXECUTING') return 'text-amber-600'
  if (status === 'INTERRUPTED') return 'text-red-600'
  if (status === 'DONE') return 'text-green-600'
  return 'text-gray-500'
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
  if (status === 'DONE') return 'text-green-600'
  if (status === 'FAILED') return 'text-red-600'
  if (status === 'DOING') return 'text-amber-600'
  return 'text-gray-500'
}

function stepTextClass(status: string): string {
  if (status === 'DONE') return 'text-gray-500 line-through'
  if (status === 'FAILED') return 'text-red-600/80'
  return 'text-gray-900'
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
    const res = await executePlan(
      planId,
      Number(localStorage.getItem('workspace.modelId')),
      Number(localStorage.getItem('workspace.sessionId')),
    )
    if (res.ok) {
      startPolling()
    }
  } catch { /* ignore */ }
}

async function loadPlans() {
  const sessionId = localStorage.getItem('workspace.sessionId')
  if (!sessionId) return
  try {
    plans.value = await listSessionPlans(Number(sessionId))
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





