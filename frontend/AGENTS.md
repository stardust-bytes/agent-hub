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

## Theme: Semantic Tokens (Mintlify-style)

Theming uses CSS variable semantic tokens defined in `main.css` (`:root` / `.dark`) and mapped to Tailwind via `rgb(var(--name) / <alpha-value>)`. Components use semantic utility classes only — no raw hex or Tailwind color literals. `darkMode: 'class'` toggles `.dark` on `<html>`. Interactive primitives are built on **Headless UI** (`@headlessui/vue`).

| Token | Light value | Dark value | Usage |
|---|---|---|---|
| `background` | `255 255 255` | `15 17 23` | View background |
| `surface` | `255 255 255` | `22 27 34` | Panels, cards, headers, sidebar, modals |
| `muted` | `249 250 251` | `26 32 40` | Hover rows, code/terminal, inset fills |
| `elevated` | `255 255 255` | `30 37 46` | Modals, dropdowns, popovers |
| `border` | `229 231 235` | `34 43 54` | Panel/section dividers |
| `input` | `209 213 219` | `48 58 70` | Inputs, selects, secondary buttons |
| `ring` | `59 130 246` | `59 130 246` | Input focus ring |
| `foreground` | `17 24 39` | `230 237 243` | Primary/code text |
| `muted-foreground` | `107 114 128` | `139 148 158` | Secondary/muted/meta text |
| `primary` | `37 99 235` | `59 130 246` | Links, active state, primary buttons |
| `primary-foreground` | `255 255 255` | `255 255 255` | Primary button label |
| `success` | `22 163 74` | `34 197 94` | Connected / SUCCESS |
| `warning` | `217 119 6` | `245 158 11` | Processing / pending |
| `danger` | `220 38 38` | `248 113 113` | Errors, delete |

**Font:** `font-sans` (Inter stack: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI"…`) for UI chrome. `font-mono` (`"JetBrains Mono"`, `"Fira Code"`, monospace) currently unused (all UI uses `font-sans`). Reserve for future code-specific display if needed.

**Border radius:** `rounded-lg` (8px) for controls, inputs, cards, modals; `rounded-xl` (12px) for modals.

**Shadows:** subtle only — `shadow-sm` on hover cards, `shadow-lg` on popovers/menus, `shadow-xl` on modals. **No gradients.**

---

## Component Hierarchy

```
App.vue
└── AppShell.vue
    ├── TopBar.vue           — top bar: brand, search trigger (⌘K), ThemeToggle, lang toggle, settings
    ├── SidebarNav.vue       — grouped desktop nav, RouterLink items from navGroups
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
    ├── StatusBar.vue        — bottom bar: backend status, DB status, sub-agent count, clock
    └── CommandPalette.vue   — ⌘K global command palette (Headless UI Dialog + Combobox)

ThemeToggle.vue              — light/dark toggle button (used by TopBar)
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
2. **`font-sans`** for all UI (no `font-mono` in components currently).
3. **`rounded-lg`** (8px) for controls, inputs, cards; `rounded-xl` for modals.
4. **Subtle shadows only** (popovers/modals/hover cards); no gradients.
5. **Semantic token utilities only** (`bg-surface`, `text-foreground`, `border-border`, `bg-primary`…); no Tailwind color literals or `cyber-*` tokens in components.
6. **Headless UI** for interactive primitives (modal/select); see `BaseModal`, `BaseSelect`.
7. **No `any` types** — TypeScript strict throughout.
8. **i18n required** — all user-facing strings via `t('key')`.
9. **Icons** — `vue-icons-plus/hi` (Hero Icons). No inline SVG.
