# components/ — Agent Context

All UI components for the AI Workspace. The layout is a multi-panel IDE: icon sidebar (desktop) + router-view content column + bottom tab bar (mobile). Routing is handled by `vue-router` (`src/router/index.ts`); settings sub-screens (providers, tools, usage, memories, permissions) are tabs inside `SettingsView`.

## Component Map

```
AppShell.vue              — layout shell, hosts <router-view>, reads ui state from useUiStore
├── SidebarNav.vue        — desktop nav column, RouterLink items from config/navigation
├── [Content area — router-view, see router/index.ts]
│   ├── CoworkView.vue            — /cowork: coordinator (project + chat + artifacts)
│   │   ├── cowork/MessageList.vue  — scroll wrapper + v-for MessageItem, forward events
│   │   ├── cowork/MessageItem.vue  — per-message render (thinking/tool/agent/plan/user/system)
│   │   ├── cowork/ChatInputBar.vue — input form + ModelSelector + mode toggle + sessions button
│   │   ├── cowork/ProjectBar.vue   — project path + connect/save/delete menu
│   │   ├── cowork/types.ts         — shared interfaces (Message, PlanData, ProviderModelFlat, …)
│   │   ├── cowork/markdown.ts      — renderMarkdown, parseSegments, highlightUserMessage
│   │   ├── ArtifactsPanel.vue      — file preview + plan steps + tool results pane
│   │   ├── FileTree.vue            — project file tree
│   │   ├── FilesView.vue           — knowledge base upload + codebase watcher
│   │   ├── ToolApprovalBar.vue     — pending tool-call approve/deny bar
│   │   ├── SlashMenu.vue           — slash-command autocomplete
│   │   ├── PlanBubble.vue          — plan steps bubble in chat
│   │   ├── SessionModal.vue        — session list/CRUD modal
│   │   └── DirectoryBrowser.vue    — backend-driven filesystem tree modal
│   ├── ScheduleTasksView.vue   — /tasks: scheduled task list + create
│   ├── ScheduleTaskDetailView.vue — /tasks/:id: task detail + run logs
│   ├── NotesView.vue           — /notes: markdown notes CRUD (uses NoteModal)
│   ├── ConnectorsView.vue      — /connectors: Google connector accounts + OAuth
│   ├── AgentOutputView.vue     — /agent-output: list + download agent files
│   ├── PlansView.vue           — /plans: execution plan list
│   ├── OAuthCallbackPage.vue   — /oauth/callback: OAuth redirect handler (state+code → confirmOAuth)
│   └── SettingsView.vue        — /settings/:tab: tabbed settings host
│       ├── ProvidersView.vue   — LLM provider CRUD + model management (uses ProviderFormModal)
│       ├── ToolsView.vue       — tool registry toggle + config (uses ToolConfigModal)
│       ├── UsageView.vue       — token usage totals + per-session breakdown
│       ├── MemoryView.vue      — memory CRUD with type filter, search, auto-extracted badge
│       └── PermissionView.vue  — tool permission / YOLO config
├── BottomTabBar.vue     — mobile navigation (visible < md)
└── StatusBar.vue        — bottom bar: model name, DB status, WS status, live clock

Shared/reusable:
ModelSelector.vue            — model dropdown (uses BaseSelect)
BaseModal.vue                — reusable modal shell (Teleport)
BaseConfirmModal.vue         — confirm dialog (uses BaseModal)
BaseSelect.vue               — reusable styled select
FormBlock.vue                — agent-rendered form segment
NoteModal.vue                — create/edit note modal
ProviderFormModal.vue        — create/edit provider form
ToolConfigModal.vue          — per-tool config editor
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

## ScheduleTasksView.vue

`/tasks` route. Lists scheduled tasks from `GET /api/schedule-tasks`, create new, toggle enabled, run-now, navigate to detail. Frequency shown as manual/hourly/daily/weekdays/weekly.

---

## ScheduleTaskDetailView.vue

`/tasks/:id` route (`props: true`). Shows a single scheduled task and its run logs (`GET /api/schedule-tasks/:id/logs`). Supports edit, delete, run-now.

---

## NotesView.vue

`/notes` route. Markdown notes CRUD against `/api/notes`; create/edit via `NoteModal`. Real-time updates via the `/notes` Socket.io namespace.

---

## ConnectorsView.vue

`/connectors` route. Lists connector accounts, starts Google OAuth (`GET /api/connectors/oauth/auth-url`), enables/disables and deletes connectors.

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

`/settings/:tab` route. Tabbed host that renders one of `ProvidersView`, `ToolsView`, `UsageView`, `MemoryView`, `PermissionView` based on the `:tab` param, plus a general tab with version and health check status (pings `GET /api/health`).

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
