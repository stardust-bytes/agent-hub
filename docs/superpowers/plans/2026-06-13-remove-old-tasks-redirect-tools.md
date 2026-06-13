# Remove Old Tasks + Redirect Agent Tools to ScheduleTasks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xoá hệ thống Kanban Tasks cũ (backend + frontend + DB) và chuyển 6 agent tool executors sang dùng ScheduleTasksService.

**Architecture:** 7 tasks độc lập — backend (xoá module, sửa module, sửa 6 executors), frontend (xoá components + sửa deps), DB migration, update tool descriptions.

**Tech Stack:** NestJS, Prisma/SQLite, Vue 3, i18n

---

### Task 1: Xoá backend Tasks module + cập nhật app.module.ts

**Files:**
- Xoá: `backend/src/tasks/`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Xoá thư mục `src/tasks/`**

```bash
Remove-Item -Recurse -Force "backend/src/tasks"
```

- [ ] **Step 2: Sửa `app.module.ts` — bỏ import và registration của TasksModule**

Xoá dòng 6: `import { TasksModule } from './tasks/tasks.module';`
Xoá dòng 32: `TasksModule,`

```bash
git add backend/src/app.module.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove old Tasks backend module"
```

---

### Task 2: Cập nhật ScheduleTasksModule + ToolsModule imports

**Files:**
- Modify: `backend/src/schedule-tasks/schedule-tasks.module.ts`
- Modify: `backend/src/tools/tools.module.ts`

- [ ] **Step 1: Sửa `schedule-tasks.module.ts` — export ScheduleTasksService**

Thêm `exports: [ScheduleTasksService]` vào module decorator:

```typescript
@Module({
  imports: [PrismaModule, AgentModule, ProvidersModule, SessionsModule, CoworkModule, ScheduleModule.forRoot()],
  controllers: [ScheduleTasksController],
  providers: [ScheduleTasksService, ScheduleRunnerService, ScheduleCronService],
  exports: [ScheduleTasksService],
})
export class ScheduleTasksModule {}
```

- [ ] **Step 2: Sửa `tools.module.ts` — thay `TasksModule` bằng `ScheduleTasksModule` + `ProvidersModule`**

Đổi dòng 30: `import { TasksModule } from '../tasks/tasks.module';` → xoá
Thêm: `import { ScheduleTasksModule } from '../schedule-tasks/schedule-tasks.module';`
Thêm: `import { ProvidersModule } from '../providers/providers.module';`

Đổi imports array dòng 94:
```typescript
imports: [ScheduleTasksModule, ProvidersModule, KnowledgeModule, NotesModule, WorkspaceModule, PlansModule, WordModule, ConnectorModule],
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/schedule-tasks/schedule-tasks.module.ts backend/src/tools/tools.module.ts
git commit -m "refactor: wire ScheduleTasksModule and ProvidersModule for tool executors"
```

---

### Task 3: Rewrite 6 task executors → ScheduleTasksService

**Files:**
- Modify: `backend/src/tools/executors/create-task.executor.ts`
- Modify: `backend/src/tools/executors/list-tasks.executor.ts`
- Modify: `backend/src/tools/executors/get-task.executor.ts`
- Modify: `backend/src/tools/executors/update-task.executor.ts`
- Modify: `backend/src/tools/executors/delete-tasks.executor.ts`
- Modify: `backend/src/tools/executors/convert-note-to-task.executor.ts`

- [ ] **Step 1: Rewrite `create-task.executor.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { ScheduleTasksService } from '../../schedule-tasks/schedule-tasks.service';
import { ProvidersService } from '../../providers/providers.service';

@Injectable()
export class CreateTaskExecutor implements ToolExecutor {
  readonly name = 'create_task';

  constructor(
    private readonly scheduleTasksService: ScheduleTasksService,
    private readonly providersService: ProvidersService,
  ) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const name = args.name as string;
    const description = (args.description ?? '') as string;

    let modelId = args.modelId as number | undefined;
    if (!modelId) {
      const models = await this.providersService.findAllModels();
      if (models.length > 0) modelId = models[0].id;
    }

    const task = await this.scheduleTasksService.create({
      name,
      description: description || null,
      prompt: description || '',
      frequency: (args.frequency as string) ?? 'manual',
      cronMinute: args.cronMinute as number | undefined,
      cronHour: args.cronHour as number | undefined,
      cronDayOfWeek: args.cronDayOfWeek as number | undefined,
      cronDaysOfWeek: args.cronDaysOfWeek as string | undefined,
      projectPath: args.projectPath as string | undefined,
      modelId: modelId ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    return `Schedule task #${task.id} created: "${task.name}"`;
  }
}
```

- [ ] **Step 2: Rewrite `list-tasks.executor.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { ScheduleTasksService } from '../../schedule-tasks/schedule-tasks.service';

