<template>
  <div class="flex flex-col bg-cyber-bg min-w-0">
    <div class="px-3 py-2 border-b border-cyber-border bg-cyber-dark flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-cyber-orange text-xs tracking-widest font-mono">
          <HiTerminal class="w-3 h-3 inline" /> {{ t('chat.header') }}
        </span>
        <ModelSelector
          v-model="selectedModel"
          :models="availableModels"
          :disabled="streaming"
        />
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="streaming"
          @click="stopStream"
          class="text-cyber-orange/80 text-xs font-mono border border-cyber-dim rounded px-2 py-0.5 transition-colors duration-150 hover:border-cyber-accent"
        >{{ t('chat.stop') }}</button>
        <span class="text-cyber-orange/40 text-xs font-mono">
          {{ ollamaOnline ? t('chat.mode.ollama') : t('chat.mode.stub') }}
        </span>
      </div>
    </div>

    <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
      <div v-for="(msg, i) in messages" :key="i" class="font-mono">
        <div class="text-xs mb-1" :class="roleColor(msg.role)">
          <HiChevronRight v-if="msg.role === 'agent'" class="w-3 h-3 inline" />
          {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
        </div>
        <div
          class="text-sm leading-relaxed break-words"
          :class="{
            'text-cyber-orange/50': msg.role === 'system',
            'text-slate-100': msg.role === 'user' || msg.role === 'agent',
          }"
        >
          {{ msg.content }}<span v-if="msg.typing" class="animate-blink text-cyber-orange ml-px">█</span>
        </div>
      </div>
    </div>

    <div class="px-3 py-2 border-t border-cyber-border bg-cyber-dark shrink-0">
      <form @submit.prevent="submit" class="flex items-center gap-2 border border-cyber-dim rounded px-3 py-2">
        <span class="text-cyber-orange text-sm font-mono">$</span>
        <input
          v-model="input"
          class="flex-1 bg-transparent text-slate-100 text-sm outline-none font-mono placeholder-cyber-orange/30"
          :placeholder="t('chat.placeholder')"
          :disabled="streaming"
          autocomplete="off"
          spellcheck="false"
        />
        <span v-if="!streaming" class="animate-blink text-cyber-orange text-sm">█</span>
        <span v-else class="text-cyber-orange/50 text-xs">{{ t('chat.thinking') }}</span>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiTerminal, HiChevronRight } from 'vue-icons-plus/hi'
import ModelSelector from './ModelSelector.vue'

interface Message {
  role: 'user' | 'agent' | 'system'
  content: string
  timestamp: string
  typing?: boolean
}

const emit = defineEmits<{ lastMessage: [content: string] }>()
const { t } = useI18n()

const messages = ref<Message[]>([
  { role: 'system', content: t('chat.system.init'), timestamp: now() },
])
const input = ref('')
const streaming = ref(false)
const selectedModel = ref(localStorage.getItem('workspace.model') ?? 'llama3.2')
const availableModels = ref<string[]>([])
const ollamaOnline = ref(true)
const abortController = ref<AbortController | null>(null)
const messagesEl = ref<HTMLElement | null>(null)

function now(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false })
}

function rolePrefix(role: string): string {
  if (role === 'user') return t('chat.user.prefix')
  if (role === 'agent') return t('chat.agent.prefix')
  return t('chat.system.prefix')
}

function roleColor(role: string): string {
  if (role === 'user') return 'text-cyber-orange/60'
  if (role === 'agent') return 'text-cyber-orange'
  return 'text-cyber-orange/40'
}

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

onMounted(async () => {
  try {
    const res = await fetch('/api/ollama/models')
    if (!res.ok) throw new Error('fetch failed')
    const models = (await res.json()) as string[]
    availableModels.value = models
    if (models.length > 0 && !models.includes(selectedModel.value)) {
      selectedModel.value = models[0]
    }
  } catch {
    ollamaOnline.value = false
  }
})

watch(selectedModel, (val) => {
  localStorage.setItem('workspace.model', val)
})

function stopStream() {
  abortController.value?.abort()
}

async function submit() {
  const text = input.value.trim()
  if (!text || streaming.value) return
  input.value = ''
  streaming.value = true

  messages.value.push({ role: 'user', content: text, timestamp: now() })
  await scrollToBottom()

  const ctrl = new AbortController()
  abortController.value = ctrl

  const agentMsg: Message = { role: 'agent', content: '', timestamp: now(), typing: true }
  messages.value.push(agentMsg)
  const msgIdx = messages.value.length - 1
  await scrollToBottom()

  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, model: selectedModel.value }),
      signal: ctrl.signal,
    })

    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let done = false

    while (!done) {
      const { done: streamDone, value } = await reader.read()
      if (streamDone) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') { done = true; break }
        try {
          const parsed = JSON.parse(payload) as { token?: string; error?: string }
          if (parsed.error) {
            done = true
            messages.value[msgIdx].typing = false
            messages.value.push({
              role: 'system',
              content: `${t('chat.error.unreachable')} (${parsed.error})`,
              timestamp: now(),
            })
            await scrollToBottom()
          } else if (parsed.token) {
            messages.value[msgIdx].content += parsed.token
            await scrollToBottom()
          }
        } catch { /* skip malformed SSE line */ }
      }
    }

    messages.value[msgIdx].typing = false
    if (messages.value[msgIdx].content) emit('lastMessage', messages.value[msgIdx].content)
  } catch (e) {
    messages.value[msgIdx].typing = false
    if (e instanceof Error && e.name !== 'AbortError') {
      messages.value.push({
        role: 'system',
        content: `${t('chat.error.unreachable')} (${e.message})`,
        timestamp: now(),
      })
      await scrollToBottom()
    }
  } finally {
    streaming.value = false
    abortController.value = null
  }
}
</script>
