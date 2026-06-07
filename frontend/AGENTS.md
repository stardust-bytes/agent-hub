# Frontend — Agent Context

Local-First AI Agent Workspace · Vue 3 SPA.

## What this is

Single-page application with a 3-panel IDE layout: icon sidebar + chat panel (45%) + artifacts panel (flex-1). Served by Nginx on port 3000 in production, Vite dev server on port 5173 locally. Proxies `/api` requests to the NestJS backend on port 3001.

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

---

## Color Tokens (tailwind.config.ts)

| Token | Hex / Value | Usage |
|---|---|---|
| `cyber-bg` | `#000000` | Page background |
| `cyber-dark` | `#111111` | Panel backgrounds, cards |
| `cyber-status` | `#161616` | Status bar |
| `cyber-accent` | `#3B82F6` | Primary accent (blue), borders, interactive elements |
| `cyber-green` | `#22C55E` | Success, connected state |
| `cyber-blue` | `#3B82F6` | Alias for accent |

**Font:** `font-mono` everywhere. Stack: JetBrains Mono → Fira Code → Courier New.

**Border radius:** Max `rounded` (4px). Never `rounded-lg` or larger.

**No shadows. No gradients.**

---

## Component Hierarchy

```
App.vue
└── AppShell.vue
    ├── SidebarNav.vue       — 52px icon column, navigation + VI/EN toggle + health dot
    ├── ChatPanel.vue        — 45% width, message history + SSE streaming + input
    ├── ArtifactsPanel.vue   — flex-1, displays last agent reply
    ├── TasksView.vue        — full-width when activeView === 'tasks'
    ├── SettingsView.vue     — full-width when activeView === 'settings'
    ├── FilesView.vue        — full-width when activeView === 'files'
    ├── SessionModal.vue     — session list modal (teleported to body)
    ├── ModelSelector.vue    — Ollama model dropdown
    └── StatusBar.vue        — bottom bar: model, DB, WS status, clock
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
    ├── ChatPanel.vue
    ├── ArtifactsPanel.vue
    ├── TasksView.vue
    ├── SettingsView.vue
    ├── FilesView.vue
    ├── SessionModal.vue
    ├── ModelSelector.vue
    └── StatusBar.vue
```

---

## ChatPanel.vue — SSE Event Handling

The chat panel reads an SSE stream from `POST /api/agent/chat` and handles these event types:

| Event | Frontend Handling |
|---|---|
| `token` | Append to current agent message (lazy-created on first token) |
| `toolCall` | Reset currentAgentIdx, push tool call notification message |
| `toolResult` | Push tool result message with raw text |
| `thinking` | Reset currentAgentIdx, push thinking indicator message |
| `[DONE]` | Stop stream, set agent message typing=false |
| `error` | Push error system message |

**Message ordering:** Agent message is NOT created upfront — created lazily on first `token` event. This ensures tool call/result/thinking messages always appear BEFORE the agent response text.

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
