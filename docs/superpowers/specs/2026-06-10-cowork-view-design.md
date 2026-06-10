# Cowork View Design

## Summary

Split cowork mode out of ChatPanel into a dedicated full-screen view (`CoworkView.vue`) with a Claude Code-inspired 3-panel layout: File Tree (left) | Chat/Terminal (center) | Artifacts (right). Cowork becomes a first-class navigation item in the sidebar, separate from Chat and Agent modes.

## Problem

Currently cowork is a mode toggle inside ChatPanel (chat/agent/cowork). The project connection UI is buried in FilesView. There is no file tree, no code preview, and no dedicated space for the cowork experience. The user must manually switch modes and navigate to a different view to connect a project.

## Scope

This spec covers the Cowork View as a new view in the existing sidebar navigation system. Existing ChatPanel (chat/agent modes) remains untouched. Slash commands (`/plan`, `/resume-plan`) are NOT ported to CoworkView — the LLM autonomously decides planning via the `create_plan` tool.

## Architecture

### Navigation

SidebarNav and BottomTabBar get a new nav item:

| View | Label (vi) | Label (en) | Icon |
|---|---|---|---|
| `cowork` | Làm việc | Cowork | `HiCode` |

`AppShell.activeView` type gains `'cowork'`:
```typescript
type ActiveView = 'chat' | 'cowork' | 'tasks' | 'files' | 'settings' | 'providers' | 'tools' | 'notes' | 'plans'
```

Template:
```html
<CoworkView v-else-if="activeView === 'cowork'" class="flex-1 overflow-hidden" />
```

### Entry Flow

```
CoworkView.vue mounted
├── GET /api/cowork/project
│   ├── projectPath exists → render 3-panel layout
│   └── no project → render "Connect a Project" screen
│       ├── Browse button → DirectoryBrowser modal
│       ├── Connect button → POST /api/cowork/project { path }
│       └── On connect → auto-render 3-panel layout
│
├── Disconnect button in top bar
│   → DELETE /api/cowork/project
│   → Return to "Connect a Project" screen
```

