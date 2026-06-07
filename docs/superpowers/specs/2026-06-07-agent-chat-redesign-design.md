# Agent Chat Redesign — Multi-Session + Conversation History

**Date:** 2026-06-07  
**Status:** Approved  
**Goal:** Redesign agent chat inspired by opencode — agent vừa là trợ lý hỏi đáp thông thường, vừa có thể dùng tools và KB, với conversation history đầy đủ và quản lý nhiều sessions.

---

## 1. Context & Current State

| Aspect | Current | After redesign |
|---|---|---|
| Conversation | Stateless — mỗi message là độc lập | Full session memory — toàn bộ history gửi lên model |
| Sessions | Không có | Multi-session, new/resume |
| Tool routing | Always-on (giữ nguyên) | Always-on (giữ nguyên) |
| Chat rendering | Plain text | Markdown (marked.js + DOMPurify) |
| Session UI | Không có | Button trên header → modal popup |

**Không thay đổi:** OllamaProvider tool loop (create_task, update_task, list_tasks, search_knowledge), ArtifactsPanel, SidebarNav, AppShell, TasksModule, KnowledgeModule.

---

## 2. Data Model

Thêm 2 model vào `prisma/schema.prisma`:

```prisma
model Session {
  id        Int           @id @default(autoincrement())
  title     String        @default("New Session")
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  messages  ChatMessage[]
}

model ChatMessage {
  id        Int      @id @default(autoincrement())
  sessionId Int
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      String   // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())
}
```

**Rules:**
- `role` chỉ lưu `user` và `assistant` — tool call/result events không lưu vào DB (chỉ dùng cho UI display).
- `onDelete: Cascade` — xóa session xóa luôn toàn bộ messages.
- `session.title` tự động set từ 5 từ đầu của tin nhắn đầu tiên trong session.
- Migration: `npx prisma migrate dev --name add-sessions-chat-messages`.

---

## 3. Backend API

### 3.1 SessionsModule (mới)

File structure:
```
backend/src/sessions/
├── sessions.module.ts
├── sessions.controller.ts
├── sessions.controller.spec.ts
├── sessions.service.ts
├── sessions.service.spec.ts
└── dto/
    └── create-session.dto.ts
```

Endpoints (prefix `/api/sessions`):

| Method | Path | Mô tả | Response |
|---|---|---|---|
| `GET` | `/api/sessions` | Liệt kê tất cả sessions | `Session[]` với `messageCount` |
| `POST` | `/api/sessions` | Tạo session mới | `Session` |
| `DELETE` | `/api/sessions/:id` | Xóa session + messages | `{ id }` |
| `GET` | `/api/sessions/:id/messages` | Lấy messages để hiển thị lại | `ChatMessage[]` |

### 3.2 AgentController — thay đổi ChatDto

```ts
// backend/src/agent/dto/chat.dto.ts
export class ChatDto {
  @IsString() message: string
  @IsString() model: string
  @IsNumber() sessionId: number
}
```

### 3.3 AgentService flow mới

```
POST /api/agent/chat { message, model, sessionId }
  → SessionsService.getHistory(sessionId)     // load user+assistant messages
  → Build OllamaMessage[] = [...history, { role:'user', content: message }]
  → OllamaProvider.streamChat(messages, model, res, signal)
       → returns { finalText: string }
  → SessionsService.saveMessage(sessionId, 'user', message)
  → SessionsService.saveMessage(sessionId, 'assistant', finalText)
  → SessionsService.autoTitle(sessionId, message)  // nếu là msg đầu tiên
```

### 3.4 OllamaProvider — signature thay đổi

```ts
// Cũ
streamChat(message: string, model: string, res: Response, signal: AbortSignal): Promise<void>

// Mới
streamChat(
  messages: OllamaMessage[],
  model: string,
  res: Response,
  signal: AbortSignal,
): Promise<{ finalText: string }>

interface OllamaMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
}
```

Provider không biết về sessions — nhận messages array, stream, return `finalText`. AgentService chịu trách nhiệm persist.

---

## 4. Frontend

### 4.1 SessionModal.vue (component mới)

```
frontend/src/components/SessionModal.vue
```

**Props:** `modelValue: boolean`  
**Emits:** `update:modelValue: [value: boolean]`, `select: [sessionId: number]`, `created: [sessionId: number]`

UI:
- Overlay full-screen mờ (`bg-cyber-dark/80`) + modal nhỏ căn giữa (`w-80`)
- Header: label `SESSIONS` + nút `+ Mới` + nút `✕`
- Danh sách sessions (scrollable): title, thời gian tạo, số tin nhắn
- Session active: `border-l-2 border-cyber-accent`
- Nhấn item → `emit('select', id)` → đóng modal
- Nhấn `+ Mới` → `POST /api/sessions` → `emit('created', id)` → đóng modal
- Nhấn overlay hoặc `✕` → `emit('update:modelValue', false)`
- Mỗi session item có nút `🗑` xóa session (`DELETE /api/sessions/:id`)

