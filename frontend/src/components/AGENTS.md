# components/ — Agent Context

All UI components for the AI Workspace. The layout is a 3-panel IDE: fixed icon sidebar + chat column (45%) + artifacts column (flex-1). Additional full-width views for tasks, settings, and files.

## Component Map

```
AppShell.vue              — layout coordinator, owns activeView state
├── SidebarNav.vue        — 52px icon column, emits navigate events, health dot, VI/EN toggle
├── ChatPanel.vue         — SSE streaming agent chat + message history + tool call display
├── ArtifactsPanel.vue    — renders last agent reply (code blocks + prose markdown)
├── TasksView.vue         — full-width kanban board (activeView === 'tasks')
├── SettingsView.vue      — full-width settings panel (activeView === 'settings')
├── FilesView.vue         — full-width knowledge base file manager (activeView === 'files')
├── SessionModal.vue      — session list modal (teleported to body, session CRUD)
├── ModelSelector.vue     — Ollama model dropdown
└── StatusBar.vue         — bottom bar: model name, DB status, WS status, live clock
```

---

## AppShell.vue

**Owns:** `activeView` (`'chat' | 'tasks' | 'files' | 'settings'`), `modelName`, `dbConnected`, `wsConnected`.

**Conditional rendering:**
- `activeView === 'chat'` → ChatPanel (default)
- `activeView === 'tasks'` → TasksView
- `activeView === 'settings'` → SettingsView
- `activeView === 'files'` → FilesView

---

## SidebarNav.vue

**Props:** `activeView: 'chat' | 'tasks' | 'files'`

**Emits:** `navigate: [view: 'chat' | 'tasks' | 'files']`

**Navigation:** Chat, Tasks, Files (icons from `vue-icons-plus/hi`), Settings (inactive).

**Language toggle:** VI/EN at bottom — `toggleLang()`, persists to `localStorage('workspace.lang')`.

**Health dot:** Polls `GET /api/health` on mount. Green when `status === 'ok'`, red otherwise.

---

## ChatPanel.vue

**Emits:** none (ArtifactsPanel reads from API directly)

**Message types:**
| role | Display | Prefix |
|---|---|---|
| `user` | Plain text, slate-100 | `$ người dùng` / `$ user` |
| `agent` | Markdown via renderMarkdown() | `▶ agent` |
| `tool` (call) | `[⚙] toolName(args)`, orange | — |
| `tool` (result) | Raw result text, green | — |
| `system` | Thinking indicator / errors, muted | `[hệ thống]` / `[system]` |

**SSE streaming:** Reads `POST /api/agent/chat` SSE stream. Lazy agent message creation (created on first `token` event) ensures correct ordering: toolCall → toolResult → thinking → response tokens.

**Stop stream:** `AbortController.abort()` on button click or client disconnect.

**renderMarkdown:** `DOMPurify.sanitize(marked.parse(content))`. Styled via `.markdown-body` CSS.

---

## SessionModal.vue

**Props:** `modelValue: boolean`, `currentSessionId: number | null`.

**Emits:** `update:modelValue`, `select(sessionId)`, `created(sessionId)`.

**Features:** Lists sessions (title, date, message count), create new, delete with confirm, select to switch. Teleported to `<body>`. Fetches session list on open.

---

## ModelSelector.vue

**Props:** `modelValue: string`, `models: string[]`, `disabled: boolean`.

**Emits:** `update:modelValue`.

Fetches model list from `GET /api/ollama/models`. Shows "ollama offline" when unavailable.

---

## StatusBar.vue

Bottom bar showing model name, DB connection status, WebSocket connection status, and live 24h clock.

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