### 3-Panel Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Top Bar: [Project path] ● Connected  [Browse] [Disconnect]  │
├──────────┬─────────────────────────────┬────────────────────┤
│          │                             │                    │
│ FileTree │      Chat/Terminal          │  ArtifactsPanel    │
│ (240px)  │      (flex-1)              │  (360px, toggle)   │
│          │                             │                    │
│ - Browse │ - SSE streaming agent chat  │ - Code preview     │
│ - Expand │ - Tool calls & results      │ - Plan steps       │
│ - Click  │ - Plan bubbles (auto)       │ - Diffs            │
│   to     │ - No slash commands         │ - Tool outputs     │
│   preview│ - Auto "tiếp tục" resume    │ - Collapsible      │
│          │                             │                    │
└──────────┴─────────────────────────────┴────────────────────┘
```

### Component Tree

```
CoworkView.vue
├── [TopBar] project path + status + [Browse] [Disconnect]
├── [Body] flex flex-row
│   ├── FileTree.vue (240px, overflow-y-auto)
│   ├── ChatPanel (flex-1, cowork mode only — reused from existing)
│   └── ArtifactsPanel.vue (360px, collapsible)
```

### New Components

**CoworkView.vue** — orchestrator component.
- Props: none
- Owns: `projectPath`, `connected`, `selectedFilePath` state
- Mount → `GET /api/cowork/project`
- Top bar with project display + browse/disconnect
- Renders connect screen or 3-panel layout

**FileTree.vue** — expandable directory tree.
- Props: `projectPath: string`
- Emits: `fileSelect(path: string)`
- `GET /api/cowork/browse?path=<path>` on folder click
- Indentation + expand/collapse toggle per directory
- Files are leaf nodes (not expandable)
- Click file → emit `fileSelect` with absolute path

**ArtifactsPanel.vue** — auxiliary display panel.
- Props: `selectedFilePath: string | null`, `plans: PlanData[]`, `toolResults: ToolResult[]`
- Tabs/areas:
  - **File Preview**: shows file content (fetched via `GET /api/cowork/read-file?path=`)
  - **Plan Progress**: shows active plan steps with status (reuses PlanBubble-like rendering)
  - **Diff**: shows code diff when agent writes files
- Collapsible via close button in top-right corner

### Backend Addition

One new endpoint in `CoworkController`:

| Method | Path | Description |
|---|---|---|
| GET | `/api/cowork/read-file?path=<path>` | Read file content, return `{ content, filename, size }` |

**Validation**: `isPathAllowed()` check against the connected project path. Return 403 if path is outside project.

### Existing Components — No Changes

- `ChatPanel.vue` — unchanged (still handles chat/agent modes with mode toggle)
- `FilesView.vue` — project connection UI kept for backward compatibility; will be removed later
- `PlanBubble.vue`, `PlansView.vue`, `SessionModal.vue` — no changes needed

### SSE Events in CoworkView

CoworkView's chat area uses the same SSE reader as ChatPanel (shared or duplicated). Events handled:
- `token` — streaming agent response
- `toolCall`, `toolResult` — tool execution display
- `thinking` — processing indicator
- `plan` — plan bubble (auto-generated by LLM via `create_plan` tool)
- `planStepUpdate` — live step status updates
- `planInterrupted` — stop/resume handling
- `[DONE]` — stream complete
- `error` — error display

No slash command processing needed — LLM autonomously decides planning.

### Existing Cowork UI in FilesView

The project connection section in FilesView.vue (lines 47-66) is kept for backward compatibility but is superseded by CoworkView. Users can still connect a project from FilesView, and CoworkView will pick it up on mount via `GET /api/cowork/project`.

## File Changes

### Frontend

| File | Change |
|---|---|
| `frontend/src/components/CoworkView.vue` | **New** — orchestrator component |
| `frontend/src/components/FileTree.vue` | **New** — expandable directory tree |
| `frontend/src/components/ArtifactsPanel.vue` | **New** — code preview + plan progress + diffs |
| `frontend/src/components/AppShell.vue` | Add `'cowork'` to ActiveView type, add `v-else-if` for CoworkView |
| `frontend/src/components/SidebarNav.vue` | Add Cowork nav item with `HiCode` icon |
| `frontend/src/components/BottomTabBar.vue` | Add Cowork nav item |
| `frontend/src/locales/vi.json` | Add `nav.cowork`, `cowork.*` keys |
| `frontend/src/locales/en.json` | Add `nav.cowork`, `cowork.*` keys |

### Backend

| File | Change |
|---|---|
| `backend/src/cowork/cowork.controller.ts` | Add `GET /api/cowork/read-file` endpoint |
| `backend/src/cowork/cowork.controller.spec.ts` | Add test for read-file endpoint |
| `backend/src/cowork/cowork.service.ts` | Add `readFile(path)` method with path validation |
| `backend/src/cowork/cowork.service.spec.ts` | Add test for readFile |
| `backend/src/cowork/AGENTS.md` | **New** — document module |

## i18n Keys

```json
{
  "nav": {
    "cowork": "Cowork" / "Làm việc"
  },
  "cowork": {
    "title": "Cowork Mode",
    "connect.title": "Connect a Project",
    "connect.description": "Select a local project directory to work with the AI agent.",
    "connect.browse": "Browse",
    "connect.connect": "Connect",
    "connected": "Connected",
    "disconnect": "Disconnect",
    "files": "Files",
    "artifacts": "Artifacts",
    "no_project": "No project connected",
    "read_error": "Cannot read file outside project directory"
  }
}
```

## Testing

1. **CoworkView**: mount with/without project, connect/disconnect flow
2. **FileTree**: browse, expand/collapse, file select, edge cases (empty dir, permission denied)
3. **ArtifactsPanel**: file preview, plan display, collapse
4. **Backend read-file**: valid path, path traversal attack, non-existent file, outside-project path
5. **Navigation**: sidebar cowork item → switch views, verify CoworkView mounts/unmounts
