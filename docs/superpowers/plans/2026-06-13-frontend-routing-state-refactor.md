# Frontend Routing & State Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add URL routing and centralized state to the Vue 3 frontend while staying local-first, and break up the two largest components — without changing how anything looks or behaves.

**Architecture:** Three independent, sequentially-built phases. Phase 1 adds a stateless `api/` call layer and Pinia stores (`components → stores → api`). Phase 2 adds `vue-router` (history mode) driven by a single navigation config, replacing the `activeView` ref. Phase 3 extracts SSE/streaming logic into `useChatStream` and splits `ChatPanel`/`CoworkView` into focused subcomponents. The app builds, type-checks, and runs after every phase.

**Tech Stack:** Vue 3 (`<script setup>`), TypeScript strict, Vite, Pinia, vue-router v4, Vitest, vue-i18n v9, TailwindCSS (`cyber-*` tokens).

**Conventions for every task in this plan:**
- All new `.vue` files use `<script setup lang="ts">`, `font-mono`, max `rounded` (4px), no shadows/gradients, `vue-icons-plus/hi` icons, i18n via `t('key')`.
- No `any` types. No raw SQL. No secrets.
- Each phase ends with `npm run type-check` + `npm run build` green and a manual smoke of touched views before final commit.
- Update the relevant `frontend/AGENTS.md` / `frontend/src/components/AGENTS.md` entries **before** each phase's final commit (documentation-sync rule), editing only the affected entries.
- Commit messages: English, `<type>: <subject>` + body. No `Co-Authored-By` trailer.

**Verification baseline (run once before starting):**

Run: `cd frontend && npm run type-check && npm run build`
Expected: both succeed. This is the green baseline every phase must preserve.

---

# Phase 1 — Foundation: `api/` layer + Pinia stores

Outcome: every `fetch('/api/...')` call is replaced by a store action calling a typed `api/` function. Views render identically. Vitest is installed with tests for the API client and the providers store.

## Task 1.1: Install Pinia + Vitest

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd frontend && npm install pinia && npm install -D vitest @vue/test-utils jsdom
```
Expected: `pinia` in `dependencies`; `vitest`, `@vue/test-utils`, `jsdom` in `devDependencies`.

- [ ] **Step 2: Add the test and type-check scripts**

In `frontend/package.json`, add to `"scripts"` (the `type-check` script does not exist yet — the project currently only type-checks via `build`'s `vue-tsc && vite build`; this plan references `npm run type-check` throughout):
```json
    "type-check": "vue-tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create Vitest config**

Create `frontend/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 4: Verify the runner starts**

Run: `cd frontend && npm test`
Expected: Vitest runs and reports "No test files found" (exit 0 or "no tests" message). This confirms config loads.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts
git commit -m "chore: add pinia and vitest to frontend"
```

---

## Task 1.2: API client with coded errors (TDD)

**Files:**
- Create: `frontend/src/api/client.ts`
- Test: `frontend/src/api/client.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/api/client.spec.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { request, AppError } from './client'

afterEach(() => { vi.restoreAllMocks() })

describe('request', () => {
  it('prepends /api and parses JSON on success', async () => {
    const json = vi.fn().mockResolvedValue({ ok: 1 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json }))
    const result = await request<{ ok: number }>('/health')
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({ method: 'GET' }))
    expect(result).toEqual({ ok: 1 })
  })

  it('serializes a JSON body and sets the content-type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue({}) })
    vi.stubGlobal('fetch', fetchMock)
    await request('/tasks', { method: 'POST', body: { title: 'x' } })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ title: 'x' }))
  })

  it('throws AppError with the given code on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: vi.fn() }))
    await expect(request('/health', { errorCode: 'health.failed' }))
      .rejects.toMatchObject({ code: 'health.failed' } as Partial<AppError>)
  })

  it('throws AppError with code network_error when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    await expect(request('/health')).rejects.toMatchObject({ code: 'errors.network' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/api/client.spec.ts`
