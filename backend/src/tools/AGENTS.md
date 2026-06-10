# tools/ — Agent Context

Tool execution framework. Manages tool definitions, enable/disable toggling, and per-tool config. Executors implement the actual tool logic (task CRUD, note CRUD, knowledge search, web fetch, web search).

## Responsibility

- `ToolsController` — REST endpoints under `/api/tools`. List tools, toggle enable/disable, update config.
- `ToolsService` — Prisma queries for `Tool` entity. Returns enabled tools for agent context building.
- `ToolExecutors` — Individual executor classes implementing tool logic. Injected into `OllamaProvider` for the ReAct loop.

## Files

```
tools/
├── tools.module.ts
├── tools.controller.ts
├── tools.service.ts
├── executors/
│   ├── tool-executor.interface.ts     — ToolExecutor interface
│   ├── create-task.executor.ts
│   ├── update-task.executor.ts
│   ├── list-tasks.executor.ts
│   ├── get-task.executor.ts
│   ├── delete-tasks.executor.ts
│   ├── search-knowledge.executor.ts
│   ├── web-fetch.executor.ts
│   ├── web-search.executor.ts
│   ├── create-note.executor.ts
│   ├── update-note.executor.ts
│   ├── list-notes.executor.ts
│   ├── delete-note.executor.ts
│   ├── convert-note-to-task.executor.ts
│   ├── read-file.executor.ts
│   ├── read-file.executor.spec.ts
│   ├── write-file.executor.ts
│   ├── write-file.executor.spec.ts
│   ├── list-directory.executor.ts
│   ├── list-directory.executor.spec.ts
│   ├── grep.executor.ts
│   └── grep.executor.spec.ts
```

## API Endpoints

Base path: `/api/tools`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/tools` | List all tools, ordered by `name ASC` |
| `PATCH` | `/api/tools/:name/toggle` | Toggle tool enabled/disabled |
| `PATCH` | `/api/tools/:name/config` | Update tool config `{ config: object }` |

## Available Executors

| Executor | Tool Name | Function |
|---|---|---|
| `CreateTaskExecutor` | `create_task` | Create a task |
| `UpdateTaskExecutor` | `update_task` | Update a task |
| `ListTasksExecutor` | `list_tasks` | List all tasks |
| `GetTaskExecutor` | `get_task` | Get task by ID |
| `DeleteTasksExecutor` | `delete_tasks` | Delete tasks |
| `SearchKnowledgeExecutor` | `search_knowledge` | Semantic search in knowledge base |
| `WebFetchExecutor` | `web_fetch` | Fetch URL content |
| `WebSearchExecutor` | `web_search` | Web search |
| `CreateNoteExecutor` | `create_note` | Create a note |
| `UpdateNoteExecutor` | `update_note` | Update a note |
| `ListNotesExecutor` | `list_notes` | List all notes |
| `DeleteNoteExecutor` | `delete_note` | Delete a note |
| `ConvertNoteToTaskExecutor` | `convert_note_to_task` | Convert note to task |
| `ReadFileExecutor` | `read_file` | Read file content |
| `WriteFileExecutor` | `write_file` | Write content to file |
| `ListDirectoryExecutor` | `list_directory` | List directory entries |
| `RunCommandExecutor` | `run_command` | Execute shell command (disabled by default) |
| `GrepExecutor` | `grep` | Search file contents recursively using a pattern |

## Security

- **Allowed paths:** write_file, read_file, list_directory check `isPathAllowed()` against `ALLOWED_PATHS` env var. Defaults: `./workspace_data`, `os.tmpdir()`, `USERPROFILE`/`HOME`, `process.cwd()`.
- **run_command** disabled by default; enabled via Tools UI with permission check.

## Dependency Injection

Executors import domain services directly:
- `TasksModule` → `TasksService` for task CRUD executors
- `KnowledgeModule` → `KnowledgeService` for search knowledge
- `NotesModule` → `NotesService` for note CRUD executors

## Testing

```bash
npx jest src/tools        # executor unit tests
```

Executors are tested individually with mocked domain services.
