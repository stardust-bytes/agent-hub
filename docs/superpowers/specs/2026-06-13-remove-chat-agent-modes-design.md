# Remove Chat & Agent Modes — Design Spec

**Date:** 2026-06-13
**Status:** Draft

---

## Problem

The system has three modes (`chat`, `agent`, `cowork`) but only `cowork` is actively used. The `ChatPanel.vue` component and `/chat` route are unreachable from the navigation sidebar (the default route is now `/cowork`). Maintaining dead code paths, mode branches, and a full component hierarchy for unused modes adds complexity without value.

**Goal:** Remove `chat` mode and `agent` mode + `ChatPanel.vue` from the codebase. Make `cowork` the only mode. In configuration-style files, only remove the mode entries without restructuring the file organization.

**Secondary goal:** When the user has connected a project in cowork mode, tool executors that create files (write_file, write_word, edit_word, write_excel, excel_chart, excel_add_sheet) should save directly into the project folder. When no project is connected, they fall back to the temp agent-output directory with a download link.

---

## Scope

**Out of scope:**
- Backend API restructuring (mode param in sessions remains at the DB level)
- Frontend layout/aesthetic changes
- Touching the `memory`, `knowledge`, `tasks`, `notes`, `connectors`, `usage`, `plans` modules

---

## Phase 1 — Frontend: Component & Route Cleanup

### Files to Delete

| File | Reason |
|---|---|
| `frontend/src/components/ChatPanel.vue` | The coordinator component for chat/agent mode. CoworkView covers all functionality. |

### Files to Rename

| Old Path | New Path |
|---|---|
| `frontend/src/components/chat/types.ts` | `frontend/src/components/cowork/types.ts` |
| `frontend/src/components/chat/markdown.ts` | `frontend/src/components/cowork/markdown.ts` |
| `frontend/src/components/chat/MessageItem.vue` | `frontend/src/components/cowork/MessageItem.vue` |
| `frontend/src/components/chat/MessageList.vue` | `frontend/src/components/cowork/MessageList.vue` |
| `frontend/src/components/chat/ChatInputBar.vue` | `frontend/src/components/cowork/ChatInputBar.vue` |

### Files to Modify

**`frontend/src/router/index.ts`:**
- Remove `import ChatPanel` and `{ path: '/chat', name: 'chat', component: ChatPanel }` route

**`frontend/src/components/CoworkView.vue`:**
- Update all `./chat/` imports to `./cowork/`

**`frontend/src/components/cowork/ChatInputBar.vue` (formerly chat/):**
- Remove `mode` prop (`defineProps<{ mode: 'chat' | 'agent' }>()`)
- Remove `update:mode` emit
- Remove the mode toggle buttons (Chat/Agent) from template
- Keep: `ModelSelector`, input form, stop button, streaming dots, sessions button
- Keep: `models` prop, `modelId` prop, `streaming` prop

**`frontend/src/components/SessionModal.vue`:**
- Remove `mode` prop from `defineProps`
- `fetchSessions()` and `createSession()` always use `'cowork'`

**`frontend/src/locales/vi.json` and `en.json`:**
- Remove orphaned keys: `nav.chat`, `chat.mode.chat`, `chat.mode.agent`, `chat.mode.stub`, `chat.mode.ollama`, `chat.model.offline`
- Keep: `chat.mode.cowork` (still used), all other chat.* keys (error messages, placeholders, etc.)

### CoworkInputBar Wired as Always-Agent

CoworkView sends `mode: 'cowork'` in the `POST /api/agent/chat` body. The ChatInputBar no longer passes a mode — the backend always receives `'cowork'`.

---

## Phase 2 — Backend: Mode Removal + Project Path Integration

### ToolContext Interface

```typescript
export interface ToolContext {
  sessionId: number;
  projectPath?: string;
}
```

### ChatDto

```typescript
// Before: @IsIn(['agent', 'chat', 'cowork'])
// After:  @IsIn(['cowork'])
```

### Mode Policy Config (`mode-policy.config.ts`)

Keep only the `cowork` entry. Delete `chat` and `agent` entries. The `MODE_POLICY` object still exports a `Record<string, ModePolicy>` but now has one entry.

### Mode Policy Service (`mode-policy.service.ts`)

- `getEnabledTools()`: fallback from `MODE_POLICY.agent` → `MODE_POLICY.cowork`
- `isToolAllowed()`: same fallback change
- `resolveAllowedPaths()`: same fallback change
- `getSystemPromptStyle()`: same fallback change
- `getPermissionMode()`: same fallback change
- Remove test cases for `chat` and `agent` modes

### Context Builder (`context-builder.service.ts`)

