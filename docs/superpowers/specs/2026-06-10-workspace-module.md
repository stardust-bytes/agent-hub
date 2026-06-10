# Design Spec: Workspace Module — Unified Workspace Data Management

**Date:** 2026-06-10
**Status:** Draft
**Goal:** Centralize workspace_data management into a dedicated WorkspaceModule. Consolidate path validation, file watching (codebase watcher), and file operations into a single module used by file executors and knowledge indexing.

---

## Context

Two problems were identified:

1. **Codebase watcher** was specified in the Knowledge RAG spec (`POST /api/knowledge/watch` + `GET /api/knowledge/watch/status`) but never implemented on the backend. The frontend `FilesView.vue` calls these endpoints but they silently fail.

2. **File tools** (`ReadFileExecutor`, `WriteFileExecutor`, `ListDirectoryExecutor`) include `process.cwd()` in their default `ALLOWED_PATHS`, allowing writes to the backend root directory. This is both a security concern and inconsistent with the intended design where `workspace_data` should be the primary working directory.

**Decision:** Merge both concerns into a single `WorkspaceModule`. File tools + codebase watcher both operate within `workspace_data`.

---

## Architecture

### Module: `workspace/`

```
backend/src/workspace/
├── workspace.module.ts                — registers + exports WorkspaceService, WorkspaceWatcherService
├── workspace.service.ts               — path validation, file ops, workspace root resolution
├── workspace.service.spec.ts
├── workspace-watcher.service.ts       — chokidar-based file watcher
├── workspace-watcher.service.spec.ts
├── workspace.controller.ts            — watch endpoints
├── workspace.controller.spec.ts
└── dto/
    └── watch.dto.ts
```

### Component Responsibilities

#### `WorkspaceService`

Single source of truth for path validation within the workspace.

**Methods:**
- `getWorkspaceRoot(): string` — returns resolved `workspace_data` path
- `resolvePath(relativePath: string): string` — resolves a relative path within workspace root
- `isPathAllowed(filePath: string): boolean` — checks if path is within allowed directories (workspace root always allowed + any paths from `ALLOWED_PATHS` env var)
- `readFile(filePath: string): Promise<string>` — read file content within allowed paths
- `writeFile(filePath: string, content: string): Promise<{ bytesWritten: number, resolved: string }>` — write file within allowed paths
- `listDirectory(dirPath: string): Promise<string[]>` — list directory entries within allowed paths

**Path validation rules:**
1. `workspace_data` root is ALWAYS allowed (cannot be overridden)
2. `ALLOWED_PATHS` env var can ADD additional paths (comma-separated)
3. `process.cwd()` is REMOVED from defaults
4. `os.tmpdir()` remains for temp file support
5. `USERPROFILE`/`HOME` remain for user directory access

#### `WorkspaceWatcherService`

Chokidar-based file watcher that monitors `workspace_data` for changes and indexes new/modified files into the knowledge base.

**State:**
```typescript
interface WatcherState {
  watching: boolean;
  directory: string;
  indexedCount: number;
}
```

**Behavior:**
- Starts watching `workspace_data` on `startWatch()` call
- Watches all files recursively
- Supported extensions: `.ts`, `.js`, `.py`, `.md`, `.txt`, `.json`, `.yaml`, `.yml`
- Debounce: 300ms coalescing window to avoid rapid re-indexing
- On file change (add/modify): read file content, call `KnowledgeService.processFile()` (reuses existing indexing pipeline)
- On file delete: remove from knowledge base via `KnowledgeService.remove()`
- Ignores: `node_modules/`, `.git/`, `dist/`, `.lancedb/`, `dev.db`, `dev.db-journal`

**Methods:**
- `startWatch(): Promise<void>` — begin watching
- `stopWatch(): Promise<void>` — stop watching
- `getStatus(): WatcherState` — return current state
- `isWatching(): boolean` — quick check

