# Provider Management — Design Spec

**Date:** 2026-06-08  
**Status:** Approved  
**Scope:** Add a Provider + ProviderModel management system. Remove hardcoded local Ollama defaults. All LLM calls must go through a configured provider.

---

## 1. Context

Currently, the Ollama base URL is stored as a key-value setting (`ollama.baseUrl`) and read by `LLMCallerService` at call time. The model name is passed as a plain string in `ChatDto`. This approach doesn't support multiple providers, API keys, or future cloud providers (OpenAI, Google).

---

## 2. Data Model

Two new Prisma models added to `schema.prisma`:

```prisma
model Provider {
  id        Int             @id @default(autoincrement())
  name      String
  type      String          // "ollama" for now; future: "openai", "google"
  baseUrl   String?
  key       String?         // API key, stored plaintext (local-first app)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  models    ProviderModel[]
}

model ProviderModel {
  id         Int      @id @default(autoincrement())
  providerId Int
  provider   Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  name       String
  createdAt  DateTime @default(now())
}
```

- `key` stored as plaintext — acceptable for a local-first, self-hosted app.
- `onDelete: Cascade` — deleting a provider removes all its models.
- `baseUrl` optional — if absent, falls back to `http://localhost:11434` for type `ollama`.

---

## 3. Backend

### 3.1 New Module: `src/providers/`

```
src/providers/
├── providers.module.ts
├── providers.controller.ts
├── providers.service.ts
├── providers.controller.spec.ts
├── providers.service.spec.ts
└── dto/
    ├── create-provider.dto.ts
    ├── update-provider.dto.ts
    └── create-provider-model.dto.ts
```

### 3.2 API Endpoints

