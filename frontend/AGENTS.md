# Frontend — Agent Context

Local-First AI Agent Workspace · Vue 3 SPA.

## What this is

Single-page application with a multi-panel IDE layout: icon sidebar + content panel + bottom tab bar (mobile). Served by Nginx on port 17135 in production, Vite dev server on port 17135 locally. Proxies `/api` requests to the NestJS backend on port 13596.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Build | Vite |
| Styling | TailwindCSS (default palette, GitHub-light) + Headless UI (`@headlessui/vue`) + `.markdown-body` CSS |
| i18n | vue-i18n v9 (`legacy: false`, Composition API mode) |
| Type safety | TypeScript strict |
| Sanitization | DOMPurify — required on every `v-html` binding |
| Markdown | `marked` + `DOMPurify` via `renderMarkdown()` |
| Icons | `vue-icons-plus/hi` (Hero Icons) |
| Routing | `vue-router` (`src/router/index.ts`) |
| WebSocket | `socket.io-client` (notes & memories real-time sync) |
| State management | Pinia — domain stores in `src/stores/` |
| Testing | Vitest — co-located `*.spec.ts` files |

---

## Theme: GitHub Light

The UI uses the **default Tailwind palette** (GitHub-light flavored) directly in components — not custom `cyber-*` tokens. Interactive primitives are built on **Headless UI** (`@headlessui/vue`).

| Role | Tailwind class | Usage |
|---|---|---|
| Page | `bg-gray-50` | App / view background |
| Surface | `bg-white` | Panels, cards, headers, sidebar, modals |
| Divider | `border-gray-200` | Panel/section dividers |
| Input border | `border-gray-300` | Inputs, selects, secondary buttons |
| Accent | `blue-600` | Links, active state, primary buttons |
| Success | `green-600` | Connected / SUCCESS |
| Warning | `amber-600` | Processing / pending |
| Danger | `red-600` | Errors, delete |
| Text primary | `text-gray-900` | Headings, body |
| Text secondary | `text-gray-600` | Supporting text |
| Text muted | `text-gray-500` | Dimmed/meta |
| Code surface | `bg-gray-50` / `bg-gray-100` | Code blocks, terminal panes (mono) |

> Legacy `cyber-*` / `gh-*` tokens remain defined in `tailwind.config.ts` only as a safety net; do not use them in new components.

**Font:** `font-sans` (GitHub system stack: `-apple-system, BlinkMacSystemFont, "Segoe UI"…`) for UI chrome. `font-mono` (JetBrains Mono) only for code, terminal/chat input, logs, and file paths.

**Border radius:** `rounded-md` (6px) for controls, inputs, cards, and modals.

**Shadows:** subtle only — `shadow-sm` on hover cards, `shadow-lg`/`shadow-xl` on popovers & modals. **No gradients.**

---

## Component Hierarchy

```
App.vue
└── AppShell.vue
    ├── SidebarNav.vue       — desktop icon column, RouterLink nav + VI/EN toggle
    ├── <router-view>        — active screen by URL (see src/router/index.ts)
    │   ├── CoworkView.vue       — /cowork: project + chat + artifacts (cowork/ subcomponents)
    │   ├── ScheduleTasksView.vue — /tasks: scheduled task list
    │   ├── ScheduleTaskDetailView.vue — /tasks/:id: task detail + run logs
    │   ├── NotesView.vue        — /notes: markdown notes CRUD (Socket.io)
    │   ├── ConnectorsView.vue   — /connectors: Google connectors + OAuth
    │   ├── AgentOutputView.vue  — /agent-output: list + download agent files
    │   ├── PlansView.vue        — /plans: execution plan list
    │   ├── OAuthCallbackPage.vue — /oauth/callback: OAuth redirect handler
    │   └── SettingsView.vue     — /settings/:tab: tabbed host
    │       ├── ProvidersView.vue — LLM provider CRUD + model management
    │       ├── AgentsView.vue    — agent profile CRUD (system prompt + scoped tools)
    │       ├── ToolsView.vue     — tool registry toggle + config
    │       ├── UsageView.vue     — token usage totals + per-session
    │       ├── MemoryView.vue    — memory CRUD with type filter, search
    │       └── PermissionView.vue — tool permission / YOLO config
    ├── BottomTabBar.vue     — mobile navigation (visible < md)
    └── StatusBar.vue        — bottom bar: model, DB, WS status, clock

SessionModal.vue             — session list modal (teleported, BaseModal wrapper)
ModelSelector.vue            — model dropdown (uses BaseSelect)
ProviderFormModal.vue        — create/edit provider form modal (uses BaseModal)
NoteModal.vue                — create/edit note modal
ToolConfigModal.vue          — per-tool config editor

BaseSelect.vue               — reusable styled select component
BaseModal.vue                — reusable modal shell (Teleport, slots for header/body/footer)
BaseConfirmModal.vue         — confirm dialog (uses BaseModal)
```

---

## File Structure

