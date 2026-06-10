# Cowork View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split cowork out of ChatPanel into a dedicated Claude Code-inspired screen with file tree, chat, and artifacts panels.

**Architecture:** New CoworkView.vue orchestrates 3 panels (FileTree, Chat, Artifacts). Cowork becomes a sidebar nav item. Backend adds a read-file endpoint. Existing ChatPanel unchanged; CoworkView's chat area duplicates the SSE reader without slash commands — LLM autonomously decides planning via `create_plan` tool.

**Tech Stack:** Vue 3 + TailwindCSS (frontend), NestJS + Prisma (backend), SSE streaming.

---

### Task 1: Backend — read-file endpoint

**Files:**
- Modify: `backend/src/cowork/cowork.service.ts`
- Modify: `backend/src/cowork/cowork.service.spec.ts`
- Modify: `backend/src/cowork/cowork.controller.ts`
- Modify: `backend/src/cowork/cowork.controller.spec.ts`

- [ ] **Step 1: Write the failing service test**

In `backend/src/cowork/cowork.service.spec.ts`, add:

```typescript
import * as fs from 'fs/promises';

describe('readFile', () => {
  it('reads file content within project path', async () => {
    jest.spyOn(fs, 'readFile').mockResolvedValue('file content');

    const result = await service.readFile('/project/src/main.ts', '/project');
    expect(result).toEqual({ content: 'file content', filename: 'main.ts', size: 12 });
  });

  it('rejects path traversal', async () => {
    await expect(
      service.readFile('/project/../outside/secret.txt', '/project'),
    ).rejects.toThrow('Path is outside the project directory');
  });

  it('rejects path outside project dir', async () => {
    await expect(
      service.readFile('/outside/secret.txt', '/project'),
    ).rejects.toThrow('Path is outside the project directory');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/cowork/cowork.service.spec.ts --no-coverage -t "readFile"`
Expected: FAIL — readFile not defined

- [ ] **Step 3: Implement readFile in service**

In `backend/src/cowork/cowork.service.ts`, add:

```typescript
import * as path from 'path';

async readFile(filePath: string, projectPath: string): Promise<{ content: string; filename: string; size: number }> {
  const resolved = path.resolve(filePath);
  const project = path.resolve(projectPath);

  if (!resolved.startsWith(project)) {
    throw new Error('Path is outside the project directory');
  }

  const stat = await fs.stat(resolved);
  if (!stat.isFile()) {
    throw new Error('Path is not a file');
  }

  const content = await fs.readFile(resolved, 'utf-8');
  return {
    content,
    filename: path.basename(resolved),
    size: stat.size,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/cowork/cowork.service.spec.ts --no-coverage -t "readFile"`
Expected: PASS

- [ ] **Step 5: Add controller endpoint**

In `backend/src/cowork/cowork.controller.ts`, add:

```typescript
@Get('read-file')
async readFile(@Query('path') filePath: string) {
  if (!filePath) throw new BadRequestException('path query parameter is required');
  const status = await this.cowork.getStatus();
  if (!status.projectPath) throw new BadRequestException('No project connected');
  return this.cowork.readFile(filePath, status.projectPath);
}
```

- [ ] **Step 6: Add controller test**

In `backend/src/cowork/cowork.controller.spec.ts`, add:

```typescript
it('readFile delegates to service and returns file content', async () => {
  mockService.getStatus.mockResolvedValue({ projectPath: '/project', isActive: true });
  mockService.readFile.mockResolvedValue({ content: 'hi', filename: 'test.ts', size: 2 });

  const result = await controller.readFile('/project/test.ts');
  expect(mockService.getStatus).toHaveBeenCalled();
  expect(mockService.readFile).toHaveBeenCalledWith('/project/test.ts', '/project');
  expect(result).toEqual({ content: 'hi', filename: 'test.ts', size: 2 });
});

it('readFile rejects when no project', async () => {
  mockService.getStatus.mockResolvedValue({ projectPath: null, isActive: false });
  await expect(controller.readFile('/project/test.ts')).rejects.toThrow('No project connected');
});
```

- [ ] **Step 7: Run all cowork tests**

