# sessions/ — Agent Context

Chat session management module. CRUD for `Session` entity and `ChatMessage` records. Used by the agent module for conversation history persistence and retrieval.

## Responsibility

- `SessionsController` — REST endpoints under `/api/sessions`.
- `SessionsService` — session CRUD, message CRUD, chat history retrieval as Ollama-compatible message format, auto-title generation from first user message.

## Files

```
sessions/
├── sessions.module.ts
├── sessions.controller.ts
├── sessions.controller.spec.ts
├── sessions.service.ts
├── sessions.service.spec.ts
```

## API Endpoints

Base path: `/api/sessions`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sessions` | List all sessions with message count, ordered by `updatedAt DESC` |
| `POST` | `/api/sessions` | Create a new session |
| `DELETE` | `/api/sessions` | Delete all sessions |
| `DELETE` | `/api/sessions/:id` | Delete a session (cascades messages) |
| `GET` | `/api/sessions/:id/messages` | Get all messages for a session (ordered by `createdAt ASC, id ASC`) |

## Key Patterns

- **Auto-title**: On first user message, sets session title to first 5 words of the message
- **History format**: `getHistory()` returns messages in Ollama format (`{ role, content }[]`) for context building. Filters out non-standard roles (`plan`, etc.) — only `system`, `user`, `assistant`, `tool` are included. Both `getMessages()` and `getHistory()` order by `createdAt ASC, id ASC` to ensure stable ordering even when multiple messages share the same timestamp.
- **Cascade delete**: Deleting a session cascades to all its `ChatMessage` records (via Prisma schema `onDelete: Cascade`)

## Dependencies

- PrismaService (Session + ChatMessage CRUD)

## Testing

```bash
npx jest src/sessions    # 2 suites
```
