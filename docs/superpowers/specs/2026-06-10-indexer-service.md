# Design Spec: IndexerService — Queue-Based File Processing

**Date:** 2026-06-10
**Status:** Draft
**Goal:** Reduce CPU/IO lag caused by the codebase watcher when processing file changes, by introducing a queue-based IndexerService with concurrency control.

---

## Context

The codebase watcher (`WorkspaceWatcherService`) processes every file change synchronously via `handleFileChange`, which calls `knowledge.findAll()` (O(n) full table scan) and `knowledge.processFile()` (Ollama embedding + LanceDB write) for each event. When multiple files change simultaneously (e.g., git checkout, npm install, initial index), all of these run concurrently — overwhelming Ollama and causing system lag.

---

## Architecture

### IndexerService

A new service that manages a FIFO job queue with configurable concurrency:

```
enqueue(filePath)
  → if not already queued/processing → push to queue → trigger processNext()
  → if already queued/processing → skip (dedup)

processNext()
  → while processing.size < concurrency:
    → dequeue next file
    → mark as processing
    → findByFilepath() + processFile() or createWithPath() + processFile()
    → on done: update stats, processNext()
    → on error: update stats, processNext()
```

### Key Design Decisions

1. **Queue in memory** — no persistence needed. Watcher state is ephemeral.
2. **Concurrency default: 3** — limits parallel Ollama API calls.
3. **Deduplication** — if a file is already queued or processing, skip. Handles rapid save events.
4. **No retry** — errors are counted and skipped. Simpler implementation.
5. **FIFO** — files processed in order they arrived.

---

## File Changes

**Create:**
- `backend/src/workspace/indexer.service.ts` — queue + concurrency limit + stats
- `backend/src/workspace/indexer.service.spec.ts`

**Modify:**
- `backend/src/workspace/workspace-watcher.service.ts` — `handleFileChange` enqueues instead of processing directly. Remove per-file debounce.
- `backend/src/workspace/workspace.module.ts` — add IndexerService to providers
- `backend/src/knowledge/knowledge.service.ts` — add `findByFilepath(filepath: string)`
- `backend/src/workspace/workspace.controller.ts` — add `GET /api/workspace/indexer/status`

---

## API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/workspace/indexer/status` | Returns `{ pending, processing, done, errors }` |

---

## Implementation Order

1. Add `findByFilepath` to KnowledgeService
2. Create IndexerService with queue + concurrency (TDD)
3. Refactor WorkspaceWatcherService to use IndexerService
4. Add indexer status endpoint to WorkspaceController
5. Verify: all backend tests pass
