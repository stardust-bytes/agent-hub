<template>
  <div class="flex flex-col h-full bg-background">
    <ProjectBar
      :project-path="projectPath"
      :saved-projects="savedProjects"
      :subagent-count="activeSubagentCount"
      @browse-directory="showDirBrowser = true"
      @select-project="connectProject"
      @delete-project="deleteProject"
      @save-project="saveCurrentProject"
      @toggle-artifacts="artifactsVisible = !artifactsVisible"
      @toggle-subagent-monitor="subagentMonitorVisible = !subagentMonitorVisible"
      @disconnect="disconnect"
    />

    <div class="flex flex-1 overflow-hidden">
      <FileTree v-if="projectPath"
        :project-path="projectPath"
        :refresh-key="fileTreeRefreshKey"
        class="w-60 shrink-0"
        @file-select="onFileSelect"
      />
      <div class="flex-1 flex flex-col overflow-hidden">
        <MessageList
          v-if="messages.length > 0"
          ref="messageListRef"
          :messages="messages"
          :streaming="streaming"
          @form-submit="onFormSubmit"
        />
        <div v-else class="flex-1 flex items-center justify-center min-h-0">
          <div class="text-center">
            <div class="text-3xl font-semibold text-foreground mb-1">Agent Hub</div>
            <div class="text-sm font-mono text-muted-foreground">Code 171305</div>
            <div class="text-sm text-muted-foreground mt-2">{{ t('chat.empty.subtitle') }}</div>
          </div>
        </div>

        <ToolApprovalBar
          v-if="pendingApproval"
          :id="pendingApproval.id"
          :name="pendingApproval.name"
          :args="pendingApproval.args"
          :remaining="remainingSeconds"
          :total="30"
          :max-expand-height="maxExpandHeight"
          @approve="approveTool"
          @deny="denyTool"
        />

        <div ref="chatInputWrapperRef">
          <ChatInputBar
            :streaming="streaming"
            :models="availableModels"
            :model-id="selectedModelId"
            @update:model-id="selectedModelId = $event"
            @submit="submitText"
            @stop="stopStream"
            @open-sessions="showSessionModal = true"
          />
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
      <SubagentMonitorPanel
        :visible="subagentMonitorVisible"
        :sessions="subagentSessions"
        @close="subagentMonitorVisible = false"
      />
    </div>

    <SessionModal
      v-model="showSessionModal"
      :current-session-id="currentSessionId"
      @select="loadSession"
      @created="(id: number) => { currentSessionId = id; loadSession(id) }"
    />
    <DirectoryBrowser v-model="showDirBrowser" @select="onDirSelected" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, triggerRef, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import FileTree from './FileTree.vue'
import ArtifactsPanel from './ArtifactsPanel.vue'
import SubagentMonitorPanel from './SubagentMonitorPanel.vue'
import DirectoryBrowser from './DirectoryBrowser.vue'
import SessionModal from './SessionModal.vue'
import MessageList from './cowork/MessageList.vue'
import ChatInputBar from './cowork/ChatInputBar.vue'
import ProjectBar from './cowork/ProjectBar.vue'
import ToolApprovalBar from './ToolApprovalBar.vue'
import type { Message, PlanData } from './cowork/types'
import type { SubagentSession, SubagentLogEntry } from './SubagentMonitorPanel.vue'
import { useProvidersStore } from '../stores/providers'
import { useUiStore } from '../stores/ui'
import { createSession, getSessionMessages } from '../api/sessions'
import { getPlan } from '../api/plans'
import { requestRaw } from '../api/client'
import {
  getProject,
  listProjects,
  setProject,
  saveProject as apiSaveProject,
  deleteProject as apiDeleteProject,
  readFile,
  clearProject,
} from '../api/cowork'
import { loadSessionMessages } from '../composables/useSessionMessages'
import { parseSseStream, type SseCallbacks } from '../composables/useChatStream'


const { t } = useI18n()
const ui = useUiStore()

const projectPath = ref<string | null>(null)
const messages = ref<Message[]>([])
const streaming = ref(false)
const abortController = ref<AbortController | null>(null)
const showDirBrowser = ref(false)
const artifactsVisible = ref(false)
const savedProjects = ref<Array<{ id: string; name: string; path: string }>>([])
const previewContent = ref<string | null>(null)
const previewFileName = ref('')
const activePlans = ref<PlanData[]>([])
const recentToolResults = ref<Array<{ toolName: string; content: string }>>([])
const selectedModelId = ref<number | null>(null)
const availableModels = ref<Array<{ id: number; name: string; providerName: string; providerId: number }>>([])
const currentSessionId = ref<number | null>(null)
const showSessionModal = ref(false)
const fileTreeRefreshKey = ref(0)
const activeSubagentCount = ref(0)
const messageListRef = ref<{ scrollToBottom: () => Promise<void> } | null>(null)
const subagentSessions = ref<SubagentSession[]>([])
const subagentMonitorVisible = ref(false)

const chatInputWrapperRef = ref<HTMLElement | null>(null)
const chatInputBarHeight = ref(0)
const statusBarHeight = 28
const maxExpandHeight = computed(() => window.innerHeight - statusBarHeight - chatInputBarHeight.value)

