# Phase 2 — Real Ollama Chat (Streaming) Design Spec

**Date:** 2026-06-07  
**Status:** Approved  
**Owner:** doanphanthanh1305@gmail.com  
**Depends on:** Phase 1 (i18n + Language Toggle)

---

## Overview

Replace the stub `AgentService.mockReply()` with real Ollama LLM streaming. Users chat with a local model; tokens stream token-by-token to the terminal UI. The backend introduces a provider abstraction layer (strategy pattern) so future providers (OpenAI, DeepSeek) can be added in Phase 4 without touching the chat endpoint.

---

## User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| CHAT-1 | Chat với LLM local | Send message → Ollama trả lời thật, không phải stub |
| CHAT-2 | Stream từng token | Tokens xuất hiện lần lượt, không chờ full response |
| CHAT-3 | Chọn model | Dropdown trong ChatPanel header, danh sách từ `GET /api/ollama/models`, lưu `localStorage('workspace.model')` |
| CHAT-4 | Ollama offline | Dropdown hiển thị `"ollama offline"` (disabled), send trả lỗi rõ ràng |
| CHAT-5 | Dừng generation | Nút `◼ Dừng` khi đang stream, cancel cả frontend và backend Ollama request |

---

## Architecture Decision

**Streaming mechanism:** `fetch() + ReadableStream` (POST-compatible). Frontend gọi `POST /api/agent/chat`, đọc `response.body` dưới dạng stream. Không dùng `EventSource` (GET-only constraint). Không dùng hai-phase POST→GET (over-engineered cho scope này).

**Provider pattern:** `LLMProvider` interface cho phép Phase 4 thêm `OpenAIProvider` mà không thay đổi controller/service contract. Phase 2 chỉ implement `OllamaProvider`.

---

## Backend Design

### File Structure

```
src/
├── agent/
│   ├── agent.module.ts
│   ├── agent.controller.ts          — POST /api/agent/chat (SSE stream)
│   ├── agent.controller.spec.ts
│   ├── agent.service.ts             — resolves provider, delegates streamChat()
│   ├── agent.service.spec.ts
│   └── providers/
│       ├── llm-provider.interface.ts
│       └── ollama.provider.ts
│
└── ollama/
    ├── ollama.module.ts
    ├── ollama.controller.ts         — GET /api/ollama/models
    ├── ollama.controller.spec.ts
    ├── ollama.service.ts            — proxy to Ollama /api/tags
    └── ollama.service.spec.ts
```

### Interface

```ts
// llm-provider.interface.ts
export interface LLMProvider {
  streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<void>
}
```

### `POST /api/agent/chat`

**Request DTO (`ChatDto`):**
```ts
class ChatDto {
  @IsString()
  message: string

  @IsString()
  @IsOptional()
  model?: string  // fallback: 'llama3.2'
}
```

**Controller behavior:**
1. Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
2. Create `AbortController`, bind `req.on('close', () => ctrl.abort())`
3. Call `agentService.streamChat(dto, res, ctrl.signal)`
4. On completion, `res.end()` (called inside service)

**SSE event format:**
```
data: {"token":"..."}\n\n     — one per Ollama token
data: {"error":"..."}\n\n     — on Ollama error mid-stream
data: [DONE]\n\n              — always last event
```

### `OllamaProvider.streamChat()` flow

1. Call `POST {OLLAMA_URL}/api/chat` with `{ model, messages: [{role:'user', content: message}], stream: true }`
2. If fetch fails → write `data: {"error":"ollama_unreachable"}\n\n`, then `data: [DONE]\n\n`, return
3. Read response body line-by-line (NDJSON: each line is `{ message: { content: "..." }, done: boolean }`)
4. For each line: parse JSON, write `data: {"token":"<content>"}\n\n`
5. When `done: true` or stream ends → write `data: [DONE]\n\n`
6. On `signal.aborted` → stop reading, do NOT write further

### `GET /api/ollama/models`

`OllamaService.getModels()`:
- Calls `GET {OLLAMA_URL}/api/tags`
- Returns `string[]` of `model.name` values
- If Ollama unreachable → throws `ServiceUnavailableException` (503)

### New Environment Variables

```
OLLAMA_URL=http://host.docker.internal:11434
ACTIVE_PROVIDER=ollama
```

Add to `.env.example`. `ACTIVE_PROVIDER` reserved for Phase 4 — `AgentService` reads it but only `'ollama'` is valid in Phase 2.

---

## Frontend Design

### New Component: `ModelSelector.vue`

**Location:** `frontend/src/components/ModelSelector.vue`

**Props:**
```ts
defineProps<{
  models: string[]
  modelValue: string
  disabled: boolean
}>()
```

