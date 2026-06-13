<template>
  <div class="flex flex-col bg-cyber-bg min-w-0">
    <template v-if="hasChatMessages">
      <MessageList
        ref="messageListRef"
        :messages="messages"
        :streaming="streaming"
        @form-submit="onFormSubmit"
        @approve="handleApprove"
        @reject="handleReject"
        @resume="handleResumeFromBubble"
      />
    </template>
    <div v-else class="flex-1 flex items-center justify-center min-h-0">
      <div class="text-center">
        <div class="font-['Press_Start_2P'] text-3xl text-cyber-accent mb-4">171305</div>
        <div class="text-sm font-mono text-cyber-muted">// {{ t('chat.empty.subtitle') }}</div>
      </div>
    </div>

    <SessionModal
      v-model="showSessionModal"
      :current-session-id="currentSessionId"
      mode="chat"
      @select="loadSession"
      @created="(id: number) => { currentSessionId = id; loadSession(id) }"
    />

    <ChatInputBar
      :streaming="streaming"
      :models="availableModels"
      :model-id="selectedModelId"
      :mode="currentMode"
      @update:model-id="selectedModelId = $event"
      @update:mode="currentMode = $event"
      @submit="submitText"
      @stop="stopStream"
      @open-sessions="showSessionModal = true"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SessionModal from './SessionModal.vue'
import MessageList from './chat/MessageList.vue'
import ChatInputBar from './chat/ChatInputBar.vue'
import type { Message, PlanData, ProviderModelFlat } from './chat/types'
import { useProvidersStore } from '../stores/providers'
import { useUiStore } from '../stores/ui'
import { createSession, getSessionMessages } from '../api/sessions'
import { getPlan, getNextPlan } from '../api/plans'
import { requestRaw } from '../api/client'
import { parseSseStream, type SseCallbacks } from '../composables/useChatStream'
import { loadSessionMessages } from '../composables/useSessionMessages'

const { t } = useI18n()
const ui = useUiStore()

const messages = ref<Message[]>([
  { role: 'system', content: t('chat.system.init'), timestamp: now() },
])
const streaming = ref(false)
const selectedModelId = ref<number | null>(null)
const availableModels = ref<ProviderModelFlat[]>([])
const abortController = ref<AbortController | null>(null)
const currentSessionId = ref<number | null>(null)
const showSessionModal = ref(false)
const currentMode = ref<'chat' | 'agent'>('chat')
const activeSubagentCount = ref(0)
const messageListRef = ref<{ scrollToBottom: () => Promise<void> } | null>(null)

onUnmounted(() => {
  ui.activeSubagents = 0
})

const hasChatMessages = computed(() =>
  messages.value.some(m => m.role === 'user' || m.role === 'agent' || m.role === 'plan')
)

function now(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false })
}

async function scrollToBottom() {
  await nextTick()
  messageListRef.value?.scrollToBottom()
}


onMounted(async () => {
  const providersStore = useProvidersStore()
  try {
    await providersStore.loadModels()
    const models = providersStore.models
    availableModels.value = models
    if (models.length > 0) {
      const savedId = Number(localStorage.getItem('workspace.modelId'))
      selectedModelId.value = models.find(m => m.id === savedId)?.id ?? models[0].id
    }
  } catch {
    availableModels.value = []
  }
})

watch(selectedModelId, (val) => {
  if (val !== null) localStorage.setItem('workspace.modelId', String(val))
})

function stopStream() {
  abortController.value?.abort()
}

async function loadSession(id: number) {
  currentSessionId.value = id
  messages.value = []
  try {
    const loaded = await loadSessionMessages(id, getSessionMessages, getPlan, now)
    messages.value = loaded
    if (loaded.length === 0) {
      messages.value.push({ role: 'system', content: t('chat.system.init'), timestamp: now() })
    }
  } catch { /* ignore */ }
  await scrollToBottom()
}

async function handleApprove(planId: number) {
  if (selectedModelId.value === null) return
  await submitText(`/plan approve ${planId}`)
}

