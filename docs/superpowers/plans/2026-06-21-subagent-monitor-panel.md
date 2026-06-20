# Sub-agent Monitor Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated UI panel that displays each running sub-agent as an independent terminal session with live streaming of tokens, tool calls, results, and thinking events — separate from the main chat message list.

**Architecture:** A new `SubagentMonitorPanel.vue` component sits alongside `ArtifactsPanel` as a toggleable right-side panel. The backend adds a `subagentRunId` (UUID) to every sub-agent SSE event so the frontend can group events by run. `CoworkView.vue` refactors its `onSubagent` handler to manage `SubagentSession[]` instead of pushing inline chat messages. `ProjectBar.vue` gets a toggle button for the panel. Data flows: SSE → `parseSseStream` → `onSubagent` → `SubagentSession` append → reactive render in panel.

**Spec:** `docs/superpowers/specs/2026-06-21-subagent-monitor-panel-design.md`

**Tech Stack:** NestJS 10, Vue 3 + Pinia + vue-router, Vitest/Jest.

## Global Constraints

- Backend port `13596`; CORS origin only `http://localhost:17135`.
- All DB access via injected `PrismaService`; no raw SQL.
- Frontend: `font-mono`, max `rounded`, no shadows/gradients, icons from `vue-icons-plus/hi`, all user-facing strings via `t('key')` (vi primary, en secondary), `v-html` only via `DOMPurify`.
- Commit messages: lowercase type prefix (`feat`/`fix`/`refactor`/`chore`), no trailing period, no `Co-Authored-By`.
- Update `AGENTS.md` before committing code that changes module status/files/endpoints/deps.

---

### Task 1: Add `subagentRunId` to backend SSE events

**Files:**
- Modify: `backend/src/agent/subagent/subagent.service.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`

**Interfaces:**
- `SubagentService.spawn()` and `delegate()` generate a UUID per run
- The `createPrefixedResponse` wrapper includes `subagentRunId` in every SSE event
- Agent loop passes the run context through when calling subagent service

- [ ] **Step 1: Generate and pass runId**

In `backend/src/agent/subagent/subagent.service.ts`:
- In `spawn()`: generate `const runId = crypto.randomUUID()` at the top, pass to `createPrefixedResponse(res, subagentName, runId)`
- In `createPrefixedResponse()`: add `runId` param, include `parsed.subagentRunId = runId` in all wrapped events

- [ ] **Step 2: Pass runId through agent-loop**

In `backend/src/agent/services/agent-loop.service.ts`:
- In `run()` method: add optional `subagentRunId?: string` param (auto-generated if not provided)
- All SSE events from the loop include `subagentRunId` when set
- When calling `subagentService.spawn()`/`delegate()`, pass the generated runId

- [ ] **Step 3: Type-check**

Run: `cd backend && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/subagent/subagent.service.ts backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: add subagentRunId to SSE events for session grouping"
```

---

### Task 2: SubagentEvent interface update

**Files:**
- Modify: `frontend/src/composables/useChatStream.ts`

**Interfaces:**
- `SubagentEvent` gains `subagentRunId?: string` field
- Used downstream by CoworkView to group events

- [ ] **Step 1: Update SubagentEvent**

Add `subagentRunId?: string` to the `SubagentEvent` interface.

```ts
export interface SubagentEvent {
  done?: boolean
  token?: string
  toolCall?: { name: string; args: Record<string, unknown> }
  toolResult?: { name: string; result: string }
  thinking?: string
  toolApprovalRequired?: { id: string; name: string; args: Record<string, unknown> }
  subagentName?: string
  subagentRunId?: string    // new
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/composables/useChatStream.ts
git commit -m "feat: add subagentRunId to SubagentEvent"
```

---

### Task 3: Build SubagentMonitorPanel component

**Files:**
- Create: `frontend/src/components/SubagentMonitorPanel.vue`

**Interfaces:**
- Consumes: `SubagentSession[]`, `visible` prop
- Produces: reactive session cards with live log streaming
- All strings via `t('subagent.*')`, `font-mono`, no `rounded-lg`/shadows/gradients, icons from `vue-icons-plus/hi`

- [ ] **Step 1: Define types**

At the top of the component (or in a shared types file), define:

```ts
interface SubagentLogEntry {
  type: 'thinking' | 'toolCall' | 'toolResult' | 'token' | 'error' | 'done'
  text: string
  timestamp: string
  toolName?: string
}

interface SubagentSession {
  id: string
  name: string
  status: 'running' | 'completed' | 'failed'
  logs: SubagentLogEntry[]
  startedAt: string
  completedAt?: string
}
```

