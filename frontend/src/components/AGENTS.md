# components/ — Agent Context

All UI components for the AI Workspace. The layout is a multi-panel IDE: icon sidebar (desktop) + content column + bottom tab bar (mobile). Additional full-width views for tasks, settings, files, and providers.

## Component Map

```
AppShell.vue              — layout coordinator, owns activeView state
├── SidebarNav.vue        — 32px icon column (desktop), emits navigate events
├── [Content area]
│   ├── ChatPanel.vue         — SSE streaming agent chat + message history + tool call display
│   ├── TasksView.vue         — priority filter bar + KanbanBoard
│   ├── KanbanBoard.vue       — drag-and-drop columns (TODO/PROCESSING/DONE/FAILED)
│   │   ├── TaskCard.vue      — individual task card with priority highlight
│   │   │   └── TaskCardMenu.vue — priority picker + delete action
│   ├── FilesView.vue         — knowledge base upload + codebase watcher
│   ├── SettingsView.vue      — health check + version info + memories tab (MemoryView)
│   │   └── MemoryView.vue   — memory CRUD with type filter, search, auto-extracted badge, create/edit modals
│   └── ProvidersView.vue     — LLM provider CRUD + model management
├── AgentOutputView.vue  — list + download agent-generated files
├── BottomTabBar.vue     — mobile navigation (visible < sm)
├── StatusBar.vue         — bottom bar: model name, DB status, WS status, live clock

DirectoryBrowser.vue         — backend-driven filesystem tree modal for cowork project selection (Teleport to body)
SessionModal.vue             — session list modal (teleported to body, session CRUD)
├── BaseModal.vue            — reusable modal shell
ModelSelector.vue            — model dropdown
├── BaseSelect.vue           — reusable styled select
ProviderFormModal.vue        — create/edit provider form
├── BaseModal.vue
```

---

## AppShell.vue

**Owns:** `activeView` (`'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output'`), `dbConnected`, `wsConnected`.

**Layout:** flex-col h-screen → flex flex-1 (SidebarNav + content) + BottomTabBar + StatusBar.

**Conditional rendering:**
- `activeView === 'chat'` → ChatPanel (default)
- `activeView === 'tasks'` → TasksView
- `activeView === 'files'` → FilesView
- `activeView === 'tools'` → ToolsView
- `activeView === 'settings'` → SettingsView
- `activeView === 'providers'` → ProvidersView
- `activeView === 'notes'` → NotesView
- `activeView === 'plans'` → PlansView
- `activeView === 'agent-output'` → AgentOutputView

---

## SidebarNav.vue

**Props:** `activeView: 'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output'`

**Emits:** `navigate: [view: 'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output']`

**Navigation:** Chat (HiChatAlt2), Tasks (HiClipboardList), Notes (HiDocumentText), Plans (📋), AgentOutput (HiDownload), Tools (HiLightningBolt), Providers (HiCog), Settings (HiCog — separate button below spacer).

**Language toggle:** VI/EN (via `useI18n` locale), persists to `localStorage('workspace.lang')`.

Visible on desktop only (`hidden sm:flex`, `w-32`).

---

## BottomTabBar.vue

**Props:** `activeView: 'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output'`

**Emits:** `navigate: [view: 'chat' | 'cowork' | 'tasks' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans' | 'agent-output']`

Visible on mobile only (`flex sm:hidden`, `h-[3rem]`). Same navigation items as SidebarNav.

---

## ChatPanel.vue

**Emits:** none

**SSE streaming:** Uses Fetch API `ReadableStream` reader on `POST /api/agent/chat`. Body includes `{ message, providerModelId, sessionId, mode }`. AbortController for stopping streams.

**Model loading:** Fetches from `GET /api/providers/models` on mount. Selects from `localStorage('workspace.modelId')`.

