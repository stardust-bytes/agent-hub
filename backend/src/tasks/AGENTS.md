# tasks/ — Agent Context

Task management module. Full CRUD for the `Task` entity. The Kanban board (Phase 3) will extend this module with status transitions and Socket.io events.

## Responsibility

- `TasksController` — REST endpoints under `/api/tasks`.
- `TasksService` — business logic; all DB access via injected `PrismaService`.
- `dto/` — validated input shapes for create and update.

## Files

```
tasks/
├── tasks.module.ts
├── tasks.controller.ts
├── tasks.controller.spec.ts
├── tasks.service.ts
├── tasks.service.spec.ts
└── dto/
    ├── create-task.dto.ts
    └── update-task.dto.ts
```

## API Endpoints

Base path: `/api/tasks` (global prefix `/api` added in `main.ts`).

| Method | Path | Handler | Description |
|---|---|---|---|
| `GET` | `/api/tasks` | `findAll()` | All tasks, ordered by `createdAt DESC` |
| `POST` | `/api/tasks` | `create(dto)` | Create a task |
| `PATCH` | `/api/tasks/:id` | `update(id, dto)` | Partial update |
| `DELETE` | `/api/tasks/:id` | `remove(id)` | Delete by id |

`:id` is parsed as an integer via `ParseIntPipe`. Passing a non-integer returns 400 automatically.

## Service Methods

```ts
findAll(): Promise<Task[]>
create(dto: CreateTaskDto): Promise<Task>
update(id: number, dto: UpdateTaskDto): Promise<Task>   // throws NotFoundException if id missing
remove(id: number): Promise<Task>                       // throws NotFoundException if id missing
```

`findOneOrFail(id)` is a private helper — used internally by `update` and `remove`.

## DTOs

**`CreateTaskDto`:**
```ts
title: string                                           // required
description?: string
status?: 'TODO' | 'PROCESSING' | 'DONE' | 'FAILED'    // default: 'TODO'
priority?: number                                       // default: 0
dueDate?: string                                        // ISO 8601 date string
```

**`UpdateTaskDto`** — `PartialType(CreateTaskDto)`, every field optional.

`ValidationPipe` (global, `whitelist: true`) strips unknown fields automatically.

## Task Status Values

```
TODO        — not started
PROCESSING  — agent or user actively working on it
DONE        — completed
FAILED      — agent could not complete it
```

## Adding a New Field to Task

1. Add the field to `backend/prisma/schema.prisma`.
2. `npx prisma migrate dev --name add-<fieldname>-to-task`
3. Add the field to `CreateTaskDto` with appropriate `class-validator` decorator.
4. `UpdateTaskDto` inherits it automatically via `PartialType`.
5. Update `tasks.service.spec.ts` — new field should appear in create/update tests.

## Testing Pattern

```bash
npx jest src/tasks        # run just the tasks module tests
npx jest --watch          # watch mode
```

Test files mock `PrismaService` with a jest mock object:
```ts
const mockPrisma = {
  task: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}
```

Always write the failing test before implementing any new service method.

## Phase 3 Note

Phase 3 (Kanban) will add:
- `PATCH /api/tasks/:id/status` — dedicated status transition endpoint
- Socket.io gateway emitting `task:updated` events when status changes

Do not add Socket.io imports to this module before Phase 3 planning is complete.
