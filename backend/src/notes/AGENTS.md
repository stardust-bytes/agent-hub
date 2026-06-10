# notes/ — Agent Context

Notes management module. Full CRUD for the `Note` entity. Includes Socket.io gateway (`/notes` namespace) emitting `note:created`, `note:updated`, `note:deleted` events for real-time sync.

## Responsibility

- `NotesController` — REST endpoints under `/api/notes`.
- `NotesService` — business logic; all DB access via injected `PrismaService`. Emits WS events on mutations.
- `NotesGateway` — Socket.io `/notes` namespace with CORS for dev (171305) and prod (3000).

## Files

```
notes/
├── notes.module.ts
├── notes.controller.ts
├── notes.controller.spec.ts
├── notes.service.ts
├── notes.service.spec.ts
├── notes.gateway.ts
├── notes.gateway.spec.ts
└── dto/
    ├── create-note.dto.ts
    └── update-note.dto.ts
```

## API Endpoints

Base path: `/api/notes`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/notes` | List all notes, ordered by `createdAt DESC` |
| `POST` | `/api/notes` | Create a note |
| `PATCH` | `/api/notes/:id` | Update a note |
| `DELETE` | `/api/notes/:id` | Delete a note |

## WebSocket Events

| Event | Payload | When |
|---|---|---|
| `note:created` | `Note` | Note created |
| `note:updated` | `Note` | Note updated |
| `note:deleted` | `{ id }` | Note deleted |

## Dependencies

- PrismaService (Note CRUD)
- NotesGateway (WebSocket event emission)

## Testing

```bash
npx jest src/notes     # 3 suites
```

Tests mock `PrismaService` and `NotesGateway`.
