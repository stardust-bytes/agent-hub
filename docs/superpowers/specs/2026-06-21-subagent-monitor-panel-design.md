# Sub-agent Monitor Panel

**Date:** 2026-06-21
**Status:** Draft
**PRD Reference:** [Root AGENTS.md](../../../../AGENTS.md)

## Problem

Sub-agent streaming output is interleaved into the main chat message list with a `[subagent:<name>]` prefix. Users cannot:
- See sub-agent activity separately from the main conversation
- Track multiple sub-agents running in parallel (delegate mode)
- Replay or inspect a sub-agent's full run after it completes
- Distinguish which tokens/tools belong to which sub-agent

## Scope

A dedicated UI panel (toggleable, similar to ArtifactsPanel) that displays each running sub-agent as an independent terminal session with live streaming of tokens, tool calls, results, and thinking events. Maintains history of completed runs within the current chat session.

## Design

### Panel: SubagentMonitorPanel.vue

A right-side collapsible panel (flex-1, width ~30%) sitting alongside the chat + artifacts panels. Modeled after ArtifactsPanel's toggle pattern.

#### States

| State | Visual |
|---|---|
| No sub-agents | Hidden/minimized; toggle button in ProjectBar shows "(0)" |
| Running | Panel slides in with active sessions highlighted with animated border |
| Completed | Sessions show final summary; collapsible |

#### Layout

```
┌─────────────────────────────┐
│ ◈ Sub-agents        [✕]    │ ← header, bg-cyber-dark
├─────────────────────────────┤
│ ┌─ ◈ researcher ──────┐    │ ← active session card
│ │ ⟳ Gathering data... │    │    border-cyber-green when live
│ │ [⚙] search_knowledge│    │    animated pulse on left border
│ │ [✓] Found 3 results │    │
│ │ Done in 2.4s        │    │
│ └─────────────────────┘    │
│ ┌─ ◈ code-reviewer ───┐    │ ← completed session (collapsible)
│ │ ✓ Completed. 4 files │    │    border-cyber-code-border
│ │ [view log ▸]        │    │
│ └─────────────────────┘    │
└─────────────────────────────┘
```

Each sub-agent session card contains a scrollable log area showing:
- **Thinking**: `⟳ <text>` in `text-cyber-accent/60`
- **Tool call**: `[⚙] <name>(<args>)` in `text-cyber-orange`
- **Tool result**: preview in `text-cyber-green`
- **Token stream**: live text in `text-cyber-text` with typewriter effect
- **Completion badge**: `✓ Done` in green, `✗ Failed` in red, with duration

### Backend Changes

Minimal — the existing `subagentName` in SSE events is sufficient. However, to support replay of completed sub-agent runs after page reload:

1. **Add `subagentRunId` to SSE events** — a UUID per `spawn()` call so the frontend can group events by run.
2. **Optionally persist sub-agent logs** — new `SubagentRunLog` model if replay across sessions is desired (deferred if out of scope).

### Frontend Changes

#### New Component: `frontend/src/components/SubagentMonitorPanel.vue`

Props:
```ts
{
  visible: boolean
  sessions: SubagentSession[]
}
```

Emits:
```ts
{
  close: []
}
```

Interface:
```ts
interface SubagentLogEntry {
  type: 'thinking' | 'toolCall' | 'toolResult' | 'token' | 'error' | 'done'
  text: string
  timestamp: string
  toolName?: string
}

interface SubagentSession {
  id: string          // UUID from backend
  name: string        // profile slug or 'subagent'
  status: 'running' | 'completed' | 'failed'
  logs: SubagentLogEntry[]
  startedAt: string
  completedAt?: string
}
```

#### Modified: `CoworkView.vue`

- Replace inline `onSubagent` message pushes with `subagentSessions` ref management
- Add `subagentSessions` reactive array of `SubagentSession`
- On `subagent.toolApprovalRequired` → route to main `onToolApprovalRequired` (already done)
- Add toggle button for panel visibility (next to artifacts toggle)
- Update `activeSubagentCount` from sessions rather than separate counter

