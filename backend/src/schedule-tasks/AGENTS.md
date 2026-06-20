# schedule-tasks/ — Agent Context

Scheduled task module — the project's "tasks" feature. A `ScheduleTask` is a named agent prompt that runs on demand or on a cron schedule; each run is recorded as a `ScheduleTaskLog`. Created by the user via `/api/schedule-tasks` and by the agent's `create_task` / `convert_note_to_task` tools.

## Responsibility

- `ScheduleTasksController` — REST endpoints under `/api/schedule-tasks`.
- `ScheduleTasksService` — `ScheduleTask` + `ScheduleTaskLog` CRUD via injected `PrismaService`; exported for use by tool executors.
- `ScheduleCronService` — registers/refreshes cron jobs (`@nestjs/schedule`) for enabled tasks based on `frequency` + cron fields.
- `ScheduleRunnerService` — runs a task's `prompt` through the agent loop (creates a session, streams to completion, writes a `ScheduleTaskLog`).

## Files

```
schedule-tasks/
├── schedule-tasks.module.ts
├── schedule-tasks.controller.ts
├── schedule-tasks.service.ts
├── schedule-cron.service.ts
├── schedule-runner.service.ts
└── dto/
    ├── create-schedule-task.dto.ts
    └── update-schedule-task.dto.ts
```

## API Endpoints

Base path: `/api/schedule-tasks`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/schedule-tasks` | List scheduled tasks |
| `POST` | `/api/schedule-tasks` | Create a scheduled task |
| `PATCH` | `/api/schedule-tasks/:id` | Update a scheduled task |
| `DELETE` | `/api/schedule-tasks/:id` | Delete a scheduled task |
| `GET` | `/api/schedule-tasks/:id/logs` | List run logs for a task |
| `POST` | `/api/schedule-tasks/:id/run` | Run a task now |

## DTOs

**`CreateScheduleTaskDto`**: `name` (required), `prompt` (required), `description?`, `frequency?` (manual|hourly|daily|weekdays|weekly), `cronMinute?` (0–59), `cronHour?` (0–23), `cronDayOfWeek?` (0–6), `cronDaysOfWeek?`, `modelId?` (Int), `projectPath?`, `timezone?`.

**`UpdateScheduleTaskDto`**: `PartialType(CreateScheduleTaskDto)` + `enabled?` (boolean).

## Models

`ScheduleTask` (1) → (N) `ScheduleTaskLog`. See `backend/AGENTS.md` for full Prisma definitions.

## Dependencies

- PrismaService (ScheduleTask / ScheduleTaskLog CRUD)
- AgentModule (`forwardRef`) — agent loop for running prompts
- ProvidersModule — resolve model for a run
- SessionsModule — create a session per run
- CoworkModule — resolve project path
- `@nestjs/schedule` (`ScheduleModule.forRoot()`) — cron registration
