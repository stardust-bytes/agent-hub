# Schedule Tasks — Design Spec

**Date:** 2026-06-13
**Status:** Draft

---

## Problem

The current "Tasks" feature is a Kanban board (TODO/PROCESSING/DONE/FAILED) with drag-and-drop, real-time WebSocket sync, and basic CRUD. This has limited value — tasks are disconnected from agent execution. There's no way to schedule automated agent runs.

**Goal:** Replace the Kanban task system with "Schedule Tasks" — scheduled agent runs that execute a predefined prompt on a timer. Each task can optionally specify a model and project folder.

**Constraint:** The existing `Task` table/data stays in the database for backward compatibility (existing agent tool references). Only the UI and navigation are replaced.

---

## Data Model

### ScheduleTask (new table)

```prisma
model ScheduleTask {
  id            Int      @id @default(autoincrement())
  name          String
  description   String?
  prompt        String
  frequency     String   @default("manual")   // manual | hourly | daily | weekdays | weekly
  cronMinute    Int?                           // 0-59, for hourly / daily / weekdays / weekly
  cronHour      Int?                           // 0-23, for daily / weekdays / weekly
  cronDayOfWeek Int?                           // 0-6 (Sun=0), for weekly only
  modelId       Int?                           // optional ProviderModel ID
  projectPath   String?                        // optional cowork project folder
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  logs          ScheduleTaskLog[]
}
```

**Time configuration by frequency:**

| Frequency | Fields used | Example |
|---|---|---|
| `manual` | none | User triggers manually via "Run Now" |
| `hourly` | `cronMinute` (minute of each hour) | `cronMinute: 15` → chạy lúc :15 mỗi giờ |
| `daily` | `cronHour` + `cronMinute` | `cronHour: 14, cronMinute: 30` → chạy 14:30 mỗi ngày |
| `weekdays` | `cronHour` + `cronMinute` | `cronHour: 9, cronMinute: 0` → chạy 09:00 thứ 2–6 |
| `weekly` | `cronDayOfWeek` + `cronHour` + `cronMinute` | `cronDayOfWeek: 1, cronHour: 8` → chạy 08:00 thứ 2 hàng tuần |

### ScheduleTaskLog (new table)

```prisma
model ScheduleTaskLog {
  id           Int      @id @default(autoincrement())
  taskId       Int
  task         ScheduleTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  sessionId    Int?                         // Chat session created for this execution
  status       String   @default("PENDING") // PENDING | RUNNING | SUCCESS | FAILED
  output       String?                      // result summary or error
  startedAt    DateTime?
  completedAt  DateTime?
  createdAt    DateTime @default(now())
}
```

Relations:
- ScheduleTask `1──N` ScheduleTaskLog (cascade delete)
- ScheduleTaskLog → Session (nullable, reference to chat session)

---

## Backend

### API Endpoints

Module: `ScheduleTasksModule` at `/api/schedule-tasks`

| Method | Path | Handler | Description |
|---|---|---|---|
| `GET` | `/api/schedule-tasks` | `findAll()` | List all tasks, ordered by createdAt desc |
| `POST` | `/api/schedule-tasks` | `create(dto)` | Create new task |
| `PATCH` | `/api/schedule-tasks/:id` | `update(id, dto)` | Update task |
| `DELETE` | `/api/schedule-tasks/:id` | `remove(id)` | Delete task (cascade deletes logs) |
| `POST` | `/api/schedule-tasks/:id/run` | `runNow(id)` | Trigger manual execution now |
| `GET` | `/api/schedule-tasks/:id/logs` | `getLogs(id)` | Get execution logs for a task |

### DTOs

