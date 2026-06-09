# knowledge/ — Agent Context

Knowledge base module. File upload, indexing, and semantic search via LanceDB vector database. Supports text extraction from `.docx`, `.pdf`, and plain text files.

## Responsibility

- `KnowledgeController` — REST endpoints under `/api/knowledge`. File upload via `multer`, search, reindex, delete.
- `KnowledgeService` — LanceDB vector search + Ollama embeddings + file text extraction (mammoth for docx, pdf-parse for PDF). Generates summaries and chunks files by section headings.
- `SearchDto` — inline DTO with `query: string` for search endpoint.

## Files

```
knowledge/
├── knowledge.module.ts
├── knowledge.controller.ts
├── knowledge.controller.spec.ts
├── knowledge.service.ts
├── knowledge.service.spec.ts
└── dto/
    └── search.dto.ts
```

## API Endpoints

Base path: `/api/knowledge`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/knowledge` | List all indexed files |
| `POST` | `/api/knowledge/upload` | Upload file (multipart/form-data, field: `file`) |
| `POST` | `/api/knowledge/search` | Semantic search (`{ query: string }`) |
| `POST` | `/api/knowledge/reindex` | Drop and rebuild all vector indexes |
| `DELETE` | `/api/knowledge/:id` | Delete file and its vectors |

## Indexing Pipeline

1. Upload file → save to `UPLOAD_DIR` → create `KnowledgeFile` record (status: `indexing`)
2. Extract text (based on MIME type: docx, pdf, or plain text)
3. Generate summary via Ollama `api/generate` using configurable `summary_model_id`
4. Chunk text by section headings (Markdown, numbered, or roman numeral headings) with 512-char chunks and 50-char overlap
5. Embed chunks + summary via Ollama `api/embeddings` using `EMBED_MODEL` (default: `nomic-embed-text`)
6. Store vectors in LanceDB table `chunks`
7. Update `KnowledgeFile` status to `ready` with chunk count

## Embedding Configuration

Embedding model can be configured via:
- `EMBED_MODEL` env var (default: `nomic-embed-text`)
- `embed_model_id` setting (references a `ProviderModel` ID)

## Dependencies

- PrismaService (KnowledgeFile CRUD)
- SettingsService (embed_model_id lookup)
- ProvidersService (model resolution for embedding + summary)
- ConfigService (UPLOAD_DIR, OLLAMA_URL, EMBED_MODEL)
- LanceDB (local vector store at `./workspace_data/lancedb`)

## Testing

```bash
npx jest src/knowledge     # 2 suites
```

Tests mock `LanceDB`, `Ollama` API calls, and `fs` operations.
