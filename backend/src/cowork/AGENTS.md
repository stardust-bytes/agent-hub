# cowork/ — Agent Context

Cowork mode module. Manages project directory connection, directory browsing, and file reading for the workspace AI agent.

## Responsibility

- `CoworkService` — active project path stored in `Setting` (key `cowork_project_path`); saved projects persisted in the `Project` table (Prisma); directory browsing, drives, and file reading with path validation
- `CoworkController` — REST endpoints for active project, saved projects CRUD, browse, read-file, drives

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
| POST | `/api/cowork/project` | Set active project directory |
| GET | `/api/cowork/project` | Get current project status |
| DELETE | `/api/cowork/project` | Clear active project |
| GET | `/api/cowork/projects` | List saved projects (`Project` table) |
| POST | `/api/cowork/projects` | Add a saved project |
| DELETE | `/api/cowork/projects/:id` | Remove a saved project |
| GET | `/api/cowork/drives` | List available drives (C:\, D:\, /) |
| GET | `/api/cowork/browse?path=` | List directory entries |
| GET | `/api/cowork/read-file?path=` | Read file content (path-validated) |

## Dependencies

- SettingsModule (active project path persistence)
- WorkspaceModule (path permission management)
- PrismaService (saved `Project` records; available via the global PrismaModule)