```
src/
├── App.vue
├── main.ts              — createApp + use(createPinia()) + use(router) + use(i18n) + mount('#app')
├── i18n.ts              — createI18n instance
├── router/
│   └── index.ts         — vue-router routes (createWebHistory)
├── config/
│   └── navigation.ts    — NAV map + sidebarItems / bottomItems (back-compat) + navGroups (grouped nav, consumed by SidebarNav/CommandPalette)
├── assets/
│   └── main.css         — Tailwind imports + scrollbar + .markdown-body styles
├── locales/
│   ├── vi.json          — Vietnamese (primary, default)
│   └── en.json          — English (secondary/fallback)
├── api/                 — typed API call layer; client.ts adds /api prefix and throws AppError(code) mapped to i18n
│   ├── client.ts        — base request(), AppError class, fallback codes errors.network / errors.request
│   └── *.ts             — one module per domain (providers, sessions, scheduleTasks, notes, connectors, …)
├── stores/              — Pinia domain stores; components read/write data exclusively through these
│   └── *.ts             — agentProfiles, connectors, memories, notes, providers, sessions, ui
├── composables/         — shared composables extracted from components
│   ├── useChatStream.ts        — SSE stream parser (parseSseStream) + SseCallbacks interface
│   └── useSessionMessages.ts   — session history loader (loadSessionMessages)
└── components/          — see components/AGENTS.md for the full map
    ├── AppShell.vue, SidebarNav.vue, BottomTabBar.vue, StatusBar.vue
    ├── CoworkView.vue + cowork/ (MessageList, MessageItem, ChatInputBar, ProjectBar, markdown.ts, types.ts)
    ├── ArtifactsPanel.vue, FileTree.vue, FilesView.vue, DirectoryBrowser.vue
    ├── ToolApprovalBar.vue, SlashMenu.vue, PlanBubble.vue
    ├── ScheduleTasksView.vue, ScheduleTaskDetailView.vue
    ├── NotesView.vue, NoteModal.vue, ConnectorsView.vue, OAuthCallbackPage.vue
    ├── AgentOutputView.vue, PlansView.vue
    ├── SettingsView.vue → ProvidersView, ToolsView, UsageView, MemoryView, PermissionView
    ├── ProviderFormModal.vue, ToolConfigModal.vue, SessionModal.vue, ModelSelector.vue, FormBlock.vue
    └── BaseModal.vue, BaseConfirmModal.vue, BaseSelect.vue
```

---

## CoworkView.vue — SSE Event Handling

The chat panel reads an SSE stream from `POST /api/agent/chat` using the Fetch API `ReadableStream` reader and handles these event types:

| Event | Frontend Handling |
|---|---|
| `token` | Append to current agent message (lazy-created on first token) |
| `toolCall` | Reset currentAgentIdx, push tool call notification message |
| `toolResult` | Push tool result message with raw text |
| `thinking` | Reset currentAgentIdx, push thinking indicator message |
| `[DONE]` | Stop stream, set agent message typing=false |
| `error` | Push error system message |
| `plan` | Push plan chat message with PlanBubble component |
| `planStepUpdate` | Update step status in-place on existing PlanBubble |
| `planInterrupted` | Push system message: "[⏹ Plan execution interrupted...]" |

**Message ordering:** Agent message is NOT created upfront — created lazily on first `token` event. This ensures tool call/result/thinking messages always appear BEFORE the agent response text.

**Model selection:** Fetches available models from `GET /api/providers/models` (flat list with provider name). Selected model ID persists to `localStorage('workspace.modelId')`.

**Mode toggle:** Agent mode (ReAct loop with tools) vs Chat mode (plain conversation).

---

## i18n

All components use `useI18n()` with `t('key')`. Never hardcode user-facing strings.

Language toggle persists to `localStorage('workspace.lang')` (values: `'vi'` | `'en'`).

---

## Security Rules

- Every `v-html` binding must sanitize with `DOMPurify.sanitize()` first
- Never bind unsanitized user content to `v-html`

---

## Commands

```bash
npm run dev              # Hot reload, port 17135
npm run type-check       # vue-tsc --noEmit
npm run build            # Production build to dist/
npm run preview          # Preview production build
```

---

## Coding Rules

1. **`<script setup>` always** — no Options API.
2. **`font-sans`** for UI chrome; `font-mono` only for code, terminal/chat input, logs, file paths.
3. **`rounded-md`** (6px) for controls, inputs, cards, modals.
4. **Subtle shadows only** (popovers/modals/hover cards); no gradients.
5. **Default Tailwind palette** (`bg-white`, `text-gray-900`, `border-gray-200`, `blue-600`…); no `cyber-*` tokens in components.
6. **Headless UI** for interactive primitives (modal/select); see `BaseModal`, `BaseSelect`.
7. **No `any` types** — TypeScript strict throughout.
8. **i18n required** — all user-facing strings via `t('key')`.
9. **Icons** — `vue-icons-plus/hi` (Hero Icons). No inline SVG.
