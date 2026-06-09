<template>
  <div class="flex flex-col bg-cyber-bg min-w-0">
    <template v-if="hasChatMessages">
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
            <template v-if="isToolLong(msg.content)">
              <div v-if="!isToolExpanded(msg)" class="text-sm text-cyber-green font-mono whitespace-pre-wrap">{{ toolPreview(msg.content) }}</div>
              <div v-if="!isToolExpanded(msg)" class="text-sm text-cyber-muted font-mono mt-0.5">...</div>
              <div v-if="isToolExpanded(msg)" class="text-sm text-cyber-green font-mono whitespace-pre-wrap">{{ msg.content }}</div>
              <button
                @click="toggleToolExpand(msg)"
                class="text-sm font-mono mt-0.5 transition-colors duration-150 text-cyber-accent/60 hover:text-cyber-accent"
              >{{ isToolExpanded(msg) ? t('chat.tool.collapse') : t('chat.tool.expand') }}</button>
            </template>
            <div v-else class="text-sm text-cyber-green font-mono whitespace-pre-wrap">{{ msg.content }}</div>
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

          <!-- Plan bubble -->
          <div v-else-if="msg.role === 'plan' && msg.plan"
            class="border-l-2 border-cyber-accent/80 pl-3 py-1">
            <div class="text-sm text-cyber-accent/80 mb-1 font-mono">
              <HiChevronRight class="w-3 h-3 inline" /> plan · {{ msg.timestamp }}
            </div>
            <PlanBubble
              :plan="msg.plan"
              :streaming="streaming"
              @approve="handleApprove"
              @reject="handleReject"
            />
          </div>

          <!-- User message block -->
          <div v-else-if="msg.role === 'user'"
            class="border-l-2 border-cyber-accent/80 pl-3 py-1">
            <div class="text-sm text-cyber-accent/80 mb-0.5 font-mono">{{ rolePrefix(msg.role) }} · {{ msg.timestamp }}</div>
            <div class="text-sm leading-relaxed break-words text-cyber-text" v-html="highlightUserMessage(msg.content)"></div>
          </div>

          <!-- System message (other) -->
          <div v-else-if="msg.role === 'system'"
            class="pl-3 py-0.5">
            <div class="text-sm text-cyber-muted font-mono">{{ msg.content }}</div>
          </div>

        </div>
        </div>
      </div>
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
      @select="loadSession"
      @created="(id: number) => { currentSessionId = id; loadSession(id) }"
    />
    <div class="shrink-0">
      <div class="max-w-60rem mx-auto w-full px-3 pb-3">
        <div class="bg-cyber-dark px-3 py-2">
          <form @submit.prevent="submit" class="flex items-center gap-2">
            <div class="relative flex-1">
              <SlashMenu
                :visible="showSlashMenu"
                :filter="slashFilter"
                :selected-index="slashSelectedIndex"
                @select="onSlashSelect"
                @highlight="(i: number) => { slashSelectedIndex = i }"
              />
              <input
                ref="inputEl"
                v-model="input"
                class="flex-1 bg-transparent text-cyber-text text-sm outline-none font-mono placeholder-cyber-muted/40 caret-white w-full"
                :placeholder="t('chat.placeholder')"
                :disabled="streaming"
                autocomplete="off"
                spellcheck="false"
                @input="onInput"
                @keydown="onKeyDown"
              />
            </div>
            <button
              v-if="streaming"
              @click="stopStream"
              class="text-cyber-accent/80 text-sm font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent shrink-0"
            >{{ t('chat.stop') }}</button>
          </form>
          <div v-if="streaming" class="flex items-center gap-1 pt-2">
            <div
              v-for="i in 8" :key="i"
              class="w-1 h-1 bg-cyber-accent rounded-full animate-dot-pulse"
              :style="{ animationDelay: `${(i - 1) * 0.15}s` }"
            />
          </div>
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
import { ref, nextTick, onMounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiChevronRight } from 'vue-icons-plus/hi'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import ModelSelector from './ModelSelector.vue'
import SessionModal from './SessionModal.vue'
import FormBlock from './FormBlock.vue'
import PlanBubble from './PlanBubble.vue'
import SlashMenu from './SlashMenu.vue'

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

