# Sub-agent Monitoring Indicator

**Date:** 2026-06-11
**Status:** Draft
**PRD Reference:** [Root AGENTS.md](../../../../AGENTS.md)

## Problem

The project has a sub-agent feature (`SubagentService.spawn()`, `delegate_parallel` tool, `spawn_subagent` tool, DelegateBubble UI) but provides no way for users to tell whether any sub-agents are currently running. Sub-agent output appears inline in the chat with a `[subagent]` prefix, but there is no summary indicator showing "are any sub-agents active right now?"

## Scope

Minimal — level 1 requested by user: just know if sub-agents are running. No dashboard, no detailed panel.

## Design

### Approach: Status Bar Counter

Add a small numeric indicator to the existing `StatusBar.vue` showing the count of currently active sub-agents.

### Backend Changes

None. All tracking is frontend-side from existing SSE events:
- `toolCall` events with `name === 'spawn_subagent'` → sub-agent starting
- `subagent.done` events → sub-agent finished
- `delegate_parallel` user confirmation → pre-count subtasks

### Frontend Changes

#### ChatPanel.vue
- Add `activeSubagentCount = ref(0)`
- Increment on `parsed.toolCall.name === 'spawn_subagent'`
- In `onDelegateChoose` with `mode === 'parallel'`: increment by `subtasks.length`
- Decrement on `parsed.subagent.done`
- Emit `active-subagents-change` event to parent

#### CoworkView.vue
- Same changes as ChatPanel (identical SSE handling pattern)

#### AppShell.vue
- Add `activeSubagents = ref(0)`
- Receive `@active-subagents-change` from ChatPanel/CoworkView
- Pass as prop to StatusBar

#### StatusBar.vue
- Add optional prop `activeSubagents: number` (default 0)
- When > 0: render `● <count> sub-agents` in cyan between DB and WS indicators
- When 0: render nothing

### Layout

```
[● Backend] [✓ DB] [● 2 sub-agents] [● WS] [VI] [14:30:00]
```

- Color: `text-cyber-cyan` (`#00d4ff`)
- Font: `font-mono text-sm`
- Dot: `●` (U+25CF)
- Positioning: left side, after DB status, before WS status

### Key Files Changed

| File | Change |
|---|---|
| `frontend/src/components/ChatPanel.vue` | Add counter + emit |
| `frontend/src/components/CoworkView.vue` | Add counter + emit |
| `frontend/src/components/AppShell.vue` | Wire event → prop |
| `frontend/src/components/StatusBar.vue` | Add prop + display |

### Out of Scope

- Sub-agent detail panel
- Sub-agent run history / persistence
- Backend event modifications