Expected: FAIL — cannot resolve `./client`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/api/client.ts`:
```ts
export class AppError extends Error {
  constructor(public code: string, public status?: number) {
    super(code)
    this.name = 'AppError'
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  errorCode?: string
  signal?: AbortSignal
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, errorCode = 'errors.request', signal } = options
  const init: RequestInit = { method, signal }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  let res: Response
  try {
    res = await fetch(`/api${path}`, init)
  } catch {
    throw new AppError('errors.network')
  }
  if (!res.ok) {
    throw new AppError(errorCode, res.status)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function requestRaw(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, signal } = options
  const init: RequestInit = { method, signal }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return fetch(`/api${path}`, init)
}
```

Note: `requestRaw` exists for streaming endpoints (`/agent/chat`) and multipart uploads (`/knowledge/upload`) that must not go through JSON parsing. Those callers handle `res.body`/`FormData` directly but still get the `/api` prefix from one place.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/api/client.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/client.spec.ts
git commit -m "feat: add api client with coded errors and json helpers"
```

---

## Task 1.3: API domain modules

**Files:**
- Create: `frontend/src/api/types.ts`, `providers.ts`, `sessions.ts`, `tasks.ts`, `notes.ts`, `connectors.ts`, `health.ts`

Each function wraps `request`/`requestRaw`. These mirror the endpoints currently called inline (see the grep map in the spec). No tests here — they are thin pass-throughs covered indirectly by store tests.

- [ ] **Step 1: Create shared types**

Create `frontend/src/api/types.ts`:
```ts
export interface ProviderModelFlat {
  id: number
  name: string
  providerName: string
  providerId: number
}

export interface SessionSummary {
  id: number
  title: string
  createdAt: string
  mode: string
  _count?: { messages: number }
}

export interface StoredMessage {
  role: string
  content: string
  createdAt: string
  toolName?: string
  isResult?: boolean
}

export interface Task {
  id: number
  title: string
  description: string | null
  status: 'TODO' | 'PROCESSING' | 'DONE' | 'FAILED'
  priority: number
  dueDate: string | null
}
```

- [ ] **Step 2: Providers API**

Create `frontend/src/api/providers.ts`:
```ts
import { request } from './client'
import type { ProviderModelFlat } from './types'

export interface Provider {
  id: number
  name: string
  baseUrl: string | null
  models?: ProviderModelFlat[]
}

export function listProviders() {
  return request<Provider[]>('/providers', { errorCode: 'providers.fetch_failed' })
}

export function listModels() {
  return request<ProviderModelFlat[]>('/providers/models', { errorCode: 'providers.fetch_failed' })
}

export function createProvider(body: { name: string; baseUrl?: string; key?: string }) {
  return request<Provider>('/providers', { method: 'POST', body, errorCode: 'providers.save_failed' })
}

export function updateProvider(id: number, body: { name: string; baseUrl?: string; key?: string }) {
  return request<Provider>(`/providers/${id}`, { method: 'PATCH', body, errorCode: 'providers.save_failed' })
}

export function deleteProvider(id: number) {
  return request<void>(`/providers/${id}`, { method: 'DELETE', errorCode: 'providers.delete_failed' })
}

export function syncModels(providerId: number) {
  return request<void>(`/providers/${providerId}/sync-models`, { method: 'POST', errorCode: 'providers.sync_failed' })
}

export function addModel(providerId: number, body: { name: string }) {
  return request<ProviderModelFlat>(`/providers/${providerId}/models`, { method: 'POST', body, errorCode: 'providers.save_failed' })
}

export function deleteModel(providerId: number, modelId: number) {
  return request<void>(`/providers/${providerId}/models/${modelId}`, { method: 'DELETE', errorCode: 'providers.delete_failed' })
}
```

- [ ] **Step 3: Sessions API**

Create `frontend/src/api/sessions.ts`:
```ts
import { request } from './client'
import type { SessionSummary, StoredMessage } from './types'

export function listSessions(mode?: string) {
  const q = mode ? `?mode=${encodeURIComponent(mode)}` : ''
  return request<SessionSummary[]>(`/sessions${q}`, { errorCode: 'sessions.fetch_failed' })
}

export function createSession(mode: string) {
  return request<{ id: number }>('/sessions', { method: 'POST', body: { mode }, errorCode: 'sessions.create_failed' })
}

export function deleteSession(id: number) {
  return request<void>(`/sessions/${id}`, { method: 'DELETE', errorCode: 'sessions.delete_failed' })
}

export function getSessionMessages(id: number) {
  return request<StoredMessage[]>(`/sessions/${id}/messages`, { errorCode: 'sessions.fetch_failed' })
}
```

- [ ] **Step 4: Tasks, notes, connectors, health APIs**

Create `frontend/src/api/tasks.ts`:
```ts
import { request } from './client'
import type { Task } from './types'

export function listTasks() {
  return request<Task[]>('/tasks', { errorCode: 'tasks.fetch_failed' })
}

export function createTask(body: Partial<Task>) {
  return request<Task>('/tasks', { method: 'POST', body, errorCode: 'tasks.save_failed' })
}

export function updateTask(id: number, body: Partial<Task>) {
  return request<Task>(`/tasks/${id}`, { method: 'PATCH', body, errorCode: 'tasks.save_failed' })
}

export function deleteTask(id: number) {
  return request<void>(`/tasks/${id}`, { method: 'DELETE', errorCode: 'tasks.delete_failed' })
}
```

Create `frontend/src/api/notes.ts`:
```ts
import { request } from './client'

export interface Note {
  id: number
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export function listNotes() {
  return request<Note[]>('/notes', { errorCode: 'notes.fetch_failed' })
}

export function createNote(body: { title: string; content: string }) {
  return request<Note>('/notes', { method: 'POST', body, errorCode: 'notes.save_failed' })
}

export function updateNote(id: number, body: { title: string; content: string }) {
  return request<Note>(`/notes/${id}`, { method: 'PATCH', body, errorCode: 'notes.save_failed' })
}

export function deleteNote(id: number) {
  return request<void>(`/notes/${id}`, { method: 'DELETE', errorCode: 'notes.delete_failed' })
}
```

Create `frontend/src/api/connectors.ts`:
```ts
import { request } from './client'

export interface Connector {
  id: string
  type: string
  connected: boolean
}

export function listConnectors() {
  return request<Connector[]>('/connectors', { errorCode: 'connectors.fetch_failed' })
}

export function getOAuthUrl(type: string) {
  return request<{ url: string }>(`/connectors/oauth/auth-url?type=${encodeURIComponent(type)}`, { errorCode: 'connectors.oauth_failed' })
}

export function deleteConnector(id: string) {
  return request<void>(`/connectors/${id}`, { method: 'DELETE', errorCode: 'connectors.delete_failed' })
}
```

Create `frontend/src/api/health.ts`:
```ts
import { request } from './client'

export function getHealth() {
  return request<{ status: string; db: string }>('/health', { errorCode: 'health.error' })
}
```

- [ ] **Step 5: Type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api
git commit -m "feat: add typed api modules for each backend domain"
```

---

## Task 1.4: Providers store (TDD)

**Files:**
- Create: `frontend/src/stores/providers.ts`
- Test: `frontend/src/stores/providers.spec.ts`

The providers store holds the flat model list shared by ChatPanel, CoworkView, and SettingsView, eliminating three separate `/api/providers/models` fetches.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/stores/providers.spec.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProvidersStore } from './providers'
import * as api from '../api/providers'

describe('providers store', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.restoreAllMocks() })

  it('loads models once and caches them', async () => {
    const spy = vi.spyOn(api, 'listModels').mockResolvedValue([
      { id: 1, name: 'gpt', providerName: 'p', providerId: 1 },
    ])
    const store = useProvidersStore()
    await store.loadModels()
    await store.loadModels()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(store.models).toHaveLength(1)
  })

  it('force-reloads models when reload=true', async () => {
    const spy = vi.spyOn(api, 'listModels').mockResolvedValue([])
    const store = useProvidersStore()
    await store.loadModels()
    await store.loadModels(true)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('records an error code on failure', async () => {
    vi.spyOn(api, 'listModels').mockRejectedValue(Object.assign(new Error(), { code: 'providers.fetch_failed' }))
    const store = useProvidersStore()
    await store.loadModels()
    expect(store.error).toBe('providers.fetch_failed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/stores/providers.spec.ts`
Expected: FAIL — cannot resolve `./providers`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/stores/providers.ts`:
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/providers'
import type { ProviderModelFlat } from '../api/types'
import { AppError } from '../api/client'

export const useProvidersStore = defineStore('providers', () => {
  const models = ref<ProviderModelFlat[]>([])
  const providers = ref<api.Provider[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)

  async function loadModels(reload = false) {
    if (loaded.value && !reload) return
    error.value = null
    try {
      models.value = await api.listModels()
      loaded.value = true
    } catch (e) {
      error.value = e instanceof AppError ? e.code : 'errors.request'
    }
  }

  async function loadProviders() {
    error.value = null
    try {
      providers.value = await api.listProviders()
    } catch (e) {
      error.value = e instanceof AppError ? e.code : 'errors.request'
    }
  }

  return { models, providers, loaded, error, loadModels, loadProviders }
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/stores/providers.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/providers.ts frontend/src/stores/providers.spec.ts
git commit -m "feat: add providers pinia store with cached model list"
```

---

## Task 1.5: Remaining stores

**Files:**
- Create: `frontend/src/stores/sessions.ts`, `tasks.ts`, `notes.ts`, `connectors.ts`, `ui.ts`

Follow the exact pattern from Task 1.4 (state `ref`s + async actions that call `api/` and set `error` on `AppError`). No new test files required beyond providers; type-check is the gate.

- [ ] **Step 1: Sessions store**

Create `frontend/src/stores/sessions.ts`:
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/sessions'
import type { SessionSummary } from '../api/types'
import { AppError } from '../api/client'

export const useSessionsStore = defineStore('sessions', () => {
  const sessions = ref<SessionSummary[]>([])
  const error = ref<string | null>(null)

  async function load(mode?: string) {
    error.value = null
    try { sessions.value = await api.listSessions(mode) }
    catch (e) { error.value = e instanceof AppError ? e.code : 'errors.request' }
  }

  async function create(mode: string) {
    return (await api.createSession(mode)).id
  }

  async function remove(id: number) {
    await api.deleteSession(id)
    sessions.value = sessions.value.filter(s => s.id !== id)
  }

  return { sessions, error, load, create, remove }
})
```

- [ ] **Step 2: Tasks store**

Create `frontend/src/stores/tasks.ts`:
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/tasks'
import type { Task } from '../api/types'
import { AppError } from '../api/client'

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    try { tasks.value = await api.listTasks() }
    catch (e) { error.value = e instanceof AppError ? e.code : 'errors.request' }
  }

  function upsert(task: Task) {
    const i = tasks.value.findIndex(t => t.id === task.id)
    if (i === -1) tasks.value.push(task)
    else tasks.value[i] = task
  }

  function removeLocal(id: number) {
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  async function updateStatus(id: number, status: Task['status']) {
    return api.updateTask(id, { status })
  }

  async function create(body: Partial<Task>) { return api.createTask(body) }
  async function update(id: number, body: Partial<Task>) { return api.updateTask(id, body) }
  async function remove(id: number) { await api.deleteTask(id); removeLocal(id) }

  return { tasks, error, load, upsert, removeLocal, updateStatus, create, update, remove }
})
```

`upsert`/`removeLocal` exist so KanbanBoard's Socket.io handlers write directly into the store.

- [ ] **Step 3: Notes store**

Create `frontend/src/stores/notes.ts`:
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/notes'
import { AppError } from '../api/client'

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<api.Note[]>([])
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    try { notes.value = await api.listNotes() }
    catch (e) { error.value = e instanceof AppError ? e.code : 'errors.request' }
  }

  async function create(body: { title: string; content: string }) { await api.createNote(body); await load() }
  async function update(id: number, body: { title: string; content: string }) { await api.updateNote(id, body); await load() }
  async function remove(id: number) { await api.deleteNote(id); await load() }

  return { notes, error, load, create, update, remove }
})
```

- [ ] **Step 4: Connectors store**

Create `frontend/src/stores/connectors.ts`:
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/connectors'
import { AppError } from '../api/client'

export const useConnectorsStore = defineStore('connectors', () => {
  const connectors = ref<api.Connector[]>([])
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    try { connectors.value = await api.listConnectors() }
    catch (e) { error.value = e instanceof AppError ? e.code : 'errors.request' }
  }

  async function remove(id: string) { await api.deleteConnector(id); await load() }

  return { connectors, error, load, remove }
})
```

