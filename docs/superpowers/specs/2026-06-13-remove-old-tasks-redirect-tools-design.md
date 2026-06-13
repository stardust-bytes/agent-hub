# Remove Old Tasks (Kanban) + Redirect Agent Tools to ScheduleTasks

## Scope

Xoá toàn bộ hệ thống Tasks cũ (Kanban) và chuyển hướng 6 agent executors sang dùng ScheduleTasksService.

## Phần 1: Xoá Backend Tasks cũ

**Files cần xoá:**
- `backend/src/tasks/` — toàn bộ thư mục (tasks.module.ts, controller, service, gateway, DTOs, specs, AGENTS.md)
- `backend/prisma/schema.prisma` — xoá `model Task` (tạo migration mới `20260613_remove_task_model`)
- `backend/src/app.module.ts` — bỏ `TasksModule` khỏi imports array

**Migration:** `prisma migrate dev --create-only` + manual SQL `DROP TABLE IF EXISTS "Task"` + xoá `_prisma_migrations` entry cho migration cũ `20260607051149_init`. Không xoá dữ liệu user (bảng Task là độc lập, không liên quan đến dữ liệu khác).

## Phần 2: Chuyển hướng 6 Executor

**Thay đổi trong từng executor:**
- Inject `ScheduleTasksService` + `ProvidersService` thay vì `TasksService`
- Mapping: `title → name`, `description → prompt`, bỏ `priority`/`status`/`dueDate`

### create-task.executor.ts

```typescript
@Injectable()
export class CreateTaskExecutor implements ToolExecutor {
  readonly name = 'create_task'

  constructor(
    private scheduleTasksService: ScheduleTasksService,
    private providersService: ProvidersService,
  ) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const name = args.name as string
    const description = args.description as string | undefined

    let modelId = args.modelId as number | undefined
    if (!modelId) {
      const models = await this.providersService.findAllModels()
      if (models.length > 0) modelId = models[0].id
    }

    const task = await this.scheduleTasksService.create({
      name,
      description: description ?? null,
      prompt: description ?? '',
      frequency: (args.frequency as string) ?? 'manual',
      cronMinute: args.cronMinute as number | undefined,
      cronHour: args.cronHour as number | undefined,
      cronDayOfWeek: args.cronDayOfWeek as number | undefined,
      cronDaysOfWeek: args.cronDaysOfWeek as string | undefined,
      projectPath: args.projectPath as string | undefined,
      modelId: modelId ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })

    return `Schedule task #${task.id} created: "${task.name}"`
  }
}
```

### list-tasks.executor.ts

```typescript
@Injectable()
export class ListTasksExecutor implements ToolExecutor {
  readonly name = 'list_tasks'

  constructor(private scheduleTasksService: ScheduleTasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const tasks = await this.scheduleTasksService.findAll()
    if (tasks.length === 0) return 'No scheduled tasks found.'

    return tasks.map(t =>
      `#${t.id}: "${t.name}" [${t.frequency}] ${t.enabled ? '● enabled' : '○ disabled'}`
    ).join('\n')
  }
}
```

### get-task.executor.ts

```typescript
@Injectable()
export class GetTaskExecutor implements ToolExecutor {
  readonly name = 'get_task'

  constructor(private scheduleTasksService: ScheduleTasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const id = args.id as number
    const task = await this.scheduleTasksService.findOne(id)
    if (!task) return `Task #${id} not found.`

    return [
      `Task #${task.id}: "${task.name}"`,
      `Description: ${task.description ?? '(none)'}`,
      `Prompt: ${task.prompt}`,
      `Frequency: ${task.frequency}`,
      task.cronHour != null ? `Time: ${String(task.cronHour).padStart(2, '0')}:${String(task.cronMinute ?? 0).padStart(2, '0')}` : null,
      task.cronDaysOfWeek ? `Days: ${task.cronDaysOfWeek}` : null,
      `Model ID: ${task.modelId ?? '(default)'}`,
      `Project: ${task.projectPath ?? '(none)'}`,
      `Timezone: ${task.timezone ?? '(none)'}`,
      `Enabled: ${task.enabled}`,
    ].filter(Boolean).join('\n')
  }
}
```

### update-task.executor.ts

```typescript
@Injectable()
export class UpdateTaskExecutor implements ToolExecutor {
  readonly name = 'update_task'

  constructor(
    private scheduleTasksService: ScheduleTasksService,
    private providersService: ProvidersService,
  ) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const id = args.id as number

