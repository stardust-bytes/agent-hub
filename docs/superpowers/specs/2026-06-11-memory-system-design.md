# Memory System Design

## Overview

Local-first persistent memory system inspired by Claude Code's 4-type memory model. Stores user preferences, validated approaches, project context, and external references in SQLite, with background auto-extraction and prompt injection.

## Database Schema

```prisma
enum MemoryType {
  USER
  FEEDBACK
  PROJECT
  REFERENCE
}

model Memory {
  id        String     @id @default(cuid())
  type      MemoryType
  title     String
  content   String
  metadata  String?
  sessionId String?
  agentId   String?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  session   Session?   @relation(fields: [sessionId], references: [id], onDelete: SetNull)
}
```

**Constraints:**
- Content hash (SHA256 of title + content) deduplication — skip if duplicate hash within 24h
- Index on type + createdAt for query performance
- metadata JSON: `{ "source": "auto-extract" | "manual", "relevance": number, "keywords": string[] }`

**Prompt injection limits:**
- User: top 3, Feedback: top 5, Project: active (7 days), Reference: top 5
- Total ≤ 200 lines / 25KB

## Module Structure

```
backend/src/memory/
├── memory.module.ts
├── memory.service.ts
├── memory.controller.ts
├── memory.gateway.ts
├── memory-extraction.service.ts
├── dto/
│   ├── create-memory.dto.ts
│   ├── update-memory.dto.ts
│   └── search-memory.dto.ts
└── memory.constants.ts
```

### API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/memories` | List with type/session/search filters |
| `POST` | `/api/memories` | Create manual memory |
| `PATCH` | `/api/memories/:id` | Update memory |
| `DELETE` | `/api/memories/:id` | Delete memory |
| `GET` | `/api/memories/context` | Get memories for prompt injection (limit 20) |

### Socket.io Gateway

- Namespace: `/memories`
- Events: `memory:created`, `memory:updated`, `memory:deleted`
- Pattern matches existing tasks/notes gateways

## Background Auto-Extraction

### Trigger

Agent SSE stream completes → check last turn tool call count:
- Had tool calls → skip
- No tool calls (idle) → spawn extraction sub-agent

### Extraction Sub-Agent

- Max 5 turns (giống Claude Code)
- Tools: Read, Grep, Glob (unrestricted), Bash (read-only), Write/Edit (restricted to Memory table)
- Shares prompt cache with parent session
- Output: structured list of `{ type, title, content }` items

### Implementation

- `agent-loop.service.ts` emits `agent.idle` event when RESPONDING→DONE transition with 0 tool calls
- `MemoryExtractionService` subscribes to event, runs async
- No blocking — extraction runs in background via SubAgentService

## Prompt Injection

In `context-builder.service.ts`, append after chat history:

```
## Persistent Memory

### User
- Role: ...

### Feedback
- ...

### Project
- ...

### Reference
- ...
```

Query via GET `/api/memories/context` with per-type limits.

## Deduplication

- SHA256 hash of `title + content` stored in metadata
- Before insert: check if same hash exists within 24h → skip
- Similar title + same type → append to existing content instead of new row
- Auto-extraction checks dedup first, then falls back to manual insertion

## Frontend Component

- `MemoryView.vue` in Settings (tab "Memories")
- Filter by type (user/feedback/project/reference)
- Create/edit modal (reuse BaseModal + FormBlock)
- Delete with BaseConfirmModal
- Search bar across content field
- Real-time sync via Socket.io

## i18n Keys

```
memory.title         → "Memories" / "Bộ nhớ"
memory.type.user     → "User" / "Người dùng"
memory.type.feedback → "Feedback" / "Phản hồi"
memory.type.project  → "Project" / "Dự án"
memory.type.reference → "Reference" / "Tham khảo"
memory.create        → "New Memory" / "Bộ nhớ mới"
memory.edit          → "Edit Memory" / "Sửa bộ nhớ"
memory.delete        → "Delete Memory" / "Xóa bộ nhớ"
memory.empty         → "No memories yet" / "Chưa có bộ nhớ nào"
memory.auto_extracted → "[auto]" / "[tự động]"
```

## Dependencies

- New module: `MemoryModule` imported in `app.module.ts`
- Inject: `AgentModule` (for idle event), `SessionsModule` (for session relation)
- New service: `MemoryExtractionService` uses `SubAgentService` from agent module

## Testing

- `memory.service.spec.ts`: CRUD + dedup + context query
- `memory.controller.spec.ts`: DTO validation, response format
- `memory-extraction.service.spec.ts`: idle trigger, extraction flow, dedup
- `memory.gateway.spec.ts`: Socket.io events