- [ ] **Step 5: UI store**

Create `frontend/src/stores/ui.ts`:
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getHealth } from '../api/health'

export const useUiStore = defineStore('ui', () => {
  const dbConnected = ref(true)
  const wsConnected = ref(false)
  const activeSubagents = ref(0)
  const sidebarOpen = ref(false)

  async function refreshHealth() {
    try {
      const h = await getHealth()
      dbConnected.value = h.db === 'connected'
    } catch {
      dbConnected.value = false
    }
  }

  return { dbConnected, wsConnected, activeSubagents, sidebarOpen, refreshHealth }
})
```

- [ ] **Step 6: Register Pinia in main.ts**

Modify `frontend/src/main.ts` to:
```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/main.css'
import App from './App.vue'
import { i18n } from './i18n'

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.mount('#app')
```

- [ ] **Step 7: Type-check and test**

Run: `cd frontend && npm run type-check && npm test`
Expected: type-check PASS; all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/stores frontend/src/main.ts
git commit -m "feat: add sessions, tasks, notes, connectors, ui stores and register pinia"
```

---

## Task 1.6: Migrate views to stores (remove inline fetch)

**Files (modify):** every component listed in the migration map below.

The migration pattern is identical everywhere: delete the inline `fetch(...)`/`.json()`/`.ok` block, call the matching store action or `api/` function, read state from the store. Error handling: where a component currently swallows errors silently, keep that behavior; where it shows a chat `[error]` message, map `AppError.code` through `t(code)`.