**Message types:**
| role | Display | Prefix |
|---|---|---|
| `user` | Plain text, slate-100 | `$ người dùng` / `$ user` |
| `agent` | Markdown via renderMarkdown() | `▶ agent` |
| `tool` (call) | `[⚙] toolName(args)`, orange | — |
| `tool` (result) | Raw result text, green | — |
| `system` | Thinking indicator / errors, muted | `[hệ thống]` / `[system]` |
| `plan` | PlanBubble with step list + approve/reject/resume buttons | `plan` |

**renderMarkdown:** `DOMPurify.sanitize(marked.parse(content))`. Styled via `.markdown-body` CSS.

**Mode toggle:** Agent mode (ReAct loop with tools) vs Chat mode (plain conversation).

**Plan execution SSE:** `planStepUpdate` events update step statuses in-place on PlanBubble. `planInterrupted` pushes a system message. PlanBubble now supports INTERRUPTED status with a "Tiếp tục" resume button.

---

## KanbanBoard.vue

**Props:** `activeFilters: Set<number>`

**Emits:** `ws-status: [connected: boolean]`

**Columns:** TODO, PROCESSING, DONE, FAILED. Drag-and-drop via `vue-draggable-plus`. WebSocket via `socket.io-client` (`/tasks` namespace) for real-time task:created/updated/deleted events.

**Optimistic updates:** On drag, updates status optimistically; rolls back on PATCH failure.

---

## TaskCard.vue

**Props:** `task: Task`

**Emits:** `delete: [id]`, `update-priority: [id, priority]`

Renders title, description (truncated), priority label, due date. Priority determines left border color (red=high, orange=medium, transparent=low).

---

## TaskCardMenu.vue (absolute-positioned dropdown)

**Props:** `taskId: number`, `currentPriority: number`

**Emits:** `delete`, `update-priority: [id, priority]`

Three priority buttons (HIGH/MED/LOW) + delete action with confirmation.

---

## SessionModal.vue (teleported modal)

**Props:** `modelValue: boolean`, `currentSessionId: number | null`

**Emits:** `update:modelValue`, `select(sessionId)`, `created(sessionId)`

Lists sessions (title, date, message count via `_count.messages`), create new, delete with confirm, select to switch. Fetches session list on open.

---

## ProvidersView.vue

Fetches providers from `GET /api/providers`. Each provider is expandable to show models. Add/edit via ProviderFormModal. Add/delete models inline.

---

## ProviderFormModal.vue

**Props:** `modelValue: boolean`, `editing: Provider | null`

**Emits:** `update:modelValue`, `saved`

Form fields: name, baseUrl (optional), key (optional, password field). POST to create or PATCH to update.

---

## ModelSelector.vue

**Props:** `models: ProviderModelFlat[]`, `modelValue: number | null`, `disabled: boolean`

**Emits:** `update:modelValue: [value: number | null]`

Renders BaseSelect with options formatted as `"{providerName} / {modelName}"`.

---

## FilesView.vue

File upload zone (drag-and-drop + click), filter input, file list with status polling. Cowork project path input with DirectoryBrowser modal for directory selection.

---

## SettingsView.vue

Shows version and health check status (pings `GET /api/health` on mount).

---

## Design Rules

| Rule | Value |
|---|---|
| Font | `font-mono` everywhere. Never sans or serif. |
| Background | `bg-cyber-bg` / `bg-cyber-dark` |
| Border radius | Max `rounded` (4px). Never `rounded-lg` |
| Shadows | Forbidden (`shadow-*`) |
| Gradients | Forbidden |
| Animations | `animate-blink` for cursor only. `transition-colors duration-150` on interactive elements |
| Icons | `vue-icons-plus/hi` (Hero Icons). No inline SVG |

## i18n in Components

All components use `useI18n()`. Never hardcode user-facing strings. Always `t('key')`.

## i18n Keys Added Beyond Template

| Key | Purpose |
|---|---|
| `nav.providers` | Provider nav label |
| `providers.*` | Provider management UI |
| `chat.no_provider` | Warning when no model configured |
| `chat.mode.agent` | Agent mode toggle |
| `chat.mode.chat` | Chat mode toggle |
| `chat.thinking` | Thinking indicator text |
