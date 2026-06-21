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
│   │   ├── SubagentMonitorPanel.vue — sub-agent live log sessions panel
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
│       ├── AgentsView.vue      — agent profile CRUD (uses ModelSelector + BaseConfirmModal)
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
SubagentMonitorPanel.vue     — sub-agent live log sessions panel
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

**Frontend slash commands:** `/clear` clears messages locally; `/help` renders available commands as a system message. `/agent` and `/plan` commands are forwarded to the backend for processing.

**Model loading:** Reads from `providersStore.models` via `useProvidersStore().loadModels()`.

**Session history:** Uses `loadSessionMessages` from `src/composables/useSessionMessages.ts`.

**Sub-agent monitoring:** Manages `subagentSessions` ref and `SubagentMonitorPanel` toggle. Sub-agent SSE events are routed to session logs for live display, with brief inline messages in the main chat. `activeSubagentCount` shown via `ProjectBar` prop.

**File tree:** Refreshed via `fileTreeRefreshKey` counter incremented on stream complete.

**Artifacts:** File preview via `readFile` API call; tool results fed to `ArtifactsPanel`.

---

## cowork/ProjectBar.vue

**Props:** `projectPath: string | null`, `savedProjects: SavedProject[]`, `subagentCount?: number`

**Emits:** `browse-directory`, `select-project(path)`, `delete-project(id)`, `save-project(name)`, `toggle-artifacts`, `toggle-subagent-monitor`

Owns its own dropdown state (`showProjectMenu`, `showSaveModal`, `saveProjectName`). Renders the project path bar with a connected indicator dot, dropdown menu for saved projects, and save/delete/browse actions. When `subagentCount > 0`, shows a ◈ button that toggles the SubagentMonitorPanel.

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

**Props:** `streaming: boolean`, `models: ProviderModelFlat[]`, `modelId: number | null`

**Emits:** `update:modelId`, `submit(text)`, `stop`, `openSessions`

Owns its own `input` ref and text state. Emits `submit` with trimmed text on form submit. Contains `<SlashMenu>` with full keyboard navigation (ArrowUp/Down/Enter/Escape). Computes `slashCommands` from static entries (`/plan`, `/resume-plan`, `/help`, `/clear`) plus dynamic `/agent <slug>` per enabled profile (loaded from `useAgentProfilesStore`). Filters commands by current input prefix. Contains `<ModelSelector>`, sessions button, and streaming dots animation.

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

`/settings/:tab` route. Tabbed host that renders one of `ProvidersView`, `AgentsView`, `ToolsView`, `UsageView`, `MemoryView`, `PermissionView` based on the `:tab` param, plus a general tab with version and health check status (pings `GET /api/health`) and an `agent.autoDispatch` toggle (persisted via `PATCH /api/settings/agent.autoDispatch`).

---

## AgentsView.vue

`agents` settings tab. Lists agent profiles from `useAgentProfilesStore` (`GET /api/agent-profiles`); create/edit in a `BaseModal` (name, slug, description, systemPrompt, allowedTools, model via `ModelSelector`, enabled). `allowedTools` is edited via a "Chọn công cụ" button that opens `ToolPickerModal`; the chosen tool names render as removable chips (empty selection ⇒ `*` / all tools, shown as "Tất cả công cụ"). Toggle enable/disable inline; delete non-builtin profiles via `BaseConfirmModal` (builtin profiles are read-only — no delete, slug locked on edit).

---

## ToolPickerModal.vue

**Props:** `modelValue: boolean`, `selected: string[]`

**Emits:** `update:modelValue`, `confirm(tools: string[])`

`BaseModal` listing all registry tools (`GET /api/tools`, loaded once) with a filter input and a checkbox per tool. Initializes checked state from `selected` each open; "Thêm" emits `confirm` with the checked names and closes. Used by `AgentsView` to pick a profile's allowed tools.

---

## SlashMenu.vue

Slash-command autocomplete dropdown. Purely presentational — receives `commands` as a prop from `ChatInputBar.vue`, which provides static entries (`/plan`, `/resume-plan`, `/help`, `/clear`) plus dynamic `/agent <slug>` entries per enabled profile. Keyboard navigation handled by parent.

---

## SubagentMonitorPanel.vue

**Props:** `visible: boolean`, `sessions: SubagentSession[]`

**Emits:** `close`

Right-side collapsible panel for live sub-agent monitoring. Each active/completed sub-agent spawn is a `SubagentSession` card with a log area showing thinking, tool calls, tool results, token stream, and completion status. Auto-scrolls on new log entries. Session identity comes from `subagentRunId` in SSE events (set by backend).

---

## Design Rules

> Theme: **GitHub Light**. Default Tailwind palette + Headless UI primitives. Light/white surfaces, no `cyber-*` tokens in components.

| Rule | Value |
|---|---|
| Font | `font-sans` (GitHub system stack) for UI chrome; `font-mono` only for code, terminal/chat input, logs, file paths. |
| Surfaces | Page `bg-gray-50`, panels/cards/headers `bg-white`. Dividers `border-gray-200`, inputs `border-gray-300`. |
| Text | Primary `text-gray-900`, secondary `text-gray-600`, muted `text-gray-500`. |
| Accent | `blue-600` links/active; `bg-blue-600 text-white` primary buttons. Success `green-600`, warning `amber-600`, danger `red-600`. |
| Border radius | `rounded-md` (6px) for controls, inputs, cards, modals. |
| Shadows | Subtle only — `shadow-sm` on hover cards, `shadow-lg`/`shadow-xl` on popovers & modals. |
| Gradients | Forbidden |
| Animations | `animate-blink` (cursor), `animate-dot-pulse` (streaming). `transition-colors duration-150` on interactive elements |
| Icons | `vue-icons-plus/hi` (Hero Icons). No inline SVG |
| Buttons | Text labels for action buttons. Delete: `text-red-600 rounded-md border border-red-300 hover:bg-red-50`. Secondary outline: `text-blue-600 rounded-md border border-blue-600/30 hover:bg-blue-50`. Primary solid: `text-white bg-blue-600 rounded-md hover:bg-blue-700`. |
| Cards | Flex column (`flex flex-col`). `border border-gray-200 rounded-md bg-white`. Action buttons bottom-right (`mt-auto justify-end`). |
| Inputs | `bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500`. |
| Modals/selects | Built on Headless UI (`@headlessui/vue`): `Dialog`/`TransitionRoot` (`BaseModal`), `Listbox` (`BaseSelect`). |
| Text size | `text-sm` for body; `text-xs` allowed for meta/badges. |

## Header Pattern (standard cho mọi màn hình)

```html
<div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-gray-200 shrink-0 bg-white">
  <Icon class="w-4 h-4 text-gray-400" />
  <span class="text-sm text-gray-900 font-semibold">{{ t('view.header') }}</span>
  <button class="ml-auto text-sm text-blue-600 px-2.5 py-1 rounded-md border border-blue-600/30 transition-colors duration-150 hover:bg-blue-50">
    {{ t('view.action') }}
  </button>
</div>
```

- Chiều cao cố định `h-[3rem]`
- Icon (muted `text-gray-400`) + title (`text-gray-900 font-semibold`) bên trái, action button `ml-auto` bên phải
- Button style: `text-blue-600 rounded-md border border-blue-600/30 hover:bg-blue-50`

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