**Migration map (file → action):**

| File | Inline fetch | Replace with |
|---|---|---|
| `ChatPanel.vue:400` | `/api/providers/models` | `providersStore.loadModels()` then read `providersStore.models` |
| `ChatPanel.vue:425,451,537,550` | sessions/plans | `api/sessions` + keep plan fetch via new `api/plans.ts` (add `getPlan`, `getNextPlan`) |
| `CoworkView.vue:246-393` | cowork/projects/sessions/models | add `api/cowork.ts` (`getProject`, `listProjects`, `setProject`, `saveProject`, `deleteProject`, `readFile`, `clearProject`); models via `providersStore` |
| `KanbanBoard.vue:132,147` | tasks | `tasksStore.load()`, `tasksStore.updateStatus()` |
| `TasksView.vue:141` | delete task | `tasksStore.remove()` |
| `TaskFormModal.vue:137,143` | create/update task | `tasksStore.create()` / `tasksStore.update()` |
| `NotesView.vue:71-118` | notes CRUD | `notesStore` |
| `ConnectorsView.vue:73-90` | connectors | `connectorsStore` + `api.getOAuthUrl` |
| `ProvidersView.vue:117-182` | providers CRUD | `providersStore` + `api/providers` functions |
| `ProviderFormModal.vue:137` | create/update provider | `api.createProvider` / `api.updateProvider` |
| `SessionModal.vue:87-117` | sessions | `sessionsStore` |
| `SettingsView.vue:128-160` | health/providers/settings | `uiStore.refreshHealth()`, `providersStore`, add `api/settings.ts` |
| `StatusBar.vue:51` | health | `uiStore` state (read `dbConnected`) |
| `AgentOutputView.vue:63` | agent-output | add `api/agentOutput.ts` (`listOutputs`) |
| `ToolsView.vue:73,89` | tools | add `api/tools.ts` (`listTools`, `toggleTool`) |
| `ToolConfigModal.vue:80` | tool config | `api/tools.ts` (`saveToolConfig`) |
| `PermissionView.vue:78,95` | yolo-config | add `api/agent.ts` (`getYoloConfig`, `setYoloConfig`) |
| `UsageView.vue:38,39` | usage | add `api/usage.ts` (`getUsage`, `getUsageSessions`) |
| `MemoryView.vue:173-224` | memories CRUD | add `api/memories.ts` + `stores/memories.ts` |
| `FilesView.vue:112-141` | knowledge | add `api/knowledge.ts`; upload uses `requestRaw` with `FormData` |
| `FileTree.vue:105`, `DirectoryBrowser.vue:73` | cowork/browse | `api/cowork.ts` (`browse`) — keep `AbortSignal` passthrough |
| `PlansView.vue:135,153` | plans | `api/plans.ts` (`executePlan`, `listSessionPlans`) |

`ChatPanel.vue:601` and `CoworkView.vue:562` (`/api/agent/chat` streaming) and `FilesView` upload are migrated to `requestRaw` only — the SSE reading loop is **not** touched in this phase (that is Phase 3).

- [ ] **Step 1: Create the remaining api modules**

Create `api/plans.ts`, `api/cowork.ts`, `api/settings.ts`, `api/agentOutput.ts`, `api/tools.ts`, `api/agent.ts`, `api/usage.ts`, `api/memories.ts`, `api/knowledge.ts` following the Task 1.3 pattern (one typed function per endpoint in the map). For `api/cowork.ts:browse` and `DirectoryBrowser`, accept an optional `signal?: AbortSignal` and pass it to `request`.

Example `api/plans.ts`:
```ts
import { request, requestRaw } from './client'

export interface PlanStep { id: number; order: number; text: string; status: string }
export interface PlanData { id: number; title: string; status: string; steps: PlanStep[] }

export function getPlan(id: number) {
  return request<PlanData>(`/plans/${id}`, { errorCode: 'plans.fetch_failed' })
}
export function getNextPlan(sessionId: number) {
  return request<{ found: boolean; plan?: PlanData; action?: string }>(`/plans/session/${sessionId}/next`, { errorCode: 'plans.fetch_failed' })
}
export function listSessionPlans(sessionId: number) {
  return request<PlanData[]>(`/plans/session/${sessionId}`, { errorCode: 'plans.fetch_failed' })
}
export function executePlan(planId: number, providerModelId: number) {
  return requestRaw(`/agent/plans/${planId}/execute`, { method: 'POST', body: { providerModelId } })
}
```

- [ ] **Step 2: Create the memories store**

Create `frontend/src/stores/memories.ts` following the notes-store pattern (`load`, `create`, `update`, `remove`), backed by `api/memories.ts`.

- [ ] **Step 3: Migrate views one file at a time**

For each file in the migration map: replace the inline fetch block with the store/api call. After each file, run `npm run type-check` to catch breakage early. Commit per logical group (e.g. all task-related files together).

Example — `KanbanBoard.vue` (lines 132 & 147):
```ts
// before:
const res = await fetch('/api/tasks')
const tasks = await res.json()
// after:
import { useTasksStore } from '../stores/tasks'
const tasksStore = useTasksStore()
await tasksStore.load()
// template/list reads tasksStore.tasks
```
And the optimistic drag update:
```ts
// before: fetch(`/api/tasks/${task.id}`, { method: 'PATCH', ... })
await tasksStore.updateStatus(task.id, newStatus)
```
Socket.io handlers in KanbanBoard now call `tasksStore.upsert(task)` / `tasksStore.removeLocal(id)` instead of mutating local arrays.

- [ ] **Step 4: Add i18n error keys**

Add the new error-code keys used above (`providers.fetch_failed`, `providers.save_failed`, `providers.delete_failed`, `providers.sync_failed`, `sessions.fetch_failed`, `sessions.create_failed`, `sessions.delete_failed`, `tasks.fetch_failed`, `tasks.save_failed`, `tasks.delete_failed`, `notes.*`, `connectors.*`, `plans.fetch_failed`, `health.error`, `errors.network`, `errors.request`) to **both** `frontend/src/locales/vi.json` and `frontend/src/locales/en.json`. Vietnamese is primary; English is the fallback.