**Emits:** `update:modelValue`

**Behavior:**
- Renders as a compact `<select>` styled with `cyber-*` tokens, `font-mono`, max `rounded`
- When `models` is empty: shows single disabled option `t('chat.model.offline')`
- No shadow, no gradient — matches terminal aesthetic

### ChatPanel.vue Changes

**Header additions:**
- `ModelSelector` component (left of mode label)
- `◼ Dừng` button (right side, only visible when `streaming === true`)
- Header label: `chat.mode.ollama` when Ollama online, `chat.mode.stub` when offline

**New state:**
```ts
const streaming = ref(false)
const selectedModel = ref(localStorage.getItem('workspace.model') ?? 'llama3.2')
const availableModels = ref<string[]>([])
const ollamaOnline = ref(true)
const abortController = ref<AbortController | null>(null)
```

**`onMounted`:** Fetch `GET /api/ollama/models`. On success → populate `availableModels`. On failure → `ollamaOnline = false`, `availableModels = []`.

**`submit()` — streaming flow:**
1. Set `streaming = true`, create `AbortController`, store in `abortController`
2. `fetch POST /api/agent/chat` with `{ message, model: selectedModel }`
3. Create agent message `{ role: 'agent', content: '', typing: true }`
4. Read `response.body` with `getReader()` + `TextDecoder`
5. For each `data: {"token":"..."}` line → append to `msg.content`, `scrollToBottom()`
6. On `data: [DONE]` → `msg.typing = false`, `streaming = false`
7. On `data: {"error":"..."}` → append system error message, `streaming = false`
8. On `AbortError` catch → `msg.typing = false`, `streaming = false` (keep partial content)
9. On other errors → append `t('chat.error.unreachable')` system message

**`stopStream()`:** `abortController.value?.abort()`

**`watch(selectedModel)`:** `localStorage.setItem('workspace.model', selectedModel.value)`

### New i18n Keys

| Key | vi | en |
|---|---|---|
| `chat.mode.ollama` | `chế độ ollama` | `ollama mode` |
| `chat.model.offline` | `ollama offline` | `ollama offline` |
| `chat.stop` | `◼ Dừng` | `◼ Stop` |
| `chat.thinking` | `⟳ đang nghĩ...` | `⟳ thinking...` |

Existing 21 keys remain unchanged.

---

## Error Handling Matrix

| Scenario | Backend behavior | Frontend display |
|---|---|---|
| Ollama offline — load models | `OllamaService` throws 503 | `availableModels = []`, dropdown shows `"ollama offline"` |
| Ollama offline — send message | Write `{"error":"ollama_unreachable"}` + `[DONE]` | System message: `[lỗi] Không kết nối được Ollama` |
| User clicks Dừng | `req.on('close')` → abort Ollama fetch | `AbortError` caught, partial content kept, `typing = false` |
| Ollama error mid-stream | Write `{"error":"..."}` + `[DONE]` | Inline system error message |
| Model not found | Ollama 400 → write error event | System message: `[lỗi] Model không tìm thấy` |

---

## Testing Plan (Backend TDD)

**Write specs before implementation.**

### `ollama.service.spec.ts`
- `getModels()` parses `{ models: [{name: 'llama3.2'}] }` → returns `['llama3.2']`
- `getModels()` when Ollama offline → throws `ServiceUnavailableException`

### `ollama.provider.spec.ts`
- `streamChat()` writes `data: {"token":"hello"}\n\n` for each NDJSON token
- `streamChat()` writes `data: [DONE]\n\n` as last event
- `streamChat()` on fetch failure → writes error event then `[DONE]`
- `streamChat()` stops writing when `signal.aborted`

### `agent.service.spec.ts`
- `streamChat()` calls provider with message + model
- Uses fallback model `'llama3.2'` when `dto.model` is undefined

### `agent.controller.spec.ts`
- Sets `Content-Type: text/event-stream` header
- `req.on('close')` triggers `AbortController.abort()`

---

## Out of Scope (Phase 2)

- Chat history persistence (session-only)
- Multi-turn context window management (single user message per request)
- Function calling / tool use (Phase 6)
- OpenAI/DeepSeek provider UI (Phase 4 — `LLMProvider` interface is the foundation)
- System prompt customization

---

## Non-Breaking Contract

These must not change:
- `POST /api/agent/chat` endpoint path
- `ChatDto.message: string` field
- `TasksModule`, `PrismaModule`, `AppController`
- All 21 existing i18n keys
- `ArtifactsPanel.vue` props interface (`lastMessage: string`)
- `AppShell.vue` / `SidebarNav.vue` interfaces
