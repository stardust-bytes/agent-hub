# Frontend Routing & State Refactor — Design Spec

**Date:** 2026-06-13
**Status:** Draft

---

## Problem

The frontend is a Vue 3 SPA with no router and no centralized state. Five compounding issues:

1. **No URL routing.** `AppShell.vue` holds an `activeView` ref and swaps components with `v-if`. The browser URL is always `http://localhost:17135/` regardless of view — no bookmarks, no deep links, reload always lands on the default view, browser back/forward does nothing.
2. **Duplicated navigation union type.** The literal `'chat' | 'cowork' | 'tasks' | 'settings' | 'notes' | 'plans' | 'agent-output' | 'connectors'` is copy-pasted across `AppShell.vue`, `SidebarNav.vue`, and `BottomTabBar.vue`. Adding or changing a view requires editing several files and the copies have already drifted (several views are commented out).
3. **No centralized state.** Each view fetches and holds its own local state (providers, sessions, models, tasks…). Data is duplicated, cannot be shared, and identical APIs are re-fetched on every view mount.
4. **Scattered API calls.** Raw `fetch('/api/...')` calls live inside individual components instead of a service layer, so error handling and base-path logic are repeated.
5. **State not URL-persisted.** Sub-views such as the Memories tab inside Settings have no URL of their own; reloading loses the selected tab.

**Constraint:** the workspace stays local-first. Routing is a frontend-only concern (URL ↔ component); it sends nothing to a remote server. SQLite/LanceDB and the NestJS backend remain local.

---

## Approach

Incremental refactor in three phases. **The app must build, type-check, and run after every phase** — each phase is committed independently with manual smoke verification.

Add two de-facto-standard Vue libraries: **`vue-router`** (routing) and **Pinia** (state). Add **Vitest** to test the pure logic extracted during the refactor (SSE stream parser, store actions) — the frontend currently has zero tests, and these extractions are the riskiest part.

**Target dependency direction:** `components → stores → api`. Components no longer call `fetch` directly; Pinia stores hold state and call the `api/` layer; `api/client.ts` is the single place that builds the request, handles network failure, and throws a coded error (English key) that the frontend translates to Vietnamese via i18n (per Rule Set 2).

**Routing mode:** history mode (clean URLs like `/tasks`). `nginx.conf` already has `try_files $uri $uri/ /index.html;`, so deep links and reloads work in production with no Nginx change; the Vite dev server falls back to `index.html` automatically.

---

## Target Architecture

```
src/
├── api/                  # Stateless API call layer
│   ├── client.ts         # request() wrapper: base path, JSON, throws AppError(code)
│   ├── sessions.ts
│   ├── providers.ts
│   ├── tasks.ts
│   ├── notes.ts
│   ├── connectors.ts
│   └── agentOutput.ts
├── stores/               # Pinia stores, one per domain
│   ├── sessions.ts
│   ├── providers.ts      # providers + flat model list (shared)
│   ├── tasks.ts
│   ├── notes.ts
│   ├── connectors.ts
│   └── ui.ts             # health status, ws status, locale, sidebar open
├── composables/
│   └── useChatStream.ts  # SSE parsing extracted from ChatPanel
├── router/
│   └── index.ts          # Central route table (history mode)
├── config/
│   └── navigation.ts     # Single source of truth: nav item list
└── components/ ...
```

---

## Section 1: API Layer

### `api/client.ts`

A single `request<T>(path, options)` helper:
- Prepends `/api` and serializes JSON bodies.
- On non-2xx or network failure, throws an `AppError` carrying a **string code** (English key, e.g. `'providers.fetch_failed'`), never a localized message. Components map the code to a Vietnamese string via i18n, then append a red `[error]` system message where applicable (per existing chat error convention).
- Never exposes backend stack traces.

### `api/<domain>.ts`

One module per backend domain, exporting typed functions that wrap `request()` — e.g. `listProviders()`, `listModels()`, `createSession()`, `listTasks()`, `updateTaskStatus()`. No component imports `fetch` after this phase; all data access goes through these functions (called from stores).

### Stores (Pinia)

One store per domain holds the canonical state plus actions that call `api/`:

| Store | State | Notes |
|---|---|---|
| `providers` | providers, flat model list | Replaces per-view re-fetch of `/api/providers/models` |
| `sessions` | session list, current session id | Used by chat + SessionModal |
| `tasks` | task list by status | KanbanBoard still owns its Socket.io subscription; store holds the list |
| `notes` | notes list | |
| `connectors` | connector configs | |
| `ui` | health, ws status, locale, sidebar open | Locale persists to `localStorage('workspace.lang')` as today |

Components read from stores and call store actions. WebSocket subscription logic (KanbanBoard `/tasks` namespace) stays in the component but writes results into the `tasks` store.

### Rule

After Phase 1, no `.vue` component contains a raw `fetch('/api/...')` call. All data access goes through a store action, which calls an `api/` function.

---

## Section 2: Routing & Navigation

### `config/navigation.ts` — single source of truth

```ts
interface NavItem {
  name: string        // route name, e.g. 'cowork'
  path: string        // '/cowork'
  labelKey: string    // i18n key, e.g. 'nav.cowork'
  icon: Component | string
}
```