- [ ] **Step 5: Verify no inline fetch remains**

Run: `cd frontend && grep -rn "fetch('/api" src/ || echo "clean"`
Expected: only `requestRaw`-based streaming/upload sites remain (ChatPanel chat stream, CoworkView chat stream, FilesView upload — all now via `requestRaw`, so the literal `fetch('/api` should be gone). Output should be `clean` for the raw-prefixed pattern.

- [ ] **Step 6: Phase gate — type-check, build, test, smoke**

Run: `cd frontend && npm run type-check && npm run build && npm test`
Expected: all PASS.
Manual smoke: open the app, visit every view (Cowork, Tasks, Notes, Connectors, Agent Output, Settings), confirm data loads, create/delete a task and a note, send a chat message. No behavior change vs. before.

- [ ] **Step 7: Update AGENTS.md and commit**

Update `frontend/AGENTS.md` (add `api/`, `stores/` to the File Structure section and a short "Data access" note) and `frontend/src/components/AGENTS.md` (note components now read from stores). Edit only affected entries.
```bash
git add frontend/src frontend/AGENTS.md
git commit -m "refactor: route all view data access through api modules and pinia stores

Replace every inline fetch('/api/...') call in components with typed
api/ functions invoked through domain Pinia stores. Streaming and upload
endpoints go through requestRaw to keep the /api prefix in one place.
Adds i18n keys for the new error codes."
```

---

# Phase 2 — Routing: vue-router + navigation config

Outcome: each view has a URL (history mode); the duplicated `activeView` union type is gone; Settings tabs are URL-persisted.

## Task 2.1: Install vue-router and build the navigation config

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/config/navigation.ts`

- [ ] **Step 1: Install**

Run: `cd frontend && npm install vue-router@4`
Expected: `vue-router` in `dependencies`.

- [ ] **Step 2: Create the navigation config (single source of truth)**

Create `frontend/src/config/navigation.ts`:
```ts
import type { Component } from 'vue'
import { HiCode, HiClipboardList, HiDocumentText, HiCog, HiDownload } from 'vue-icons-plus/hi'

export interface NavItem {
  name: string
  path: string
  labelKey: string
  icon: Component | string
}

export const navItems: NavItem[] = [
  { name: 'cowork', path: '/cowork', labelKey: 'nav.cowork', icon: HiCode },
  { name: 'tasks', path: '/tasks', labelKey: 'nav.tasks', icon: HiClipboardList },
  { name: 'notes', path: '/notes', labelKey: 'nav.notes', icon: HiDocumentText },
  { name: 'connectors', path: '/connectors', labelKey: 'nav.connectors', icon: HiCog },
  { name: 'agent-output', path: '/agent-output', labelKey: 'nav.agentOutput', icon: HiDownload },
]

export const settingsNav: NavItem = { name: 'settings', path: '/settings', labelKey: 'nav.settings', icon: HiCog }
```

This mirrors the active `navItems` currently hardcoded in `SidebarNav.vue:57-66` (commented-out items stay out).

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/config/navigation.ts
git commit -m "feat: add vue-router dependency and central navigation config"
```

---

## Task 2.2: Create the router

**Files:**
- Create: `frontend/src/router/index.ts`
- Modify: `frontend/src/main.ts`

- [ ] **Step 1: Define routes (history mode)**

Create `frontend/src/router/index.ts`:
```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import CoworkView from '../components/CoworkView.vue'
import TasksView from '../components/TasksView.vue'
import NotesView from '../components/NotesView.vue'
import ConnectorsView from '../components/ConnectorsView.vue'
import AgentOutputView from '../components/AgentOutputView.vue'
import SettingsView from '../components/SettingsView.vue'
import ChatPanel from '../components/ChatPanel.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/cowork' },
  { path: '/cowork', name: 'cowork', component: CoworkView },
  { path: '/chat', name: 'chat', component: ChatPanel },
  { path: '/tasks', name: 'tasks', component: TasksView },
  { path: '/notes', name: 'notes', component: NotesView },
  { path: '/connectors', name: 'connectors', component: ConnectorsView },
  { path: '/agent-output', name: 'agent-output', component: AgentOutputView },
  { path: '/settings', redirect: '/settings/general' },
  { path: '/settings/:tab', name: 'settings', component: SettingsView, props: true },
  { path: '/:pathMatch(.*)*', redirect: '/cowork' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
```

- [ ] **Step 2: Register the router in main.ts**

Modify `frontend/src/main.ts`:
```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/main.css'
import App from './App.vue'
import { i18n } from './i18n'
import { router } from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(i18n)
app.mount('#app')
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS (AppShell still uses `activeView`; router is registered but `<router-view>` not yet wired — that is the next task).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/router frontend/src/main.ts
git commit -m "feat: add vue-router with history-mode routes for every view"
```

---

## Task 2.3: Wire AppShell to router-view; delete the activeView union

**Files:**
- Modify: `frontend/src/components/AppShell.vue`, `SidebarNav.vue`, `BottomTabBar.vue`

- [ ] **Step 1: Rewrite AppShell template + script**

Replace `frontend/src/components/AppShell.vue` with:
```vue
<template>
  <div class="flex flex-col h-screen bg-cyber-bg font-mono overflow-hidden">
    <div class="flex flex-1 overflow-hidden">
      <SidebarNav class="hidden xl:flex" />

      <div v-if="ui.sidebarOpen" class="fixed inset-0 z-40 xl:hidden" @click="ui.sidebarOpen = false">
        <div class="absolute inset-0 bg-black/60"></div>
        <div class="relative h-full" @click.stop>
          <SidebarNav class="h-full" />
        </div>
      </div>

      <button @click="ui.sidebarOpen = !ui.sidebarOpen" class="fixed top-0 left-0 z-50 xl:hidden w-8 h-[3rem] flex items-center justify-center bg-cyber-dark border-r border-b border-cyber-code-border text-cyber-muted hover:text-cyber-accent transition-colors duration-150 text-sm font-mono">
        {{ ui.sidebarOpen ? '✕' : '☰' }}
      </button>

      <div class="flex-1 flex overflow-hidden">
        <router-view class="flex-1 overflow-hidden" />
      </div>
    </div>
    <StatusBar
      :db-connected="ui.dbConnected"
      :ws-connected="ui.wsConnected"
      :active-subagents="ui.activeSubagents"
    />
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import SidebarNav from './SidebarNav.vue'
import StatusBar from './StatusBar.vue'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
const route = useRoute()

watch(() => route.fullPath, () => { ui.sidebarOpen = false })
</script>
```

