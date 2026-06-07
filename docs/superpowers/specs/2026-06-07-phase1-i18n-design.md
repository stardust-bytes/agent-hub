# Design Spec: Phase 1 — i18n + Language Toggle

**Date:** 2026-06-07  
**Status:** Approved  
**Phase:** 1 of 6  
**Depends on:** Phase 0 (Foundation Skeleton)

---

## Context

Phase 0 tạo ra skeleton với toàn bộ UI strings hardcoded bằng tiếng Anh. CLAUDE.md yêu cầu Vietnamese là primary language và mọi chuỗi user-facing phải đi qua `t('key')`. Phase 1 thiết lập i18n foundation trước khi thêm bất kỳ UI feature mới nào — nếu không làm bây giờ, mỗi phase sau sẽ phải retrofit lại.

**Mục tiêu:** Tích hợp `vue-i18n` v9, chuyển toàn bộ hardcoded strings trong 3 component hiện tại sang locale keys, thêm toggle `VI / EN` nhỏ gọn cuối sidebar.

---

## Architecture

Chỉ thay đổi frontend. Backend không bị ảnh hưởng.

```
frontend/src/
├── i18n.ts                    ← createI18n instance, locale detection
├── locales/
│   ├── vi.json                ← Vietnamese (primary, default)
│   └── en.json                ← English (secondary)
├── main.ts                    ← app.use(i18n)  [modified]
└── components/
    ├── SidebarNav.vue          ← + VI/EN toggle, + useI18n()  [modified]
    ├── ChatPanel.vue           ← 5 strings → t('key')  [modified]
    └── ArtifactsPanel.vue      ← 2 strings → t('key')  [modified]
```

---

## Locale Keys

**`src/locales/vi.json`:**
```json
{
  "nav.chat": "Trò chuyện",
  "nav.tasks": "Nhiệm vụ",
  "nav.files": "Tệp tin",
  "nav.settings": "Cài đặt",
  "nav.lang": "VI",
  "chat.header": "AGENT CHAT",
  "chat.mode.stub": "chế độ stub",
  "chat.placeholder": "nhập lệnh hoặc câu hỏi_",
  "chat.system.init": "Agent đã khởi động. SQLite đã kết nối. Đang ở chế độ stub.",
  "chat.user.prefix": "$ người dùng",
  "chat.agent.prefix": "▶ agent",
  "chat.system.prefix": "[hệ thống]",
  "chat.error.unreachable": "[lỗi] Không kết nối được agent. Backend đang chạy chưa?",
  "chat.loading": "…",
  "artifacts.header": "KẾT QUẢ",
  "artifacts.empty": "◈ Chưa có kết quả",
  "artifacts.label.lastReply": "phản hồi cuối",
  "health.checking": "Đang kiểm tra...",
  "health.ok": "Backend: hoạt động · DB: đã kết nối",
  "health.error": "Không kết nối được backend"
}
```

**`src/locales/en.json`:**
```json
{
  "nav.chat": "Chat",
  "nav.tasks": "Tasks",
  "nav.files": "Files",
  "nav.settings": "Settings",
  "nav.lang": "EN",
  "chat.header": "AGENT CHAT",
  "chat.mode.stub": "stub mode",
  "chat.placeholder": "type a command or question_",
  "chat.system.init": "Agent initialized. SQLite connected. Stub mode active.",
  "chat.user.prefix": "$ user",
  "chat.agent.prefix": "▶ agent",
  "chat.system.prefix": "[system]",
  "chat.error.unreachable": "[error] Could not reach agent. Is the backend running?",
  "chat.loading": "…",
  "artifacts.header": "ARTIFACTS",
  "artifacts.empty": "◈ No artifacts yet",
  "artifacts.label.lastReply": "last reply",
  "health.checking": "Checking backend...",
  "health.ok": "Backend: ok · DB: connected",
  "health.error": "Backend unreachable"
}
```

---

## Component Specs

### `src/i18n.ts` (new)

```ts
import { createI18n } from 'vue-i18n'
import vi from './locales/vi.json'
import en from './locales/en.json'

const savedLang = localStorage.getItem('workspace.lang') ?? 'vi'

export const i18n = createI18n({
  legacy: false,
  locale: savedLang,
  fallbackLocale: 'en',
  messages: { vi, en },
})

export type Locale = 'vi' | 'en'
```

- `legacy: false` — dùng Composition API mode
- `fallbackLocale: 'en'` — key thiếu trong `vi.json` sẽ fallback về `en.json`
- localStorage key: `workspace.lang`, giá trị mặc định `'vi'`

### `src/main.ts` (modified)

Thêm `import { i18n } from './i18n'` và `app.use(i18n)` trước `app.mount('#app')`.

### `src/components/SidebarNav.vue` (modified)

