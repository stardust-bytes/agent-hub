<template>
  <div class="flex flex-col h-full bg-cyber-bg font-mono">
    <div v-if="projectPath" class="flex items-center gap-3 px-3 py-2 border-b border-cyber-code-border shrink-0 bg-cyber-dark">
      <div class="flex items-center gap-2 text-sm">
        <span class="text-cyber-green">●</span>
        <span class="text-cyber-text truncate max-w-80">{{ projectPath }}</span>
      </div>
      <button @click="browseProject" class="text-sm text-cyber-accent font-mono px-2 py-0.5 border border-cyber-accent/40 transition-colors duration-150 hover:bg-cyber-accent/10">{{ t('cowork.browse') }}</button>
      <button @click="disconnect" class="text-sm text-red-400 font-mono px-2 py-0.5 border border-red-400/40 transition-colors duration-150 hover:bg-red-400/10">{{ t('cowork.disconnect') }}</button>
    </div>

    <div v-else class="flex-1 flex items-center justify-center">
      <div class="text-center max-w-md">
        <div class="text-lg text-cyber-accent font-mono mb-2">{{ t('cowork.connect.title') }}</div>
        <div class="text-sm text-cyber-muted font-mono mb-4">{{ t('cowork.connect.description') }}</div>
        <button @click="showDirBrowser = true" class="text-sm text-cyber-accent font-mono px-4 py-2 border border-cyber-accent/40 transition-colors duration-150 hover:bg-cyber-accent/10">{{ t('cowork.connect.browse') }}</button>
      </div>
    </div>

    <div v-if="projectPath" class="flex flex-1 overflow-hidden">
      <FileTree
        :project-path="projectPath"
        :refresh-key="fileTreeRefreshKey"
        class="w-60 shrink-0"
        @file-select="onFileSelect"
      />
      <div class="flex-1 flex flex-col overflow-hidden">
        <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 cowork-messages">
          <div class="max-w-60rem mx-auto space-y-4 px-3">
            <div v-for="(msg, i) in messages" :key="i" class="font-mono">

              <div v-if="msg.role === 'system' && msg.content === '⟳ thinking...' || msg.content === '⟳ đang nghĩ...'"
                class="border-l-2 border-cyber-accent/30 pl-3 py-1">
                <div class="text-sm text-cyber-accent/60 font-mono">⟳ {{ msg.content.replace('⟳ ', '') }}</div>
              </div>

              <div v-else-if="msg.role === 'tool' && !msg.isResult"
                class="border-l-2 border-cyber-orange/50 pl-3 py-1.5">
                <div class="text-sm text-cyber-orange font-mono mb-0.5 break-all">[⚙] {{ msg.content }}</div>
              </div>

              <div v-else-if="msg.role === 'tool' && msg.isResult"
                class="border-l-2 border-cyber-green/50 pl-3 py-1.5">
                <template v-if="isToolLong(msg.content)">
                  <div v-if="!isToolExpanded(msg)" class="text-sm text-cyber-green font-mono whitespace-pre-wrap break-all">{{ toolPreview(msg.content) }}</div>
                  <div v-if="!isToolExpanded(msg)" class="text-sm text-cyber-muted font-mono mt-0.5">...</div>
                  <div v-if="isToolExpanded(msg)" class="text-sm text-cyber-green font-mono whitespace-pre-wrap break-all">{{ msg.content }}</div>
                  <button
                    @click="toggleToolExpand(msg)"
                    class="text-sm font-mono mt-0.5 transition-colors duration-150 text-cyber-accent/60 hover:text-cyber-accent"
                  >{{ isToolExpanded(msg) ? t('chat.tool.collapse') : t('chat.tool.expand') }}</button>
                </template>
                <div v-else class="text-sm text-cyber-green font-mono whitespace-pre-wrap break-all">{{ msg.content }}</div>
              </div>

              <div v-else-if="msg.role === 'agent'"
                class="border-l-2 border-cyber-accent/80 pl-3 py-1">
                <div class="text-sm text-cyber-accent/80 mb-0.5 font-mono">
                  <HiChevronRight class="w-3 h-3 inline" /> {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
                </div>
                <div v-if="msg.typing" class="text-sm leading-relaxed break-words text-cyber-text markdown-body" v-html="renderMarkdown(msg.content)"></div>
                <template v-else>
                  <template v-for="(seg, si) in parseSegments(msg.content)" :key="si">
                    <div v-if="seg.type === 'markdown'" class="text-sm leading-relaxed break-words text-cyber-text markdown-body" v-html="seg.content" />
                    <FormBlock v-else :html="seg.content" :index="si" @submit="(data) => onFormSubmit(data)" />
                  </template>
                </template>
              </div>



              <div v-else-if="msg.role === 'user'"
                class="border-l-2 border-cyber-accent/80 pl-3 py-1">
                <div class="text-sm text-cyber-accent/80 mb-0.5 font-mono">{{ rolePrefix(msg.role) }} · {{ msg.timestamp }}</div>
                <div class="text-sm leading-relaxed break-words text-cyber-text" v-html="highlightUserMessage(msg.content)"></div>
              </div>

              <div v-else-if="msg.role === 'system'"
                class="pl-3 py-0.5">
                <div class="text-sm text-cyber-muted font-mono">{{ msg.content }}</div>
              </div>

            </div>
          </div>
        </div>

        <div class="shrink-0 pt-2">
          <div class="max-w-60rem mx-auto w-full px-3 pb-3">
            <div class="bg-cyber-dark px-3 py-2">
              <form @submit.prevent="submit" class="flex items-center gap-2">
                <input
                  ref="inputEl"
                  v-model="input"
                  class="flex-1 bg-transparent text-cyber-text text-sm outline-none font-mono placeholder-cyber-muted/40 caret-white"
                  :placeholder="t('chat.placeholder')"
                  :disabled="streaming"
                />
                <button
                  v-if="streaming"
                  @click="stopStream"
                  class="text-cyber-accent/80 text-sm font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent shrink-0"
                >{{ t('chat.stop') }}</button>
              </form>
              <div v-if="streaming" class="flex items-center gap-1 pt-2">
                <div v-for="i in 8" :key="i" class="w-1 h-1 bg-cyber-accent rounded-full animate-dot-pulse" :style="{ animationDelay: `${(i - 1) * 0.15}s` }" />
              </div>
            </div>
            <div class="flex items-center justify-between pt-2">
              <ModelSelector
                v-model="selectedModelId"
                :models="availableModels"
                :disabled="streaming"
              />
              <button
                @click="showSessionModal = true"
                class="text-cyber-accent/70 text-sm font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent"
              >{{ t('sessions.header') }}</button>
            </div>
          </div>
        </div>
      </div>

      <ArtifactsPanel
        :visible="artifactsVisible"
        :file-content="previewContent"
        :file-name="previewFileName"
        :plans="activePlans"
        :tool-results="recentToolResults"
        class="w-96 shrink-0"
        @close="artifactsVisible = false"
      />
    </div>

    <SessionModal
      v-model="showSessionModal"
      :current-session-id="currentSessionId"
      mode="cowork"
      @select="loadSession"
      @created="(id: number) => { currentSessionId = id; loadSession(id) }"
    />
    <DirectoryBrowser v-model="showDirBrowser" @select="onDirSelected" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiChevronRight } from 'vue-icons-plus/hi'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import FileTree from './FileTree.vue'
