# components/ — Agent Context

All UI components for the AI Workspace. The layout is a Mintlify-style shell: TopBar + grouped sidebar (desktop) + router-view content column + StatusBar + ⌘K command palette. Routing is handled by `vue-router` (`src/router/index.ts`); settings sub-screens are routed as `/settings/:tab` and listed in the sidebar Config group.

## Component Map

```
AppShell.vue              — layout shell, hosts TopBar + SidebarNav + router-view + StatusBar + CommandPalette
├── TopBar.vue            — top bar: brand, ⌘K search trigger, ThemeToggle, lang toggle, settings
├── SidebarNav.vue        — grouped desktop nav column, RouterLink items from config/navigation navGroups
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
│   ├── OAuthCallbackPage.vue   — /oauth/callback: OAuth redirect handler (state+code → confirmOAuth)
│   └── SettingsView.vue        — /settings/:tab: tabbed settings host
│       ├── ProvidersView.vue   — LLM provider CRUD + model management (uses ProviderFormModal)
│       ├── AgentsView.vue      — agent profile CRUD (uses ModelSelector + BaseConfirmModal)
│       ├── ToolsView.vue       — tool registry toggle + config (uses ToolConfigModal)
│       ├── UsageView.vue       — token usage totals + per-session breakdown
│       ├── MemoryView.vue      — memory CRUD with type filter, search, auto-extracted badge
│       └── PermissionView.vue  — tool permission / YOLO config
├── StatusBar.vue        — bottom bar: backend status, DB status, sub-agent count, live clock
└── CommandPalette.vue   — ⌘K global command palette (Headless UI Dialog + Combobox)

Shared/reusable:
ThemeToggle.vue              — light/dark toggle button (used by TopBar)
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

**Layout:** TopBar → flex flex-1 (SidebarNav + `<router-view>`) + StatusBar + CommandPalette.

**Routing:** `<router-view>` renders the active view based on the current URL. `watch(route.fullPath)` closes the mobile sidebar on navigation.

---

## SidebarNav.vue

**Props:** none

**Emits:** none

**Navigation:** Renders `sidebarItems` from `config/navigation.ts` as `<RouterLink>` elements. Active state derived from `useRoute().name`. Settings rendered as a separate `<RouterLink>` at the bottom. Items: cowork, tasks, notes, connectors, agent-output (settings separate).

Visible on desktop only (`hidden xl:flex`, `w-60`).

---

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

> Theme: **Semantic Tokens** (Mintlify-style). CSS variable tokens via `rgb(var(--name))` + `darkMode: 'class'`. No Tailwind color literals in components — use `bg-surface`, `text-foreground`, `border-border`, `bg-primary`, etc.

| Rule | Value |
|---|---|
| Font | `font-sans` (Inter stack) for UI chrome; `font-mono` (JetBrains Mono) only for code, terminal/chat input, logs, file paths. |
| Background | `bg-background` (page root), `bg-surface` (panels/cards/headers), `bg-muted` (hover/inset/code), `bg-elevated` (modals/popovers). |
| Dividers | `border-border` (panel/section dividers), `border-input` (inputs, selects). |
| Text | `text-foreground` (primary), `text-muted-foreground` (secondary/muted). |
| Accent | `text-primary` / `bg-primary text-primary-foreground` for links/buttons; `bg-primary/10` for active/hover tint. |
| Status | `text-success` (connected), `text-warning` (pending), `text-danger` (errors/delete). |
| Border radius | `rounded-lg` (8px) for controls, inputs, cards; `rounded-xl` for modals. |
| Shadows | Subtle only — `shadow-sm` on hover cards, `shadow-lg` on popovers/menus, `shadow-xl` on modals. |
| Gradients | Forbidden |
| Animations | `animate-blink` (cursor), `animate-dot-pulse` (streaming). `transition-colors duration-150` on interactive elements |
| Icons | `vue-icons-plus/hi` (Hero Icons). No inline SVG |
| Buttons | Primary recipe: `inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90`. Secondary: `inline-flex items-center gap-1.5 rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-foreground transition-colors duration-150 hover:bg-muted`. Delete: `rounded-lg border border-danger/40 px-2.5 py-1 text-sm text-danger transition-colors duration-150 hover:bg-danger/10`. |
| Cards | `flex flex-col rounded-lg border border-border bg-surface p-3 transition-shadow hover:shadow-sm`. |
| Inputs | `w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring`. |
| Modals/selects | Built on Headless UI (`@headlessui/vue`): `Dialog`/`TransitionRoot` (`BaseModal`), `Listbox` (`BaseSelect`). |
| Text size | `text-sm` for body; `text-xs` allowed for meta/badges. |

## Header Pattern (seamless — no border between header and content)

All pages use a seamless layout where header and content share the same `mx-auto max-w-5xl w-full px-6` container. No `border-b` separates them.

### A. List view (ScheduleTasks, Notes, AgentOutput, Connectors, Files)

```html
<div class="mx-auto max-w-5xl w-full px-6 pt-5 pb-4">
  <div class="flex items-center gap-3">
    <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
      <HiIcon class="w-4 h-4" />
    </div>
    <span class="text-base font-semibold text-foreground">{{ t('view.header') }}</span>
    <span class="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">badge</span>
    <div class="ml-auto">
      <button class="text-sm rounded-lg border border-primary/30 text-primary hover:bg-primary/10 px-2.5 py-1">{{ t('view.action') }}</button>
    </div>
  </div>