const pendingApproval = ref<{ id: string; name: string; args: string; expiresAt: number } | null>(null)
const remainingSeconds = ref(0)
let approvalTimer: ReturnType<typeof setInterval> | null = null

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function getOrCreateSession(runId: string | undefined, name: string): SubagentSession {
  if (runId) {
    const existing = subagentSessions.value.find(s => s.id === runId)
    if (existing) return existing
  }
  const session: SubagentSession = {
    id: runId || uid(),
    name,
    status: 'running',
    logs: [],
    startedAt: now(),
    startedAtMs: Date.now(),
  }
  subagentSessions.value.push(session)
  triggerRef(subagentSessions)
  return session
}

function clearPendingApproval() {
  if (approvalTimer) {
    clearInterval(approvalTimer)
    approvalTimer = null
  }
  pendingApproval.value = null
}

onMounted(async () => {
  await loadProject()
  await loadModel()
})

onUnmounted(() => {
  ui.activeSubagents = 0
  clearPendingApproval()
})

let chatInputRo: ResizeObserver | null = null

onMounted(() => {
  chatInputRo = new ResizeObserver(() => {
    chatInputBarHeight.value = chatInputWrapperRef.value?.offsetHeight ?? 0
  })
  if (chatInputWrapperRef.value) chatInputRo.observe(chatInputWrapperRef.value)
  window.addEventListener('resize', onViewportResize)
})

onUnmounted(() => {
  chatInputRo?.disconnect()
  window.removeEventListener('resize', onViewportResize)
})

function onViewportResize() {
  chatInputBarHeight.value = chatInputWrapperRef.value?.offsetHeight ?? 0
}

async function loadProject() {
  try {
    const data = await getProject()
    projectPath.value = data.projectPath
  } catch { /* ignore */ }
  await loadSavedProjects()
}

async function loadSavedProjects() {
  try {
    savedProjects.value = await listProjects()
  } catch { /* ignore */ }
}

async function connectProject(p: string) {
  try {
    await setProject(p)
    projectPath.value = p
    showDirBrowser.value = false
  } catch { /* ignore */ }
}

async function saveCurrentProject(name: string) {
  if (!name || !projectPath.value) return
  try {
    await apiSaveProject(name, projectPath.value)
    await loadSavedProjects()
  } catch { /* ignore */ }
}

async function deleteProject(id: string) {
  try {
    await apiDeleteProject(id)
    await loadSavedProjects()
  } catch { /* ignore */ }
}

async function loadModel() {
  const providersStore = useProvidersStore()
  try {
    await providersStore.loadModels(true)
    const models = providersStore.models
    availableModels.value = models
    if (models.length > 0) {
      const savedId = Number(localStorage.getItem('workspace.modelId'))
      selectedModelId.value = models.find(m => m.id === savedId)?.id ?? models[0].id
    }
  } catch { /* ignore */ }
}

async function loadSession(id: number) {
  currentSessionId.value = id
  messages.value = []
  activePlans.value = []
  try {
    const loaded = await loadSessionMessages(id, getSessionMessages, getPlan, now)
    messages.value = loaded
  } catch { /* ignore */ }
  await scrollToBottom()
}

function onFileSelect(filePath: string) {
  loadFilePreview(filePath)
}

async function loadFilePreview(filePath: string) {
  try {
    const data = await readFile(filePath)
    previewContent.value = data.content
    previewFileName.value = data.filename
    artifactsVisible.value = true
  } catch { /* ignore */ }
}

function onDirSelected(dirPath: string) {
  connectProject(dirPath)
}

async function disconnect() {
  try {
    await clearProject()
    projectPath.value = null
    messages.value = []
    previewContent.value = null
    activePlans.value = []
  } catch { /* ignore */ }
}

function now(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false })
}

async function approveTool(id: string) {
  try {
    await fetch('/api/agent/approve-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: true }),
    })
  } catch { /* ignore */ }
  clearPendingApproval()
}

async function denyTool(id: string) {
  try {
    await fetch('/api/agent/approve-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: false }),
    })
  } catch { /* ignore */ }
  clearPendingApproval()
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

async function scrollToBottom() {
  await nextTick()
  messageListRef.value?.scrollToBottom()
}

function stopStream() {
  abortController.value?.abort()
}