import ArtifactsPanel from './ArtifactsPanel.vue'
import DirectoryBrowser from './DirectoryBrowser.vue'
import ModelSelector from './ModelSelector.vue'
import SessionModal from './SessionModal.vue'
import FormBlock from './FormBlock.vue'

interface PlanStep { id: number; order: number; text: string; status: string }
interface PlanData { id: number; title: string; status: string; steps: PlanStep[] }
interface ChatMessage { role: string; content: string; timestamp: string; typing?: boolean; isResult?: boolean; plan?: PlanData; toolName?: string }

const { t } = useI18n()

const projectPath = ref<string | null>(null)
const input = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const messagesEl = ref<HTMLElement | null>(null)
const messages = ref<ChatMessage[]>([])
const streaming = ref(false)
const abortController = ref<AbortController | null>(null)
const showDirBrowser = ref(false)
const artifactsVisible = ref(true)
const previewContent = ref<string | null>(null)
const previewFileName = ref('')
const activePlans = ref<PlanData[]>([])
const recentToolResults = ref<Array<{ toolName: string; content: string }>>([])
const selectedModelId = ref<number | null>(null)
const availableModels = ref<Array<{ id: number; name: string; providerName: string; providerId: number }>>([])
const currentSessionId = ref<number | null>(null)
const showSessionModal = ref(false)
const fileTreeRefreshKey = ref(0)