@Injectable()
export class ListTasksExecutor implements ToolExecutor {
  readonly name = 'list_tasks';

  constructor(private readonly scheduleTasksService: ScheduleTasksService) {}

  async execute(_args: Record<string, unknown>): Promise<string> {
    const tasks = await this.scheduleTasksService.findAll();
    if (tasks.length === 0) return 'No scheduled tasks found.';

    return tasks.map(t =>
      `#${t.id}: "${t.name}" [${t.frequency}] ${t.enabled ? '● enabled' : '○ disabled'}`
    ).join('\n');
  }
}
```

- [ ] **Step 3: Rewrite `get-task.executor.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { ScheduleTasksService } from '../../schedule-tasks/schedule-tasks.service';

@Injectable()
export class GetTaskExecutor implements ToolExecutor {
  readonly name = 'get_task';

  constructor(private readonly scheduleTasksService: ScheduleTasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const id = args.id as number;
    const task = await this.scheduleTasksService.findOne(id);
    if (!task) return `Task #${id} not found.`;

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
    ].filter(Boolean).join('\n');
  }
}
```

- [ ] **Step 4: Rewrite `update-task.executor.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { ScheduleTasksService } from '../../schedule-tasks/schedule-tasks.service';

@Injectable()
export class UpdateTaskExecutor implements ToolExecutor {
  readonly name = 'update_task';

  constructor(private readonly scheduleTasksService: ScheduleTasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const id = args.id as number;
    const dto: Record<string, unknown> = {};
    if (args.name !== undefined) dto.name = args.name;
    if (args.description !== undefined) dto.description = args.description;
    if (args.frequency !== undefined) dto.frequency = args.frequency;
    if (args.cronMinute !== undefined) dto.cronMinute = args.cronMinute;
    if (args.cronHour !== undefined) dto.cronHour = args.cronHour;
    if (args.cronDayOfWeek !== undefined) dto.cronDayOfWeek = args.cronDayOfWeek;
    if (args.cronDaysOfWeek !== undefined) dto.cronDaysOfWeek = args.cronDaysOfWeek;
    if (args.projectPath !== undefined) dto.projectPath = args.projectPath;
    if (args.modelId !== undefined) dto.modelId = args.modelId;

    const task = await this.scheduleTasksService.update(id, dto as any);
    return `Schedule task #${task.id} updated: "${task.name}"`;
  }
}
```

- [ ] **Step 5: Rewrite `delete-tasks.executor.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { ScheduleTasksService } from '../../schedule-tasks/schedule-tasks.service';

@Injectable()
export class DeleteTasksExecutor implements ToolExecutor {
  readonly name = 'delete_tasks';

  constructor(private readonly scheduleTasksService: ScheduleTasksService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const ids = args.ids as number[];
    for (const id of ids) {
      await this.scheduleTasksService.remove(id);
    }
    return `Deleted ${ids.length} schedule task(s): #${ids.join(', #')}`;
  }
}
```

- [ ] **Step 6: Rewrite `convert-note-to-task.executor.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { NotesService } from '../../notes/notes.service';
import { ScheduleTasksService } from '../../schedule-tasks/schedule-tasks.service';
import { ProvidersService } from '../../providers/providers.service';

@Injectable()
export class ConvertNoteToTaskExecutor implements ToolExecutor {
  readonly name = 'convert_note_to_task';