- [ ] **Step 2: Build template**

```html
<template>
  <div v-if="visible" class="w-80 shrink-0 border-l border-cyber-code-border bg-cyber-bg flex flex-col overflow-hidden">
    <!-- header -->
    <div class="flex items-center gap-2 px-3 py-2 bg-cyber-dark border-b border-cyber-code-border shrink-0">
      <span class="text-sm text-cyber-cyan font-mono">{{ t('subagent.panel.header') }}</span>
      <span v-if="sessions.length" class="text-xs text-cyber-muted font-mono">({{ sessions.length }})</span>
      <button @click="emit('close')" class="ml-auto text-cyber-muted text-sm font-mono hover:text-cyber-accent">✕</button>
    </div>
    <!-- session list -->
    <div class="flex-1 overflow-y-auto p-2 space-y-2">
      <div v-for="s in sessions" :key="s.id" class="border-l-2"
        :class="s.status === 'running' ? 'border-cyber-green animate-pulse' : 'border-cyber-code-border'">
        <!-- session card content -->
        ...
      </div>
      <div v-if="!sessions.length" class="text-center text-cyber-muted text-sm font-mono py-8">
        {{ t('subagent.panel.empty') }}
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Build session card template**

For each session:
- Header row: `◈ {{ s.name }}` in `text-cyber-cyan` + status badge + elapsed time in `text-cyber-muted`
- Log area (`max-h-60 overflow-y-auto`): iterate `s.logs`
  - `thinking` → `⟳ {{ text }}` in `text-cyber-accent/60`
  - `toolCall` → `[⚙] {{ text }}` in `text-cyber-orange` with expand/collapse for long args
  - `toolResult` → preview in `text-cyber-green`
  - `token` → live text in `text-cyber-text`
  - `error` → `✗ {{ text }}` in `text-red-400`
  - `done` → `✓ Done` badge in `text-cyber-green`
- Auto-scroll to bottom while `s.status === 'running'`

- [ ] **Step 4: Implement reactivity**

Use `watch(sessions, ...)` with `{ deep: true }` to auto-scroll on new log entries.
Use `nextTick` after appending log entries before scrolling.

- [ ] **Step 5: Type-check**

Run: `cd frontend && npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SubagentMonitorPanel.vue
git commit -m "feat: add SubagentMonitorPanel component"
```

---

### Task 4: Add i18n keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add keys to vi.json**

```json
"subagent.panel.header": "Sub-agents",
"subagent.panel.empty": "Không có sub-agent nào đang chạy",
"subagent.session.running": "đang chạy",
"subagent.session.done": "Hoàn thành",
"subagent.session.failed": "Thất bại",
"subagent.log.view": "xem kết quả",
"subagent.log.collapse": "thu gọn"
```

- [ ] **Step 2: Add keys to en.json**

```json
"subagent.panel.header": "Sub-agents",
"subagent.panel.empty": "No sub-agents active",
"subagent.session.running": "running",
"subagent.session.done": "Done",
"subagent.session.failed": "Failed",
"subagent.log.view": "view full result",
"subagent.log.collapse": "collapse"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add subagent monitor i18n keys"
```

---

### Task 5: Refactor CoworkView to use SubagentSessions

**Files:**
- Modify: `frontend/src/components/CoworkView.vue`
- Modify: `frontend/src/components/ProjectBar.vue`

**Interfaces:**
- CoworkView manages `subagentSessions: ref<SubagentSession[]>` and `subagentMonitorVisible: ref(false)`
- `onSubagent` handler creates/updates sessions instead of pushing chat messages
- Sub-agent tool results still pushed as minimal chat messages (for history), but detailed logs go to sessions
- ProjectBar gets a toggle button for the panel

- [ ] **Step 1: Add state to CoworkView**

```ts
import SubagentMonitorPanel from './SubagentMonitorPanel.vue'

