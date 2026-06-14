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
│   ├── grep.executor.spec.ts
│   ├── resume-plan.executor.ts
│   ├── resume-plan.executor.spec.ts
│   ├── create-plan.executor.ts
│   └── create-plan.executor.spec.ts
│   ├── spawn-subagent.executor.ts
│   └── spawn-subagent.executor.spec.ts
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
| `ResumePlanExecutor` | `resume_plan` | Validate and describe plan status for resumption |
| `CreatePlanExecutor` | `create_plan` | Create a plan with steps, optional auto-approve |
| `SpawnSubagentExecutor` | `spawn_subagent` | Registration placeholder — subagent spawning handled by AgentLoopService |
| `GoogleGmailSearchExecutor` | `google_gmail_search` | Search Gmail emails |
| `GoogleGmailReadExecutor` | `google_gmail_read` | Read a Gmail email |
| `GoogleGmailSendExecutor` | `google_gmail_send` | Send email via Gmail |
| `GoogleGmailDraftExecutor` | `google_gmail_draft` | Create Gmail draft |
| `GoogleGmailLabelsExecutor` | `google_gmail_labels` | List Gmail labels |
| `GoogleCalendarListExecutor` | `google_calendar_list` | List calendar events |
| `GoogleCalendarCreateExecutor` | `google_calendar_create` | Create calendar event |
| `GoogleCalendarUpdateExecutor` | `google_calendar_update` | Update calendar event |
| `GoogleCalendarAvailabilityExecutor` | `google_calendar_availability` | Check calendar availability |
| `GoogleDriveSearchExecutor` | `google_drive_search` | Search Drive files |
| `GoogleDriveReadExecutor` | `google_drive_read` | Read Drive file |
| `GoogleDriveListExecutor` | `google_drive_list` | List Drive folder |
| `GoogleDriveUploadExecutor` | `google_drive_upload` | Upload to Drive |
| `GoogleSheetsReadExecutor` | `google_sheets_read` | Read a Sheets range → markdown table |
| `GoogleSheetsListTabsExecutor` | `google_sheets_list_tabs` | List tabs in a spreadsheet |
| `GoogleSheetsUpdateExecutor` | `google_sheets_update` | Overwrite values in a range |
| `GoogleSheetsAppendExecutor` | `google_sheets_append` | Append rows to a tab |
| `GoogleSheetsCreateExecutor` | `google_sheets_create` | Create a new spreadsheet |
| `GoogleSheetsAddTabExecutor` | `google_sheets_add_tab` | Add a tab to a spreadsheet |
| `GoogleSheetsFormatExecutor` | `google_sheets_format` | Format a cell range |
| `GoogleSheetsChartExecutor` | `google_sheets_chart` | Add a chart to a tab |

## Security

- **Allowed paths:** write_file, read_file, list_directory check `isPathAllowed()` against `ALLOWED_PATHS` env var. Defaults: `./workspace_data`, `os.tmpdir()`, `USERPROFILE`/`HOME`, `process.cwd()`.
- **run_command** disabled by default; enabled via Tools UI with permission check.
- **Mode-aware sandbox:** `write_file` receives `ToolContext` (mode + sessionId). In `agent` mode, path is forced to `{workspaceRoot}/agent-output/session_{sessionId}/` — directory parts are stripped from LLM-supplied paths. Non-agent modes retain standard `isPathAllowed()` checks.

## Dependency Injection

Executors import domain services directly:
- `TasksModule` → `TasksService` for task CRUD executors
- `KnowledgeModule` → `KnowledgeService` for search knowledge
- `NotesModule` → `NotesService` for note CRUD executors
- `PlansModule` → `PlansService` for resume_plan, create_plan executors
- `ConnectorModule` → `GmailService`, `GoogleCalendarService`, `GoogleDriveService` for Google connector executors

## Testing

```bash
npx jest src/tools        # executor unit tests
```

Executors are tested individually with mocked domain services.