**`CreateScheduleTaskDto`**:
```typescript
export class CreateScheduleTaskDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsString() prompt: string;
  @IsOptional() @IsIn(['manual', 'hourly', 'daily', 'weekdays', 'weekly']) frequency?: string;
  @IsOptional() @IsInt() @Min(0) @Max(59) cronMinute?: number;
  @IsOptional() @IsInt() @Min(0) @Max(23) cronHour?: number;
  @IsOptional() @IsInt() @Min(0) @Max(6) cronDayOfWeek?: number;
  @IsOptional() @IsInt() modelId?: number;
  @IsOptional() @IsString() projectPath?: string;
}
```

**`UpdateScheduleTaskDto`** — `PartialType(CreateScheduleTaskDto)`

### ScheduleTaskService

CRUD methods:
- `findAll()` — `prisma.scheduleTask.findMany({ orderBy: { createdAt: 'desc' }, include: { logs: { take: 1, orderBy: { createdAt: 'desc' } } } })`
- `create(dto)` — create task, return it
- `update(id, dto)` — update task fields
- `remove(id)` — delete with cascade

### ScheduleRunnerService

**`runNow(taskId: number): Promise<ScheduleTaskLog>`**

Flow:
1. Load `ScheduleTask` with `modelId` and `projectPath`
2. Create a new `Session` with mode = `'cowork'` and title = task name
3. Create `ScheduleTaskLog` with status `RUNNING`
4. Resolve provider model (if `modelId` set, use it; otherwise use the first available model)
5. Call `agentLoop.run()` with the task's `prompt` as the message, `projectPath` if set
6. On success: update log status to `SUCCESS`, save output
7. On error: update log status to `FAILED`, save error message

Injects `CoworkService` to set the project path if the task has one.

### ScheduleCronService

Uses `@nestjs/schedule` `@Cron` decorator. Runs every minute to check all enabled tasks.

```typescript
@Cron('0 * * * * *') // every 10 seconds for testing; change to * * * * * for production
async checkSchedules() {
  const tasks = await this.scheduleTaskService.findEligible(new Date());
  for (const task of tasks) {
    await this.scheduleRunnerService.runNow(task.id);
  }
}
```

`findEligible(now)` logic — checks current time against user-configured cron fields:

| Frequency | Eligibility condition |
|---|---|
| `manual` | Never (user triggers via API) |
| `hourly` | `enabled && now.getMinutes() === cronMinute && lastRun was before this hour` |
| `daily` | `enabled && now.getHours() === cronHour && now.getMinutes() === cronMinute && lastRun was before today` |
| `weekdays` | Same as `daily` + `now.getDay()` must be 1–5 (Mon–Fri) |
| `weekly` | Same as `daily` + `now.getDay()` must equal `cronDayOfWeek` |

### Agent Context for Schedule Mode

The schedule runner needs to bypass the normal SSE streaming (no frontend to receive it). It calls `agentLoop.run()` with a mock `WriteStream` that captures output instead of writing to an HTTP response:

```typescript
class CapturingWriteStream {
  private buffer = ''
  write(data: string) { this.buffer += data; return true; }
  getOutput() { return this.buffer; }
}
```

Then extracts the final agent response from the captured output.

---

## Frontend

### Routing

**`frontend/src/router/index.ts`** — Replace `TasksView` with `ScheduleTasksView`:
```typescript
import ScheduleTasksView from '../components/ScheduleTasksView.vue'
// ...
{ path: '/tasks', name: 'tasks', component: ScheduleTasksView },
```

Keep the old `TasksView.vue` and `KanbanBoard.vue` files in the repo (not deleted), just remove the route.

### ScheduleTasksView.vue (new)

Replaces `TasksView.vue` entirely.

**Template layout:**
- Header bar with title "Schedule Tasks" + "New Task" button
- Task list as a table/card list. Each row shows:
  - **Name** + description (truncated)
  - **Frequency** badge: `manual` (muted), `hourly` (cyan), `daily` (green), `weekdays` (orange), `weekly` (accent)
  - **Model** name or "Default"
  - **Project** path or "—"
  - **Enabled** toggle switch
  - **Last run** status + time (from latest log)
  - **Actions**: Run Now, Edit, Delete
- Clicking a task opens detail/log modal or expands inline