Note: the `@active-subagents-change` and `@ws-status` emits previously wired through AppShell now write directly to `useUiStore()` from inside CoworkView/ChatPanel/KanbanBoard (update those three to set `ui.activeSubagents` / `ui.wsConnected` instead of emitting). Make that change in this step.

- [ ] **Step 2: Rewrite SidebarNav to use the router + nav config**

Replace `frontend/src/components/SidebarNav.vue` script + nav rendering so it iterates `navItems` from `config/navigation.ts`, uses `<RouterLink>` (or `router.push`), and derives active state from `useRoute().name`:
```vue
<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { navItems, settingsNav } from '../config/navigation'

const route = useRoute()
const { t } = useI18n()
function isActive(name: string) { return route.name === name }
</script>
```
Template: `v-for="item in navItems"` rendering `<RouterLink :to="item.path">` with active classes `route.name === item.name ? 'bg-cyber-accent/10 text-cyber-accent' : 'text-cyber-muted hover:text-cyber-accent'`. Settings button uses `settingsNav`. The VI/EN language toggle block stays unchanged. **Delete** the `activeView` prop, the `navigate` emit, and the local `navItems`/union type.

- [ ] **Step 3: Rewrite BottomTabBar the same way**

Apply the identical change to `frontend/src/components/BottomTabBar.vue`: render from `navItems`, use `<RouterLink>`, derive active from `route.name`, delete the `activeView` prop and `navigate` emit.

- [ ] **Step 4: Make SettingsView read its tab from the route**

In `frontend/src/components/SettingsView.vue`, accept `props: { tab: string }` (from `/settings/:tab`) and use it to select the active tab (e.g. `general`, `memories`) instead of internal `ref` state. Changing tabs calls `router.push('/settings/<tab>')`. Default `/settings` already redirects to `/settings/general` (Task 2.2).

- [ ] **Step 5: Type-check, build, test**

Run: `cd frontend && npm run type-check && npm run build && npm test`
Expected: all PASS. (If old `App.vue` referenced AppShell props, none are needed now.)

- [ ] **Step 6: Phase gate — smoke**

Manual smoke: app loads at `/` → redirects to `/cowork`. Click each nav item → URL changes (`/tasks`, `/notes`, …). Reload on `/tasks` → stays on Tasks. Browser back/forward works. Visit `/settings/memories` directly → Memories tab is active. Unknown URL → redirects to `/cowork`. Mobile (`< xl`): bottom bar / hamburger navigate correctly.

- [ ] **Step 7: Update AGENTS.md and commit**

Update `frontend/AGENTS.md` (note router + `config/navigation.ts`; SPA → routed) and `frontend/src/components/AGENTS.md` (AppShell now hosts `<router-view>`, no `activeView`; SidebarNav/BottomTabBar derive active from route, props/emits removed). Edit only affected entries.
```bash
git add frontend/src frontend/AGENTS.md
git commit -m "feat: drive navigation with vue-router and central nav config

AppShell hosts <router-view> and reads ui state from the ui store.
SidebarNav and BottomTabBar render from config/navigation.ts and derive
active state from the route, removing the activeView union duplicated
across three files. Settings tab is now URL-persisted via /settings/:tab."
```

---

# Phase 3 — Component decomposition

Outcome: SSE parsing lives in a tested `useChatStream` composable shared by ChatPanel and CoworkView; ChatPanel and CoworkView are split into focused subcomponents.

## Task 3.1: Extract the SSE stream parser (TDD)

**Files:**
- Create: `frontend/src/composables/useChatStream.ts`
- Test: `frontend/src/composables/useChatStream.spec.ts`

The parser is the pure core of `ChatPanel.submit()` (lines 600-799): it reads a `ReadableStreamDefaultReader`, splits `data: ` lines, parses each JSON event, and invokes typed callbacks. It does **not** touch Vue refs — callers map callbacks to their own message arrays. This makes it unit-testable.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/composables/useChatStream.spec.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { parseSseStream, type SseCallbacks } from './useChatStream'

function readerFrom(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const enc = new TextEncoder()
  let i = 0
  return {
    read: async () => i < chunks.length
      ? { done: false, value: enc.encode(chunks[i++]) }
      : { done: true, value: undefined },
    releaseLock: () => {},
    cancel: async () => {},
    closed: Promise.resolve(undefined),
  } as unknown as ReadableStreamDefaultReader<Uint8Array>
}

function spyCallbacks(): SseCallbacks {
  return {
    onToken: vi.fn(), onToolCall: vi.fn(), onToolResult: vi.fn(),
    onThinking: vi.fn(), onPlan: vi.fn(), onPlanStepUpdate: vi.fn(),
    onPlanInterrupted: vi.fn(), onSubagent: vi.fn(),
    onDelegateProgress: vi.fn(), onDelegateResult: vi.fn(),
    onError: vi.fn(), onDone: vi.fn(),
  }
}

