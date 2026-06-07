<template>
  <div class="flex flex-col bg-cyber-bg min-w-0">
    <div class="px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-cyber-accent text-xs tracking-widest font-mono">
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
          class="text-cyber-accent/80 text-xs font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent"
        >{{ t('chat.stop') }}</button>
        <span class="text-[#888888] text-xs font-mono">
          {{ ollamaOnline ? t('chat.mode.ollama') : t('chat.mode.stub') }}
        </span>
      </div>
    </div>

    <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
      <div v-for="(msg, i) in messages" :key="i" class="font-mono">

        <!-- Thinking block -->
        <div v-if="msg.role === 'system' && msg.content === '⟳ thinking...' || msg.content === '⟳ đang nghĩ...'"
          class="border-l-2 border-cyber-accent/30 pl-3 py-1">
          <div class="text-xs text-cyber-accent/60 font-mono">⟳ {{ msg.content.replace('⟳ ', '') }}</div>
        </div>

        <!-- Tool call block -->
        <div v-else-if="msg.role === 'tool' && !msg.isResult"
          class="border-l-2 border-[#FFA500]/50 pl-3 py-1.5">
          <div class="text-[11px] text-[#FFA500] font-mono mb-0.5">[⚙] {{ msg.content }}</div>
        </div>

        <!-- Tool result block -->
        <div v-else-if="msg.role === 'tool' && msg.isResult"
          class="border-l-2 border-cyber-green/50 pl-3 py-1.5">
          <div class="text-[11px] text-cyber-green font-mono">{{ msg.content }}</div>
        </div>

        <!-- Agent answer block -->
        <div v-else-if="msg.role === 'agent'"
          class="border-l-2 border-cyber-accent/20 pl-3 py-1">
          <div class="text-xs text-cyber-accent/60 mb-0.5 font-mono">
            <HiChevronRight class="w-3 h-3 inline" /> {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
          </div>
          <div class="text-sm leading-relaxed break-words text-[#EEEEEE]">
            {{ msg.content }}<span v-if="msg.typing" class="animate-blink text-cyber-accent ml-px">&#9608;</span>
          </div>
        </div>

        <!-- User message block -->
        <div v-else-if="msg.role === 'user'"
          class="border-l-2 border-cyber-accent/20 pl-3 py-1">
          <div class="text-xs text-cyber-accent/80 mb-0.5 font-mono">{{ rolePrefix(msg.role) }} · {{ msg.timestamp }}</div>
          <div class="text-sm leading-relaxed break-words text-[#EEEEEE]">{{ msg.content }}</div>
        </div>

        <!-- System message (other) -->
        <div v-else-if="msg.role === 'system'"
          class="pl-3 py-0.5">
          <div class="text-xs text-[#888888] font-mono">{{ msg.content }}</div>
        </div>

      </div>
    </div>

    <div class="px-3 py-2 bg-cyber-dark shrink-0">
      <form @submit.prevent="submit" class="flex items-center gap-2 bg-cyber-dark px-3 py-2">
        <span class="text-cyber-accent text-sm font-mono">$</span>
        <span v-if="!streaming" class="animate-blink text-[#EEEEEE] text-sm">█</span>
        <input
          ref="inputEl"
          v-model="input"
          class="flex-1 bg-transparent text-[#EEEEEE] text-sm outline-none font-mono placeholder-[#888888]/40 caret-white"
          :placeholder="t('chat.placeholder')"
          :disabled="streaming"
          autocomplete="off"
          spellcheck="false"
        />
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
  role: 'user' | 'agent' | 'system' | 'tool'
  content: string
  timestamp: string
  typing?: boolean
  toolName?: string
  isResult?: boolean
}

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
const inputEl = ref<HTMLInputElement | null>(null)
const messagesEl = ref<HTMLElement | null>(null)

function now(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false })
}

function rolePrefix(role: string): string {
  if (role === 'user') return t('chat.user.prefix')
  if (role === 'agent') return t('chat.agent.prefix')
  if (role === 'system') return t('chat.system.prefix')
  return ''
}

function roleColor(role: string): string {
  if (role === 'user') return 'text-cyber-accent/80'
  if (role === 'agent') return 'text-cyber-accent'
  if (role === 'system') return 'text-[#888888]'
  return 'text-[#888888]'
}

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

onMounted(async () => {
  inputEl.value?.focus()
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

  const thinkingMsg: Message = { role: 'system', content: t('chat.thinking'), timestamp: now() }
  messages.value.push(thinkingMsg)
  await scrollToBottom()

  const agentMsg: Message = { role: 'agent', content: '', timestamp: now(), typing: true }
  const msgIdx = messages.value.length
  messages.value.push(agentMsg)
  await scrollToBottom()

  function clearThinking() {
    const idx = messages.value.indexOf(thinkingMsg)
    if (idx !== -1) messages.value[idx].content = ''
  }

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
    let buf = ''
    let done = false

    while (!done) {
      const { done: streamDone, value } = await reader.read()
      if (streamDone) break

      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') { done = true; break }
        try {
          const parsed = JSON.parse(payload) as Record<string, unknown>

          if (parsed.error) {
            done = true
            agentMsg.typing = false
            messages.value.push({
              role: 'system',
              content: `${t('chat.error.unreachable')} (${String(parsed.error)})`,
              timestamp: now(),
            })
            await scrollToBottom()
          } else if (parsed.toolCall) {
            clearThinking()
            const tc = parsed.toolCall as { name: string; args: Record<string, unknown> }
            const argsStr = Object.entries(tc.args).map(([k, v]) => `${k}=${v}`).join(', ')
            messages.value.push({
              role: 'tool',
              content: `${tc.name}(${argsStr})`,
              timestamp: now(),
              toolName: tc.name,
              isResult: false,
            })
            await scrollToBottom()
          } else if (parsed.toolResult) {
            const tr = parsed.toolResult as { name: string; result: string }
            messages.value.push({
              role: 'tool',
              content: tr.result,
              timestamp: now(),
              toolName: tr.name,
              isResult: true,
            })
            await scrollToBottom()
          } else if (parsed.token) {
            clearThinking()
            messages.value[msgIdx].content += String(parsed.token)
            if (!done) scrollToBottom()
          }
        } catch { /* skip malformed SSE line */ }
      }
    }

    messages.value[msgIdx].typing = false
    await scrollToBottom()
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
    clearThinking()
    streaming.value = false
    abortController.value = null
  }
}
</script>