**TaskFormModal** (reuse pattern from existing):
- Fields: name, description, prompt (large textarea), frequency (select), model (ModelSelector), project path (input/browse)
- Khi chọn frequency, hiển thị time picker tương ứng:
  - `hourly`: input minute (0–59) — *"Run at minute ___ of each hour"*
  - `daily`: input hour (0–23) + minute (0–59)
  - `weekdays`: input hour + minute (same as daily, auto limit to Mon–Fri)
  - `weekly`: input hour + minute + day of week selector (Mon–Sun)
  - `manual`: không hiển thị time picker
- Create and Edit modes

**Log view**: expandable section per task showing past executions (time, status, session link)

### API layer

**`frontend/src/api/scheduleTasks.ts`**:
```typescript
export interface ScheduleTask { id: number; name: string; description: string | null; prompt: string; frequency: string; modelId: number | null; projectPath: string | null; enabled: boolean; createdAt: string; updatedAt: string; lastLog?: ScheduleTaskLog }
export interface ScheduleTaskLog { id: number; taskId: number; sessionId: number | null; status: string; output: string | null; startedAt: string | null; completedAt: string | null; createdAt: string }

export function listTasks() { return request<ScheduleTask[]>('/schedule-tasks') }
export function createTask(body: Partial<ScheduleTask>) { return request<ScheduleTask>('/schedule-tasks', { method: 'POST', body }) }
export function updateTask(id: number, body: Partial<ScheduleTask>) { return request<ScheduleTask>(`/schedule-tasks/${id}`, { method: 'PATCH', body }) }
export function deleteTask(id: number) { return request<void>(`/schedule-tasks/${id}`, { method: 'DELETE' }) }
export function runTask(id: number) { return request<ScheduleTaskLog>(`/schedule-tasks/${id}/run`, { method: 'POST' }) }
export function getTaskLogs(id: number) { return request<ScheduleTaskLog[]>(`/schedule-tasks/${id}/logs`) }
```

### Navigation

The existing `nav.tasks` entry in `frontend/src/config/navigation.ts` stays unchanged — the `/tasks` route now points to the new view.

### i18n Keys

New keys under `schedules.*`:
- `schedules.header` — "Schedule Tasks" / "Tác vụ định kỳ"
- `schedules.add` — "New Task" / "Tác vụ mới"
- `schedules.edit` — "Edit Task" / "Sửa tác vụ"
- `schedules.runNow` — "Run Now" / "Chạy ngay"
- `schedules.frequency.*` — per-frequency labels
- `schedules.logs.header` — "Execution Logs" / "Lịch sử chạy"
- `schedules.form.*` — form field labels

---

## Files Changed

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `ScheduleTask` + `ScheduleTaskLog` models |
| `backend/src/schedule-tasks/` | NEW module: controller, service, DTOs, runner, cron |
| `backend/package.json` | Add `@nestjs/schedule` dependency |
| `frontend/src/components/ScheduleTasksView.vue` | NEW — replaces TasksView |
| `frontend/src/components/ScheduleTaskFormModal.vue` | NEW — create/edit form |
| `frontend/src/api/scheduleTasks.ts` | NEW — API layer |
| `frontend/src/router/index.ts` | Replace TasksView → ScheduleTasksView |
| `frontend/src/config/navigation.ts` | No change (route name stays) |
| `frontend/src/locales/*.json` | Add `schedules.*` i18n keys |

The old `TasksView.vue`, `KanbanBoard.vue`, `TaskCard.vue`, `TaskCardMenu.vue`, `TaskFormModal.vue`, `api/tasks.ts`, `stores/tasks.ts` remain in the codebase (not deleted) — they're just no longer routed or imported.

---

## Out of Scope

- Deleting the old `Task` Prisma model or its data — kept for backward compat with existing agent tools
- Full calendar/schedule visualization — just the frequency selector for MVP
- Email/notification on task failure — deferred
- Parallel task execution — tasks run sequentially for now