    let modelId = args.modelId as number | undefined
    if (args.modelId === undefined && args.name && !args.frequency) {
      // Nếu user không truyền modelId, giữ nguyên model cũ
    }

    const dto: any = {}
    if (args.name !== undefined) dto.name = args.name
    if (args.description !== undefined) dto.description = args.description
    if (args.prompt !== undefined) dto.prompt = args.prompt
    if (args.frequency !== undefined) dto.frequency = args.frequency
    if (args.cronMinute !== undefined) dto.cronMinute = args.cronMinute
    if (args.cronHour !== undefined) dto.cronHour = args.cronHour
    if (args.cronDayOfWeek !== undefined) dto.cronDayOfWeek = args.cronDayOfWeek
    if (args.cronDaysOfWeek !== undefined) dto.cronDaysOfWeek = args.cronDaysOfWeek
    if (args.projectPath !== undefined) dto.projectPath = args.projectPath
    if (args.modelId !== undefined) dto.modelId = args.modelId

    const task = await this.scheduleTasksService.update(id, dto)
    return `Schedule task #${task.id} updated: "${task.name}"`
  }
}
```

### delete-tasks.executor.ts

```typescript
@Injectable()
export class DeleteTasksExecutor implements ToolExecutor {
  readonly name = 'delete_tasks'

  constructor(private scheduleTasksService: ScheduleTasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const ids = args.ids as number[]
    const deleted: number[] = []
    for (const id of ids) {
      await this.scheduleTasksService.remove(id)
      deleted.push(id)
    }
    return `Deleted ${deleted.length} schedule task(s): #${deleted.join(', #')}`
  }
}
```

### convert-note-to-task.executor.ts

```typescript
@Injectable()
export class ConvertNoteToTaskExecutor implements ToolExecutor {
  readonly name = 'convert_note_to_task'

  constructor(
    private scheduleTasksService: ScheduleTasksService,
    private notesService: NotesService,
    private providersService: ProvidersService,
  ) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const noteId = args.noteId as number
    const note = await this.notesService.findOne(noteId)

    let modelId = args.modelId as number | undefined
    if (!modelId) {
      const models = await this.providersService.findAllModels()
      if (models.length > 0) modelId = models[0].id
    }

    const task = await this.scheduleTasksService.create({
      name: note.title,
      description: note.content.substring(0, 200),
      prompt: note.content,
      frequency: 'manual',
      modelId: modelId ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })

    await this.notesService.remove(noteId)
    return `Converted note "${note.title}" to schedule task #${task.id}`
  }
}
```

## Phần 3: Xoá Frontend Tasks cũ

**Xoá files:**
- `frontend/src/components/TasksView.vue`
- `frontend/src/components/KanbanBoard.vue`
- `frontend/src/components/TaskCard.vue`
- `frontend/src/components/TaskFormModal.vue`
- `frontend/src/api/tasks.ts`
- `frontend/src/stores/tasks.ts`

**Sửa files:**
- `frontend/src/api/types.ts` — xoá interface `Task`
- `frontend/src/config/navigation.ts` — xoá `NAV.tasks`, xoá khỏi `sidebarItems` và `bottomItems`
- `frontend/src/stores/ui.ts` — xoá `wsConnected` (chỉ KanbanBoard dùng)
- `frontend/src/locales/en.json` — xoá tất cả keys `tasks.*`
- `frontend/src/locales/vi.json` — xoá tất cả keys `tasks.*`

## Phần 4: Cập nhật module registration

- `backend/src/app.module.ts` — bỏ `TasksModule` import
- `backend/src/tools/tools.module.ts` — thay `TasksModule` bằng `ScheduleTasksModule` + `ProvidersModule` trong imports để executors có thể inject

## Tool descriptions cho LLM

Các tool descriptions cần cập nhật để LLM biết cách dùng:
- `create_task`: "Create a scheduled task. Parameters: name (required), description (optional, used as prompt), frequency (optional, default manual; values: manual/hourly/daily/weekdays/weekly), cronMinute (0-59), cronHour (0-23), cronDayOfWeek (0-6, 0=Sunday), cronDaysOfWeek (comma-separated, 0=Sun, 1=Mon...), modelId (optional, auto-resolves if empty), projectPath (optional). Use natural language to parse user's scheduling requests into cron fields."
- `update_task`: "Update a scheduled task by id."
- `list_tasks`: "List all scheduled tasks."
- `get_task`: "Get details of a scheduled task by id."
- `delete_tasks`: "Delete scheduled tasks by array of ids."
- `convert_note_to_task`: "Convert a note to a scheduled task."