interface Message {
  role: 'user' | 'agent' | 'system' | 'tool' | 'plan'
  content: string
  timestamp: string
  typing?: boolean
  toolName?: string
  isResult?: boolean
  plan?: PlanData
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
const streaming = ref(false)
const selectedModelId = ref<number | null>(null)
const availableModels = ref<ProviderModelFlat[]>([])
const abortController = ref<AbortController | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const input = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const currentSessionId = ref<number | null>(null)
const showSessionModal = ref(false)
const agentMode = ref(true)
const showSlashMenu = ref(false)
const slashFilter = ref('')
const slashSelectedIndex = ref(0)

const hasChatMessages = computed(() =>
  messages.value.some(m => m.role === 'user' || m.role === 'agent' || m.role === 'plan')
)

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

const toolExpanded = ref<Set<Message>>(new Set())

function isToolLong(content: string): boolean {
  return content.split('\n').length > 5
}

function toolPreview(content: string): string {
  return content.split('\n').slice(0, 5).join('\n')
}

function isToolExpanded(msg: Message): boolean {
  return toolExpanded.value.has(msg)
}

function toggleToolExpand(msg: Message): void {
  const s = toolExpanded.value
  if (s.has(msg)) {
    s.delete(msg)
  } else {
    s.add(msg)
  }
  toolExpanded.value = new Set(s)
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

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const text = el.value || ''

  if (text.startsWith('/')) {
    const spaceIdx = text.indexOf(' ')
    if (spaceIdx === -1) {
      showSlashMenu.value = true
      slashFilter.value = text
      slashSelectedIndex.value = 0
    } else {
      showSlashMenu.value = false
    }
  } else {
    showSlashMenu.value = false
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (!showSlashMenu.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    slashSelectedIndex.value = Math.min(slashSelectedIndex.value + 1, 2)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    slashSelectedIndex.value = Math.max(slashSelectedIndex.value - 1, 0)
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault()
    const filtered = getSlashCommands().filter(c => c.command.startsWith(slashFilter.value))
    if (filtered[slashSelectedIndex.value]) {
      insertSlash(filtered[slashSelectedIndex.value].command)
    }
  } else if (e.key === 'Escape') {
    showSlashMenu.value = false
  }
}

function onSlashSelect(command: string) {
  insertSlash(command)
}

function insertSlash(command: string) {
  input.value = command + ' '
  showSlashMenu.value = false
  inputEl.value?.focus()
}

function getSlashCommands() {
  return [
    { command: '/plan', description: '' },
    { command: '/help', description: '' },
    { command: '/clear', description: '' },
  ]
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
        } else if (msg.role === 'plan') {
          try {
            const planData = JSON.parse(msg.content) as PlanData
            messages.value.push({
              role: 'plan',
              content: '',
              timestamp: new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
              plan: planData,
            })
          } catch {
            messages.value.push({
              role: 'system',
              content: msg.content,
              timestamp: new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
            })
          }
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

async function handleApprove(planId: number) {
  const planMsg = messages.value.find(m => m.role === 'plan' && m.plan?.id === planId)
  if (!planMsg?.plan || selectedModelId.value === null || currentSessionId.value === null) return

  try {
    const approveRes = await fetch(`/api/plans/${planId}/approve`, { method: 'POST' })
    if (!approveRes.ok) throw new Error(`HTTP ${approveRes.status}`)
    planMsg.plan.status = 'EXECUTING'
  } catch {
    messages.value.push({ role: 'system', content: t('chat.error.unreachable'), timestamp: now() })
    return
  }

  streaming.value = true
  let currentAgentIdx = -1

  try {
    const execRes = await fetch(`/api/agent/plans/${planId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerModelId: selectedModelId.value, sessionId: currentSessionId.value }),
    })
    if (!execRes.ok || !execRes.body) throw new Error(`HTTP ${execRes.status}`)

    const reader = execRes.body.getReader()
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
          if (parsed.planStepUpdate) {
            const upd = parsed.planStepUpdate as { planId: number; stepId: number; status: string }
            const msg = messages.value.find(m => m.role === 'plan' && m.plan?.id === upd.planId)
            if (msg?.plan) {
              const step = msg.plan.steps.find(s => s.id === upd.stepId)
              if (step) step.status = upd.status
            }
            await scrollToBottom()
          } else if (parsed.token) {
            if (currentAgentIdx < 0) {
              currentAgentIdx = messages.value.length
              messages.value.push({ role: 'agent', content: '', timestamp: now(), typing: true })
            }
            messages.value[currentAgentIdx].content += String(parsed.token)
            await scrollToBottom()
          } else if (parsed.toolCall) {
            currentAgentIdx = -1
            const tc = parsed.toolCall as { name: string; args: Record<string, unknown> }
            const argsStr = Object.entries(tc.args).map(([k, v]) => `${k}=${v}`).join(', ')
            messages.value.push({ role: 'tool', content: `${tc.name}(${argsStr})`, timestamp: now(), toolName: tc.name, isResult: false })
            await scrollToBottom()
          } else if (parsed.toolResult) {
            currentAgentIdx = -1
            const tr = parsed.toolResult as { name: string; result: string }
            messages.value.push({ role: 'tool', content: tr.result, timestamp: now(), toolName: tr.name, isResult: true })
            await scrollToBottom()
          }
        } catch { /* skip malformed */ }
      }
    }

    const msg2 = messages.value.find(m => m.role === 'plan' && m.plan?.id === planId)
    if (msg2?.plan && msg2.plan.status === 'EXECUTING') msg2.plan.status = 'DONE'
    if (currentAgentIdx >= 0) messages.value[currentAgentIdx].typing = false
    await scrollToBottom()
  } catch (e) {
    if (e instanceof Error && e.name !== 'AbortError') {
      messages.value.push({ role: 'system', content: t('chat.error.unreachable'), timestamp: now() })
    }
  } finally {
    streaming.value = false
  }
}

async function handleReject(planId: number) {
  try {
    await fetch(`/api/plans/${planId}/reject`, { method: 'POST' })
  } catch { /* ignore */ }
  const idx = messages.value.findIndex(m => m.role === 'plan' && m.plan?.id === planId)
  if (idx !== -1) messages.value.splice(idx, 1)
}

function highlightUserMessage(content: string): string {
  return DOMPurify.sanitize(highlightSlash(content))
}

function highlightSlash(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (text.startsWith('/')) {
    const spaceIdx = text.indexOf(' ')
    if (spaceIdx !== -1) {
      const cmd = text.slice(0, spaceIdx)
      const rest = text.slice(spaceIdx)
      return `<span class="text-cyber-cyan">${esc(cmd)}</span><span class="text-cyber-text">${esc(rest)}</span>`
    }
    return `<span class="text-cyber-cyan">${esc(text)}</span>`
  }
  return `<span class="text-cyber-text">${esc(text)}</span>`
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
          } else if (parsed.plan) {
            clearThinking()
            currentAgentIdx = -1
            const planData = parsed.plan as PlanData
            messages.value.push({
              role: 'plan',
              content: '',
              timestamp: now(),
              plan: { ...planData, steps: planData.steps.map(s => ({ ...s })) },
            })
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