Run: `npx jest src/cowork --no-coverage`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/cowork/
git commit -m "feat: add read-file endpoint to cowork module"
```

---

### Task 2: Frontend — FileTree.vue

**Files:**
- Create: `frontend/src/components/FileTree.vue`

- [ ] **Step 1: Create FileTree component**

Create `frontend/src/components/FileTree.vue`:

```vue
<template>
  <div class="flex flex-col h-full bg-cyber-bg border-r border-cyber-code-border">
    <div class="px-3 py-2 text-xs text-cyber-accent font-mono border-b border-cyber-code-border shrink-0">
      {{ t('cowork.files') }}
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="text-xs text-cyber-muted font-mono px-3 py-2">{{ t('cowork.browse.loading') }}</div>
      <div v-else-if="error" class="text-xs text-red-400 font-mono px-3 py-2">{{ error }}</div>
      <div v-else class="py-1">
        <div
          v-for="entry in tree"
          :key="entry.path"
          :style="{ paddingLeft: entry.depth * 16 + 8 + 'px' }"
          class="flex items-center gap-1 px-2 py-0.5 cursor-pointer text-xs font-mono transition-colors duration-150"
          :class="selectedPath === entry.path ? 'bg-cyber-accent/10 text-cyber-accent' : 'text-cyber-text hover:bg-cyber-dark'"
          @click="onClick(entry)"
        >
          <span class="w-4 shrink-0 text-center">
            <template v-if="entry.isDirectory">{{ expanded[entry.path] ? '▼' : '▶' }}</template>
            <template v-else>📄</template>
          </span>
          <span class="truncate">{{ entry.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface TreeEntry {
  name: string
  path: string
  isDirectory: boolean
  depth: number
}

const props = defineProps<{
  projectPath: string
}>()

const emit = defineEmits<{
  fileSelect: [path: string]
}>()

const { t } = useI18n()

const tree = ref<TreeEntry[]>([])
const expanded = ref<Record<string, boolean>>({})
const loading = ref(false)
const error = ref('')
const selectedPath = ref<string | null>(null)

watch(() => props.projectPath, async (val) => {
  if (val) await loadRoot(val)
}, { immediate: true })

async function loadRoot(projectPath: string) {
  loading.value = true
  error.value = ''
  try {
    const entries = await fetchChildren(projectPath, 0)
    tree.value = entries
  } catch (e) {
    error.value = t('cowork.browse.error')
  } finally {
    loading.value = false
  }
}

async function fetchChildren(dirPath: string, depth: number): Promise<TreeEntry[]> {
  const enc = encodeURIComponent(dirPath)
  const res = await fetch(`/api/cowork/browse?path=${enc}`)
  if (!res.ok) throw new Error('fetch failed')
  const data = await res.json() as { entries: Array<{ name: string; isDirectory: boolean }> }
  return data.entries.map(e => ({
    name: e.name,
    path: dirPath.replace(/\/$/, '') + '/' + e.name,
    isDirectory: e.isDirectory,
    depth,
  }))
}

async function onClick(entry: TreeEntry) {
  if (entry.isDirectory) {
    const key = entry.path
    if (expanded.value[key]) {
      expanded.value[key] = false
      tree.value = tree.value.filter(e => !e.path.startsWith(key + '/') || e.path === key)
    } else {
      expanded.value[key] = true
      try {
        const children = await fetchChildren(entry.path, entry.depth + 1)
        const idx = tree.value.indexOf(entry)
        tree.value.splice(idx + 1, 0, ...children)
      } catch {
        expanded.value[key] = false
      }
    }
  } else {
    selectedPath.value = entry.path
    emit('fileSelect', entry.path)
  }
}
</script>
```

- [ ] **Step 2: Verify type check**

Run: `cd frontend; npx vue-tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FileTree.vue
git commit -m "feat: add FileTree component for cowork view"
```

---

### Task 3: Frontend — ArtifactsPanel.vue

**Files:**
- Create: `frontend/src/components/ArtifactsPanel.vue`

- [ ] **Step 1: Create ArtifactsPanel component**

Create `frontend/src/components/ArtifactsPanel.vue`:

```vue
<template>
  <div class="flex flex-col h-full bg-cyber-bg border-l border-cyber-code-border">
    <div class="flex items-center justify-between px-3 py-2 border-b border-cyber-code-border shrink-0">
      <span class="text-xs text-cyber-accent font-mono">{{ t('cowork.artifacts') }}</span>
      <button @click="emit('close')" class="text-cyber-muted text-xs font-mono hover:text-cyber-accent">✕</button>
    </div>
    <div class="flex-1 overflow-y-auto px-3 py-2 space-y-3">
      <!-- File preview -->
      <div v-if="fileContent !== null" class="border border-cyber-code-border">
        <div class="bg-cyber-dark px-2 py-1 text-xs text-cyber-muted font-mono border-b border-cyber-code-border">
          📄 {{ fileName }}
        </div>
        <pre class="text-xs text-cyber-code-text font-mono p-2 whitespace-pre-wrap break-all max-h-60 overflow-y-auto bg-cyber-code-bg">{{ fileContent }}</pre>
      </div>

      <!-- Plan display -->
      <div v-for="plan in plans" :key="plan.id" class="border border-cyber-accent/40">
        <div class="bg-cyber-dark px-2 py-1 text-xs text-cyber-cyan font-mono border-b border-cyber-accent/20">
          PLAN: {{ plan.title }}
        </div>
        <div class="px-2 py-1 space-y-0.5">
          <div v-for="step in plan.steps" :key="step.id" class="flex items-center gap-2 text-xs font-mono">
            <span :class="step.status === 'DONE' ? 'text-cyber-green' : step.status === 'DOING' ? 'text-cyber-orange' : step.status === 'FAILED' ? 'text-red-400' : 'text-cyber-muted'">
              {{ step.status === 'DONE' ? '[✓]' : step.status === 'DOING' ? '[⟳]' : step.status === 'FAILED' ? '[✗]' : '[ ]' }}
            </span>
            <span :class="step.status === 'DONE' ? 'text-cyber-green' : 'text-cyber-text'">{{ step.text }}</span>
          </div>
        </div>
      </div>

      <!-- Tool results / diffs -->
      <div v-for="(result, i) in toolResults" :key="i" class="border border-cyber-code-border">
        <div class="bg-cyber-dark px-2 py-1 text-xs text-cyber-orange font-mono border-b border-cyber-code-border">
          ⚙ {{ result.toolName }}
        </div>
        <pre class="text-xs text-cyber-code-text font-mono p-2 whitespace-pre-wrap break-all max-h-40 overflow-y-auto bg-cyber-code-bg">{{ result.content }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface PlanStep { id: number; order: number; text: string; status: string }
interface PlanData { id: number; title: string; status: string; steps: PlanStep[] }
interface ToolResult { toolName: string; content: string }

defineProps<{
  visible: boolean
  fileContent: string | null
  fileName: string
  plans: PlanData[]
  toolResults: ToolResult[]
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
```

- [ ] **Step 2: Verify type check**

Run: `cd frontend; npx vue-tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ArtifactsPanel.vue
git commit -m "feat: add ArtifactsPanel component for cowork view"
```

---

### Task 4: Frontend — CoworkView.vue

**Files:**
- Create: `frontend/src/components/CoworkView.vue`

- [ ] **Step 1: Create CoworkView orchestrator**

Create `frontend/src/components/CoworkView.vue`:

```vue
<template>
  <div class="flex flex-col h-full bg-cyber-bg font-mono">
    <!-- Top bar -->
    <div v-if="projectPath" class="flex items-center gap-3 px-3 py-2 border-b border-cyber-code-border shrink-0 bg-cyber-dark">
      <div class="flex items-center gap-2 text-sm">
        <span class="text-cyber-green">●</span>
        <span class="text-cyber-text truncate max-w-80">{{ projectPath }}</span>
      </div>
      <button @click="browseProject" class="text-xs text-cyber-accent font-mono px-2 py-0.5 border border-cyber-accent/40 transition-colors duration-150 hover:bg-cyber-accent/10">{{ t('cowork.browse') }}</button>
      <button @click="disconnect" class="text-xs text-red-400 font-mono px-2 py-0.5 border border-red-400/40 transition-colors duration-150 hover:bg-red-400/10">{{ t('cowork.disconnect') }}</button>
    </div>

    <!-- Connect screen -->
    <div v-else class="flex-1 flex items-center justify-center">
      <div class="text-center max-w-md">
        <div class="text-lg text-cyber-accent font-mono mb-2">{{ t('cowork.connect.title') }}</div>
        <div class="text-sm text-cyber-muted font-mono mb-4">{{ t('cowork.connect.description') }}</div>
        <button @click="showDirBrowser = true" class="text-sm text-cyber-accent font-mono px-4 py-2 border border-cyber-accent/40 transition-colors duration-150 hover:bg-cyber-accent/10">{{ t('cowork.connect.browse') }}</button>
      </div>
    </div>

    <!-- 3-panel layout -->
    <div v-if="projectPath" class="flex flex-1 overflow-hidden">
      <FileTree
        :project-path="projectPath"
        class="w-60 shrink-0"
        @file-select="onFileSelect"
      />
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Chat area (cowork-only) -->
        <div class="flex-1 overflow-y-auto px-3 py-3">
          <div class="max-w-60rem mx-auto space-y-4 px-3">
            <div v-for="(msg, i) in messages" :key="i">
              <!-- User message -->
              <div v-if="msg.role === 'user'" class="border-l-2 border-cyber-accent/80 pl-3 py-1">
                <div class="text-xs text-cyber-accent/80 mb-0.5 font-mono">▶ {{ t('chat.user.prefix') }} · {{ msg.timestamp }}</div>
                <div class="text-sm leading-relaxed break-words text-cyber-text">{{ msg.content }}</div>
              </div>
              <!-- Agent message -->
              <div v-else-if="msg.role === 'agent'" class="border-l-2 border-cyber-accent/80 pl-3 py-1">
                <div class="text-xs text-cyber-accent/80 mb-0.5 font-mono">▶ {{ t('chat.agent.prefix') }} · {{ msg.timestamp }}</div>
                <div class="text-sm leading-relaxed break-words text-cyber-text">{{ msg.content }}</div>
              </div>
              <!-- Tool call -->
              <div v-else-if="msg.role === 'tool' && !msg.isResult" class="border-l-2 border-cyber-orange/50 pl-3 py-1">
                <div class="text-sm text-cyber-orange font-mono">[⚙] {{ msg.content }}</div>
              </div>
              <!-- Tool result -->
              <div v-else-if="msg.role === 'tool' && msg.isResult" class="border-l-2 border-cyber-green/50 pl-3 py-1">
                <div class="text-sm text-cyber-green font-mono whitespace-pre-wrap">{{ msg.content }}</div>
              </div>
              <!-- System -->
              <div v-else-if="msg.role === 'system'" class="pl-3 py-0.5">
                <div class="text-sm text-cyber-muted font-mono">{{ msg.content }}</div>
              </div>
              <!-- Plan bubble -->
              <div v-else-if="msg.role === 'plan' && msg.plan" class="border-l-2 border-cyber-accent/80 pl-3 py-1">
                <PlanBubble :plan="msg.plan" :streaming="streaming" @approve="handleApprove" @reject="handleReject" />
              </div>
            </div>
          </div>
        </div>

        <!-- Input bar -->
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

      <!-- Artifacts panel -->
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
```

- [ ] **Step 2: Verify type check**

Run: `cd frontend; npx vue-tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CoworkView.vue
git commit -m "feat: add CoworkView with 3-panel layout and SSE streaming"
```

---

### Task 5: Frontend — Navigation (AppShell, SidebarNav, BottomTabBar)

**Files:**
- Modify: `frontend/src/components/AppShell.vue`
- Modify: `frontend/src/components/SidebarNav.vue`
- Modify: `frontend/src/components/BottomTabBar.vue`

- [ ] **Step 1: Add CoworkView to AppShell**

In `frontend/src/components/AppShell.vue`:

Add import: `import CoworkView from './CoworkView.vue'`

Update type: `const activeView = ref<'chat' | 'cowork' | 'tasks' | 'files' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans'>('chat')`

Add template line after `ToolsView`:
```html
<CoworkView   v-else-if="activeView === 'cowork'"  class="flex-1 overflow-hidden" />
```

- [ ] **Step 2: Add Cowork to SidebarNav**

In `frontend/src/components/SidebarNav.vue`:

Add `HiCode` to imports: `import { ..., HiCode } from 'vue-icons-plus/hi'`

Add to `NavItem` type and `navItems` array:
```typescript
{ view: 'cowork', labelKey: 'nav.cowork', icon: HiCode },
```

Update `defineProps` and `defineEmits` types to include `'cowork'`.

- [ ] **Step 3: Add Cowork to BottomTabBar**

Same pattern as SidebarNav. Update type unions, add nav item with `HiCode`.

- [ ] **Step 4: Verify type check**

Run: `cd frontend; npx vue-tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AppShell.vue frontend/src/components/SidebarNav.vue frontend/src/components/BottomTabBar.vue
git commit -m "feat: add cowork navigation to sidebar and bottom bar"
```

---

### Task 6: Frontend — Locale keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add vi.json keys**

In `frontend/src/locales/vi.json`, add to `nav` object:
```json
"cowork": "Làm việc"
```

Add `cowork` section:
```json
"cowork": {
  "title": "Cowork",
  "files": "Tệp tin",
  "artifacts": "Kết quả",
  "connect": {
    "title": "Kết nối dự án",
    "description": "Chọn thư mục dự án để làm việc với AI agent.",
    "browse": "Duyệt"
  },
  "connected": "Đã kết nối",
  "disconnect": "Ngắt kết nối",
  "browse": {
    "title": "Duyệt thư mục",
    "loading": "⟳ Đang tải...",
    "error": "Không thể tải thư mục",
    "empty": "Trống",
    "parent": "..",
    "select": "Chọn"
  },
  "read_error": "Không thể đọc file ngoài thư mục dự án"
}
```

- [ ] **Step 2: Add en.json keys**

In `frontend/src/locales/en.json`, add to `nav` object:
```json
"cowork": "Cowork"
```

Add `cowork` section:
```json
"cowork": {
  "title": "Cowork",
  "files": "Files",
  "artifacts": "Artifacts",
  "connect": {
    "title": "Connect a Project",
    "description": "Select a local project directory to work with the AI agent.",
    "browse": "Browse"
  },
  "connected": "Connected",
  "disconnect": "Disconnect",
  "browse": {
    "title": "Browse",
    "loading": "⟳ Loading...",
    "error": "Cannot load directory",
    "empty": "Empty",
    "parent": "..",
    "select": "Select"
  },
  "read_error": "Cannot read file outside project directory"
}
```

- [ ] **Step 3: Verify no broken i18n**

Run: `cd frontend; npx vue-tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add cowork locale keys"
```

---

### Task 7: Backend — cowork AGENTS.md

**Files:**
- Create: `backend/src/cowork/AGENTS.md`

- [ ] **Step 1: Create AGENTS.md**

Create `backend/src/cowork/AGENTS.md`:

```markdown
# cowork/ — Agent Context

Cowork mode module. Manages project directory connection, directory browsing, and file reading for the workspace AI agent.

## Responsibility

- `CoworkService` — project path persistence (SQLite), directory browsing, file reading with path validation
- `CoworkController` — REST endpoints for project CRUD, browse, read-file, drives

## Files

```
cowork/
├── cowork.module.ts
├── cowork.controller.ts
├── cowork.controller.spec.ts
├── cowork.service.ts
├── cowork.service.spec.ts
├── dto/
│   └── set-project.dto.ts
└── AGENTS.md
```

## API Endpoints

Base path: `/api/cowork`

| Method | Path | Description |
|---|---|---|
| POST | `/api/cowork/project` | Set project directory |
| GET | `/api/cowork/project` | Get current project status |
| DELETE | `/api/cowork/project` | Clear project |
| GET | `/api/cowork/drives` | List available drives (C:\, D:\, /) |
| GET | `/api/cowork/browse?path=` | List directory entries |
| GET | `/api/cowork/read-file?path=` | Read file content (path-validated) |

## Dependencies

- SettingsModule (project path persistence)
- WorkspaceModule (path permission management)
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/cowork/AGENTS.md
git commit -m "docs: add AGENTS.md for cowork module"
```

---

### Task 8: Integration — verify everything

**Files:**
- Run full test suite

- [ ] **Step 1: Run backend tests**

Run: `npx jest --no-coverage`
Expected: All tests pass

- [ ] **Step 2: Run frontend type check**

Run: `cd frontend; npx vue-tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify all commits**

Run: `git log --oneline -15`
Expected: Shows all 7+ commits