onMounted(async () => {
  await loadProject()
  await loadModel()
})

async function loadProject() {
  try {
    const res = await fetch('/api/cowork/project')
    if (res.ok) {
      const data = await res.json() as { projectPath: string | null }
      projectPath.value = data.projectPath
    }
  } catch { /* ignore */ }
}

async function loadModel() {
  try {
    const res = await fetch('/api/providers/models')
    if (res.ok) {
      const models = await res.json() as Array<{ id: number; name: string; providerName: string; providerId: number }>
      availableModels.value = models
      if (models.length > 0) {
        const savedId = Number(localStorage.getItem('workspace.modelId'))
        selectedModelId.value = models.find(m => m.id === savedId)?.id ?? models[0].id
      }
    }
  } catch { /* ignore */ }
}

async function loadSession(id: number) {
  currentSessionId.value = id
  messages.value = []
  try {
    const res = await fetch(`/api/sessions/${id}/messages`)
    if (res.ok) {
      const history = await res.json() as Array<{ role: string; content: string; createdAt: string; toolName?: string; isResult?: boolean }>
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
            const planForDisplay = { ...planData, steps: planData.steps.map(s => ({ ...s })) }
            try {
              const fres = await fetch(`/api/plans/${planData.id}`)
              if (fres.ok) {
                const fresh = await fres.json() as PlanData
                planForDisplay.status = fresh.status
                if (fresh.steps) {
                  for (const fs of fresh.steps) {
                    const step = planForDisplay.steps.find(s => s.id === fs.id)
                    if (step) step.status = fs.status
                  }
                }
              }
            } catch { /* use saved data */ }
            if (planForDisplay.status === 'EXECUTING' && planForDisplay.steps.every(s => s.status === 'DONE' || s.status === 'FAILED')) {
              planForDisplay.status = 'DONE'
            }
            messages.value.push({
              role: 'plan',
              content: '',
              timestamp: new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
              plan: planForDisplay,
            })
          } catch {
            messages.value.push({ role: 'system', content: msg.content, timestamp: new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour12: false }) })
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
  await scrollToBottom()
}

function onFileSelect(filePath: string) {
  loadFilePreview(filePath)
}

async function loadFilePreview(filePath: string) {
  try {
    const enc = encodeURIComponent(filePath)
    const res = await fetch(`/api/cowork/read-file?path=${enc}`)
    if (res.ok) {
      const data = await res.json() as { content: string; filename: string }
      previewContent.value = data.content
      previewFileName.value = data.filename
      artifactsVisible.value = true
    }
  } catch { /* ignore */ }
}

async function browseProject() {
  showDirBrowser.value = true
}

function onDirSelected(dirPath: string) {
  connectProject(dirPath)
}

async function connectProject(dirPath: string) {
  try {
    const res = await fetch('/api/cowork/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dirPath }),
    })
    if (res.ok) {
      projectPath.value = dirPath
      showDirBrowser.value = false
    }
  } catch { /* ignore */ }
}

async function disconnect() {
  try {
    await fetch('/api/cowork/project', { method: 'DELETE' })
    projectPath.value = null
    messages.value = []
    previewContent.value = null
    activePlans.value = []
  } catch { /* ignore */ }
}

function now(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false })
}

function rolePrefix(role: string): string {
  if (role === 'user') return t('chat.user.prefix')
  if (role === 'agent') return t('chat.agent.prefix')
  if (role === 'system') return t('chat.system.prefix')
  return ''
}

const toolExpanded = ref<Set<ChatMessage>>(new Set())

