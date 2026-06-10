# Frontend — Agent Context

Local-First AI Agent Workspace · Vue 3 SPA.

## What this is

Single-page application with a multi-panel IDE layout: icon sidebar + content panel + bottom tab bar (mobile). Served by Nginx on port 3000 in production, Vite dev server on port 5173 locally. Proxies `/api` requests to the NestJS backend on port 3001.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Build | Vite |
| Styling | TailwindCSS — custom `cyber-*` color tokens + `.markdown-body` CSS |
| i18n | vue-i18n v9 (`legacy: false`, Composition API mode) |
| Type safety | TypeScript strict |
| Sanitization | DOMPurify — required on every `v-html` binding |
| Markdown | `marked` + `DOMPurify` via `renderMarkdown()` |
| Icons | `vue-icons-plus/hi` (Hero Icons) |
| Drag & drop | `vue-draggable-plus` (Kanban) |
| WebSocket | `socket.io-client` (task real-time sync) |

---

## Color Tokens (tailwind.config.ts)

| Token | Hex / Value | Usage |
|---|---|---|
| `cyber-bg` | `#000000` | Page background |
| `cyber-dark` | `#111111` | Panel backgrounds, cards |
| `cyber-status` | `#161616` | Status bar |
| `cyber-modal-bg` | `#0a0e1a` | Modal backgrounds |
| `cyber-accent` | `#3B82F6` | Primary accent (blue), borders, interactive elements |
| `cyber-green` | `#22C55E` | Success, connected state |
| `cyber-blue` | `#3B82F6` | Alias for accent |
| `cyber-muted` | `#888888` | Dimmed/secondary text |
| `cyber-text` | `#EEEEEE` | Primary text |
| `cyber-orange` | `#FFA500` | Warning, processing state |
| `cyber-cyan` | `#00d4ff` | Secondary accent, headings |
| `cyber-link` | `#58a6ff` | Links |
| `cyber-code-bg` | `#0d1117` | Code block background |
| `cyber-code-border` | `#30363d` | Code block borders |
| `cyber-code-text` | `#e6edf3` | Code text |
| `cyber-row` | `#161b22` | Table rows |

**Font:** `font-mono` everywhere. Stack: JetBrains Mono → Fira Code → Courier New (via Google Fonts).

**Border radius:** Max `rounded` (4px). Never `rounded-lg` or larger.

**No shadows. No gradients.**

---

## Component Hierarchy

```
App.vue
└── AppShell.vue
    ├── SidebarNav.vue       — 32px/52px icon column (desktop), navigation + VI/EN toggle
    ├── [Content area]
    │   ├── ChatPanel.vue        — message history + SSE streaming + input (default view)
    │   ├── TasksView.vue        — priority filter bar + KanbanBoard
    │   ├── NotesView.vue        — markdown notes CRUD
    │   ├── PlansView.vue        — execution plan management
    │   ├── FilesView.vue        — knowledge base upload + codebase watcher
    │   ├── ToolsView.vue        — tool registry
    │   ├── SettingsView.vue     — health check + version info
    │   └── ProvidersView.vue    — LLM provider CRUD + model management
    ├── BottomTabBar.vue     — mobile navigation (visible < sm)
    └── StatusBar.vue        — bottom bar: model, DB, WS status, clock

KanbanBoard.vue              — drag-and-drop column layout, Socket.io real-time sync
├── TaskCard.vue             — individual task card with priority indicator
│   └── TaskCardMenu.vue     — priority picker + delete action

SessionModal.vue             — session list modal (teleported, BaseModal wrapper)
ModelSelector.vue            — model dropdown (uses BaseSelect)
ProviderFormModal.vue        — create/edit provider form modal (uses BaseModal)

BaseSelect.vue               — reusable styled select component
BaseModal.vue                — reusable modal shell (Teleport, slots for header/body/footer)
```

---

## File Structure

```
src/
├── App.vue
├── main.ts              — createApp + app.use(i18n) + app.mount('#app')
├── i18n.ts              — createI18n instance
├── assets/
│   └── main.css         — Tailwind imports + scrollbar + .markdown-body styles
├── locales/
│   ├── vi.json          — Vietnamese (primary, default)
│   └── en.json          — English (secondary/fallback)
└── components/
    ├── AppShell.vue
    ├── SidebarNav.vue
    ├── BottomTabBar.vue
    ├── ChatPanel.vue
    ├── TasksView.vue
    ├── KanbanBoard.vue
    ├── TaskCard.vue
    ├── TaskCardMenu.vue
    ├── FilesView.vue
    ├── SettingsView.vue
    ├── PlansView.vue
    ├── ProvidersView.vue
    ├── ProviderFormModal.vue
    ├── SessionModal.vue
    ├── ModelSelector.vue
    ├── BaseSelect.vue
    ├── BaseModal.vue
    └── StatusBar.vue
```

---

## ChatPanel.vue — SSE Event Handling

The chat panel reads an SSE stream from `POST /api/agent/chat` using the Fetch API `ReadableStream` reader and handles these event types:

| Event | Frontend Handling |
|---|---|
| `token` | Append to current agent message (lazy-created on first token) |
| `toolCall` | Reset currentAgentIdx, push tool call notification message |
| `toolResult` | Push tool result message with raw text |
| `thinking` | Reset currentAgentIdx, push thinking indicator message |
| `[DONE]` | Stop stream, set agent message typing=false |
| `error` | Push error system message |

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
npm run dev              # Hot reload, port 5173
npm run type-check       # vue-tsc --noEmit
npm run build            # Production build to dist/
npm run preview          # Preview production build
```

---

## Coding Rules

1. **`<script setup>` always** — no Options API.
2. **`font-mono`** on every text element. Never use system sans-serif.
3. **`rounded` max** — 4px border radius.
4. **No shadows, no gradients.**
5. **No `any` types** — TypeScript strict throughout.
6. **i18n required** — all user-facing strings via `t('key')`.
7. **Icons** — `vue-icons-plus/hi` (Hero Icons). No inline SVG.
