<template>
  <div class="flex flex-col bg-cyber-bg min-w-0">
    <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 min-h-0">
      <div class="max-w-60rem mx-auto space-y-4 px-3">
        <div v-for="(msg, i) in messages" :key="i" class="font-mono">

        <!-- Thinking block -->
        <div v-if="msg.role === 'system' && msg.content === '⟳ thinking...' || msg.content === '⟳ đang nghĩ...'"
          class="border-l-2 border-cyber-accent/30 pl-3 py-1">
          <div class="text-sm text-cyber-accent/60 font-mono">⟳ {{ msg.content.replace('⟳ ', '') }}</div>
        </div>

        <!-- Tool call block -->
        <div v-else-if="msg.role === 'tool' && !msg.isResult"
          class="border-l-2 border-cyber-orange/50 pl-3 py-1.5">
          <div class="text-sm text-cyber-orange font-mono mb-0.5">[⚙] {{ msg.content }}</div>
        </div>

        <!-- Tool result block -->
        <div v-else-if="msg.role === 'tool' && msg.isResult"
          class="border-l-2 border-cyber-green/50 pl-3 py-1.5">
          <div class="text-sm text-cyber-green font-mono">{{ msg.content }}</div>
        </div>

        <!-- Agent answer block -->
        <div v-else-if="msg.role === 'agent'"
          class="border-l-2 border-cyber-accent/80 pl-3 py-1">
          <div class="text-sm text-cyber-accent/80 mb-0.5 font-mono">
            <HiChevronRight class="w-3 h-3 inline" /> {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
          </div>
          <div v-if="msg.typing" class="text-sm leading-relaxed break-words text-cyber-text">
            {{ msg.content }}
          </div>
          <template v-else>
            <template v-for="(seg, si) in parseSegments(msg.content)" :key="si">
              <div v-if="seg.type === 'markdown'" class="text-sm leading-relaxed break-words text-cyber-text markdown-body" v-html="seg.content" />
              <FormBlock v-else :html="seg.content" :index="si" @submit="(data) => onFormSubmit(data)" />
            </template>
          </template>
        </div>

        <!-- User message block -->
        <div v-else-if="msg.role === 'user'"
          class="border-l-2 border-cyber-accent/80 pl-3 py-1">
          <div class="text-sm text-cyber-accent/80 mb-0.5 font-mono">{{ rolePrefix(msg.role) }} · {{ msg.timestamp }}</div>
          <div class="text-sm leading-relaxed break-words text-cyber-text">{{ msg.content }}</div>
        </div>

        <!-- System message (other) -->
        <div v-else-if="msg.role === 'system'"
          class="pl-3 py-0.5">
          <div class="text-sm text-cyber-muted font-mono">{{ msg.content }}</div>
        </div>

      </div>
      </div>
    </div>

    <SessionModal
      v-model="showSessionModal"
      :current-session-id="currentSessionId"
      @select="loadSession"
      @created="(id: number) => { currentSessionId = id; loadSession(id) }"
    />
    <div class="shrink-0">
      <div class="max-w-60rem mx-auto w-full px-3 pb-3">
        <div class="bg-cyber-dark px-3 py-2">
          <form @submit.prevent="submit" class="flex items-center gap-2">
            <input
              ref="inputEl"
              v-model="input"
              class="flex-1 bg-transparent text-cyber-text text-sm outline-none font-mono placeholder-cyber-muted/40 caret-white"
              :placeholder="t('chat.placeholder')"
              :disabled="streaming"
              autocomplete="off"
              spellcheck="false"
            />
            <button
              v-if="streaming"
              @click="stopStream"
              class="text-cyber-accent/80 text-sm font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent shrink-0"
            >{{ t('chat.stop') }}</button>
          </form>
        </div>
        <div class="flex items-center justify-between pt-2">
          <div class="flex items-center gap-2">
            <ModelSelector
              v-model="selectedModelId"
              :models="availableModels"
              :disabled="streaming"
            />
            <div class="flex border border-cyber-accent/20 rounded">
              <button
                @click="agentMode = true"
                :class="agentMode ? 'bg-cyber-accent/20 text-cyber-accent' : 'text-cyber-muted'"
                class="px-2 py-0.5 text-sm font-mono transition-colors duration-150"
              >{{ t('chat.mode.agent') }}</button>
              <button
                @click="agentMode = false"
                :class="!agentMode ? 'bg-cyber-accent/20 text-cyber-accent' : 'text-cyber-muted'"
                class="px-2 py-0.5 text-sm font-mono transition-colors duration-150"
              >{{ t('chat.mode.chat') }}</button>
            </div>
          </div>
          <button
            @click="showSessionModal = true"
            class="text-cyber-accent/70 text-sm font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent"
          >{{ t('sessions.header') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiChevronRight } from 'vue-icons-plus/hi'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import ModelSelector from './ModelSelector.vue'
import SessionModal from './SessionModal.vue'
import FormBlock from './FormBlock.vue'

interface Message {
  role: 'user' | 'agent' | 'system' | 'tool'
  content: string
  timestamp: string
  typing?: boolean
  toolName?: string
  isResult?: boolean
}

interface ProviderModelFlat {
  id: number
  name: string
  providerName: string
  providerId: number
}

const { t } = useI18n()

const messages = ref<Message[]>([
  { role: 'system', content: t('chat.system.init'), timestamp: now() },
])
const input = ref('')
const streaming = ref(false)
const selectedModelId = ref<number | null>(null)
const availableModels = ref<ProviderModelFlat[]>([])
const abortController = ref<AbortController | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const messagesEl = ref<HTMLElement | null>(null)
const currentSessionId = ref<number | null>(null)
const showSessionModal = ref(false)
const agentMode = ref(true)

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
  if (role === 'system') return 'text-cyber-muted'
  return 'text-cyber-muted'
}

function renderMarkdown(content: string): string {
  let html = marked.parse(content) as string
  html = html.replace(
    /\[Source:\s*([^\]]+)\]/g,
    (_m, content) => {
      const sources: string[] = []
      const re = /&quot;([^&]+)&quot;[^§]*§(\d+)/g
      let m
      while ((m = re.exec(content)) !== null) {
        sources.push(`<span class="citation">[📄 ${m[1]} · §${m[2]}]</span>`)
      }
      return sources.join(' ')
    }
  )
  return DOMPurify.sanitize(html)
}