</div>
<div class="flex-1 overflow-y-auto mx-auto max-w-5xl w-full px-6 pb-6">
  (content)
</div>
```

### B. Detail view (ScheduleTaskDetail)

```html
<div class="mx-auto max-w-5xl w-full px-6 pt-4 pb-4">
  <div class="flex items-center gap-1 text-xs font-mono text-muted-foreground mb-2">
    <span class="hover:text-primary">Parent</span>
    <span class="text-input">/</span>
    <span class="text-foreground">Current</span>
  </div>
  <div class="flex items-center gap-3">
    <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
      <HiIcon class="w-4 h-4" />
    </div>
    <span class="text-lg font-bold text-foreground tracking-tight">Title</span>
    <span class="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">N runs</span>
    <div class="ml-auto flex gap-2">
      <button class="secondary-recipe">{{ t('view.secondary') }}</button>
      <button class="primary-recipe">{{ t('view.primary') }}</button>
    </div>
  </div>
</div>
```

### C. Settings tab bar

```html
<div class="mx-auto max-w-5xl w-full px-6 pt-5 pb-0">
  <div class="flex items-center gap-3">
    <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
      <HiCog class="w-4 h-4" />
    </div>
    <span class="text-base font-semibold text-foreground">{{ t('settings.header') }}</span>
  </div>
</div>
<div class="mx-auto max-w-5xl w-full px-6">
  <div class="flex gap-0 border-b border-border">
    <button class="font-mono text-sm px-3 py-1.5 text-muted-foreground hover:text-foreground">Tab</button>
    <button class="font-mono text-sm px-3 py-1.5 text-primary border-b-2 border-primary">Active</button>
  </div>
</div>
```

### D. CoworkView ProjectBar

CoworkView uses a `ProjectBar` instead of a standard header. Styled consistently with icon box + path segments + status badge:

```html
<div class="flex items-center gap-3 px-6 py-3">
  <div class="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
    <svg><!-- folder icon --></svg>
  </div>
  <span class="w-2 h-2 rounded-full bg-success"></span>
  <span class="font-mono text-sm"><span class="text-foreground font-medium">~/projects</span><span class="text-muted-foreground">/my-app</span></span>
</div>
```

**Rules:**
- No `border-b` between header and content (seamless flow)
- Header and content share `mx-auto max-w-5xl w-full px-6`
- Icon in `w-7 h-7 bg-primary/10 text-primary rounded-lg` accent box
- Action buttons: ghost recipe (`border border-primary/30 text-primary hover:bg-primary/10`) for secondary, primary recipe for CTA
- No `h-[3rem]` on page headers
- No `xl:pl-3 pl-10` legacy padding

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
