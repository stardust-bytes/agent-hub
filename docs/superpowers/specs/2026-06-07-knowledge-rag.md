# Phase 5 — Knowledge Base & RAG

**Date:** 2026-06-07
**Status:** Draft
**Goal:** Allow AI agent to access context from uploaded documents and local codebase via vector search (RAG).

---

## 1. User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| RAG-1 | User uploads PDF/DOCX/TXT/MD → AI answers based on file content | File indexed, search returns relevant chunks, Ollama uses them in response |
| RAG-2 | User uploads code files (.ts, .js, .py) → AI understands code context | Code files chunked and embedded, search finds relevant code |
| RAG-3 | User views indexed files list with status | Files tab shows name, size, status (ready/indexing/error), delete button |
| RAG-4 | User deletes a file from knowledge base | File + its chunks removed from storage and LanceDB |
| RAG-5 | User points AI to codebase directory → auto-indexed | Directory watched, files indexed automatically, progress visible |
| RAG-6 | AI auto-uses RAG when question relates to indexed content | Vector search top-3 chunks injected into system prompt |

---

## 2. Backend

### Prisma Schema

Add `KnowledgeFile` model:

```prisma
model KnowledgeFile {
  id        Int      @id @default(autoincrement())
  filename  String
  filepath  String
  size      Int
  mimeType  String
  status    String   @default("indexing") // indexing | ready | error
  chunkCount Int     @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### KnowledgeModule

**Files:**
- `backend/src/knowledge/knowledge.module.ts`
- `backend/src/knowledge/knowledge.service.ts`
- `backend/src/knowledge/knowledge.service.spec.ts`
- `backend/src/knowledge/knowledge.controller.ts`
- `backend/src/knowledge/knowledge.controller.spec.ts`
- `backend/src/knowledge/dto/upload.dto.ts`

### KnowledgeService

**Upload flow:**
1. Receive multipart file
2. Save to `./workspace_data/uploads/{uuid}-{filename}`
3. Create `KnowledgeFile` record (status: indexing)
4. Read file content based on MIME type:
   - `.pdf` → `pdf-parse`
   - `.docx` → `mammoth`
   - `.txt`, `.md`, `.ts`, `.js`, `.py` → `fs.readFile` (utf-8)
5. Chunk text: custom splitter, 512 chars per chunk, 50 overlap
6. For each chunk: embed via Ollama `POST /api/embeddings` (model `nomic-embed-text`)
7. Store in LanceDB: `{ id, fileId, chunkIndex, text, vector }`
8. Update `KnowledgeFile` status to `ready`

**Search flow:**
1. Receive query string
2. Embed via Ollama `POST /api/embeddings`
3. Search LanceDB for top-3 similar vectors
4. Return `[{ fileId, filename, chunkIndex, text, score }]`

**Delete flow:**
1. Find `KnowledgeFile` by id
2. Delete from LanceDB where `fileId` matches
3. Delete physical file from disk
4. Delete `KnowledgeFile` record

### KnowledgeController

| Method | Path | Body/Query | Response |
|---|---|---|---|
| `POST` | `/api/knowledge/upload` | `multipart/form-data` file | `{ id, filename, status }` |
| `GET` | `/api/knowledge` | — | `[{ id, filename, size, mimeType, status, chunkCount, createdAt }]` |
| `DELETE` | `/api/knowledge/:id` | — | `{ ok: true }` |
| `POST` | `/api/knowledge/search` | `{ query: string }` | `[{ fileId, filename, text, score }]` |
| `POST` | `/api/knowledge/watch` | `{ directory: string }` | `{ ok: true, filesCount: number }` |
| `GET` | `/api/knowledge/watch/status` | — | `{ watching: boolean, directory: string, indexedCount: number }` |

### Codebase Watcher

- `POST /api/knowledge/watch` — accepts directory path, scans for supported files
- Supported: `.ts`, `.js`, `.py`, `.md`, `.txt`
- Each file: read → chunk → embed → store (same pipeline as upload)
- `GET /api/knowledge/watch/status` — returns watcher state

### RAG Pipeline (AgentService)

In `AgentService.streamChat()`:
1. Embed user's message via Ollama
2. Search LanceDB for top-3 chunks
3. If chunks found, prepend to system prompt:
   ```
   Context from knowledge base:
   [File: architecture.md]
   <chunk text>
   ---
   [File: requirements.pdf]
   <chunk text>
   ```
4. Send enriched prompt to Ollama

### Dependencies

Add to `backend/package.json`:
- `@lancedb/lancedb`
- `pdf-parse`
- `mammoth`
- `multer` (NestJS built-in or `@nestjs/platform-express`)
- `chokidar` (for codebase watcher)

---

## 3. Frontend

### FilesView.vue

Full-width view (like TasksView, SettingsView):

**Sections:**
1. Upload zone: dashed border, drag-drop + click, file type filter
2. Search/filter input
3. File list: rows with filename, size, status badge, delete button
4. Codebase watcher section: directory path input + Watch button + status indicator

**States:**
- Empty: "No files indexed yet. Upload a document or point to a codebase."
- Loading: spinner during upload/indexing
- List: file rows as described
- Error: per-file error badge

### Locale Keys

| Key | vi | en |
|---|---|---|
| `files.header` | KIẾN THỨC | KNOWLEDGE BASE |
| `files.dropzone` | Thả file hoặc click để upload | Drop files or click to upload |
| `files.filter` | Lọc theo tên... | Filter by name... |
| `files.status.ready` | ✓ sẵn sàng | ✓ ready |
| `files.status.indexing` | ⟳ đang index | ⟳ indexing |
| `files.status.error` | ✗ lỗi | ✗ error |
| `files.delete` | Xóa | Delete |
| `files.empty` | Chưa có file nào | No files yet |
| `files.watch.title` | Codebase Watcher | Codebase Watcher |
| `files.watch.path` | Đường dẫn: | Directory: |
| `files.watch.btn` | Theo dõi | Watch |
| `files.watch.status` | ● đang theo dõi | ● watching |

### AppShell

When `activeView === 'files'`, render `FilesView` full-width.

### SidebarNav

Files icon already exists and navigates to `'files'`. Update types to include `'files'`.

---

## 4. Implementation Order

1. Install backend deps (lancedb, pdf-parse, mammoth, chokidar)
2. Prisma: add `KnowledgeFile` model + migration
3. Backend: `KnowledgeService` TDD (chunk, embed, store, search)
4. Backend: `KnowledgeController` TDD (upload, list, delete, search, watch)
5. Backend: `KnowledgeModule` + register in AppModule
6. Backend: RAG pipeline in `AgentService` (search + inject context)
7. Frontend: locale keys
8. Frontend: `FilesView.vue`
9. Frontend: Wire AppShell + SidebarNav
10. Verify: backend tests pass, frontend builds