describe('parseSseStream', () => {
  it('emits tokens in order', async () => {
    const cb = spyCallbacks()
    await parseSseStream(readerFrom(['data: {"token":"Hel"}\n', 'data: {"token":"lo"}\n', 'data: [DONE]\n']), cb)
    expect((cb.onToken as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0])).toEqual(['Hel', 'lo'])
    expect(cb.onDone).toHaveBeenCalledOnce()
  })

  it('routes a tool call with parsed args', async () => {
    const cb = spyCallbacks()
    await parseSseStream(readerFrom(['data: {"toolCall":{"name":"read","args":{"path":"a"}}}\n', 'data: [DONE]\n']), cb)
    expect(cb.onToolCall).toHaveBeenCalledWith('read', { path: 'a' })
  })

  it('handles a payload split across chunks', async () => {
    const cb = spyCallbacks()
    await parseSseStream(readerFrom(['data: {"tok', 'en":"x"}\n', 'data: [DONE]\n']), cb)
    expect(cb.onToken).toHaveBeenCalledWith('x')
  })

  it('skips malformed json lines without throwing', async () => {
    const cb = spyCallbacks()
    await parseSseStream(readerFrom(['data: {bad\n', 'data: {"token":"ok"}\n', 'data: [DONE]\n']), cb)
    expect(cb.onToken).toHaveBeenCalledWith('ok')
  })

  it('routes error events', async () => {
    const cb = spyCallbacks()
    await parseSseStream(readerFrom(['data: {"error":"boom"}\n']), cb)
    expect(cb.onError).toHaveBeenCalledWith('boom')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/composables/useChatStream.spec.ts`
Expected: FAIL — cannot resolve `./useChatStream`.

- [ ] **Step 3: Implement the parser**

Create `frontend/src/composables/useChatStream.ts`. Port the event-dispatch logic from `ChatPanel.vue:623-776` into a pure function whose branches call callbacks instead of mutating `messages.value`:
```ts
export interface PlanStep { id: number; order: number; text: string; status: string }
export interface PlanData { id: number; title: string; status: string; steps: PlanStep[] }

export interface SubagentEvent {
  done?: boolean
  token?: string
  toolCall?: { name: string; args: Record<string, unknown> }
  toolResult?: { name: string; result: string }
  thinking?: string
}

export interface SseCallbacks {
  onToken: (token: string) => void
  onToolCall: (name: string, args: Record<string, unknown>) => void
  onToolResult: (name: string, result: string) => void
  onThinking: (text: string) => void
  onPlan: (plan: PlanData) => void
  onPlanStepUpdate: (planId: number, stepId: number, status: string) => void
  onPlanInterrupted: (planId: number, reason: string) => void
  onSubagent: (ev: SubagentEvent) => void
  onDelegateProgress: (index: number, subtask: string, status: string) => void
  onDelegateResult: (count: number) => void
  onError: (error: string) => void
  onDone: () => void
}

export async function parseSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  cb: SseCallbacks,
): Promise<void> {
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
      if (payload === '[DONE]') { cb.onDone(); done = true; break }
      try {
        const p = JSON.parse(payload) as Record<string, unknown>
        if (p.error) cb.onError(String(p.error))
        else if (p.subagent) cb.onSubagent(p as unknown as SubagentEvent)
        else if (p.toolCall) { const tc = p.toolCall as { name: string; args: Record<string, unknown> }; cb.onToolCall(tc.name, tc.args) }
        else if (p.toolResult) { const tr = p.toolResult as { name: string; result: string }; cb.onToolResult(tr.name, tr.result) }
        else if (p.thinking) cb.onThinking(String(p.thinking))
        else if (p.plan) cb.onPlan(p.plan as PlanData)
        else if (p.planStepUpdate) { const u = p.planStepUpdate as { planId: number; stepId: number; status: string }; cb.onPlanStepUpdate(u.planId, u.stepId, u.status) }
        else if (p.planInterrupted) { const i = p.planInterrupted as { planId: number; reason: string }; cb.onPlanInterrupted(i.planId, i.reason) }
        else if (p.delegateProgress) { const d = p.delegateProgress as { index: number; subtask: string; status: string }; cb.onDelegateProgress(d.index, d.subtask, d.status) }
        else if (p.delegateResult) { const d = p.delegateResult as { count: number }; cb.onDelegateResult(d.count) }
        else if (p.token) cb.onToken(String(p.token))
      } catch { /* skip malformed */ }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/composables/useChatStream.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useChatStream.ts frontend/src/composables/useChatStream.spec.ts
git commit -m "feat: extract SSE stream parser into tested useChatStream composable"
```

---

## Task 3.2: Use the parser in ChatPanel

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Replace the inline SSE loop**

In `ChatPanel.vue:submit()`, replace the `while (!done) { ... }` reading loop (lines 615-778) with a call to `parseSseStream(reader, callbacks)`. Move each former inline branch's body into the matching callback (the message-mutation code stays in ChatPanel, called from the callbacks). The `subagent` handling maps to `onSubagent` (which inspects `ev.done`/`ev.token`/etc. exactly as the old nested branch did). Keep `clearThinking`, `getOrCreateAgentMsg`, `currentAgentIdx`, `scrollToBottom`, and the `activeSubagents` updates (now writing to `useUiStore()`).

- [ ] **Step 2: Type-check + test + smoke**

Run: `cd frontend && npm run type-check && npm test`
Expected: PASS.
Smoke: send a chat message in Chat mode and Agent mode; confirm tokens stream, tool calls/results show, a plan renders, stop button aborts. Behavior identical to before.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "refactor: drive ChatPanel SSE handling through useChatStream"
```

---

## Task 3.3: Split ChatPanel into MessageList / MessageItem / ChatInputBar

**Files:**
- Create: `frontend/src/components/chat/MessageItem.vue`, `MessageList.vue`, `ChatInputBar.vue`
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Create MessageItem.vue**

Move the per-message render blocks (`ChatPanel.vue:6-89` — thinking / tool call / tool result / agent / plan / user / system) into `chat/MessageItem.vue`. Props: `defineProps<{ msg: Message }>()`. Emits: `{ formSubmit: [data: Record<string,string>]; approve: [id: number]; reject: [id: number]; resume: [id: number]; toggleExpand: [msg: Message] }`. Move the presentation helpers it needs (`rolePrefix`, `renderMarkdown`, `parseSegments`, `highlightUserMessage`, `isToolLong`, `toolPreview`, `isToolExpanded`) — keep `renderMarkdown`/`parseSegments` in a small `chat/markdown.ts` util imported by MessageItem so they are not duplicated. Export the `Message`/`PlanData` interfaces from `chat/types.ts` and import them where needed.

- [ ] **Step 2: Create MessageList.vue**

Move the `v-for` messages container (`ChatPanel.vue:4-92`, the scroll wrapper + loop) into `chat/MessageList.vue`. Props: `defineProps<{ messages: Message[]; streaming: boolean }>()`. Renders `<MessageItem>` per message and re-emits its events upward. Owns the `messagesEl` scroll ref and exposes a `scrollToBottom()` via `defineExpose`.

- [ ] **Step 3: Create ChatInputBar.vue**

Move the input form + ModelSelector + mode toggle + sessions button (`ChatPanel.vue:108-163`) into `chat/ChatInputBar.vue`. Props: `defineProps<{ streaming: boolean; models: ProviderModelFlat[]; modelId: number | null; mode: 'chat' | 'agent' }>()`. Emits: `{ 'update:modelId': [v: number|null]; 'update:mode': [m: 'chat'|'agent']; submit: [text: string]; stop: []; openSessions: [] }`. Owns its own `input` ref; emits `submit` with the trimmed text.

- [ ] **Step 4: Reduce ChatPanel to a coordinator**

`ChatPanel.vue` now: owns `messages`, `streaming`, `selectedModelId`, `currentMode`, `currentSessionId`, the `submit()`/`loadSession()`/plan-handler logic; renders `<MessageList>` + `<ChatInputBar>` + `<SessionModal>`; wires events. The empty-state block (lines 94-99) stays in ChatPanel.

- [ ] **Step 5: Type-check + test + smoke**

Run: `cd frontend && npm run type-check && npm test`
Expected: PASS.
Smoke: full chat flow again (stream, tools, plan approve/reject/resume, expand/collapse tool output, session switch, model + mode change). Identical behavior.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/chat frontend/src/components/ChatPanel.vue
git commit -m "refactor: split ChatPanel into MessageList, MessageItem, ChatInputBar"
```

---

## Task 3.4: Share useChatStream + session loading with CoworkView, then split it

**Files:**
- Create: `frontend/src/composables/useSessionMessages.ts`
- Modify: `frontend/src/components/CoworkView.vue`
- Create: CoworkView subcomponents (seams below)

`CoworkView.vue:301-364` (`loadSession`) and `ChatPanel.vue:421-491` are near-identical. `CoworkView.vue:562` runs the same SSE flow as ChatPanel.

- [ ] **Step 1: Extract shared session-history loader**

Create `frontend/src/composables/useSessionMessages.ts` exporting `loadSessionMessages(sessionId, t): Promise<Message[]>` containing the shared history-mapping logic (tool/system/plan/user/agent mapping + plan freshness fetch via `api/plans.getPlan`). Use it from both ChatPanel.loadSession and CoworkView.loadSession. Add a unit test `useSessionMessages.spec.ts` covering the plan-status "EXECUTING → DONE when all steps done" rule and the `assistant → agent` role mapping (mock `api/plans.getPlan`).

- [ ] **Step 2: Route CoworkView SSE through parseSseStream**

Apply the Task 3.2 change to `CoworkView.vue:562` streaming loop — replace the inline reader loop with `parseSseStream`, mapping callbacks to CoworkView's `messages`/`activePlans`/`recentToolResults` updates.

- [ ] **Step 3: Split CoworkView by responsibility cluster**

Read `CoworkView.vue` in full and extract these clusters (the file's own state groupings, confirmed at lines 203-224):
- `cowork/ProjectBar.vue` — project path + connect/save/delete project menu (`projectPath`, `savedProjects`, `showProjectMenu`, `showSaveModal`, `connectProject`, `saveCurrentProject`, `deleteProject`, `loadProject`, `loadSavedProjects`). Uses `api/cowork.ts`.
- `cowork/FilePreviewPanel.vue` — the artifacts/preview pane (`previewContent`, `previewFileName`, `artifactsVisible`, `loadFilePreview`, `onFileSelect`) + FileTree.
- Reuse the Phase-3 chat subcomponents (`MessageList`, `ChatInputBar`) for CoworkView's chat column instead of its own duplicated markup.

`CoworkView.vue` becomes a coordinator wiring ProjectBar + FilePreviewPanel + the shared chat components + its SSE/session logic.

- [ ] **Step 4: Type-check + test + build + smoke**

Run: `cd frontend && npm run type-check && npm test && npm run build`
Expected: all PASS.
Smoke: in Cowork, connect a project, browse the file tree, preview a file, send a message (stream + tools + plan), switch sessions, save/delete a saved project. Identical behavior.

- [ ] **Step 5: Update AGENTS.md and commit**

Update `frontend/src/components/AGENTS.md`: add the `chat/` subcomponents and `cowork/` subcomponents to the component map; note `useChatStream`, `useSessionMessages`; update ChatPanel/CoworkView descriptions to "coordinator". Edit only affected entries.
```bash
git add frontend/src frontend/src/components/AGENTS.md
git commit -m "refactor: split CoworkView and share chat stream + session loaders

CoworkView reuses useChatStream, useSessionMessages, and the chat
subcomponents instead of duplicating ChatPanel's SSE and history logic,
and is split into ProjectBar and FilePreviewPanel by responsibility."
```

---

# Self-Review Notes (addressed)

- **Spec coverage:** §1 API layer → Tasks 1.2-1.3; §1 stores + dependency direction → Tasks 1.4-1.6; §2 navigation config + router + AppShell + Settings sub-route → Tasks 2.1-2.3; §3 useChatStream + ChatPanel/CoworkView split + Vitest → Phase 3; testing/safety-net → Task 1.1 + per-phase gates; phasing → the three phase headers. `/tasks/:id`, backend changes, visual changes confirmed out of scope (not present in any task).
- **No raw fetch after Phase 1:** enforced by Task 1.6 Step 5 grep gate; streaming/upload intentionally use `requestRaw`.
- **Type consistency:** `parseSseStream` / `SseCallbacks` names match between Task 3.1 and 3.2; `tasksStore.updateStatus`/`upsert`/`removeLocal` defined in 1.5 and used in 1.6; `navItems`/`settingsNav` defined in 2.1 and consumed in 2.3; `AppError.code` used consistently across client and stores.
```