- Remove the `mode` parameter (or accept it but ignore)
- Remove `if (mode === 'chat')` early-return branch (lines 67-74)
- Remove `if (mode === 'agent')` tool description branch (lines 166-181)
- Keep the `cowork` path as the default flow
- `buildSystemPrompt()` always produces the cowork-mode prompt (with project path, file tools, auto-execute plans, delegate guidance)
- Remove `mode` from the `build()` signature
- Include project path check: if projectPath is set, include it in the prompt; if not, skip project-specific instructions

### Context Builder: Agent Output Path

The `agent-output` path instruction in the system prompt is no longer needed since agent mode is gone. Remove the `if (mode === 'agent')` branch that injects agent output path instructions.

### Agent Controller (`agent.controller.ts`)

- `dto.mode ?? 'agent'` → always pass `'cowork'`. Or remove mode from the DTO entirely.

### Agent Service (`agent.service.ts`)

- Read project path from `CoworkService.getProject()` after building context
- Pass project path to `AgentLoopService.run()`
- Remove mode parameter handling for `/plan` commands (they're always cowork)

### Agent Loop Service (`agent-loop.service.ts`)

- Accept `projectPath?: string` parameter in `run()`
- Pass `projectPath` in ToolContext when calling `executeTool()`
- Remove `mode as 'chat' | 'agent' | 'cowork'` casts

### Tool Executors (6 files)

All 6 follow the same pattern. Replace `if (context?.mode === 'agent')` logic:

```typescript
// New logic for ALL executors:
let filePath: string;

if (context?.projectPath) {
  // Connected to a project — save directly to project folder
  const filename = (args.path as string).split(/[\\/]/).pop() || 'output.file';
  filePath = path.join(context.projectPath, filename);
} else {
  // No project connected — save to agent-output, return download link
  const filename = (args.path as string).split(/[\\/]/).pop() || 'output.file';
  const sessionDir = path.join(
    this.workspace.getWorkspaceRoot(),
    'agent-output',
    `session_${context?.sessionId ?? 0}`,
  );
  filePath = path.join(sessionDir, filename);
  fs.mkdirSync(sessionDir, { recursive: true });
}

// ... write file ...

if (!context?.projectPath) {
  // No project: create AgentFile and return download link
  const agentFile = await this.prisma.agentFile.create({
    data: { filename, path: filePath, sessionId: context?.sessionId ?? 0 },
  });
  return `... [Download "${filename}"](api/files/agent/${agentFile.id}/download)`;
}
return `Written to ${filePath}`;
```

### Word/Excel Executor Specific Notes

- `write-word.executor.ts`, `edit-word.executor.ts`: Same pattern, replace `context?.mode === 'agent'` with `context?.projectPath`
- `write-excel.executor.ts`, `excel-chart.executor.ts`, `excel-add-sheet.executor.ts`: Same pattern; note these call `excel.validatePath(filePath)` before the mode check — keep the validate call but allow it to work with the resolved path

### Sessions Service

- `create()`: remove `mode` parameter, hardcode `'cowork'`
- `findAll()`: remove `mode` filter (return all sessions)
- `sessions.controller.ts`: remove mode from body and query params

### Prisma Schema

- Change `Session.mode` default from `"chat"` to `"cowork"`

---

## Phase 3 — Test Updates

| Test File | Changes |
|---|---|
| `agent.controller.spec.ts` | Update mode values; remove chat/agent variants |
| `agent.service.spec.ts` | Update mode= → projectPath tests |
| `context-builder.service.spec.ts` | Remove chat/agent mode tests; add projectPath tests |
| `agent-loop.service.spec.ts` | Update ToolContext assertions |
| `mode-policy.service.spec.ts` | Remove chat/agent test cases; update fallback tests |
| `sessions.service.spec.ts` | Update default mode to 'cowork' |
| `write-file.executor.spec.ts` | Update ToolContext, add projectPath test cases |
| `write-word.executor.spec.ts` | Same |
| `write-excel.executor.spec.ts` | Same |
| `spawn-subagent.executor.spec.ts` | Update ToolContext |
| `write-file.executor.spec.ts` | Update test assertions |

---

## Files Changed (summary)

| Phase | Files |
|---|---|
| 1 (Frontend) | **Delete:** `ChatPanel.vue`; **Rename:** `chat/` → `cowork/` (5 files); **Modify:** `CoworkView.vue`, `router/index.ts`, `SessionModal.vue`, `cowork/ChatInputBar.vue`, `locales/*.json`, `AGENTS.md` files |
| 2 (Backend) | **Modify:** `ToolContext` interface, `ChatDto`, `mode-policy.config.ts`, `mode-policy.service.ts`, `context-builder.service.ts`, `agent.controller.ts`, `agent.service.ts`, `agent-loop.service.ts`, 6 tool executors, `sessions.service.ts`, `sessions.controller.ts`, Prisma schema |
| 3 (Tests) | **Modify:** 10+ test files |