#### `WorkspaceController`

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/workspace/watch` | `{ directory?: string }` | `{ ok: true, directory: string }` |
| `GET` | `/api/workspace/watch/status` | — | `{ watching: boolean, directory: string, indexedCount: number }` |
| `DELETE` | `/api/workspace/watch` | — | `{ ok: true }` |

The `directory` parameter is optional and defaults to the workspace root.

---

## Integration with Existing Code

### 1. File Executors (Tools Module)

**Current state:** Each executor has duplicate `isPathAllowed()` logic with hardcoded defaults.

**Target state:** Executors inject `WorkspaceService` and delegate path validation + file ops:

```typescript
// WriteFileExecutor (simplified)
@Injectable()
export class WriteFileExecutor implements ToolExecutor {
  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = args.path as string;
    const content = args.content as string;
    if (!filePath || content === undefined) return 'Error: path and content are required.';
    if (!this.workspace.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`;
    const { bytesWritten, resolved } = await this.workspace.writeFile(filePath, content);
    return `Written ${bytesWritten} bytes to ${resolved}`;
  }
}
```

Same pattern for `ReadFileExecutor` and `ListDirectoryExecutor`.

### 2. Knowledge Module

**No changes to `KnowledgeService`.** It already stores files in `workspace_data/uploads/` and vectors in `workspace_data/lancedb/`. The watcher simply calls `KnowledgeService.processFile()` and `KnowledgeService.remove()`.

### 3. Frontend — FilesView.vue

Change watch endpoint from `/api/knowledge/watch` to `/api/workspace/watch`:

```typescript
// Before
await fetch('/api/knowledge/watch', { method: 'POST', body: ... })

// After
await fetch('/api/workspace/watch', { method: 'POST', body: ... })
```

Also add status polling and stop-watch button.

### 4. AppModule

Register `WorkspaceModule` in `backend/src/app.module.ts` imports.

---

## Error Handling

- **Watcher failure:** Log error, set `watching = false`, return error status
- **File operation failure:** Return error string from executor (existing pattern)
- **Debounce:** If file changes rapidly, only process the latest version
- **Unsupported file type:** Skip silently (no error, just don't index)

---

## Files Changed

**Create:**
- `backend/src/workspace/workspace.module.ts`
- `backend/src/workspace/workspace.service.ts`
- `backend/src/workspace/workspace.service.spec.ts`
- `backend/src/workspace/workspace-watcher.service.ts`
- `backend/src/workspace/workspace-watcher.service.spec.ts`
- `backend/src/workspace/workspace.controller.ts`
- `backend/src/workspace/workspace.controller.spec.ts`
- `backend/src/workspace/dto/watch.dto.ts`

**Modify:**
- `backend/src/app.module.ts` — add `WorkspaceModule`
- `backend/src/tools/executors/write-file.executor.ts` — inject `WorkspaceService`
- `backend/src/tools/executors/write-file.executor.spec.ts` — update mocks
- `backend/src/tools/executors/read-file.executor.ts` — inject `WorkspaceService`
- `backend/src/tools/executors/read-file.executor.spec.ts` — update mocks
- `backend/src/tools/executors/list-directory.executor.ts` — inject `WorkspaceService`
- `backend/src/tools/executors/list-directory.executor.spec.ts` — update mocks
- `frontend/src/components/FilesView.vue` — update endpoint URL + add stop-watch

**No changes:**
- `backend/src/knowledge/` — unchanged, `KnowledgeService` already works with `workspace_data`

---

## Out of Scope

- File upload path changes (upload still goes through KnowledgeController -> KnowledgeService)
- LanceDB vector store relocation (stays at `workspace_data/lancedb/`)
- SQLite database relocation (stays at `workspace_data/dev.db`)
- Multi-workspace support (only one workspace root)

---

## Implementation Order

1. Create `WorkspaceService` with path validation + file ops (TDD)
2. Create `WorkspaceWatcherService` with chokidar + debounce (TDD)
3. Create `WorkspaceController` with watch endpoints (TDD)
4. Create `WorkspaceModule` + register in `AppModule`
5. Refactor file executors to inject `WorkspaceService`
6. Update frontend `FilesView.vue` to use new endpoints
7. Verify: backend tests pass, frontend builds