All prefixed with `/api`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/providers` | List all providers with their models |
| `POST` | `/api/providers` | Create provider |
| `PATCH` | `/api/providers/:id` | Update provider |
| `DELETE` | `/api/providers/:id` | Delete provider (cascades models) |
| `POST` | `/api/providers/:id/models` | Add model to provider |
| `DELETE` | `/api/providers/:id/models/:modelId` | Remove model from provider |
| `GET` | `/api/providers/models` | Flat list of all models across all providers |

> **NestJS route ordering:** `GET /providers/models` must be declared **before** `GET /providers/:id` in the controller, otherwise NestJS treats the string `"models"` as an `:id` param.

`GET /api/providers/models` response shape:
```json
[
  { "id": 1, "name": "llama3.2", "providerName": "Ollama Local", "providerId": 1 },
  { "id": 2, "name": "gemma2",   "providerName": "Ollama Local", "providerId": 1 }
]
```

### 3.3 DTOs

**`CreateProviderDto`**: `name` (required), `type` (required, default `"ollama"`), `baseUrl?`, `key?`  
**`UpdateProviderDto`**: `PartialType(CreateProviderDto)`  
**`CreateProviderModelDto`**: `name` (required)

### 3.4 Changes to Existing Code

**`ChatDto`** (`agent/dto/chat.dto.ts`):
- Remove `model?: string`
- Add `providerModelId: number` (required)

**`AgentService`** (`agent/agent.service.ts`):
- Inject `ProvidersService`
- Resolve `ProviderModel` + parent `Provider` from `providerModelId` before calling `OllamaProvider`
- Throw `BadRequestException` if `providerModelId` not found

**`OllamaProvider`** (`agent/providers/ollama.provider.ts`):
- Add `providerConfig: { baseUrl: string; key?: string }` parameter to `streamChat()`
- Pass it through to `LLMCallerService`

**`LLMCallerService`** (`agent/services/llm-caller.service.ts`):
- Remove `SettingsService` injection
- Add `baseUrl: string` and `key?: string` parameters to `streamChat()`
- Use `key` as `Authorization: Bearer <key>` header when present

**`OllamaModule`** (`ollama/`):
- **Remove entirely.** `ModelSelector` no longer calls `GET /api/ollama/models`; the flat model list is now served by `GET /api/providers/models`. Remove `OllamaController`, `OllamaService`, `OllamaModule`, and their spec files. Remove `OllamaModule` from `AppModule` imports.

**`SettingsService`** (`settings/settings.service.ts`):
- Remove `ollama.baseUrl` and `ollama.defaultModel` from `findAll()`; method now returns `{}`
- Keep `get()` and `upsert()` methods (available for future settings)
- `GET /api/settings` returns `{}` — `SettingsView` no longer reads ollama fields from it

---

## 4. Frontend

### 4.1 New Files

**`ProvidersView.vue`** — full-width view (like `FilesView`):
- Header: "⚡ PROVIDERS" + "+ thêm provider" button
- Accordion list: each provider is a collapsible row
  - Collapsed: name, type badge, baseUrl truncated, ✎ edit + ✕ delete buttons
  - Expanded: models list with ✕ per model + inline "+ thêm model" input (Enter to confirm)
- Empty state: "Chưa có provider nào"
- Add/Edit via `ProviderFormModal`

**`ProviderFormModal.vue`** — uses `BaseModal`:
- Fields: `name` (required), `type` (dropdown, only "ollama" enabled), `baseUrl` (optional), `key` (optional, `type="password"`)
- Modes: create (empty) and edit (pre-filled)

### 4.2 Modified Files

**`SidebarNav.vue`**:
- Add ⚡ icon between Files and Settings
- Emits `navigate: 'providers'`

**`AppShell.vue`**:
- Extend `activeView` union to include `'providers'`
- Render `<ProvidersView />` when `activeView === 'providers'`

**`ModelSelector.vue`**:
- Fetch from `GET /api/providers/models` instead of `GET /api/ollama/models`
- Props change: `modelValue: number` (providerModelId) instead of `modelValue: string`
- Display format: `"providerName / modelName"`
- When list is empty: show "Chưa có provider" placeholder + disabled

**`ChatPanel.vue`**:
- Send `providerModelId: number` instead of `model: string`
- Disable submit button when `providerModelId` is null/undefined (no models available)
- On `ollama_unreachable` or `400` error: append `[lỗi]` system message

**`SettingsView.vue`**:
- Remove "Ollama Base URL" and "Model mặc định" sections entirely

### 4.3 i18n Keys

Added to `vi.json` and `en.json`:

```
providers.header          → "PROVIDERS" / "PROVIDERS"
providers.add             → "+ thêm provider" / "+ add provider"
providers.empty           → "Chưa có provider nào" / "No providers yet"
providers.edit            → "Sửa provider" / "Edit provider"
providers.delete.confirm  → "Xóa provider này?" / "Delete this provider?"
providers.form.name       → "Tên" / "Name"
providers.form.type       → "Loại" / "Type"
providers.form.baseUrl    → "Base URL (tùy chọn)" / "Base URL (optional)"
providers.form.key        → "API Key (tùy chọn)" / "API Key (optional)"
providers.form.save       → "Lưu" / "Save"
providers.models.add      → "+ thêm model" / "+ add model"
providers.models.placeholder → "tên model_" / "model name_"
providers.models.delete.confirm → "Xóa model này?" / "Delete this model?"
chat.no_provider          → "Chưa có provider. Thêm trong ⚡ Providers." / "No provider configured. Add one in ⚡ Providers."
```

---

## 5. Data Flow

```
ChatPanel
  → POST /api/agent/chat { message, sessionId, providerModelId: 5 }

AgentService
  → ProvidersService.findModelWithProvider(5)
  → { model: "llama3.2", provider: { baseUrl: "http://localhost:11434", key: null } }
  → OllamaProvider.streamChat(messages, "llama3.2", res, signal, sessionId, mode, providerConfig)

LLMCallerService
  → fetch(`${baseUrl}/api/chat`, {
      headers: { Authorization: key ? `Bearer ${key}` : undefined }
    })
```

---

## 6. Error Handling

| Situation | Backend | Frontend |
|---|---|---|
| `providerModelId` not found in DB | 400 Bad Request | `[lỗi]` system message in chat |
| Provider has no `baseUrl` | Use `http://localhost:11434` as fallback | — |
| Ollama unreachable | SSE `{"error":"ollama_unreachable"}` | `[lỗi]` system message |
| No providers configured | `GET /api/providers/models` returns `[]` | ModelSelector disabled + submit disabled |

---

## 7. Testing

- `providers.service.spec.ts` — CRUD unit tests with mocked `PrismaService`
- `providers.controller.spec.ts` — endpoint tests with mocked `ProvidersService`
- `llm-caller.service.spec.ts` — update to pass `baseUrl`/`key` directly (remove `SettingsService` mock)
- `agent.service.spec.ts` — update to mock `ProvidersService`, use `providerModelId` in `ChatDto`

---

## 8. Out of Scope (This Iteration)

- Cloud provider types (OpenAI, Google) — schema supports it, implementation deferred
- Auto-fetching model list from provider API — user enters model names manually
- API key encryption at rest
- Per-provider connection health check UI