#### Modified: `ProjectBar.vue`

- Add optional prop `subagentCount: number`
- When > 0: show `◈ <count>` button alongside artifacts toggle
- Emit `toggle-subagent-monitor` event

#### Modified: `useChatStream.ts`

- Add optional `subagentRunId?: string` to `SubagentEvent`
- Update `SubagentEvent` interface to include `runId` for grouping

### Data Flow

```
Backend SSE event
  → parseSseStream routes to onSubagent(ev)
  → CoworkView finds or creates SubagentSession by ev.subagentName + runId
  → Appends SubagentLogEntry to session.logs
  → SubagentMonitorPanel renders session cards reactively
```

### Wireframe Detail

#### Card — Running State

```
┌──────────────────────────────────┐
│ ◈ researcher             00:12  │
│ ├ live indicator               │
│ ───────────────────────────────│
│ ⟳ Searching knowledge base...  │
│ [⚙] search_knowledge(query=..) │
│ Found 3 relevant documents     │
│ ─ text streaming ──────────────│
│ Based on the knowledge base...  │
│ The project structure shows...  │
│                                │
└──────────────────────────────────┘
```

- Left border: `border-l-2 border-cyber-green` with `animate-pulse` on opacity
- Header: session name in `text-cyber-cyan`, elapsed time in `text-cyber-muted`
- Log area: `max-h-60 overflow-y-auto`
- Auto-scroll to bottom while streaming

#### Card — Completed State

```
┌──────────────────────────────────┐
│ ◈ code-reviewer      ✓ 3.2s    │
│ ───────────────────────────────│
│ [⚙] read_file(path=src/...)    │
│ [⚙] read_file(path=src/...)    │
│ [⚙] grep(pattern=TODO)         │
│ ✓ Found 2 issues               │
│ [view full result ▸]           │
└──────────────────────────────────┘
```

- Left border: `border-l-2 border-cyber-code-border`
- Header shows `✓` or `✗` + duration
- Log collapsed by default; click to expand
- "view full result" opens raw tool result

#### Empty State

```
┌──────────────────────────────────┐
│       No sub-agents active       │
│   Sub-agents appear here when    │
│   the main agent spawns them.    │
└──────────────────────────────────┘
```

### i18n Keys

```
subagent.panel.header   → "Sub-agents" / "Sub-agents"
subagent.panel.empty    → "No sub-agents active" / "Không có sub-agent nào đang chạy"
subagent.session.running → "running" / "đang chạy"
subagent.session.done   → "Done" / "Hoàn thành"
subagent.session.failed → "Failed" / "Thất bại"
subagent.log.view       → "view full result" / "xem kết quả"
subagent.log.collapse   → "collapse" / "thu gọn"
```

### Files Changed

| File | Change |
|---|---|
| `frontend/src/components/SubagentMonitorPanel.vue` | **New** — monitor panel component |
| `frontend/src/components/CoworkView.vue` | Refactor `onSubagent` to use `subagentSessions`; add panel toggle |
| `frontend/src/components/ProjectBar.vue` | Add `subagentCount` prop + toggle button |
| `frontend/src/composables/useChatStream.ts` | Add `subagentRunId` to `SubagentEvent` |
| `frontend/src/locales/vi.json` | Add `subagent.*` keys |
| `frontend/src/locales/en.json` | Add `subagent.*` keys |
| `backend/src/agent/subagent/subagent.service.ts` | Add `runId` (UUID) to prefixed SSE events |
| `frontend/src/components/AGENTS.md` | Document new component |

### Out of Scope

- Persisting sub-agent logs across sessions (no DB model)
- Controlling/killing individual sub-agents from the panel
- Delegate progress visualization (separate DelegateBubble exists)
- Historical replay after page reload (requires backend persistence)
