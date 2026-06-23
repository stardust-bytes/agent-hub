# chat-upload/ — Agent Context

Chat file attachment upload module. Handles image uploads for the chat input attachment feature.

## Responsibility

- `ChatUploadController` — REST endpoints under `/api/chat/upload` and `/api/chat/uploads/:id/:filename`. File upload via multer (`FileInterceptor('file')`), size validation (20MB max), MIME type validation (image/*). Serves uploaded files via `StreamableFile`.
- `ChatUploadService` — manages the upload directory (`workspace_data/uploads/chat-uploads/`), persists records to `ChatUpload` Prisma table.

## Files

```
chat-upload/
├── chat-upload.module.ts
├── chat-upload.controller.ts
├── chat-upload.service.ts
└── AGENTS.md
```

## API Endpoints

Base path: `/api/chat`

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat/upload` | Upload image file (multipart/form-data, field: `file`) |
| `GET` | `/api/chat/uploads/:id/:filename` | Serve uploaded image by id |

## Dependencies

- PrismaService (ChatUpload CRUD)
- ConfigService (UPLOAD_DIR)

## Status

- [x] Phase 1: upload + serve endpoint — DONE
- [x] Phase 2: cleanup cron for orphaned files — DONE (hourly, deletes files > 1h)
- [x] Phase 3: integration with LLM vision providers — DONE (OpenAI/Ollama/Gemini)