interface MessageSegment {
  type: 'markdown' | 'form'
  content: string
}

function parseSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  const formRegex = /```form\s*\n([\s\S]*?)```/g
  let lastIndex = 0
  let m

  while ((m = formRegex.exec(content)) !== null) {
    if (m.index > lastIndex) {
      const markdownPart = content.slice(lastIndex, m.index).trim()
      if (markdownPart) {
        segments.push({ type: 'markdown', content: renderMarkdown(markdownPart) })
      }
    }
    segments.push({ type: 'form', content: m[1].trim() })
    lastIndex = m.index + m[0].length
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim()
    if (remaining) {
      segments.push({ type: 'markdown', content: renderMarkdown(remaining) })
    }
  }

  return segments
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
    const text = JSON.stringify(data)
    input.value = text
    submit()
  }
}

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

onMounted(async () => {
  inputEl.value?.focus()
  try {
    const res = await fetch('/api/providers/models')
    if (!res.ok) throw new Error('fetch failed')
    const models = (await res.json()) as ProviderModelFlat[]
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
    const res = await fetch(`/api/sessions/${id}/messages`)
    if (res.ok) {
      const history = await res.json() as Array<{ role: string; content: string; createdAt: string; toolName?: string; isResult?: boolean }>
      if (history.length === 0) {
        messages.value.push({ role: 'system', content: t('chat.system.init'), timestamp: now() })
      }
      for (const msg of history) {
        if (msg.toolName != null) {
          messages.value.push({
            role: 'tool',
            content: msg.content,
            timestamp: new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
            toolName: msg.toolName,
            isResult: msg.isResult ?? false,
          })
        } else if (msg.role === 'system') {
          messages.value.push({
            role: 'system',
            content: msg.content,
            timestamp: new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
          })
        } else {
          const mappedRole = msg.role === 'assistant' ? 'agent' : msg.role
          messages.value.push({
            role: mappedRole as 'user' | 'agent',
            content: msg.content,
            timestamp: new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
          })
        }
      }
    }
  } catch { /* ignore */ }
}

async function submit() {
  const text = input.value.trim()
  if (!text || streaming.value || selectedModelId.value === null) return
  if (currentSessionId.value === null) {
    try {
      const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (res.ok) {
        const session = await res.json() as { id: number }
        currentSessionId.value = session.id
      }
    } catch { /* ignore */ }
  }
  input.value = ''
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
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, providerModelId: selectedModelId.value, sessionId: currentSessionId.value, mode: agentMode.value ? 'agent' : 'chat' }),
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
            if (currentAgentIdx >= 0) {
              messages.value[currentAgentIdx].typing = false
            }
            messages.value.push({
              role: 'system',
              content: `${t('chat.error.unreachable')} (${String(parsed.error)})`,
              timestamp: now(),
            })
            await scrollToBottom()
          } else if (parsed.toolCall) {
            clearThinking()
            currentAgentIdx = -1
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
          } else if (parsed.thinking) {
            clearThinking()
            currentAgentIdx = -1
            const thinkingMsg: Message = { role: 'system', content: `⟳ ${String(parsed.thinking)}`, timestamp: now() }
            messages.value.push(thinkingMsg)
            await scrollToBottom()
          } else if (parsed.token) {
            clearThinking()
            const idx = getOrCreateAgentMsg()
            messages.value[idx].content += String(parsed.token)
            if (!done) scrollToBottom()
          }
        } catch { /* skip malformed SSE line */ }
      }
    }

    if (currentAgentIdx >= 0) {
      messages.value[currentAgentIdx].typing = false
    }
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
