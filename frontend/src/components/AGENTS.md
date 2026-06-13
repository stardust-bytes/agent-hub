# components/ — Agent Context

All UI components for the AI Workspace. The layout is a multi-panel IDE: icon sidebar (desktop) + content column + bottom tab bar (mobile). Additional full-width views for tasks, settings, files, and providers.

## Component Map

```
AppShell.vue              — layout shell, hosts <router-view>, reads ui state from useUiStore
├── SidebarNav.vue        — 60px nav column (desktop), RouterLink items from config/navigation
├── [Content area — router-view]
│   ├── CoworkView.vue            — coordinator: project + chat + artifacts
│   │   ├── cowork/MessageList.vue  — scroll wrapper + v-for MessageItem, forward events
│   │   ├── cowork/MessageItem.vue  — per-message render (thinking/tool/agent/plan/user/system)
│   │   ├── cowork/ChatInputBar.vue — input form + ModelSelector + mode toggle + sessions button
│   │   ├── cowork/types.ts         — shared interfaces (Message, PlanData, ProviderModelFlat, …)
│   │   ├── cowork/markdown.ts      — renderMarkdown, parseSegments, highlightUserMessage
│   │   ├── cowork/ProjectBar.vue — project path + connect/save/delete menu
│   │   └── ArtifactsPanel.vue    — file preview + plan steps + tool results pane
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

**Owns:** nothing — reads all state from `useUiStore()`.

**Layout:** flex-col h-screen → flex flex-1 (SidebarNav + `<router-view>`) + BottomTabBar + StatusBar.

**Routing:** `<router-view>` renders the active view based on the current URL. `watch(route.fullPath)` closes the mobile sidebar on navigation.

---

## SidebarNav.vue

**Props:** none

**Emits:** none

**Navigation:** Renders `sidebarItems` from `config/navigation.ts` as `<RouterLink>` elements. Active state derived from `useRoute().name`. Settings rendered as a separate `<RouterLink>` at the bottom. Items: cowork, tasks, notes, connectors, agent-output (settings separate).

Visible on desktop only (`hidden xl:flex`, `w-60`).

---

## BottomTabBar.vue

**Props:** none

**Emits:** none

Visible on mobile only (`flex md:hidden`, `h-[3rem]`). Renders `bottomItems` from `config/navigation.ts` as `<RouterLink>` elements. Items: cowork, tasks, agent-output, plans, notes, connectors, settings.

---

## CoworkView.vue (coordinator)

**Emits:** none

**Coordination:** Owns project state, messages, SSE streaming, file preview, plan tracking. Renders `<ProjectBar>` + `<MessageList>` + `<ChatInputBar>` + `<ArtifactsPanel>` + `<FileTree>` + `<SessionModal>` + `<DirectoryBrowser>`. Wires all events between children.

**SSE streaming:** Uses `parseSseStream` from `src/composables/useChatStream.ts`. Plan events populate `activePlans` ref and push step-update system messages with emoji icons (✅ ⟳ ✗). `toolResult` events populate both messages and `recentToolResults`. `mode: 'cowork'` sent as the agent mode.

**Model loading:** Reads from `providersStore.models` via `useProvidersStore().loadModels()`.

**Session history:** Uses `loadSessionMessages` from `src/composables/useSessionMessages.ts`.

**File tree:** Refreshed via `fileTreeRefreshKey` counter incremented on stream complete.

**Artifacts:** File preview via `readFile` API call; tool results fed to `ArtifactsPanel`.

---

## cowork/ProjectBar.vue

**Props:** `projectPath: string | null`, `savedProjects: SavedProject[]`

**Emits:** `browse-directory`, `select-project(path)`, `delete-project(id)`, `save-project(name)`, `toggle-artifacts`

Owns its own dropdown state (`showProjectMenu`, `showSaveModal`, `saveProjectName`). Renders the project path bar with a connected indicator dot, dropdown menu for saved projects, and save/delete/browse actions.

---

## cowork/MessageItem.vue

**Props:** `msg: Message`, `streaming: boolean`

**Emits:** `formSubmit(data)`, `approve(id)`, `reject(id)`, `resume(id)`, `toggleExpand(msg)`

Renders one message block. Handles thinking indicator, tool call/result with expand/collapse, agent answer with markdown+form segments, PlanBubble, user highlight, and system messages. Uses `renderMarkdown`/`parseSegments`/`highlightUserMessage` from `markdown.ts`.

---

## cowork/MessageList.vue

**Props:** `messages: Message[]`, `streaming: boolean`

**Emits:** all MessageItem events (formSubmit, approve, reject, resume, toggleExpand)

Scroll wrapper with `messagesEl` ref. Renders `<MessageItem>` per message. Exposes `scrollToBottom()` via `defineExpose`.

---

## cowork/ChatInputBar.vue

**Props:** `streaming: boolean`, `models: ProviderModelFlat[]`, `modelId: number | null`, `mode: 'chat' | 'agent'`

**Emits:** `update:modelId`, `update:mode`, `submit(text)`, `stop`, `openSessions`

Owns its own `input` ref and text state. Emits `submit` with trimmed text on form submit. Contains `<ModelSelector>`, mode toggle buttons, sessions button, and streaming dots animation.

---

## KanbanBoard.vue

**Props:** `activeFilters: Set<number>`

**Emits:** `edit: [task]`, `delete: [id]`

**Columns:** TODO, PROCESSING, DONE, FAILED. Drag-and-drop via `vue-draggable-plus`. WebSocket via `socket.io-client` (`/tasks` namespace) for real-time task:created/updated/deleted events. WS connection state written directly to `useUiStore().wsConnected`.

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
| Buttons | Text labels (not icons) for action buttons. Delete button: `text-red-400 border-red-400/50 hover:bg-red-400/10`. Primary: `text-cyber-accent border-cyber-accent/30 hover:bg-cyber-accent/10` |
| Cards | Flex column (`flex flex-col`). Action buttons at bottom-right (`mt-auto justify-end`). No `rounded`. |
| Text size | `text-sm` everywhere. No `text-xs` or `text-2xs`. |
| Border radius | None. All inputs, buttons, selects, cards are flat (no `rounded`). |

## Header Pattern (standard cho mọi màn hình)

```html
<div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-cyber-code-border shrink-0 bg-cyber-dark">
  <Icon class="w-3 h-3 text-cyber-accent" />
  <span class="text-sm text-cyber-accent font-mono">{{ t('view.header') }}</span>
  <button class="ml-auto text-sm text-cyber-accent font-mono px-2 py-0.5 border border-cyber-accent/30 transition-colors duration-150 hover:bg-cyber-accent/10">
    {{ t('view.action') }}
  </button>
</div>
```

- Chiều cao cố định `h-[3rem]`
- Icon + title bên trái, action button `ml-auto` bên phải
- Button style: `text-cyber-accent border-cyber-accent/30 hover:bg-cyber-accent/10`

## Data Access

Components obtain data through Pinia stores (`stores/`) rather than inline `fetch` calls. Stores delegate to the `api/` typed call layer; only `src/api/knowledge.ts` retains a direct `fetch` call for multipart file upload.

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
