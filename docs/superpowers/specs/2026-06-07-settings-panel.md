# Phase 4 — Settings Panel

**Date:** 2026-06-07
**Status:** Draft
**Goal:** Allow configuring workspace (Ollama URL, default model) via UI without editing `.env` or restarting.

---

## 1. User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| SET-1 | User changes Ollama base URL | URL saved to DB, next chat request uses new URL |
| SET-2 | User selects default model from dropdown | Value persisted, loaded on app start |
| SET-3 | User toggles language from Settings | Same as sidebar toggle |
| SET-4 | User sees app version + backend/DB status | Read-only info panel |

---

## 2. Prisma Schema

Add `Setting` model to `backend/prisma/schema.prisma`:

```prisma
model Setting {
  key   String @id
  value String
}
```

Built-in seed keys:

| Key | Default Value | Description |
|---|---|---|
| `ollama.baseUrl` | `http://localhost:11434` | Ollama server URL |
| `ollama.defaultModel` | `llama3.2` | Default chat model |

---

## 3. Backend

### SettingsModule

**Files:**
- `backend/src/settings/settings.module.ts`
- `backend/src/settings/settings.service.ts`
- `backend/src/settings/settings.service.spec.ts`
- `backend/src/settings/settings.controller.ts`
- `backend/src/settings/settings.controller.spec.ts`

**SettingsService:**
- `findAll()` → `GET /api/settings` — returns `{ ollama: { baseUrl, defaultModel } }`
- `upsert(key, value)` → `PATCH /api/settings/:key` — upsert into Setting table
- If key not found, return fallback from env/defaults (never throw)
- Keys: `ollama.baseUrl`, `ollama.defaultModel`

**SettingsController:**
- `@Get()` → `findAll()`
- `@Patch(':key')` → `upsert(key, dto.value)` with `@Body() dto: { value: string }`

**Env fallback:** If setting not in DB, use `OLLAMA_URL` env var or `http://localhost:11434`.

### AgentService Update

Replace `ConfigService` injection with `SettingsService` for `ollamaUrl`:
- Read `ollama.baseUrl` from settings on each request (or cache with TTL)

### AppModule

Add `SettingsModule` to imports. Import `PrismaModule` (already global).

---

## 4. Frontend

### SettingsView.vue

Full-width view (like TasksView):

```
┌────────────────────────────────────────────┐
│ [⚙] SETTINGS                               │
├────────────────────────────────────────────┤
│                                            │
│ Ollama Base URL                            │
│ [http://localhost:11434         ] [Save]   │
│                                            │
│ Default Model                              │
│ [llama3.2                     ] [Save]     │
│                                            │
│ ── Info ──                                 │
│ Version: 0.1.0                             │
│ Backend: ● ok · DB: ✓ connected            │
│────────────────────────────────────────────│
```

- Load settings from `GET /api/settings` on mount
- Each field has its own Save button → `PATCH /api/settings/:key`
- Info section is read-only, shows version from `package.json` + health

### AppShell Update

When `activeView === 'settings'`, render `SettingsView` full-width.

### SidebarNav

Settings icon ⚙️ already exists but is inert. Wire it to emit `navigate('settings')`.

### Locale Keys

Add to both `vi.json` and `en.json`:

| Key | vi | en |
|---|---|---|
| `settings.header` | CÀI ĐẶT | SETTINGS |
| `settings.ollamaUrl` | Ollama Base URL | Ollama Base URL |
| `settings.defaultModel` | Model mặc định | Default Model |
| `settings.save` | Lưu | Save |
| `settings.saved` | ✓ Đã lưu | ✓ Saved |
| `settings.version` | Phiên bản | Version |
| `settings.info` | THÔNG TIN | INFO |

---

## 5. Implementation Order

1. Prisma migration: add `Setting` model
2. Backend: `SettingsService` TDD + implement
3. Backend: `SettingsController` TDD + implement
4. Backend: `SettingsModule`, register in AppModule
5. Backend: Update `AgentService` to use `SettingsService` for URL
6. Frontend: locale keys
7. Frontend: `SettingsView.vue`
8. Frontend: Wire SidebarNav ⚙️ to navigate
9. Frontend: Update AppShell to render SettingsView
10. Verify: backend tests pass, frontend builds