**i18n keys cần thêm:**
```
sessions.header       → "SESSIONS" / "SESSIONS"
sessions.new          → "+ Mới" / "+ New"
sessions.empty        → "Chưa có session nào" / "No sessions yet"
sessions.messages     → "{n} tin nhắn" / "{n} messages"
sessions.delete.confirm → "Xóa session này?" / "Delete this session?"
```

### 4.2 ChatPanel.vue — thay đổi

**State mới:**
```ts
const currentSessionId = ref<number | null>(null)
const showSessionModal = ref(false)
```

**On mount:**
```ts
onMounted(async () => {
  // Tạo session mới khi khởi động
  const res = await fetch('/api/sessions', { method: 'POST', ... })
  const session = await res.json()
  currentSessionId.value = session.id
  // ... load models như cũ
})
```

**Switch session (khi user chọn từ modal):**
```ts
async function loadSession(sessionId: number) {
  currentSessionId.value = sessionId
  const res = await fetch(`/api/sessions/${sessionId}/messages`)
  const dbMessages = await res.json()
  messages.value = [
    { role: 'system', content: t('chat.system.init'), timestamp: now() },
    // mapDbMessage: { role:'user'→'user', role:'assistant'→'agent', content, createdAt→timestamp }
    ...dbMessages.map((m: ChatMessage) => ({
      role: m.role === 'assistant' ? 'agent' : m.role,
      content: m.content,
      timestamp: new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
    })),
  ]
}
```

**Submit — thêm sessionId:**
```ts
body: JSON.stringify({ message: text, model: selectedModel.value, sessionId: currentSessionId.value })
```

**Markdown rendering cho agent messages:**
```ts
// imports
import { marked } from 'marked'
import DOMPurify from 'dompurify'
```
```html
<!-- template: thay {{ msg.content }} bằng v-html -->
<div v-html="DOMPurify.sanitize(marked.parse(msg.content) as string)"
     class="text-sm leading-relaxed break-words text-[#EEEEEE]" />
```

**Header — thêm session button:**
```html
<button @click="showSessionModal = true"
  class="text-cyber-accent/70 text-xs font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent">
  {{ t('sessions.header') }}
</button>
<SessionModal
  v-model="showSessionModal"
  :currentSessionId="currentSessionId"
  @select="loadSession"
  @created="loadSession"
/>
```

---

## 5. Files to Create / Modify

### Create (mới hoàn toàn):
- `backend/src/sessions/sessions.module.ts`
- `backend/src/sessions/sessions.controller.ts`
- `backend/src/sessions/sessions.controller.spec.ts`
- `backend/src/sessions/sessions.service.ts`
- `backend/src/sessions/sessions.service.spec.ts`
- `backend/src/sessions/dto/create-session.dto.ts`
- `frontend/src/components/SessionModal.vue`

### Modify:
- `prisma/schema.prisma` — thêm Session + ChatMessage models
- `backend/src/app.module.ts` — import SessionsModule
- `backend/src/agent/dto/chat.dto.ts` — thêm `sessionId: number`
- `backend/src/agent/agent.service.ts` — load history, persist messages, call provider với messages[]
- `backend/src/agent/agent.service.spec.ts` — update tests
- `backend/src/agent/providers/ollama.provider.ts` — signature `messages[]`, return `finalText`
- `backend/src/agent/providers/ollama.provider.spec.ts` — update tests
- `frontend/src/components/ChatPanel.vue` — session button, loadSession, markdown render, sessionId in submit
- `frontend/src/locales/vi.json` — thêm `sessions.*` keys
- `frontend/src/locales/en.json` — thêm `sessions.*` keys

---

## 6. Error Handling

- `GET /api/sessions/:id/messages` với id không tồn tại → 404 (HttpExceptionFilter xử lý)
- Session bị xóa trong khi đang chat → frontend nhận HTTP error → append `[lỗi]` system message, tạo session mới tự động
- `marked.parse()` throw → catch, fallback về plain text display
- `sessionId` null khi submit (race condition on mount) → frontend guard: `if (!currentSessionId.value) return`

---

## 7. Testing

- `SessionsService`: unit test CRUD + autoTitle logic
- `SessionsController`: integration test các endpoints
- `AgentService`: test load history + persist sau stream
- `OllamaProvider`: test signature mới với `messages[]` input
- Frontend: manual E2E — tạo session, chat, reload page → resume session, verify history hiển thị đúng