`SidebarNav.vue` and `BottomTabBar.vue` both render from this list. The duplicated union type is **deleted** — "active" is derived from `route.name`, not a passed-in `activeView` prop. Adding a view means adding one entry here plus one route.

### `router/index.ts` — routes (history mode)

| Path | Name | Component |
|---|---|---|
| `/` | — | redirect → `/cowork` |
| `/cowork` | `cowork` | CoworkView |
| `/tasks` | `tasks` | TasksView |
| `/notes` | `notes` | NotesView |
| `/connectors` | `connectors` | ConnectorsView |
| `/agent-output` | `agent-output` | AgentOutputView |
| `/settings` | `settings` | SettingsView (redirects to default tab) |
| `/settings/:tab` | `settings-tab` | SettingsView (e.g. `/settings/memories`) |
| `/chat` | `chat` | ChatPanel (currently non-default; route still registered) |

`/settings/:tab` drives the Settings tab selection (e.g. Memories) so the tab is URL-persisted and survives reload. Unknown paths redirect to `/cowork`.

### `AppShell.vue` changes

- Remove `activeView` ref and `onNavigate`.
- Content area becomes `<router-view />`.
- `SidebarNav` / `BottomTabBar` navigate via `router.push` (or `<RouterLink>`), no `navigate` emit / `activeView` prop.
- Mobile sidebar open/close state moves to the `ui` store (or stays local — implementation detail).

### `main.ts`

Register `app.use(router)` and `app.use(createPinia())` alongside the existing `app.use(i18n)`.

---

## Section 3: Component Decomposition

Limited to the **two largest files**; nothing else is refactored.

### `ChatPanel.vue` (801 lines)

Extract:
- **`composables/useChatStream.ts`** — reads the `POST /api/agent/chat` `ReadableStream`, classifies SSE events (`token`, `toolCall`, `toolResult`, `thinking`, `plan`, `planStepUpdate`, `planInterrupted`, `[DONE]`, `error`) and exposes message-mutation callbacks + an `AbortController`. This is the pure-ish logic and the primary Vitest target.
- **`MessageList.vue` + `MessageItem.vue`** — render messages by role (user / agent / tool-call / tool-result / system / plan), preserving the existing lazy agent-message creation ordering.
- **`ChatInputBar.vue`** — input box + model selector + Agent/Chat mode toggle.

`ChatPanel.vue` becomes a thin coordinator wiring the composable to the subcomponents.

### `CoworkView.vue` (746 lines)

Split along its existing functional clusters (exact seams determined when the file is read in detail during this phase). Decompose only along clear responsibility boundaries — no speculative splitting.

---

## Testing & Safety Net

Frontend has no tests today. To make incremental refactoring safe:

- **Every phase:** `npm run type-check` (`vue-tsc`) and `npm run build` must pass before commit; manually smoke-test every view touched by the phase.
- **Vitest (added in this refactor):** unit tests for `useChatStream` (SSE event classification + message mutation, the riskiest extraction) and for a few store actions (state transitions on success/error). Tests are written for the extracted logic, not retrofitted onto untouched components.

---

## Phasing

App runs after each phase.

1. **Phase 1 — Foundation (`api/` + Pinia).** Add `api/client.ts` + `api/*`, add Pinia, create stores, migrate each view's `fetch` calls to store actions. Views render identically. Add Vitest + store-action tests.
2. **Phase 2 — Routing.** Add `vue-router` + `config/navigation.ts`; `AppShell` uses `<router-view>`; `SidebarNav`/`BottomTabBar` derive active state from the route; delete the duplicated union type; add `/settings/:tab` sub-route.
3. **Phase 3 — Component decomposition.** Extract `useChatStream` + chat subcomponents (with Vitest for the parser); split `CoworkView`.

---

## Files Changed (summary)

| Phase | Files |
|---|---|
| 1 | **Create** `src/api/*`, `src/stores/*`; **Modify** all views to use stores; **Modify** `main.ts` (Pinia); **Create** Vitest config + store tests; **Modify** `package.json` (pinia, vitest) |
| 2 | **Create** `src/router/index.ts`, `src/config/navigation.ts`; **Modify** `AppShell.vue`, `SidebarNav.vue`, `BottomTabBar.vue`, `SettingsView.vue` (tab from route), `main.ts` (router); **Modify** `package.json` (vue-router) |
| 3 | **Create** `src/composables/useChatStream.ts`, `MessageList.vue`, `MessageItem.vue`, `ChatInputBar.vue`, CoworkView subcomponents + their tests; **Modify** `ChatPanel.vue`, `CoworkView.vue` |

`AGENTS.md` files updated before each phase's commit per the project's documentation-sync rule.

---

## Out of Scope

- `/tasks/:id` task-detail route — deferred to a later cycle.
- Changing UI appearance, color tokens, or layout (terminal aesthetic unchanged).
- Backend changes — this is frontend-only.
- Refactoring any component other than `ChatPanel` and `CoworkView`.
- Replacing Socket.io task sync or the SSE chat protocol — only relocating where their state lives.
- i18n redesign — existing `nav.*` and other keys are reused; new keys only for new error codes.
```