const subagentSessions = ref<SubagentSession[]>([])
const subagentMonitorVisible = ref(false)
```

Define helper functions:
- `getOrCreateSession(runId, name): SubagentSession` — find existing or create new
- `appendLog(session, entry)` — push log entry, auto-scroll via nextTick

- [ ] **Step 2: Refactor onSubagent handler**

Replace the current inline message pushes with session log appends:

```ts
onSubagent(ev) {
  const session = this.getOrCreateSession(ev.subagentRunId, ev.subagentName)
  if (ev.done) {
    session.status = 'completed'
    session.completedAt = now()
    activeSubagentCount.value--
  } else if (ev.toolApprovalRequired) {
    // route to main approval handler
    callbacks.onToolApprovalRequired?.(...)
  } else if (ev.token) {
    session.logs.push({ type: 'token', text: String(ev.token), timestamp: now() })
  } else if (ev.toolCall) {
    session.logs.push({ type: 'toolCall', text: `${ev.toolCall.name}(${...})`, timestamp: now(), toolName: ev.toolCall.name })
  } else if (ev.toolResult) {
    session.logs.push({ type: 'toolResult', text: ev.toolResult.result.slice(0, 500), timestamp: now(), toolName: ev.toolResult.name })
  } else if (ev.thinking) {
    session.logs.push({ type: 'thinking', text: String(ev.thinking), timestamp: now() })
  }
  triggerRef(subagentSessions)
}
```

Still push brief chat messages for key sub-agent events (tool calls/results) so the main chat is not empty, but prefix with session name.

- [ ] **Step 3: Wire SubagentMonitorPanel into template**

Add next to ArtifactsPanel:

```html
<SubagentMonitorPanel
  :visible="subagentMonitorVisible"
  :sessions="subagentSessions"
  @close="subagentMonitorVisible = false"
/>
```

- [ ] **Step 4: Update ProjectBar**

Add optional prop `subagentCount: number` and emit `toggle-subagent-monitor`. When > 0, render a button `◈ {{ subagentCount }}` alongside the artifacts toggle button.

- [ ] **Step 5: Wire ProjectBar toggle in CoworkView**

```html
<ProjectBar
  ...
  :subagent-count="activeSubagentCount"
  @toggle-subagent-monitor="subagentMonitorVisible = !subagentMonitorVisible"
/>
```

- [ ] **Step 6: Type-check**

Run: `cd frontend && npm run type-check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/CoworkView.vue frontend/src/components/ProjectBar.vue
git commit -m "feat: wire SubagentMonitorPanel into CoworkView and ProjectBar"
```

---

### Task 6: Clean up old subagent inline display

**Files:**
- Modify: `frontend/src/components/CoworkView.vue`

**Rationale:** With the monitor panel, sub-agent tool calls/results no longer need full inline display in the main chat. Keep a minimal summary line (`[subagent:<name>] completed` / `[subagent:<name>] running tool...`) so the chat history is coherent, but remove the verbose inline `[subagent]` messages.

- [ ] **Step 1: Reduce inline verbosity**

In `onSubagent`:
- `toolCall`: push a brief `[subagent:<name>] running <tool>...` instead of full args
- `toolResult`: push `[subagent:<name>] ✓ done` or `[subagent:<name>] ✗ <error>` very briefly
- `thinking`: push nothing (or a minimal dot indicator)
- `token`: push nothing (streaming goes only to the panel)

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CoworkView.vue
git commit -m "refactor: reduce inline subagent messages, use monitor panel instead"
```

---

### Task 7: Update AGENTS.md and final verification

**Files:**
- Modify: `frontend/src/components/AGENTS.md`
- Modify: `frontend/AGENTS.md`
- Modify: `backend/src/agent/AGENTS.md`

- [ ] **Step 1: Update frontend AGENTS.md**

In `frontend/src/components/AGENTS.md`:
- Add `SubagentMonitorPanel.vue` to the component map
- Update `CoworkView.vue` section to mention `subagentSessions` management
- Update `ProjectBar.vue` section to mention `subagentCount` prop

- [ ] **Step 2: Update frontend AGENTS.md (root)**

In `frontend/AGENTS.md`:
- Add `SubagentMonitorPanel` to component hierarchy

- [ ] **Step 3: Update backend AGENTS.md**

In `backend/src/agent/AGENTS.md`:
- Update `subagent.service.ts` description to mention `subagentRunId` in SSE events
- Update SSE events table with `subagentRunId` field

- [ ] **Step 4: Full build verification**

```bash
cd backend && npm run build
cd frontend && npm run build
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AGENTS.md frontend/AGENTS.md backend/src/agent/AGENTS.md
git commit -m "docs: update AGENTS.md for SubagentMonitorPanel"
```

---

## Self-Review

**Spec coverage:**
- § Panel component → Task 3
- § Backend changes (subagentRunId) → Task 1
- § Frontend changes (CoworkView, ProjectBar) → Tasks 4–6
- § i18n → Task 4
- § AGENTS.md updates → Task 7

**Edge cases:**
- Multiple sub-agents running simultaneously: each gets its own session card by `subagentRunId`
- Sub-agent finishes before panel is opened: sessions maintain completed state
- No sub-agents: panel shows empty state via `sessions.length === 0`
- Long tool results: truncated to 500 chars in the panel, "view full result" link opens raw
- Page reload: session history lost (out of scope), only persistent chat messages remain
