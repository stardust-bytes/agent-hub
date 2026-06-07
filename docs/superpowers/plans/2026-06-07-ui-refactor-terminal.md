# UI Refactor: Cyber High-Contrast Terminal Style — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the entire frontend UI to a terminal-inspired, high-contrast design with amber accent, borderless contrast separation, full-width content, and bottom status bar.

**Architecture:** Update Tailwind color tokens globally, then update each component's classes to match. Create a StatusBar component for the bottom bar. Migrate from border-based separation to background-contrast-based separation (`#000000` vs `#111111`).

**Tech Stack:** TailwindCSS custom tokens, Vue 3 `<script setup>`, `vue-i18n`.

---

## File Map

**Backend — No changes.**

**Frontend — Create:**
- `frontend/src/components/StatusBar.vue`

**Frontend — Modify:**
- `frontend/tailwind.config.ts` — token values
- `frontend/src/components/AppShell.vue` — new layout, StatusBar
- `frontend/src/components/ChatPanel.vue` — full width, color migration
- `frontend/src/components/SidebarNav.vue` — color migration, remove borders
- `frontend/src/components/TasksView.vue` — color migration
- `frontend/src/components/KanbanBoard.vue` — color migration
- `frontend/src/components/TaskCard.vue` — color migration
- `frontend/src/components/TaskCardMenu.vue` — color migration
- `frontend/src/locales/vi.json` — status bar keys
- `frontend/src/locales/en.json` — status bar keys

---

## Task 1: Update Tailwind Color Tokens

**Files:**
- Modify: `frontend/tailwind.config.ts`

- [ ] **Step 1: Replace the entire colors object**

Current:
```ts
colors: {
  'cyber-bg':     '#000000',
  'cyber-dark':   '#141414',
  'cyber-accent': '#3B82F6',
  'cyber-border': 'rgba(59, 130, 246, 0.13)',
  'cyber-dim':    'rgba(59, 130, 246, 0.33)',
  'cyber-orange': '#FFA500',
  'cyber-green':  '#22C55E',
  'cyber-blue':   '#3B82F6',
},
```

New:
```ts
colors: {
  'cyber-bg':     '#000000',
  'cyber-dark':   '#111111',
  'cyber-status': '#161616',
  'cyber-accent': '#FFA500',
  'cyber-green':  '#22C55E',
  'cyber-blue':   '#3B82F6',
},
```

Changes:
- `cyber-dark`: `#141414` → `#111111`
- `cyber-accent`: `#3B82F6` (blue) → `#FFA500` (amber) — major visual change
- Remove `cyber-border`, `cyber-dim`, `cyber-orange`
- Add `cyber-status`: `#161616`

- [ ] **Step 2: Verify build still compiles**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds (compilation only, visual changes expected).

- [ ] **Step 3: Commit**

```bash
git add frontend/tailwind.config.ts
git commit -m "refactor(ui): update color tokens for terminal style — amber accent, #111111 dark, remove borders"
```

---

## Task 2: Create StatusBar Component

**Files:**
- Create: `frontend/src/components/StatusBar.vue`

- [ ] **Step 1: Create StatusBar.vue**

```vue
<!-- frontend/src/components/StatusBar.vue -->
<template>
  <div class="h-7 bg-[#161616] flex items-center justify-between px-3 shrink-0">
    <div class="flex items-center gap-3">
      <span class="text-[10px] font-mono text-[#888888]">
        <span class="text-cyber-blue">{{ modelName }}</span>
      </span>
      <span class="text-[10px] font-mono" :class="dbConnected ? 'text-cyber-green' : 'text-[#888888]'">
        [{{ dbConnected ? '✓' : '✗' }}] {{ t('status.db') }}
      </span>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-[10px] font-mono" :class="wsConnected ? 'text-cyber-green' : 'text-[#888888]'">
        {{ wsConnected ? '●' : '○' }} {{ wsConnected ? t('tasks.ws.connected') : t('tasks.ws.disconnected') }}
      </span>
      <span class="text-[10px] font-mono text-[#888888]">{{ time }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  modelName?: string
  dbConnected?: boolean
  wsConnected?: boolean
}>()

const time = ref(new Date().toLocaleTimeString('vi-VN', { hour12: false }))
let timer: ReturnType<typeof setInterval>

onMounted(() => {
  timer = setInterval(() => {
    time.value = new Date().toLocaleTimeString('vi-VN', { hour12: false })
  }, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StatusBar.vue
git commit -m "feat: add StatusBar with model, db, ws indicators and clock"
```

---

## Task 3: AppShell — New Layout

**Files:**
- Modify: `frontend/src/components/AppShell.vue`

- [ ] **Step 1: Replace entire content**

