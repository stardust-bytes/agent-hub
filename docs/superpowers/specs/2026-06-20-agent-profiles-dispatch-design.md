# Agent Profiles & Dispatch — Design

- **Date:** 2026-06-20
- **Status:** Approved (brainstorming) — pending implementation plan
- **Scope:** Backend (`backend/src/agent`, new `agent-profiles/` module) + Frontend (settings UI, slash command)

## 1. Context & Motivation

The product already ships a working sub-agent dispatch mechanism:

- Tools `spawn_subagent` and `delegate` are seeded **enabled by default** (`backend/prisma/seed.cjs`), are **not** denied by the cowork mode policy, and are therefore exposed to the main LLM.
- `AgentLoopService` intercepts both tool calls (`spawn_subagent`, `delegate`) and routes them to `SubagentService.spawn()` / `SubagentService.delegate()`.
- `SubagentService.delegate()` already runs multiple tasks in parallel (`Promise.allSettled`) and streams `delegate` / `delegateProgress` / `delegateResult` SSE events; sub-agent events are flagged `subagent: true`.
- The frontend (`useChatStream.ts`, `CoworkView.vue`, `StatusBar.vue`) already renders these events.
- The system prompt actively instructs the agent to delegate automatically (`context-builder.service.ts`).

So **autonomous parallel dispatch is functional today**. What is missing are controls and specialization. This feature adds:

1. A **toggle** for autonomous dispatch (currently always on, uncontrollable).
2. **Agent Profiles** — named specializations (system prompt + scoped tool set + optional model) usable both by the main agent (via the `profile` argument) and by users (via a slash command).
3. **Safety limits** — concurrency cap and recursion prevention. Today a sub-agent inherits the full tool list including `spawn_subagent`/`delegate`, allowing unbounded recursion / token blow-up.
4. A user trigger (`/agent <slug> <task>`) and a management UI.

## 2. Goals / Non-Goals

### Goals (v1)
- CRUD for Agent Profiles, persisted in SQLite.
- Main agent can dispatch to a named profile (`spawn_subagent`/`delegate` accept a `profile` slug).
- User can run a profile from chat via `/agent <slug> <task>`.
- A setting to enable/disable autonomous dispatch by the main agent.
- Concurrency cap + recursion block, applied to both autonomous and user-triggered runs.
- Management UI (a tab under Settings) with create/edit, tool selection, and a quick test.

### Non-Goals (v1, with extension hooks left in place)
- Background/async execution with later notification (v1 runs synchronously in the chat stream).
- Git worktree / remote isolation per sub-agent.
- Multi-level nesting beyond depth 1 (sub-agents do not spawn further sub-agents).
- Cross-session agent orchestration.

## 3. Data Model

New Prisma model `AgentProfile`:

```prisma
model AgentProfile {
  id           Int      @id @default(autoincrement())
  slug         String   @unique          // used by /agent <slug> and the profile arg
  name         String
  description  String?
  systemPrompt String                    // the sub-agent's role/instructions
  allowedTools String   @default("*")    // JSON: "*" or ["read_file","grep",...]
  modelId      Int?                       // null = inherit the main session's model
  enabled      Boolean  @default(true)
  builtin      Boolean  @default(false)   // seeded defaults, not user-deletable
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Migration follows the project DB rules (additive, nullable/defaulted columns). Seed a small set of `builtin` profiles: `researcher`, `code-reviewer`, `explorer`. Built-in profiles can be edited and disabled but not deleted.

The autonomous-dispatch toggle is stored in the existing `Setting` table under key `agent.autoDispatch` (`"true"`/`"false"`, default `"true"` to preserve current behavior).

## 4. Backend

### 4.1 New module `agent-profiles/`
- `AgentProfilesService` — CRUD via `PrismaService` (`findAll`, `findBySlug`, `create`, `update`, `remove`; `remove` rejects `builtin`).
- `AgentProfilesController` — `GET/POST/PATCH/DELETE /api/agent-profiles`, typed DTOs with `class-validator` (`CreateAgentProfileDto`, `UpdateAgentProfileDto`). `allowedTools` validated as `"*"` or an array of known tool names.
- Exported so `AgentModule` can inject the service.

### 4.2 Dispatch integration (`agent`)
- Extend the `spawn_subagent` and `delegate` tool parameter schemas (in `seed.cjs`) with an optional `profile` (string, slug).
- In `AgentLoopService`, when handling `spawn_subagent`/`delegate`:
  - Resolve `profile` via `AgentProfilesService.findBySlug`. If the slug is missing/disabled, return a clear error string into the tool result (no crash) and continue.
  - Build the sub-agent system prompt from `profile.systemPrompt` (fallback to the current generic prompt when no profile is supplied).
  - Filter the tool list passed to `SubagentService` by `profile.allowedTools` (reuse the same filtering shape `ModePolicyService` uses). **Always strip `spawn_subagent` and `delegate`** from a sub-agent's tools regardless of profile → enforces depth-1 (recursion block).
  - Resolve `profile.modelId` when set; otherwise inherit the caller's provider/model.
- **Autonomous toggle:** when `agent.autoDispatch` is `false`, omit `spawn_subagent`/`delegate` from the tool list given to the **main** agent (in `context-builder`), so the LLM cannot self-dispatch. User-triggered `/agent` still works.
- **Concurrency cap:** `SubagentService.delegate` limits parallelism to N (default 4) via a small batching/pool wrapper; configurable later. Document the cap; it applies to autonomous and user runs.

### 4.3 User trigger `/agent <slug> <task>`
- Parsed in the chat entry path alongside the existing `/plan ...` handling. On match, run a single sub-agent with the resolved profile via `SubagentService.spawn`, streaming `subagent:true` events (already supported by the UI).
- Unknown/disabled slug → system message in chat listing available slugs.

## 5. Frontend

- New **"Agents"** tab inside `SettingsView` (alongside Providers/Tools), backed by a new `api/agentProfiles.ts` + a Pinia store.
  - List profiles; create/edit form (name, slug, description, system prompt, tool multi-select reusing the ToolsView selection style, model select reusing `ModelSelector`, enabled toggle).
  - A "test" action that sends a sample task to the profile and shows the streamed result.
  - A global switch for `agent.autoDispatch` (in the same tab or the general settings tab).
- `SlashMenu.vue` gains an `/agent` suggestion and lists enabled profile slugs fetched from `GET /api/agent-profiles`.
- i18n: add `agents.*` keys (vi primary, en secondary).

## 6. Error Handling

- Invalid/disabled profile slug (autonomous or `/agent`) → descriptive message, no exception surfaced to the user; the loop continues.
- Sub-agent failure in `delegate` → already captured as `{ status: 'failed', summary }` per task.
- DTO validation errors → handled by the global `ValidationPipe` + `HttpExceptionFilter`; frontend maps keys to i18n.
- Deleting a `builtin` profile → 400 with an English key.

## 7. Reuse vs New

- **Reuse:** `SubagentService.spawn/delegate`, SSE `subagent`/`delegate` handling (BE + FE), `SlashMenu`, `ModelSelector`, Tools/Providers UI patterns, `PrismaService`, `ValidationPipe`/`HttpExceptionFilter`, `ModePolicyService` tool-filtering shape.
- **New:** `AgentProfile` model + migration + seed, `agent-profiles/` module, `profile` arg + resolution in the loop, recursion strip + concurrency cap, `agent.autoDispatch` setting, `/agent` parser, Agents UI + store + api module + i18n keys.

## 8. Testing (TDD per project rules)

- `AgentProfilesService` — CRUD, `findBySlug`, builtin-delete rejection.
- `AgentProfilesController` — DTO validation, endpoints.
- Profile resolution + tool filtering — correct prompt/tools; `spawn_subagent`/`delegate` always stripped from sub-agent tools.
- Autonomous toggle — tools omitted from main agent when off.
- `/agent` parser — valid slug runs a sub-agent; unknown slug returns guidance.
- Concurrency cap — no more than N parallel.

## 9. Out of Scope (future)

Background execution + notifications, worktree/remote isolation, multi-level nesting, per-profile rate/cost budgets, profile sharing/export.
