# Agent File Restriction & Download Design

## Problem

1. **Agent can access backend code**: `process.cwd()` is in allowedPaths and system prompt. Agent can list/read backend source files.
2. **File paths leaked**: When `write_file` creates a file, it returns the full filesystem path, exposing internal directory structure.
3. **No isolation**: Agent should only work within `workspace_data` and the connected cowork project directory.

## Solution

### Section 1 — Restrict Allowed Paths + Context

**WorkspaceService.allowedPaths**: Remove `process.cwd()`. Only keep:
- `workspaceRoot` (`./workspace_data`)
- `os.tmpdir()`
- Cowork project path (added via `addAllowedPath()` at runtime)
- `ALLOWED_PATHS` env var entries

**ContextBuilderService.buildSystemPrompt()**: Remove:
- `process.cwd()` — was leaking backend directory
- `process.env.USERPROFILE` / `process.env.HOME` — unnecessary exposure

Keep:
- `process.platform`
- Connected project path (if set via cowork)

### Section 2 — File Download for workspace_data Files

**Prisma schema**: Add `AgentFile` model:
```prisma
model AgentFile {
  id          Int      @id @default(autoincrement())
  filename    String
  path        String
  sessionId   Int
  createdAt   DateTime @default(now())
}
```

**WriteFileExecutor** — modified behavior:
- Write file via `WorkspaceService.writeFile()` (existing)
- After successful write, check if resolved path starts with `workspaceRoot`
- If YES (workspace_data file) → create `AgentFile` record → return `[Download "{filename}"](api/files/agent/{id}/download)`
- If NO (cowork project file) → return `Written {n} bytes to {resolved}` (current behavior)

**New endpoint**: `GET /api/files/agent/:id/download`
- Lookup `AgentFile` by id
- If not found → 404
- If found → read file from `path`, serve with `Content-Disposition: attachment; filename="{filename}"`
- Handle file-not-found-on-disk: return 404

**New FilesModule**: `backend/src/files/`
- `files.module.ts`
- `files.controller.ts` — download endpoint
- Wire into `AppModule`

## File Changes

### Backend
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `AgentFile` model |
| `backend/src/workspace/workspace.service.ts` | Remove `process.cwd()` from allowedPaths |
| `backend/src/agent/services/context-builder.service.ts` | Remove cwd + userHome from system prompt |
| `backend/src/tools/executors/write-file.executor.ts` | Register agent file + return download URL for workspace_data files |
| `backend/src/files/files.module.ts` | **New** |
| `backend/src/files/files.controller.ts` | **New** — download endpoint |
| `backend/src/app.module.ts` | Import FilesModule |

### No frontend changes needed
The download URL is rendered as a markdown link in the chat panel, which already handles markdown rendering.

## Testing

- `WorkspaceService` — `isPathAllowed(process.cwd())` returns false
- `ContextBuilderService` — system prompt doesn't contain cwd
- `WriteFileExecutor` — returns download URL for workspaceRoot paths, path for others
- `FilesController` — serves file by id, 404 for missing