async function resumePlan(planId: number) {
  await submitText(`/plan resume ${planId}`)
}

async function handleReject(planId: number) {
  if (selectedModelId.value === null) return
  await submitText(`/plan reject ${planId}`)
}

async function handleResumeFromBubble(planId: number) {
  await submitText(`/plan resume ${planId}`)
}

function onFormSubmit(data: Record<string, string>) {
  const json = JSON.stringify(data, null, 2)
  messages.value.push({
    role: 'user',
    content: `Form submission:\n\`\`\`json\n${json}\n\`\`\``,
    timestamp: now(),
  })
  scrollToBottom()
  if (currentSessionId.value !== null && selectedModelId.value !== null) {
    submitText(JSON.stringify(data))
  }
}

async function submitText(text: string) {
  if (!text || streaming.value || selectedModelId.value === null) return
  if (currentSessionId.value === null) {
    try {
      const session = await createSession('chat')
      currentSessionId.value = session.id
    } catch { return }
  }
  const continuePattern = /^(tiếp\s*tục|tiếp|continue|resume)\b/i
  if (currentSessionId.value !== null && continuePattern.test(text.trim())) {
    try {
      const nextData = await getNextPlan(currentSessionId.value)
      if (nextData.found && nextData.plan && nextData.action === 'resume') {
        await resumePlan(nextData.plan.id)
        return
      }
      if (nextData.found && nextData.plan && nextData.action === 'approve') {
        messages.value.push({
          role: 'plan',
          content: '',
          timestamp: now(),
          plan: { ...nextData.plan, steps: nextData.plan.steps.map(s => ({ ...s })) },
        })
        await scrollToBottom()
        return
      }
    } catch { /* fall through to normal chat */ }
  }

  streaming.value = true

  messages.value.push({ role: 'user', content: text, timestamp: now() })
  await scrollToBottom()

  const ctrl = new AbortController()
  abortController.value = ctrl

  let currentAgentIdx = -1
  const thinkingMsg: Message = { role: 'system', content: t('chat.thinking'), timestamp: now() }
  messages.value.push(thinkingMsg)
  await scrollToBottom()

  function clearThinking() {
    const idx = messages.value.indexOf(thinkingMsg)
    if (idx !== -1) messages.value[idx].content = ''
  }

  function getOrCreateAgentMsg(): number {
    if (currentAgentIdx >= 0 && currentAgentIdx < messages.value.length) {
      return currentAgentIdx
    }
    const newMsg: Message = { role: 'agent', content: '', timestamp: now(), typing: true }
    currentAgentIdx = messages.value.length
    messages.value.push(newMsg)
    return currentAgentIdx
  }

  try {
    const res = await requestRaw('/agent/chat', {
      method: 'POST',
      body: { message: text, providerModelId: selectedModelId.value, sessionId: currentSessionId.value, mode: currentMode.value },
      signal: ctrl.signal,
    })

    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

    const reader = res.body.getReader()

    const callbacks: SseCallbacks = {
      onError(error) {
        if (currentAgentIdx >= 0) {
          messages.value[currentAgentIdx].typing = false
        }
        messages.value.push({
          role: 'system',
          content: `${t('chat.error.unreachable')} (${error})`,
          timestamp: now(),
        })
        scrollToBottom()
      },
      onSubagent(ev) {
        clearThinking()
        if (ev.done) {
          if (activeSubagentCount.value > 0) {
            activeSubagentCount.value--
            ui.activeSubagents = activeSubagentCount.value
          }
        } else if (ev.token) {
          const idx = getOrCreateAgentMsg()
          messages.value[idx].content += String(ev.token)
          scrollToBottom()
        } else if (ev.toolCall) {
          currentAgentIdx = -1
          const tc = ev.toolCall
          const argsStr = Object.entries(tc.args).map(([k, v]) => `${k}=${v}`).join(', ')
          messages.value.push({
            role: 'tool',
            content: `[subagent] ${tc.name}(${argsStr})`,
            timestamp: now(),
            toolName: tc.name,
            isResult: false,
          })
          scrollToBottom()
        } else if (ev.toolResult) {
          const tr = ev.toolResult
          messages.value.push({
            role: 'tool',
            content: `[subagent] ${tr.name}: ${tr.result}`,
            timestamp: now(),
            toolName: tr.name,
            isResult: true,
          })
          scrollToBottom()
        } else if (ev.thinking) {
          currentAgentIdx = -1
          messages.value.push({
            role: 'system',
            content: `⟳ [subagent] ${String(ev.thinking)}`,
            timestamp: now(),
          })
          scrollToBottom()
        }
      },
      onToolCall(name, args) {
        clearThinking()
        currentAgentIdx = -1
        const argsStr = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(', ')
        messages.value.push({
          role: 'tool',
          content: `${name}(${argsStr})`,
          timestamp: now(),
          toolName: name,
          isResult: false,
        })
        if (name === 'spawn_subagent') {
          activeSubagentCount.value++
          ui.activeSubagents = activeSubagentCount.value
        }
        scrollToBottom()
      },
      onToolResult(name, result) {
        messages.value.push({
          role: 'tool',
          content: result,
          timestamp: now(),
          toolName: name,
          isResult: true,
        })
        scrollToBottom()
      },
      onThinking(text) {
        clearThinking()
        currentAgentIdx = -1
        messages.value.push({ role: 'system', content: `⟳ ${text}`, timestamp: now() })
        scrollToBottom()
      },
      onPlan(plan) {
        clearThinking()
        currentAgentIdx = -1
        messages.value.push({
          role: 'plan',
          content: '',
          timestamp: now(),
          plan: { ...plan, steps: plan.steps.map(s => ({ ...s })) },
        })
        scrollToBottom()
      },
      onPlanStepUpdate(planId, stepId, status) {
        for (const msg of messages.value) {
          if (msg.role === 'plan' && msg.plan && msg.plan.id === planId) {
            const step = msg.plan.steps.find(s => s.id === stepId)
            if (step) {
              step.status = status
              msg.plan = { ...msg.plan, steps: [...msg.plan.steps] }
            }
            break
          }
        }
      },
      onPlanInterrupted(_planId, _reason) {
        messages.value.push({
          role: 'system',
          content: '[⏹ Plan execution interrupted. Send "tiếp tục" to resume.]',
          timestamp: now(),
        })
        scrollToBottom()
      },
      onDelegateProgress(index, subtask, status) {
        clearThinking()
        currentAgentIdx = -1
        const key = status === 'running' ? 'delegate.running' : status === 'completed' ? 'delegate.completed' : 'delegate.failed'
        messages.value.push({
          role: 'system',
          content: t(key, { index: index + 1, task: subtask }),
          timestamp: now(),
        })
        scrollToBottom()
      },
      onDelegateResult(count) {
        clearThinking()
        currentAgentIdx = -1
        messages.value.push({
          role: 'system',
          content: t('delegate.complete', { count }),
          timestamp: now(),
        })
        scrollToBottom()
      },
      onToken(token) {
        clearThinking()
        const idx = getOrCreateAgentMsg()
        messages.value[idx].content += token
        scrollToBottom()
      },
      onDone() {
        // no-op: post-stream cleanup (typing=false) handled below
      },
    }

    await parseSseStream(reader, callbacks)

    const lastAgent = [...messages.value].reverse().find(m => m.role === 'agent')
    if (lastAgent) lastAgent.typing = false
    await scrollToBottom()
  } catch (e) {
    if (currentAgentIdx >= 0) {
      messages.value[currentAgentIdx].typing = false
    }
    if (e instanceof Error && e.name !== 'AbortError') {
      messages.value.push({
        role: 'system',
        content: `${t('chat.error.unreachable')} (${e.message})`,
        timestamp: now(),
      })
      await scrollToBottom()
    }
  } finally {
    clearThinking()
    streaming.value = false
    abortController.value = null
  }
}
</script>