  constructor(
    private readonly notesService: NotesService,
    private readonly scheduleTasksService: ScheduleTasksService,
    private readonly providersService: ProvidersService,
  ) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const noteId = Number(args.noteId);
    if (!noteId) return 'Error: noteId is required.';

    try {
      const note = await this.notesService.findOne(noteId);

      let modelId = args.modelId as number | undefined;
      if (!modelId) {
        const models = await this.providersService.findAllModels();
        if (models.length > 0) modelId = models[0].id;
      }

      const task = await this.scheduleTasksService.create({
        name: note.title,
        description: note.content.substring(0, 200) || null,
        prompt: note.content,
        frequency: 'manual',
        modelId: modelId ?? null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      await this.notesService.remove(noteId);
      return `Converted note "${note.title}" to schedule task #${task.id}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown'}`;
    }
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/tools/executors/create-task.executor.ts backend/src/tools/executors/list-tasks.executor.ts backend/src/tools/executors/get-task.executor.ts backend/src/tools/executors/update-task.executor.ts backend/src/tools/executors/delete-tasks.executor.ts backend/src/tools/executors/convert-note-to-task.executor.ts
git commit -m "refactor: redirect task executors to ScheduleTasksService"
```

---

### Task 4: Xoá Frontend Tasks cũ

**Files:**
- Xoá: `frontend/src/components/TasksView.vue`
- Xoá: `frontend/src/components/KanbanBoard.vue`
- Xoá: `frontend/src/components/TaskCard.vue`
- Xoá: `frontend/src/components/TaskFormModal.vue`
- Xoá: `frontend/src/api/tasks.ts`
- Xoá: `frontend/src/stores/tasks.ts`
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/config/navigation.ts`
- Modify: `frontend/src/stores/ui.ts`
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/locales/vi.json`

- [ ] **Step 1: Xoá component files + api + store**

```bash
Remove-Item "frontend/src/components/TasksView.vue"
Remove-Item "frontend/src/components/KanbanBoard.vue"
Remove-Item "frontend/src/components/TaskCard.vue"
Remove-Item "frontend/src/components/TaskFormModal.vue"
Remove-Item "frontend/src/api/tasks.ts"
Remove-Item "frontend/src/stores/tasks.ts"
```

- [ ] **Step 2: Xoá interface `Task` khỏi `api/types.ts`**

Xoá dòng 24-33:
```typescript
export interface Task {
  id: number
  title: string
  description?: string | null
  status: 'TODO' | 'PROCESSING' | 'DONE' | 'FAILED'
  priority: number
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 3: Sửa `navigation.ts` — xoá `tasks` khỏi sidebar và bottomItems**

Xoá dòng 13: `tasks: ...`
Sửa dòng 25: `pickNav(['cowork', 'notes', 'connectors', 'agent-output'])`
Sửa dòng 27: `pickNav(['cowork', 'agent-output', 'plans', 'notes', 'connectors', 'settings'])`
Xoá import `HiClipboardList` trên dòng 2 (nếu không còn dùng).

Kết quả:
```typescript
import type { Component } from 'vue'
import { HiCode, HiDocumentText, HiCog, HiDownload } from 'vue-icons-plus/hi'

export interface NavItem {
  name: string
  path: string
  labelKey: string
  icon: Component | string
}

export const NAV: Record<string, NavItem> = {
  cowork:          { name: 'cowork',        path: '/cowork',        labelKey: 'nav.cowork',      icon: HiCode },
  notes:           { name: 'notes',         path: '/notes',         labelKey: 'nav.notes',       icon: HiDocumentText },
  connectors:      { name: 'connectors',    path: '/connectors',    labelKey: 'nav.connectors',  icon: HiCog },
  'agent-output':  { name: 'agent-output',  path: '/agent-output',  labelKey: 'nav.agentOutput', icon: HiDownload },
  plans:           { name: 'plans',         path: '/plans',         labelKey: 'nav.plans',       icon: '📋' },
  settings:        { name: 'settings',      path: '/settings',      labelKey: 'nav.settings',    icon: HiCog },
}
```

- [ ] **Step 4: Sửa `stores/ui.ts` — xoá `wsConnected`**

Xoá dòng 7: `const wsConnected = ref(false)`
Xoá dòng 20: `wsConnected,` khỏi return

Kết quả:
```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getHealth } from '../api/health'

export const useUiStore = defineStore('ui', () => {
  const dbConnected = ref(true)
  const activeSubagents = ref(0)
  const sidebarOpen = ref(false)

  async function refreshHealth() {
    try {
      const h = await getHealth()
      dbConnected.value = h.db === 'connected'
    } catch {
      dbConnected.value = false
    }
  }

  return { dbConnected, activeSubagents, sidebarOpen, refreshHealth }
})
```

- [ ] **Step 5: Xoá i18n keys `tasks.*` khỏi `locales/en.json` và `locales/vi.json`**

Xoá các keys từ `tasks.fetch_failed` đến `tasks.edit` trong cả 2 files.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove old Tasks frontend components and references"
```

---

### Task 5: DB Migration — xoá bảng Task

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: migration file

- [ ] **Step 1: Xoá `model Task` khỏi `prisma/schema.prisma`**

Xoá dòng 66-75:
```
model Task {
  id          Int       @id @default(autoincrement())
  title       String
  description String?
  status      String    @default("TODO")
  priority    Int       @default(0)
  dueDate     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

- [ ] **Step 2: Tạo migration**

```bash
cd backend
npx prisma migrate dev --create-only --name remove_task_model
```

- [ ] **Step 3: Thêm SQL xoá bảng vào migration file**

Sửa file migration mới tạo `backend/prisma/migrations/XXXXXX_remove_task_model/migration.sql` — thêm dòng:
```sql
DROP TABLE IF EXISTS "Task";
```

- [ ] **Step 4: Apply migration**

```bash
npx prisma migrate deploy
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "refactor: remove Task model from database schema"
```

---

### Task 6: Cập nhật tool descriptions trong DB

**Files:**
- Modify: `backend/prisma/seed.ts` (hoặc tạo script update tool descriptions)

- [ ] **Step 1: Sửa seed/tool descriptions**

Mở `backend/prisma/seed.ts` và cập nhật description cho 6 tool executors:

| Tool name | Description mới |
|---|---|
| `create_task` | Create a scheduled task. Parameters: name (required), description (optional, used as AI prompt), frequency (optional, default manual; values: manual/hourly/daily/weekdays/weekly), cronMinute (0-59), cronHour (0-23), cronDayOfWeek (0-6, 0=Sunday), cronDaysOfWeek (comma-separated, 0=Sun, 1=Mon...), modelId (optional, auto-resolves to first available model if empty), projectPath (optional, leave empty unless user explicitly requests). Use natural language to parse user's scheduling requests into cron fields. |
| `update_task` | Update a scheduled task by id. Parameters: id (required), name, description, frequency, cronMinute, cronHour, cronDayOfWeek, cronDaysOfWeek, modelId, projectPath (all optional — only provided fields are updated). |
| `list_tasks` | List all scheduled tasks. |
| `get_task` | Get details of a scheduled task by id. Parameters: id (required). |
| `delete_tasks` | Delete scheduled tasks by array of ids. Parameters: ids (required, array of numbers). |
| `convert_note_to_task` | Convert a note to a scheduled task. Parameters: noteId (required), modelId (optional, auto-resolves if empty). |

- [ ] **Step 2: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "chore: update tool descriptions for schedule tasks"
```

---

### Task 7: Xoá file types.ts unused imports (cleanup)

- [ ] **Step 1: Check nếu `api/types.ts` không còn `Task` interface dùng ở đâu**

```bash
cd frontend
rg "from ['\"]\.\./api/types['\"]" src/ --type ts
rg "Task" src/ --type ts | grep -v node_modules | grep -v ".spec.ts"
```

Nếu không còn file nào import `Task`, có thể xoá luôn `api/types.ts` hoặc giữ lại các interface còn dùng (`ProviderModelFlat`, `SessionSummary`, `StoredMessage`).

- [ ] **Step 2: Commit nếu có thay đổi**

```bash
git add -A
git commit -m "chore: cleanup unused types after Task removal"
```