function isToolLong(content: string): boolean {
  return content.split('\n').length > 5
}

function toolPreview(content: string): string {
  return content.split('\n').slice(0, 5).join('\n')
}

function isToolExpanded(msg: ChatMessage): boolean {
  return toolExpanded.value.has(msg)
}

function toggleToolExpand(msg: ChatMessage): void {
  const s = toolExpanded.value
  if (s.has(msg)) { s.delete(msg) } else { s.add(msg) }
  toolExpanded.value = new Set(s)
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

interface MessageSegment { type: 'markdown' | 'form'; content: string }

function parseSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  const formRegex = /```form\s*\n([\s\S]*?)```/g
  let lastIndex = 0
  let m
  while ((m = formRegex.exec(content)) !== null) {
    if (m.index > lastIndex) {
      const markdownPart = content.slice(lastIndex, m.index).trim()
      if (markdownPart) segments.push({ type: 'markdown', content: renderMarkdown(markdownPart) })
    }
    segments.push({ type: 'form', content: m[1].trim() })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim()
    if (remaining) segments.push({ type: 'markdown', content: renderMarkdown(remaining) })
  }
  return segments
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

function stopStream() {
  abortController.value?.abort()
}

async function submit() {
  const text = input.value.trim()
  if (!text || streaming.value || !selectedModelId.value) return

  if (currentSessionId.value === null) {
    try {
      const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'cowork' }) })
      if (res.ok) {
        const session = await res.json() as { id: number }
        currentSessionId.value = session.id
      }
    } catch { /* ignore */ }
  }

  localStorage.setItem('workspace.modelId', String(selectedModelId.value))
  input.value = ''
  streaming.value = true

  messages.value.push({ role: 'user', content: text, timestamp: now() })
  await scrollToBottom()

  const ctrl = new AbortController()
  abortController.value = ctrl

  let currentAgentIdx = -1
  const thinkingMsg: ChatMessage = { role: 'system', content: t('chat.thinking'), timestamp: now() }
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
    const newMsg: ChatMessage = { role: 'agent', content: '', timestamp: now(), typing: true }
    currentAgentIdx = messages.value.length
    messages.value.push(newMsg)
    return currentAgentIdx
  }

  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        providerModelId: selectedModelId.value,
        sessionId: currentSessionId.value ?? 0,
        mode: 'cowork',
      }),
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
            const msg: ChatMessage = { role: 'system', content: `⟳ ${String(parsed.thinking)}`, timestamp: now() }
            messages.value.push(msg)
            await scrollToBottom()
          } else if (parsed.plan) {
            clearThinking()
            currentAgentIdx = -1
            const planData = parsed.plan as PlanData
            activePlans.value.push(planData)
          } else if (parsed.planStepUpdate) {
            const upd = parsed.planStepUpdate as { planId: number; stepId: number; status: string }
            let stepText = ''
            for (const plan of activePlans.value) {
              if (plan.id === upd.planId) {
                const step = plan.steps.find(s => s.id === upd.stepId)
                if (step) { step.status = upd.status; stepText = step.text }
                break
              }
            }
            if (stepText) {
              const icon = upd.status === 'DONE' ? '✅' : upd.status === 'DOING' ? '⟳' : upd.status === 'FAILED' ? '✗' : '[ ]'
              messages.value.push({ role: 'system', content: `${icon} ${stepText}`, timestamp: now() })
              await scrollToBottom()
            }
          } else if (parsed.planInterrupted) {
            messages.value.push({
              role: 'system',
              content: '[⏹ Plan execution interrupted. Send "tiếp tục" to resume.]',
              timestamp: now(),
            })
            await scrollToBottom()
          } else if (parsed.token) {
            clearThinking()
            const idx = getOrCreateAgentMsg()
            messages.value[idx].content += String(parsed.token)
            if (!done) scrollToBottom()
          }
        } catch { /* skip malformed */ }
      }
    }

    const lastAgent = [...messages.value].reverse().find(m => m.role === 'agent')
    if (lastAgent) lastAgent.typing = false
    await scrollToBottom()
    fileTreeRefreshKey.value++
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
    fileTreeRefreshKey.value++
  }
}
</script>
