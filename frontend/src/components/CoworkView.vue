<template>
  <div class="flex flex-col h-full bg-cyber-bg font-mono">
    <div v-if="projectPath" class="flex items-center gap-3 px-3 py-2 border-b border-cyber-code-border shrink-0 bg-cyber-dark">
      <div class="flex items-center gap-2 text-sm">
        <span class="text-cyber-green">●</span>
        <span class="text-cyber-text truncate max-w-80">{{ projectPath }}</span>
      </div>
      <button @click="browseProject" class="text-xs text-cyber-accent font-mono px-2 py-0.5 border border-cyber-accent/40 transition-colors duration-150 hover:bg-cyber-accent/10">{{ t('cowork.browse') }}</button>
      <button @click="disconnect" class="text-xs text-red-400 font-mono px-2 py-0.5 border border-red-400/40 transition-colors duration-150 hover:bg-red-400/10">{{ t('cowork.disconnect') }}</button>
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
        class="w-60 shrink-0"
        @file-select="onFileSelect"
      />
      <div class="flex-1 flex flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto px-3 py-3">
          <div class="max-w-60rem mx-auto space-y-4 px-3">
            <div v-for="(msg, i) in messages" :key="i">
              <div v-if="msg.role === 'user'" class="border-l-2 border-cyber-accent/80 pl-3 py-1">
                <div class="text-xs text-cyber-accent/80 mb-0.5 font-mono">▶ {{ t('chat.user.prefix') }} · {{ msg.timestamp }}</div>
                <div class="text-sm leading-relaxed break-words text-cyber-text">{{ msg.content }}</div>
              </div>
              <div v-else-if="msg.role === 'agent'" class="border-l-2 border-cyber-accent/80 pl-3 py-1">
                <div class="text-xs text-cyber-accent/80 mb-0.5 font-mono">▶ {{ t('chat.agent.prefix') }} · {{ msg.timestamp }}</div>
                <div class="text-sm leading-relaxed break-words text-cyber-text">{{ msg.content }}</div>
              </div>
              <div v-else-if="msg.role === 'tool' && !msg.isResult" class="border-l-2 border-cyber-orange/50 pl-3 py-1">
                <div class="text-sm text-cyber-orange font-mono">[⚙] {{ msg.content }}</div>
              </div>
              <div v-else-if="msg.role === 'tool' && msg.isResult" class="border-l-2 border-cyber-green/50 pl-3 py-1">
                <div class="text-sm text-cyber-green font-mono whitespace-pre-wrap">{{ msg.content }}</div>
              </div>
              <div v-else-if="msg.role === 'system'" class="pl-3 py-0.5">
                <div class="text-sm text-cyber-muted font-mono">{{ msg.content }}</div>
              </div>
              <div v-else-if="msg.role === 'plan' && msg.plan" class="border-l-2 border-cyber-accent/80 pl-3 py-1">
                <PlanBubble :plan="msg.plan" :streaming="streaming" @approve="handleApprove" @reject="handleReject" />
              </div>
            </div>
          </div>
        </div>

        <div class="shrink-0 border-t border-cyber-code-border">
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

    <DirectoryBrowser v-if="showDirBrowser" v-model="showDirBrowser" @select="onDirSelected" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import FileTree from './FileTree.vue'
import ArtifactsPanel from './ArtifactsPanel.vue'
import PlanBubble from './PlanBubble.vue'
import DirectoryBrowser from './DirectoryBrowser.vue'

interface PlanStep { id: number; order: number; text: string; status: string }
interface PlanData { id: number; title: string; status: string; steps: PlanStep[] }
interface ChatMessage { role: string; content: string; timestamp: string; typing?: boolean; isResult?: boolean; plan?: PlanData; toolName?: string }

const { t } = useI18n()

const projectPath = ref<string | null>(null)
const input = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
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
      const models = await res.json() as Array<{ id: number; name: string }>
      if (models.length > 0) selectedModelId.value = models[0].id
    }
  } catch { /* ignore */ }
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

function stopStream() {
  abortController.value?.abort()
}

async function handleApprove(planId: number) {
  input.value = `/plan approve ${planId}`
  await submit()
}

async function handleReject(planId: number) {
  input.value = `/plan reject ${planId}`
  await submit()
}

async function submit() {
  const text = input.value.trim()
  if (!text || streaming.value || !selectedModelId.value) return

  input.value = ''
  streaming.value = true

  messages.value.push({ role: 'user', content: text, timestamp: now() })

  const ctrl = new AbortController()
  abortController.value = ctrl

  let currentAgentIdx = -1

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
        sessionId: 0,
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
            messages.value.push({ role: 'system', content: `[error] ${String(parsed.error)}`, timestamp: now() })
          } else if (parsed.toolCall) {
            currentAgentIdx = -1
            const tc = parsed.toolCall as { name: string; args: Record<string, unknown> }
            messages.value.push({ role: 'tool', content: `${tc.name}(${JSON.stringify(tc.args)})`, timestamp: now(), toolName: tc.name, isResult: false })
          } else if (parsed.toolResult) {
            const tr = parsed.toolResult as { name: string; result: string }
            messages.value.push({ role: 'tool', content: tr.result, timestamp: now(), toolName: tr.name, isResult: true })
            recentToolResults.value.push({ toolName: tr.name, content: tr.result })
          } else if (parsed.thinking) {
            currentAgentIdx = -1
            messages.value.push({ role: 'system', content: `⟳ ${String(parsed.thinking)}`, timestamp: now() })
          } else if (parsed.plan) {
            currentAgentIdx = -1
            const planData = parsed.plan as PlanData
            messages.value.push({ role: 'plan', content: '', timestamp: now(), plan: { ...planData, steps: planData.steps.map(s => ({ ...s })) } })
            activePlans.value.push(planData)
          } else if (parsed.planStepUpdate) {
            const upd = parsed.planStepUpdate as { planId: number; stepId: number; status: string }
            for (const msg of messages.value) {
              if (msg.role === 'plan' && msg.plan && msg.plan.id === upd.planId) {
                const step = msg.plan.steps.find(s => s.id === upd.stepId)
                if (step) { step.status = upd.status; msg.plan = { ...msg.plan, steps: [...msg.plan.steps] } }
                break
              }
            }
            for (const plan of activePlans.value) {
              if (plan.id === upd.planId) {
                const step = plan.steps.find(s => s.id === upd.stepId)
                if (step) step.status = upd.status
              }
            }
          } else if (parsed.planInterrupted) {
            messages.value.push({ role: 'system', content: '[⏹ Plan execution interrupted. Send "tiếp tục" to resume.]', timestamp: now() })
          } else if (parsed.token) {
            const idx = getOrCreateAgentMsg()
            messages.value[idx].content += String(parsed.token)
          }
        } catch { /* skip malformed */ }
      }
    }
  } catch (e) {
    if (e instanceof Error && e.name !== 'AbortError') {
      messages.value.push({ role: 'system', content: `[error] ${e.message}`, timestamp: now() })
    }
  } finally {
    streaming.value = false
    abortController.value = null
  }
}
</script>