**Thêm toggle `VI | EN`** giữa icon Settings và health dot:

```vue
<!-- language toggle -->
<button
  :title="locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'"
  @click="toggleLang"
  class="w-9 h-6 rounded flex items-center justify-center text-xs font-mono border border-cyber-dim text-cyber-accent hover:bg-cyber-accent/10 transition-colors duration-150"
>
  {{ t('nav.lang') }}
</button>
```

**Script:**
```ts
import { useI18n } from 'vue-i18n'
import type { Locale } from '../i18n'

const { locale, t } = useI18n()

function toggleLang() {
  const next: Locale = locale.value === 'vi' ? 'en' : 'vi'
  locale.value = next
  localStorage.setItem('workspace.lang', next)
}
```

**Nav items dùng `t()`:**
```ts
const navItems = [
  { view: 'chat',  labelKey: 'nav.chat',  icon: '💬' },
  { view: 'tasks', labelKey: 'nav.tasks', icon: '📋' },
  { view: 'files', labelKey: 'nav.files', icon: '📁' },
]
```

```vue
<button :title="t(item.labelKey)" ...>
```

Health status:
```ts
healthStatus.value = t('health.ok')   // on success
healthStatus.value = t('health.error') // on fail
```

### `src/components/ChatPanel.vue` (modified)

| Hardcoded (cũ) | Key mới |
|---|---|
| `'Agent initialized. SQLite connected. Stub mode active.'` | `t('chat.system.init')` |
| `'type a command or question_'` (placeholder) | `t('chat.placeholder')` |
| `'◈ AGENT CHAT'` | `t('chat.header')` |
| `'stub mode'` | `t('chat.mode.stub')` |
| `'$ user'` / `'▶ agent'` / `'[system]'` | `t('chat.user.prefix')` / `t('chat.agent.prefix')` / `t('chat.system.prefix')` |
| `'[error] Could not reach agent...'` | `t('chat.error.unreachable')` |

`useI18n()` thêm vào `<script setup>`:
```ts
const { t } = useI18n()
```

Initial system message phải reactive theo locale. Dùng `computed`:
```ts
const initMessage = computed<Message>(() => ({
  role: 'system',
  content: t('chat.system.init'),
  timestamp: now(),
}))
```

Lưu ý: `messages` array khởi tạo với `[initMessage.value]` — static snapshot tại mount time là đủ vì stub mode message không cần reactive sau khi đã hiển thị.

### `src/components/ArtifactsPanel.vue` (modified)

| Hardcoded (cũ) | Key mới |
|---|---|
| `'◈ No artifacts yet'` | `t('artifacts.empty')` |
| `'last reply'` | `t('artifacts.label.lastReply')` |
| `'◈ ARTIFACTS'` | `t('artifacts.header')` |

```ts
const { t } = useI18n()
```

---

## Data Flow

```
App mount
  → i18n.ts: read localStorage('workspace.lang') ?? 'vi'
  → createI18n({ locale })
  → main.ts: app.use(i18n)
  → SidebarNav, ChatPanel, ArtifactsPanel: useI18n() → t('key')
  → UI renders in Vietnamese

User clicks VI/EN toggle
  → toggleLang(): locale.value = 'en'
  → localStorage.setItem('workspace.lang', 'en')
  → All t('key') calls re-evaluate reactively
  → UI switches to English instantly (no page reload)

User reopens app
  → localStorage('workspace.lang') === 'en'
  → i18n initializes with locale: 'en'
  → UI starts in English
```

---

## Dependencies

```
package.json (frontend):
  "vue-i18n": "^9.0.0"
```

Không có thay đổi backend, docker-compose, nginx, Prisma.

---

## Error Handling

- Key không tồn tại trong `vi.json` → vue-i18n tự fallback sang `en.json` (vì `fallbackLocale: 'en'`)
- `en.json` cũng thiếu key → vue-i18n log warning ở dev, render key string thô (e.g. `"nav.chat"`) ở production — chấp nhận được
- localStorage không available (private browsing) → `?? 'vi'` fallback xử lý

---

## Verification

Sau khi implement, verify thủ công:

1. `npm run dev` (frontend) — mở `http://localhost:5173`
2. Toàn bộ UI hiển thị tiếng Việt theo mặc định
3. Click `VI` → chuyển sang `EN`, toàn bộ text đổi ngay
4. Click `EN` → chuyển lại `VI`
5. Refresh page → ngôn ngữ vẫn là lần chọn cuối (localStorage persist)
6. Mở DevTools Console — không có i18n missing key warnings
7. `npm run build` — build thành công, không có TypeScript errors

---

## Out of Scope

- Dịch nội dung agent reply
- Thêm ngôn ngữ thứ 3
- RTL layout
- Backend error message translation
- Date/number format localization (sẽ làm khi có date hiển thị trong Phase 3)
