# components/ — Agent Context

All UI components for the AI Workspace. The layout is a 3-panel IDE: fixed icon sidebar + chat column (45%) + artifacts column (flex-1).

## Component Map

```
AppShell.vue         — layout coordinator, owns activeView state
├── SidebarNav.vue   — 52px icon column, emits navigate events, health dot, VI/EN toggle
├── ChatPanel.vue    — message history, command input, calls /api/agent/chat
└── ArtifactsPanel.vue — renders last agent reply (code blocks + prose markdown)
```

## AppShell.vue

**Owns:** `activeView` (`'chat' | 'tasks' | 'files'`), `lastAgentMessage`.

**Connects components:**
- Passes `activeView` to `SidebarNav` as prop.
- Listens to `@navigate` from `SidebarNav` → updates `activeView`.
- Listens to `@last-message` from `ChatPanel` → passes to `ArtifactsPanel` as `:last-message`.

**Phase 3 note:** When `activeView === 'tasks'`, hide `ChatPanel` + `ArtifactsPanel`, render full-width `TasksView` in their place. The `SidebarNav` stays visible always.

---

## SidebarNav.vue

**Props:** `activeView: 'chat' | 'tasks' | 'files'`

**Emits:** `navigate: [view: 'chat' | 'tasks' | 'files']`

**Responsibilities:**
- Navigation buttons for Chat, Tasks, Files (icons from `vue-icons-plus/hi`).
- Settings button (inactive — Phase 4).
- **`VI / EN` language toggle** at bottom — calls `toggleLang()`, persists to `localStorage('workspace.lang')`.
- **Health dot** — polls `GET /api/health` on mount. Green (`bg-cyber-green`) when `status === 'ok'`, red otherwise.

**Language toggle logic:**
```ts
const { t, locale } = useI18n()

function toggleLang() {
  const next: Locale = locale.value === 'vi' ? 'en' : 'vi'
  locale.value = next
  localStorage.setItem('workspace.lang', next)
}
```

The button renders `{{ t('nav.lang') }}` — shows `"VI"` when locale is `vi`, `"EN"` when `en`.

**Health check:**
```ts
onMounted(async () => {
  const res = await fetch('/api/health')
  const data = await res.json()
  isHealthy.value = data.status === 'ok'
})
```

---

## ChatPanel.vue

**Props:** none

**Emits:** `lastMessage: [content: string]` — fires after each successful agent reply.

**State:**
- `messages: Message[]` — array of `{ role, content, timestamp, typing? }`.
- `input: string` — bound to the command input.
- `loading: boolean` — disables input while waiting for response.

**Message roles:**
- `'user'` — text-slate-100, prefix from `t('chat.user.prefix')` = `"$ người dùng"` / `"$ user"`
- `'agent'` — text-slate-100, prefix from `t('chat.agent.prefix')`, typewriter effect on arrival
- `'system'` — text-cyber-orange/50, prefix from `t('chat.system.prefix')`

**Typewriter effect** (`typewriterAppend`): Appends characters one at a time with 18ms delay. Shows `█` cursor via `animate-blink` while `msg.typing === true`.

**Error handling:** On `fetch` failure, appends a `system` role message with `t('chat.error.unreachable')`. Never `console.error` only.

**Time format:** `new Date().toLocaleTimeString('vi-VN', { hour12: false })` — 24-hour.

**API call:**
```ts
POST /api/agent/chat
Body: { message: string }
Response: { reply: string, timestamp: string }
```

Phase 2 will change this to an SSE stream — the input/submission logic stays the same, the response reading changes.

---

## ArtifactsPanel.vue

**Props:** `lastMessage: string`

**Emits:** none

**Responsibilities:**
- Parses `lastMessage` to extract fenced code blocks (regex: `/```(\w*)\n([\s\S]*?)```/g`).
- Renders each code block in a `cyber-dark` container with a language label row.
- Renders remaining prose through `marked.parse()` → `DOMPurify.sanitize()` → `v-html`.
- Shows empty state (`t('artifacts.empty')`) when `lastMessage` is empty.

**Security invariant:** `v-html` binding MUST use `DOMPurify.sanitize(marked.parse(prose))`. This is already in place — do not remove it.

---

## Design Rules (apply to all components here)

| Rule | Value |
|---|---|
| Font | `font-mono` everywhere. Never sans or serif. |
| Background | `bg-cyber-bg` (`#000000`) for main areas, `bg-cyber-dark` (`#141414`) for panels/headers |
| Accent color | `text-cyber-accent`, `border-cyber-border`, `border-cyber-dim` — never raw hex |
| Orange (chat) | `text-cyber-orange` — used for chat headers, prefixes, cursor blink |
| Border radius | Max `rounded` (4px). Never `rounded-lg`, `rounded-xl` |
| Shadows | Forbidden (`shadow-*`) |
| Gradients | Forbidden |
| Animations | `animate-blink` for cursor only. `transition-colors duration-150` on interactive elements only |
| Icons | `vue-icons-plus/hi` (Hero Icons). No inline SVG |

## Adding a New View (Phase 3+ pattern)

1. Create `NewView.vue` in `components/`.
2. In `AppShell.vue`, add the view name to the `activeView` type union.
3. Conditionally render: `<NewView v-if="activeView === 'new'" class="flex-1" />`.
4. Pass the new nav item to `SidebarNav` or handle navigation in `AppShell`.
5. Add locale keys to `src/locales/vi.json` and `src/locales/en.json`.

## i18n in Components

All components use `useI18n()`:
```ts
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
```

Never hardcode user-facing strings. Always `t('key')`. See `src/locales/` for all 21 keys.
