# workspace/ — Agent Context

File system management module. Handles workspace root resolution, path permission checks, and file system operations. Monitors workspace directories for file changes and indexes them into the knowledge base.

## Responsibility

- `WorkspaceService` — resolves `WORKSPACE_ROOT` from env (default `./workspace_data`), validates allowed paths, provides read/write/list operations
- `WorkspaceWatcherService` — chokidar-based file watcher that monitors workspace directory for new/changed/deleted files and delegates indexing to `KnowledgeService`

## Files

```
workspace/
├── workspace.service.ts
├── workspace.service.spec.ts
├── workspace-watcher.service.ts
├── workspace-watcher.service.spec.ts
├── workspace.controller.ts
├── workspace.controller.spec.ts
└── dto/
    └── watch.dto.ts
```

## Services

### WorkspaceService
- `getWorkspaceRoot()` — returns resolved workspace directory
- `isPathAllowed(filePath)` — checks if path is within allowed directories (workspace root, temp dir, user profile, env `ALLOWED_PATHS`)
- `writeFile(filePath, content)` — writes content to allowed path
- `readFile(filePath)` — reads file from allowed path
- `listDirectory(dirPath)` — lists directory entries from allowed path

### WorkspaceWatcherService
- `startWatch(directory?)` — starts chokidar watcher on workspace root (or provided directory). Skips `node_modules`, `.git`, `dist`, `.lancedb`, database files. Watches supported extensions: `.ts`, `.js`, `.py`, `.md`, `.txt`, `.json`, `.yaml`, `.yml`. Debounces at 300ms.
- `stopWatch()` — stops watcher and clears debounce timers
- `getStatus()` — returns `{ watching, directory, indexedCount }`
- File add/change — creates `KnowledgeFile` record via `createWithPath` and calls `processFile` for indexing; re-indexes if already known
- File delete — removes associated `KnowledgeFile` from database

## Dependencies

- WorkspaceService (path validation + root resolution)
- KnowledgeService (createWithPath, processFile, findAll, remove)
- chokidar (file system watcher)

## Testing

```bash
npx jest src/workspace     # 3 suites, 15 tests
```

Tests mock chokidar and KnowledgeService.

## TODOs

- [x] Add `WorkspaceController` for REST control (start/stop/status)
- [x] Wire `WorkspaceController` into `WorkspaceModule`
- [ ] Auto-start watcher on module init via `onApplicationBootstrap`