```vue
<template>
  <div class="flex flex-col h-screen bg-cyber-bg font-mono overflow-hidden">
    <div class="flex flex-1 overflow-hidden">
      <SidebarNav :active-view="activeView" @navigate="activeView = $event" />
      <TasksView v-if="activeView === 'tasks'" class="flex-1 overflow-hidden" />
      <ChatPanel v-else class="flex-1 overflow-hidden" />
    </div>
    <StatusBar
      :model-name="modelName"
      :db-connected="dbConnected"
      :ws-connected="wsConnected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SidebarNav from './SidebarNav.vue'
import ChatPanel from './ChatPanel.vue'
import TasksView from './TasksView.vue'
import StatusBar from './StatusBar.vue'

const activeView = ref<'chat' | 'tasks' | 'files'>('chat')
const modelName = ref('llama3.2')
const dbConnected = ref(true)
const wsConnected = ref(false)
</script>
```

Changes from current:
- Outer `div` is now `flex-col` with `h-screen`
- Inner wrapper `flex flex-1 overflow-hidden` for sidebar + content
- `ChatPanel` uses `flex-1` (full width, no 45% / max-width constraints)
- No `border-x` on ChatPanel
- `StatusBar` at bottom
- State for `modelName`, `dbConnected`, `wsConnected` passed to StatusBar

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AppShell.vue
git commit -m "refactor(ui): new AppShell layout — full-width content, StatusBar at bottom"
```

---

## Task 4: SidebarNav — Color Migration

**Files:**
- Modify: `frontend/src/components/SidebarNav.vue`

- [ ] **Step 1: Replace template with borderless, accent-colored sidebar**

Changes to make:
- Remove `border-r border-cyber-border` from `<nav>`
- Remove `style="text-shadow: 0 0 8px #3B82F6"` from terminal icon (was hardcoded blue)
- Active nav item: `bg-cyber-accent/10 border border-cyber-dim text-cyber-accent` → `bg-cyber-accent/10 text-cyber-accent` (remove border)
- Inactive nav item: remove `border border-transparent`, just `text-[#888888] hover:text-cyber-accent`
- Settings button: same pattern — `text-[#888888] hover:text-cyber-accent`, no border
- Lang button: remove `border-cyber-dim`, use `text-[#888888]` instead
- Health dot: `bg-cyber-green` / `bg-red-500` stays, remove `box-shadow` style

```vue
<!-- frontend/src/components/SidebarNav.vue -->
<template>
  <nav class="w-[52px] bg-cyber-dark flex flex-col items-center py-3 gap-2 shrink-0">
    <HiTerminal class="text-cyber-accent w-5 h-5 mb-2" />

    <button
      v-for="item in navItems"
      :key="item.view"
      :title="t(item.labelKey)"
      @click="$emit('navigate', item.view)"
      :class="[
        'w-9 h-9 rounded flex items-center justify-center text-base transition-colors duration-150',
        activeView === item.view
          ? 'bg-cyber-accent/10 text-cyber-accent'
          : 'text-[#888888] hover:text-cyber-accent'
      ]"
    >
      <component :is="item.icon" class="w-4 h-4" />
    </button>

    <div class="flex-1" />

    <button
      :title="t('nav.settings')"
      class="w-9 h-9 rounded flex items-center justify-center text-base text-[#888888] hover:text-cyber-accent"
    >
      <HiCog class="w-4 h-4" />
    </button>

    <button
      :title="locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'"
      @click="toggleLang"
      class="w-9 h-6 rounded flex items-center justify-center text-xs font-mono text-[#888888] hover:text-cyber-accent transition-colors duration-150"
    >
      {{ t('nav.lang') }}
    </button>

    <div
      :title="healthStatus"
      :class="['w-2 h-2 rounded-full mt-1 transition-colors duration-500', isHealthy ? 'bg-cyber-green' : 'bg-red-500']"
    />
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Locale } from '../i18n'
import { HiTerminal, HiChatAlt2, HiClipboardList, HiFolder, HiCog } from 'vue-icons-plus/hi'

defineProps<{ activeView: 'chat' | 'tasks' | 'files' }>()
defineEmits<{ navigate: [view: 'chat' | 'tasks' | 'files'] }>()

const { t, locale } = useI18n()

interface NavItem {
  view: 'chat' | 'tasks' | 'files'
  labelKey: string
  icon: Component
}

const navItems: NavItem[] = [
  { view: 'chat',  labelKey: 'nav.chat',  icon: HiChatAlt2 },
  { view: 'tasks', labelKey: 'nav.tasks', icon: HiClipboardList },
  { view: 'files', labelKey: 'nav.files', icon: HiFolder },
]

const isHealthy = ref(false)
const healthStatus = ref(t('health.checking'))

function toggleLang() {
  const next: Locale = locale.value === 'vi' ? 'en' : 'vi'
  locale.value = next
  localStorage.setItem('workspace.lang', next)
}

onMounted(async () => {
  try {
    const res = await fetch('/api/health')
    const data = await res.json()
    isHealthy.value = data.status === 'ok'
    healthStatus.value = t('health.ok')
  } catch {
    healthStatus.value = t('health.error')
  }
})
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SidebarNav.vue
git commit -m "refactor(ui): SidebarNav — remove borders, migrate to #888888 muted + accent colors"
```

---

## Task 5: ChatPanel — Full Width + Color Migration

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Replace entire ChatPanel.vue**

Full content — changes from current:
- Remove all `border-*` classes
- Replace `text-cyber-orange` → `text-cyber-accent`
- Replace `text-slate-100` → `text-[#EEEEEE]`
- Replace `text-cyber-orange/50` → `text-[#888888]`
- Replace `text-cyber-orange/40` → `text-[#888888]`
- Replace `text-cyber-orange/60` → `text-cyber-accent/80`
- Replace `placeholder-cyber-orange/30` → `placeholder-[#888888]/40`
- Header uses `bg-cyber-dark`, remove `border-b`
- Input container uses `bg-cyber-dark`, remove `border-t` and `border`

```vue
<!-- frontend/src/components/ChatPanel.vue -->
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

    <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
      <div v-for="(msg, i) in messages" :key="i" class="font-mono">
        <div class="text-xs mb-1" :class="roleColor(msg.role)">
          <HiChevronRight v-if="msg.role === 'agent'" class="w-3 h-3 inline" />
          {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
        </div>
        <div
          class="text-sm leading-relaxed break-words"
          :class="{
            'text-[#888888]': msg.role === 'system',
            'text-[#EEEEEE]': msg.role === 'user' || msg.role === 'agent',
          }"
        >
          {{ msg.content }}<span v-if="msg.typing" class="animate-blink text-cyber-accent ml-px">█</span>
        </div>
      </div>
    </div>

    <div class="px-3 py-2 bg-cyber-dark shrink-0">
      <form @submit.prevent="submit" class="flex items-center gap-2 bg-cyber-dark px-3 py-2">
        <span class="text-cyber-accent text-sm font-mono">$</span>
        <input
          v-model="input"
          class="flex-1 bg-transparent text-[#EEEEEE] text-sm outline-none font-mono placeholder-[#888888]/40"
          :placeholder="t('chat.placeholder')"
          :disabled="streaming"
          autocomplete="off"
          spellcheck="false"
        />
        <span v-if="!streaming" class="animate-blink text-cyber-accent text-sm">█</span>
        <span v-else class="text-[#888888] text-xs">{{ t('chat.thinking') }}</span>
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
  if (role === 'user') return 'text-cyber-accent/80'
  if (role === 'agent') return 'text-cyber-accent'
  return 'text-[#888888]'
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
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "refactor(ui): ChatPanel — full width, amber accent, #EEEEEE text, borderless"
```

---

## Task 6: TasksView — Color Migration

**Files:**
- Modify: `frontend/src/components/TasksView.vue`

- [ ] **Step 1: Update TasksView.vue**

Changes:
- Remove `border-b border-cyber-border` from header
- Remove `border-b border-cyber-border/50` from filter bar
- Replace `text-cyber-orange` → `text-cyber-accent`
- Replace `text-cyber-accent/40` → `text-[#888888]`
- Replace `text-cyber-green` → `text-cyber-green` (unchanged)
- Active/inactive filter classes: replace `border-cyber-*` with borderless active states

Replace entire file:

```vue
<!-- frontend/src/components/TasksView.vue -->
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-xs tracking-widest font-mono">
        <HiClipboardList class="w-3 h-3 inline" /> {{ t('tasks.header') }}
      </span>
      <span :class="['text-xs font-mono', wsConnected ? 'text-cyber-green' : 'text-[#888888]']">
        {{ wsConnected ? t('tasks.ws.connected') : t('tasks.ws.disconnected') }}
      </span>
    </div>

    <div class="px-3 py-1.5 bg-cyber-dark/40 flex items-center gap-2 shrink-0">
      <span class="text-[#888888] text-[9px] font-mono">{{ t('tasks.filter.label') }}</span>
      <button
        v-for="p in PRIORITY_FILTERS"
        :key="p.value"
        @click="toggleFilter(p.value)"
        :class="[
          'text-[9px] px-2 py-0.5 font-mono transition-colors duration-150',
          activeFilters.has(p.value) ? p.activeClass : p.inactiveClass,
        ]"
      >{{ t(p.labelKey) }}</button>
    </div>

    <KanbanBoard
      :active-filters="activeFilters"
      class="flex-1 overflow-hidden"
      @ws-status="wsConnected = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiClipboardList } from 'vue-icons-plus/hi'
import KanbanBoard from './KanbanBoard.vue'

const { t } = useI18n()
const wsConnected = ref(false)
const activeFilters = reactive(new Set<number>())

const PRIORITY_FILTERS = [
  {
    value: 2,
    labelKey: 'tasks.priority.high',
    activeClass: 'text-red-400 bg-red-400/10',
    inactiveClass: 'text-red-400/40 hover:text-red-400',
  },
  {
    value: 1,
    labelKey: 'tasks.priority.medium',
    activeClass: 'text-cyber-accent bg-cyber-accent/10',
    inactiveClass: 'text-cyber-accent/40 hover:text-cyber-accent',
  },
  {
    value: 0,
    labelKey: 'tasks.priority.low',
    activeClass: 'text-cyber-blue bg-cyber-blue/10',
    inactiveClass: 'text-cyber-blue/40 hover:text-cyber-blue',
  },
] as const

function toggleFilter(priority: number) {
  if (activeFilters.has(priority)) activeFilters.delete(priority)
  else activeFilters.add(priority)
}
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TasksView.vue
git commit -m "refactor(ui): TasksView — remove borders, migrate to terminal color tokens"
```

---

## Task 7: KanbanBoard — Color Migration

**Files:**
- Modify: `frontend/src/components/KanbanBoard.vue`

- [ ] **Step 1: Update KanbanBoard.vue**

Changes:
- Remove `border-r border-cyber-border/50` from column containers
- Remove `border-b border-cyber-border/50` from column headers
- Replace `text-cyber-accent/40` → `text-[#888888]`
- Column headers: keep `bg-cyber-dark/30`
- Input border: remove `border border-cyber-dim` on add input
- Add task button: remove `border border-dashed border-cyber-border`
- Card container: already has `border border-cyber-border` — remove border, rely on `bg-cyber-dark` for contrast

Replace the template sections that use borders. Key changes:

1. Column outer div: remove `border-r border-cyber-border/50 last:border-r-0`
2. Column header: remove `border-b border-cyber-border/50`
3. Add task input: remove `border border-cyber-dim`
4. Add task button: remove `border border-dashed border-cyber-border`, change to `bg-cyber-dark`
5. VueDraggable area: remove border classes

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/KanbanBoard.vue
git commit -m "refactor(ui): KanbanBoard — remove borders, contrast-based separation"
```

---

## Task 8: TaskCard + TaskCardMenu — Color Migration

**Files:**
- Modify: `frontend/src/components/TaskCard.vue`
- Modify: `frontend/src/components/TaskCardMenu.vue`

- [ ] **Step 1: Update TaskCard.vue**

Changes:
- Remove `border border-cyber-border` from card div
- Remove `hover:border-cyber-dim` from card div
- Card stays `bg-cyber-dark` for contrast against `#000000` background
- Update priority badge classes: remove `border-*` classes
- `···` button: `text-cyber-accent/40 hover:text-cyber-accent/70`

- [ ] **Step 2: Update TaskCardMenu.vue**

Changes:
- Remove `border border-cyber-dim` from menu container
- Remove `border-b border-cyber-border` from the priority section
- Priority buttons: remove `border rounded`, use bg-color only
- Delete button: keep text style, remove border

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TaskCard.vue frontend/src/components/TaskCardMenu.vue
git commit -m "refactor(ui): TaskCard + TaskCardMenu — remove borders, contrast separation"
```

---

## Task 9: Update Locale Files

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add status bar keys to vi.json**

Append before closing `}`:
```json
  "status.db": "db",
  "status.model": "model"
```

- [ ] **Step 2: Add status bar keys to en.json**

Append before closing `}`:
```json
  "status.db": "db",
  "status.model": "model"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add status bar i18n keys"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Full frontend build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 2: Full backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS (should be ~9 suites, ~33 tests).

---

## Verification

1. Open `http://localhost:5173`
2. Page background is absolute black (`#000000`)
3. Sidebar has no borders, icons in `#888888` / amber when active
4. Chat area full width, no border between sidebar and chat
5. Message text in `#EEEEEE`, muted text in `#888888`
6. Amber accent (`#FFA500`) on headers, cursor, agent prefix
7. Input area in `#111111` container, `$` prefix in amber
8. Status bar at bottom with model name, db indicator, ws status, clock
9. Kanban board visible when clicking Tasks icon — no borders between columns, contrast separation only
10. Task cards use `bg-cyber-dark` for contrast against column backgrounds