async function submitText(text: string) {
  if (!text || streaming.value) return

  if (text === '/clear') {
    messages.value = []
    activePlans.value = []
    recentToolResults.value = []
    return
  }

  if (text === '/help') {
    const cmds = [
      '/agent <slug> <nhiệm vụ> — ' + t('slash.agent'),
      '/help — ' + t('slash.help'),
      '/clear — ' + t('slash.clear'),
    ]
    messages.value.push({ role: 'system', content: cmds.join('\n'), timestamp: now() })
    await scrollToBottom()
    return
  }

  if (!selectedModelId.value) return

  if (currentSessionId.value === null) {
    try {
      const session = await createSession()
      currentSessionId.value = session.id
    } catch { return }
  }

  localStorage.setItem('workspace.modelId', String(selectedModelId.value))
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
      body: {
        message: text,
        providerModelId: selectedModelId.value,
        sessionId: currentSessionId.value ?? 0,
        mode: 'cowork',
      },
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
        const session = getOrCreateSession(ev.subagentRunId, ev.subagentName || 'subagent')
        const saLabel = ev.subagentName ? `[subagent:${ev.subagentName}]` : '[subagent]'
        const ts = now()
        if (ev.done) {
          session.status = 'completed'
          session.completedAt = ts
          session.logs.push({ type: 'done', text: 'Done', timestamp: ts })
          if (activeSubagentCount.value > 0) {
            activeSubagentCount.value--
            ui.activeSubagents = activeSubagentCount.value
          }
          triggerRef(subagentSessions)
        } else if (ev.toolApprovalRequired) {
          const { id, name, args } = ev.toolApprovalRequired
          callbacks.onToolApprovalRequired?.(id, name, args)
        } else if (ev.token) {
          const lastLog = session.logs[session.logs.length - 1]
          if (lastLog && lastLog.type === 'token') {
            lastLog.text += String(ev.token)
          } else {
            session.logs.push({ type: 'token', text: String(ev.token), timestamp: ts })
          }
          triggerRef(subagentSessions)
        } else if (ev.toolCall) {
          currentAgentIdx = -1
          const tc = ev.toolCall
          const argsStr = Object.entries(tc.args).map(([k, v]) => `${k}=${v}`).join(', ')
          session.logs.push({ type: 'toolCall', text: `${tc.name}(${argsStr})`, timestamp: ts, toolName: tc.name })
          messages.value.push({
            role: 'tool',
            content: `${saLabel} ${tc.name}`,
            timestamp: ts,
            toolName: tc.name,
            isResult: false,
          })
          triggerRef(subagentSessions)
          scrollToBottom()
        } else if (ev.toolResult) {
          const tr = ev.toolResult
          session.logs.push({ type: 'toolResult', text: tr.result, timestamp: ts, toolName: tr.name })
          messages.value.push({
            role: 'tool',
            content: `${saLabel} ${tr.result.slice(0, 200)}`,
            timestamp: ts,
            toolName: tr.name,
            isResult: true,
          })
          triggerRef(subagentSessions)
          scrollToBottom()
        } else if (ev.thinking) {
          currentAgentIdx = -1
          session.logs.push({ type: 'thinking', text: String(ev.thinking), timestamp: ts })
          messages.value.push({
            role: 'system',
            content: `⟳ ${saLabel} ${String(ev.thinking)}`,
            timestamp: ts,
          })
          triggerRef(subagentSessions)
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
        recentToolResults.value.push({ toolName: name, content: result })
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
        activePlans.value.push(plan)
      },
      onPlanStepUpdate(planId, stepId, status) {
        let stepText = ''
        for (const plan of activePlans.value) {
          if (plan.id === planId) {
            const step = plan.steps.find(s => s.id === stepId)
            if (step) { step.status = status; stepText = step.text }
            break
          }
        }
        if (stepText) {
          const icon = status === 'DONE' ? '✅' : status === 'DOING' ? '⟳' : status === 'FAILED' ? '✗' : '[ ]'
          messages.value.push({ role: 'system', content: `${icon} ${stepText}`, timestamp: now() })
          scrollToBottom()
        }
        triggerRef(activePlans)
      },
      onPlanInterrupted(_planId, _reason) {
        messages.value.push({
          role: 'system',
          content: '[⏹ Plan execution interrupted. Send "tiếp tục" to resume.]',
          timestamp: now(),
        })
        scrollToBottom()
      },
      onToolApprovalRequired(id, name, args) {
        const argsStr = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(', ')
        pendingApproval.value = { id, name, args: argsStr, expiresAt: Date.now() + 30000 }
        remainingSeconds.value = 30
        if (approvalTimer) clearInterval(approvalTimer)
        approvalTimer = setInterval(() => {
          if (pendingApproval.value) {
            remainingSeconds.value = Math.max(0, Math.ceil((pendingApproval.value.expiresAt - Date.now()) / 1000))
            if (remainingSeconds.value <= 0) {
              clearPendingApproval()
            }
          }
        }, 200)
      },
      onDelegateProgress(_index, _subtask, _status) {
        /* CoworkView does not render delegate progress */
      },
      onDelegateResult(_count) {
        /* CoworkView does not render delegate result */
      },
      onToken(token) {
        clearThinking()
        const idx = getOrCreateAgentMsg()
        messages.value[idx].content += token
        scrollToBottom()
      },
      onDone() {
        const lastAgent = [...messages.value].reverse().find(m => m.role === 'agent')
        if (lastAgent) lastAgent.typing = false
        triggerRef(messages)
      },
    }

    await parseSseStream(reader, callbacks)

    const lastAgent = [...messages.value].reverse().find(m => m.role === 'agent')
    if (lastAgent) lastAgent.typing = false
    triggerRef(messages)
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
    fileTreeRefreshKey.value++
  }
}
</script>
