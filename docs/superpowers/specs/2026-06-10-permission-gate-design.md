# Permission Gate: Mode-Aware Tool & Filesystem Isolation Design

Date: 2026-06-10

## Problem

Agent mode creates files in wrong directories (backend CWD) instead of a designated storage area, and download links fail because files aren't within `workspaceRoot`. The core cause: the system has no centralized policy defining which tools, paths, and context each mode (chat/agent/cowork) can access — logic is scattered across `ContextBuilderService`, `AgentLoopService`, `WorkspaceService`, and `PermissionsService`.

## Decision

Build a single `ModePolicy` config object (static, code-first) that centralizes:
- Tool allow/deny lists per mode
- Allowed filesystem paths per mode (with `{workspaceRoot}` / `{projectPath}` placeholders)
- System prompt style selection per mode
- Environment context injection per mode

## Architecture

### 1. ModePolicy Config

File: `backend/src/mode-policy/mode-policy.config.ts`

```typescript
export type SystemPromptStyle = 'chat' | 'agent' | 'cowork';

export interface ModePolicyEntry {
  enabledTools: '*' | string[];
  deniedTools: string[];
  allowedPaths: string[];
  systemPromptStyle: SystemPromptStyle;
  envContext: string[];
}

export const MODE_POLICY: Record<string, ModePolicyEntry> = {
  chat: {
    enabledTools: ['web_search', 'web_fetch'],
    deniedTools: [],
    allowedPaths: [],
    systemPromptStyle: 'chat',
    envContext: [],
  },
  agent: {
    enabledTools: '*',
    deniedTools: [
      'run_command',
      'read_file',
      'list_directory',
      'grep',
      'glob',
      'resume_plan',
    ],
    allowedPaths: ['{workspaceRoot}/agent-output'],
    systemPromptStyle: 'agent',
    envContext: ['platform'],
  },
  cowork: {
    enabledTools: '*',
    deniedTools: [],
    allowedPaths: ['{projectPath}', '{workspaceRoot}'],
    systemPromptStyle: 'cowork',
    envContext: ['platform', 'projectPath'],
  },
};
```

### 2. ModePolicyService

File: `backend/src/mode-policy/mode-policy.service.ts`

Provides:
- `getEnabledTools(mode, dbTools)` — filter Prisma tools per mode policy
- `resolveAllowedPaths(mode, projectPath?)` — resolve `{workspaceRoot}` and `{projectPath}` placeholders
- `isToolAllowed(mode, toolName)` — quick check
- `getSystemPromptStyle(mode)` — which prompt template
- `getEnvContext(mode)` — what env info to inject

### 3. ToolContext Interface

File: `backend/src/tools/executors/tool-executor.interface.ts`

```typescript
export interface ToolContext {
  mode: 'chat' | 'agent' | 'cowork';
  sessionId: number;
}

export interface ToolExecutor {
  readonly name: string;
  execute(args: Record<string, unknown>, context?: ToolContext): Promise<string>;
}
```

### 4. WriteFileExecutor — Agent Mode Sandbox

When `context.mode === 'agent'`:
- Ignore LLM-supplied path (strip directory, keep only filename)
- Resolve to `{workspaceRoot}/agent-output/session_{sessionId}/{filename}`
- Guarantee file is under workspaceRoot → `AgentFile` record + download link always works
- System prompt tells agent: "Use relative paths (e.g., 'output.txt'). They will be saved to your session's output folder."

### 5. Integration Changes

| File | Change |
|---|---|
| `backend/src/mode-policy/mode-policy.config.ts` | **NEW** — static policy definition |
| `backend/src/mode-policy/mode-policy.service.ts` | **NEW** — policy resolution service |
| `backend/src/mode-policy/mode-policy.module.ts` | **NEW** — NestJS module |
| `backend/src/tools/executors/tool-executor.interface.ts` | **EDIT** — add `ToolContext` |
| `backend/src/tools/executors/write-file.executor.ts` | **EDIT** — agent sandbox logic |
| `backend/src/agent/services/context-builder.service.ts` | **EDIT** — use ModePolicyService instead of hardcode tool filter |
| `backend/src/agent/services/agent-loop.service.ts` | **EDIT** — remove lines 116-121 mode filter; pass context to executeTool |
| `backend/src/workspace/workspace.service.ts` | **NO CHANGE** — path enforcement is at executor level via ToolContext, not at WorkspaceService |
| `backend/src/agent/agent.module.ts` | **EDIT** — import ModePolicyModule |
| `backend/src/tools/tools.module.ts` | **EDIT** — export ModePolicyModule if needed |

## Agent Mode Tool Set (final)

Allowed: `write_file`, `create_task`, `update_task`, `list_tasks`, `get_task`, `delete_tasks`, `web_fetch`, `web_search`, `search_knowledge`, `create_note`, `update_note`, `list_notes`, `delete_note`, `convert_note_to_task`

Denied: `run_command`, `read_file`, `list_directory`, `grep`, `glob`, `resume_plan`

## File Storage Layout

```
workspace_data/
├── dev.db
├── lancedb/
├── uploads/
└── agent-output/
    ├── session_1/
    │   ├── output.txt
    │   └── code.py
    └── session_5/
        └── report.md
```

## Security

- Agent mode cannot read arbitrary files (no `read_file`, `grep`, `glob`)
- Agent mode cannot list directories (no `list_directory`)
- Agent mode cannot execute shell commands (no `run_command`)
- Files written by Agent mode are sandboxed to `agent-output/session_{id}/`
- Cowork mode retains full filesystem access to project path
- Chat mode remains stateless (no file tools)
