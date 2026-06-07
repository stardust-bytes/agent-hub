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
| Styling | TailwindCSS — custom `cyber-*` color tokens |
| i18n | vue-i18n v9 (`legacy: false`, Composition API mode) |
| Type safety | TypeScript strict |
| Sanitization | DOMPurify — required on every `v-html` binding |

---

## Color Tokens (tailwind.config.ts)

Always use these tokens. Never use raw hex values in components.

| Token | Hex / Value | Usage |
|---|---|---|
| `cyber-bg` | `#000000` | Page background |
| `cyber-dark` | `#141414` | Panel backgrounds, cards |
| `cyber-accent` | `#3B82F6` | Primary accent (blue), borders, interactive elements |
| `cyber-border` | `rgba(59,130,246,0.13)` | Subtle dividers |
| `cyber-dim` | `rgba(59,130,246,0.33)` | Hover states, secondary borders |
| `cyber-orange` | `#FFA500` | Warnings, agent prefix color |
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
    ├── SidebarNav.vue    — 52px icon column, navigation + VI/EN toggle
    ├── ChatPanel.vue     — 45% width, message history + input
    └── ArtifactsPanel.vue — flex-1, displays last agent reply
```

**Layout rule:** When `activeView === 'tasks'` (Phase 3), ChatPanel and ArtifactsPanel are hidden and a full-width `TasksView` takes their place. SidebarNav is always visible.

---

## File Structure

```
src/
├── App.vue              — mounts AppShell
├── main.ts              — createApp + app.use(i18n) + app.mount('#app')
├── i18n.ts              — createI18n instance (see below)
├── assets/
│   └── main.css         — Tailwind @base/@components/@utilities imports
├── locales/
│   ├── vi.json          — Vietnamese (primary, default)
│   └── en.json          — English (secondary/fallback)
└── components/
    ├── AppShell.vue
    ├── SidebarNav.vue
    ├── ChatPanel.vue
    └── ArtifactsPanel.vue
```

---

## i18n Setup

**`src/i18n.ts`:**
```ts
import { createI18n } from 'vue-i18n'
import vi from './locales/vi.json'
import en from './locales/en.json'

const savedLang = localStorage.getItem('workspace.lang') ?? 'vi'

export const i18n = createI18n({
  legacy: false,          // Composition API mode — required
  locale: savedLang,
  fallbackLocale: 'en',
  messages: { vi, en },
})

export type Locale = 'vi' | 'en'
```

**In components:**
```ts
import { useI18n } from 'vue-i18n'
const { t, locale } = useI18n()
```

**Never** hardcode user-facing strings in `.vue` files. All strings go through `t('key')`.

**Language toggle** (SidebarNav):
```ts
function toggleLang() {
  const next: Locale = locale.value === 'vi' ? 'en' : 'vi'
  locale.value = next
  localStorage.setItem('workspace.lang', next)
}
```

**localStorage key:** `workspace.lang` — values: `'vi'` | `'en'`

---

## Locale Keys (21 keys each)

| Key | vi | en |
|---|---|---|
| `nav.chat` | Trò chuyện | Chat |
| `nav.tasks` | Nhiệm vụ | Tasks |
| `nav.files` | Tệp tin | Files |
| `nav.settings` | Cài đặt | Settings |
| `nav.lang` | VI | EN |
| `chat.header` | AGENT CHAT | AGENT CHAT |
| `chat.mode.stub` | chế độ stub | stub mode |
| `chat.placeholder` | nhập lệnh hoặc câu hỏi_ | type a command or question_ |
| `chat.system.init` | Agent đã khởi động... | Agent initialized... |
| `chat.user.prefix` | $ người dùng | $ user |
| `chat.agent.prefix` | ▶ agent | ▶ agent |
| `chat.system.prefix` | [hệ thống] | [system] |
| `chat.error.unreachable` | [lỗi] Không kết nối... | [error] Could not reach... |
| `chat.loading` | … | … |
| `artifacts.header` | KẾT QUẢ | ARTIFACTS |
| `artifacts.empty` | ◈ Chưa có kết quả | ◈ No artifacts yet |
| `artifacts.label.lastReply` | phản hồi cuối | last reply |
| `health.checking` | Đang kiểm tra... | Checking backend... |
| `health.ok` | Backend: hoạt động · DB: đã kết nối | Backend: ok · DB: connected |
| `health.error` | Không kết nối được backend | Backend unreachable |

---

## API Proxy

`vite.config.ts` proxies to backend:
```
/api  →  http://localhost:3001
/socket.io  →  http://localhost:3001  (WebSocket, for Phase 3)
```

In production, Nginx handles the same proxy rules (see `nginx.conf`).

**Base URL for fetch:** just `/api/...` — no hostname needed.

---

## Security Rules

- **Every `v-html` binding** must sanitize with DOMPurify first:
  ```ts
  import DOMPurify from 'dompurify'
  const safeHtml = DOMPurify.sanitize(rawHtml)
  ```
- Never bind unsanitized user content to `v-html`.

---

## Date Formatting

Display dates as DD/MM/YYYY. Format times with:
```ts
new Date().toLocaleTimeString('vi-VN', { hour12: false })
```

---

## Commands

```bash
# Development (hot reload, port 5173)
npm run dev

# Type check
npm run type-check

# Production build
npm run build           # outputs to dist/

# Preview production build
npm run preview
```

---

## Coding Rules

1. **`<script setup>` always** — no Options API.
2. **`font-mono`** on every text element. Never use system sans-serif.
3. **`cyber-*` tokens only** — see color table above. No raw hex.
4. **`rounded` max** — 4px border radius. Never `rounded-lg` or `rounded-xl`.
5. **No shadows, no gradients.**
6. **No `any` types** — TypeScript strict throughout.
7. **No comments** unless the WHY is non-obvious.
8. **i18n required** — all user-facing strings via `t('key')`.

---

## Upcoming Phases (context for what NOT to break)

| Phase | Feature | Frontend impact |
|---|---|---|
| 2 | Ollama streaming | ChatPanel reads SSE stream instead of single POST response |
| 3 | Kanban | New `TasksView.vue` full-width when `activeView === 'tasks'`; Socket.io client |
| 4 | Settings | New `SettingsView.vue`, `activeView === 'settings'` |
| 5 | RAG | File upload UI, indexing progress in ArtifactsPanel |
| 6 | Agent tools | Tool call display cards in ArtifactsPanel |
