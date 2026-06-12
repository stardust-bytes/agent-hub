# Token Usage Tracking Design

## Overview

Track token consumption (prompt + completion tokens) from OpenAI/DeepSeek API calls, aggregate at total and per-session levels, and display in a Usage tab within Settings.

## Scope

- **Token tracking only** — no cost/$
- **OpenAI/DeepSeek only** — Ollama excluded (no usage data in API response)
- **Per-LLM-call granularity** — 1 `UsageRecord` per `executeStep()` invocation
- **Display:** Settings → Usage tab with total overview + per-session breakdown

---

## Backend

### Prisma Schema — New Model

```prisma
model UsageRecord {
  id               Int      @id @default(autoincrement())
  sessionId        Int?
  modelName        String
  providerType     String
  promptTokens     Int
  completionTokens Int
  totalTokens      Int
  createdAt        DateTime @default(now())

  session          Session? @relation(fields: [sessionId], references: [id], onDelete: SetNull)
}
```

### `StreamChunk` Interface

Already has `usage?` field:
```typescript
usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
```

### OpenAIProvider Changes

Parse `usage` from the final SSE chunk (OpenAI sends `usage` object in the last chunk). When a chunk with `usage` is received, yield `{ type: 'done', usage: { promptTokens, completionTokens, totalTokens } }` instead of the plain `{ type: 'done' }`.

### New Module: `src/usage/`

- `usage.module.ts` — registers UsageService + UsageController
- `usage.service.ts` — methods:
  - `record(data: CreateUsageDto): Promise<UsageRecord>`
  - `getTotal(): Promise<{ promptTokens: number; completionTokens: number; totalTokens: number; requestCount: number }>`
  - `getPerSession(): Promise<Array<{ sessionId: number; sessionTitle: string; promptTokens: number; completionTokens: number; totalTokens: number }>>`
  - `getBySession(sessionId: number): Promise<UsageRecord[]>`
- `usage.controller.ts` — endpoints:
  - `GET /api/usage` → total aggregate
  - `GET /api/usage/sessions` → per-session breakdown
  - `GET /api/usage/session/:id` → records for a specific session
- `dto/create-usage.dto.ts` — validated DTO

### AgentLoopService Changes

In `executeStep()`, after the LLM stream completes and returns a done chunk with usage:
1. If usage present, call `this.usageService.record({ sessionId, modelName, providerType, promptTokens, completionTokens, totalTokens })`
2. Non-blocking — fire and forget (no await needed for stream responsiveness)

### app.module.ts

Add `UsageModule` to imports.

---

## Frontend

### New Component: `UsageView.vue`

- `<script setup lang="ts">`, all Tailwind classes, no global CSS
- Call `GET /api/usage` for total, `GET /api/usage/sessions` for per-session
- Layout (cyber-terminal style table):
  ```
  USAGE
  ┌──────────────────────────────────────┐
  │  Prompt tokens:     123,456         │
  │  Completion tokens: 78,901          │
  │  ─────────────────────────────────── │
  │  Tổng tokens:       202,357         │
  │  Số request:        47              │
  ├──────────────────────────────────────┤
  │  Session          Prompt   Compl    │
  │  Chat 1 (gpt-4)  12,340   8,901    │
  │  Chat 2 (gpt-4)  34,567   12,345   │
  └──────────────────────────────────────┘
  ```
- Empty state when no data: hiển thị "Chưa có dữ liệu usage"
- Number format: `toLocaleString('vi-VN')` (`.` as thousands separator)
- Error handling: try/catch, fallback message

### SettingsView.vue

Add a "Usage" tab button alongside "Memories" tab. When active, render `<UsageView />`.

### i18n

Add to `vi.json`:
```json
"usage": {
  "header": "Usage",
  "total_prompt": "Prompt tokens",
  "total_completion": "Completion tokens",
  "total_all": "Tổng tokens",
  "total_requests": "Số request",
  "per_session": "Chi tiết theo session",
  "empty": "Chưa có dữ liệu usage",
  "model": "Model",
  "session": "Session",
  "prompt": "Prompt",
  "completion": "Compl",
  "total": "Tổng"
}
```

Add to `en.json`:
```json
"usage": {
  "header": "Usage",
  "total_prompt": "Prompt tokens",
  "total_completion": "Completion tokens",
  "total_all": "Total tokens",
  "total_requests": "Requests",
  "per_session": "Per-session breakdown",
  "empty": "No usage data yet",
  "model": "Model",
  "session": "Session",
  "prompt": "Prompt",
  "completion": "Compl",
  "total": "Total"
}
```

---

## Data Flow

```
User sends message
  → AgentService.streamChat()
    → AgentLoopService.run()
      → executeStep()
        → LLMControllerService.stream()
          → OpenAIProvider.stream()  ← yields usage in final chunk
        ← returns { text, toolCalls, usage }
      → UsageService.record()        ← save to SQLite
    → next iteration or finish
  → stream ends
```

## Error Handling

- If OpenAI API doesn't return usage (older model, error), usage is undefined — no record saved, no crash
- UsageService.record() failure → logged but doesn't block the chat stream (fire-and-forget with try/catch)
- Frontend empty state when API returns 0 records

## Testing

- `UsageService` unit test: record + getTotal + getPerSession
- `UsageController` e2e: GET endpoints return correct shapes
- `OpenAIProvider` unit: mock SSE chunks with usage, verify yield
- `AgentLoopService` integration: mock usage and verify record() called

---

## Files Changed

**Backend:**
- `prisma/schema.prisma` — add UsageRecord model
- `src/usage/usage.module.ts` — new
- `src/usage/usage.service.ts` — new
- `src/usage/usage.service.spec.ts` — new
- `src/usage/usage.controller.ts` — new
- `src/usage/usage.controller.spec.ts` — new
- `src/usage/dto/create-usage.dto.ts` — new
- `src/agent/providers/openai.provider.ts` — parse usage from final chunk
- `src/agent/services/agent-loop.service.ts` — capture usage after executeStep
- `src/app.module.ts` — import UsageModule

**Frontend:**
- `frontend/src/components/UsageView.vue` — new
- `frontend/src/components/SettingsView.vue` — add Usage tab
- `frontend/src/locales/vi.json` — add usage.* keys
- `frontend/src/locales/en.json` — add usage.* keys
