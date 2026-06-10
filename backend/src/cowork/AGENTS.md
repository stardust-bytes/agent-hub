# cowork/ — Agent Context

Cowork mode module. Manages project directory connection, directory browsing, and file reading for the workspace AI agent.

## Responsibility

- `CoworkService` — project path persistence (SQLite), directory browsing, file reading with path validation
- `CoworkController` — REST endpoints for project CRUD, browse, read-file, drives

## Files

```
cowork/
├── cowork.module.ts
├── cowork.controller.ts
├── cowork.controller.spec.ts
├── cowork.service.ts
├── cowork.service.spec.ts
├── dto/
│   └── set-project.dto.ts
└── AGENTS.md
```

## API Endpoints

Base path: `/api/cowork`

| Method | Path | Description |
|---|---|---|
| POST | `/api/cowork/project` | Set project directory |
| GET | `/api/cowork/project` | Get current project status |
| DELETE | `/api/cowork/project` | Clear project |
| GET | `/api/cowork/drives` | List available drives (C:\, D:\, /) |
| GET | `/api/cowork/browse?path=` | List directory entries |
| GET | `/api/cowork/read-file?path=` | Read file content (path-validated) |

## Dependencies

- SettingsModule (project path persistence)
- WorkspaceModule (path permission management)
