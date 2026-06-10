# Design Spec: Cowork Mode — Tool-Based Codebase Interaction

**Date:** 2026-06-10
**Status:** Draft
**Goal:** Replace codebase watcher + RAG with a simpler tool-based "cowork" mode where the agent reads, writes, and searches files on-demand using built-in tools, similar to Claude Code.

---

## Context

The current codebase watcher uses chokidar + Ollama embeddings + LanceDB to pre-index files into a vector store for RAG. This is complex, resource-intensive, and causes lag. Claude Code and OpenCode achieve the same goal without any pre-indexing — they give the LLM tools to explore files on demand.

**Decision:** Replace the watcher + RAG approach entirely. User selects a project directory, and the agent uses tools (`read_file`, `write_file`, `list_directory`, `grep`, `glob`) to work with files in that directory.

---

## Architecture

### CoworkModule

```
backend/src/cowork/
├── cowork.module.ts
├── cowork.service.ts
├── cowork.service.spec.ts
├── cowork.controller.ts
├── cowork.controller.spec.ts
└── dto/
    └── set-project.dto.ts
```

**CoworkService:**
- `setProject(path)` — persists project path in `Setting` table (key: `cowork_project_path`), calls `workspaceService.addAllowedPath(path)`
- `getProject(): string | null` — reads from DB
- `clearProject()` — removes from DB
- `getStatus()` — `{ projectPath: string | null, isActive: boolean }`

**CoworkController:**
- `POST /api/cowork/project` — set project directory `{ path: string }`
- `GET /api/cowork/project` — get current project info
- `DELETE /api/cowork/project` — clear project

### GrepExecutor

- Tool name: `grep`
- Args: `{ pattern: string, path?: string, include?: string }`
- Searches file contents using regex pattern
- Returns `file:line:content` matches
- Uses node built-in `fs.readFile` for small searches, respects ALLOWED_PATHS

### GlobExecutor

- Tool name: `glob`
- Args: `{ pattern: string, path?: string }`
- Finds files matching glob pattern
- Returns line-separated list of matching paths
- Uses `fast-glob` if available, fallback `fs.readdir` recursive

### WorkspaceService Change

Add method: `addAllowedPath(path: string)` — appends to the runtime allowed paths list.

### ContextBuilderService Change

If CoworkService returns a project path, inject into system prompt:
```
Current working project: <path>
File operations are available in this directory.
```

### FilesView.vue Change

Replace "Codebase Watcher" UI with "Workspace" project selector:
- Directory input + Browse button + Connect button
- Connected state: shows project path + Disconnect button

---

## Files Changed

**Create:**
- `backend/src/cowork/cowork.module.ts`
- `backend/src/cowork/cowork.service.ts`
- `backend/src/cowork/cowork.service.spec.ts`
- `backend/src/cowork/cowork.controller.ts`
- `backend/src/cowork/cowork.controller.spec.ts`
- `backend/src/cowork/dto/set-project.dto.ts`
- `backend/src/tools/executors/grep.executor.ts`
- `backend/src/tools/executors/grep.executor.spec.ts`
- `backend/src/tools/executors/glob.executor.ts`
- `backend/src/tools/executors/glob.executor.spec.ts`

**Modify:**
- `backend/src/workspace/workspace.service.ts` — add `addAllowedPath()`
- `backend/src/agent/services/context-builder.service.ts` — inject project path into system prompt
- `backend/src/tools/tools.module.ts` — register grep + glob executors
- `backend/src/agent/services/agent-loop.service.ts` — register grep + glob in executorMap
- `frontend/src/components/FilesView.vue` — replace watcher UI with project selector
- `frontend/src/locales/vi.json` + `en.json` — add cowork i18n keys

**No changes (disabled):**
- Watcher + Indexer still exist in code but are not started

---

## Implementation Order

1. Add `addAllowedPath()` to WorkspaceService
2. Create CoworkModule: service + controller (TDD)
3. Create GrepExecutor (TDD)
4. Create GlobExecutor (TDD)
5. Register new executors in agent loop
6. Update ContextBuilderService to inject project path
7. Update FilesView.vue UI
8. Wire CoworkModule into AppModule
9. Final verification
