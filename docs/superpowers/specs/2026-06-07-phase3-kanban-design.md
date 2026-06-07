# Phase 3 — Task Kanban Board (Real-time) Design Spec

**Date:** 2026-06-07  
**Status:** Approved  
**Owner:** doanphanthanh1305@gmail.com  
**Depends on:** Phase 1 (i18n + Language Toggle)  
**Independent of:** Phase 2 (Ollama Chat)

---

## Overview

Add a full-width Kanban Board view for the existing `tasks` table (created in Phase 0). When the user clicks "Nhiệm vụ" in the sidebar, ChatPanel and ArtifactsPanel are hidden and a 4-column board takes their place. Columns reflect `Task.status`. Drag-drop between columns updates status via REST. Socket.io broadcasts changes to all connected clients in real time.

---

## User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| TASK-1 | Xem task theo 4 cột | Board hiển thị đúng TODO/PROCESSING/DONE/FAILED; count badge trên mỗi cột header |
| TASK-2 | Kéo task sang cột khác | Drag-drop → optimistic UI update → `PATCH /api/tasks/:id { status }` → Socket.io broadcast |
| TASK-3 | Tạo task mới inline | Click `+ thêm task` ở cột CẦN LÀM → input → Enter → task xuất hiện ngay |
| TASK-4 | Board tự cập nhật real-time | Socket.io event `task:updated` → board re-render, không reload |
| TASK-5 | Xóa task hoặc đổi priority | Hover card → `···` menu → Xóa (confirm) hoặc chọn priority |
| TASK-6 | Lọc theo priority | Toggle buttons CAO/TB/THẤP ở top bar, ảnh hưởng tất cả 4 cột |

---

## Architecture Decisions

**Real-time mechanism:** Socket.io (namespace `/tasks`). Bidirectional, reusable for Phase 6 agent tool calls. `TasksGateway` emits after every CRUD mutation in `TasksService`.

**Drag-drop library:** `vue-draggable-plus` (SortableJS-based Vue 3 wrapper). Already specified in roadmap.

**Optimistic UI:** Drag-drop updates local state immediately, then reconciles with Socket.io event. On `PATCH` failure, rollback to previous column.

**Priority mapping:** `2 = CAO (High)`, `1 = TB (Medium)`, `0 = THẤP (Low)`. Default remains `0`. Display label and badge color derived from this integer.

**Task card style:** Rich — title + 1-line description preview + priority badge + due date + `···` hover menu.

---

## Backend Design

### New Files

```
src/tasks/
├── tasks.gateway.ts          — @WebSocketGateway namespace /tasks
└── tasks.gateway.spec.ts
```

### Modified Files

```
src/tasks/
├── tasks.module.ts           — add TasksGateway to providers
├── tasks.service.ts          — inject TasksGateway, emit after each mutation
└── tasks.service.spec.ts     — add gateway mock, test emit calls
```

### `TasksGateway`

```ts
@WebSocketGateway({
  namespace: '/tasks',
  cors: { origin: ['http://localhost:5173', 'http://localhost:3000'] },
})
export class TasksGateway {
  @WebSocketServer() server: Server

  emitCreated(task: Task): void { this.server.emit('task:created', task) }
  emitUpdated(task: Task): void { this.server.emit('task:updated', task) }
  emitDeleted(id: number): void  { this.server.emit('task:deleted', { id }) }
}
```

`TasksGateway` has no `@SubscribeMessage` handlers — it is emit-only. All mutations go through REST.

### `TasksService` changes

Inject `TasksGateway` via constructor (circular dependency avoided — gateway does not inject service).

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly gateway: TasksGateway,
) {}

async create(dto: CreateTaskDto): Promise<Task> {
  const task = await this.prisma.task.create({ data: dto })
  this.gateway.emitCreated(task)
  return task
}

async update(id: number, dto: UpdateTaskDto): Promise<Task> {
  await this.findOneOrFail(id)
  const task = await this.prisma.task.update({ where: { id }, data: dto })
  this.gateway.emitUpdated(task)
  return task
}

async remove(id: number): Promise<Task> {
  await this.findOneOrFail(id)
  const task = await this.prisma.task.delete({ where: { id } })
  this.gateway.emitDeleted(task.id)
  return task
}
```

### `tasks.module.ts` changes

```ts
@Module({
  controllers: [TasksController],
  providers: [TasksService, TasksGateway],
})
export class TasksModule {}
```

### New npm dependencies (backend)

```
@nestjs/websockets  @nestjs/platform-socket.io  socket.io
```

---

## Frontend Design

### New Files

```
src/components/
├── TasksView.vue        — layout wrapper: header + filter bar + KanbanBoard
├── KanbanBoard.vue      — 4-column board, drag-drop, socket.io-client
├── TaskCard.vue         — single card: title + desc + badge + date + menu
└── TaskCardMenu.vue     — hover dropdown: delete + priority options
```

### Modified Files

```
src/components/
└── AppShell.vue         — conditional render TasksView vs Chat+Artifacts

src/locales/
├── vi.json              — 14 new keys
└── en.json              — 14 new keys
```

### `AppShell.vue` change

```vue
<SidebarNav :active-view="activeView" @navigate="activeView = $event" />
<TasksView v-if="activeView === 'tasks'" class="flex-1" />
<template v-else>
  <ChatPanel class="border-r border-cyber-border" style="width:45%" @last-message="lastAgentMessage=$event" />
  <ArtifactsPanel class="flex-1" :last-message="lastAgentMessage" />
</template>
```

Import `TasksView` only when needed — add to `<script setup>`.

### `TasksView.vue`

**Responsibility:** Filter state + layout shell. Passes `filters` down to `KanbanBoard`.

**State:**
```ts
const activeFilters = ref<Set<number>>(new Set())  // empty = show all

function toggleFilter(priority: number) {
  if (activeFilters.value.has(priority)) activeFilters.value.delete(priority)
  else activeFilters.value.add(priority)
}
```

**Template structure:**
```
TasksView
├── header bar: "📋 NHIỆM VỤ" + ws status indicator
├── filter bar: [CAO] [TB] [THẤP] toggle buttons
└── KanbanBoard :filters="activeFilters"
```

### `KanbanBoard.vue`

**Props:** `filters: Set<number>`

**State:**
```ts
interface Task {
  id: number; title: string; description?: string
  status: 'TODO' | 'PROCESSING' | 'DONE' | 'FAILED'
  priority: number; dueDate?: string
  createdAt: string; updatedAt: string
}

const tasks = ref<Task[]>([])
const wsConnected = ref(false)
const newTaskTitle = ref('')
const addingTask = ref(false)
```

**Computed columns:**
```ts
const columns = [
  { key: 'TODO',       labelKey: 'tasks.col.todo'       },
  { key: 'PROCESSING', labelKey: 'tasks.col.processing' },
  { key: 'DONE',       labelKey: 'tasks.col.done'       },
  { key: 'FAILED',     labelKey: 'tasks.col.failed'     },
]

function tasksForColumn(status: string): Task[] {
  return tasks.value.filter(t =>
    t.status === status &&
    (activeFilters.value.size === 0 || activeFilters.value.has(t.priority))
  )
}
```

**`onMounted`:**
1. `GET /api/tasks` → populate `tasks`
2. Connect `socket.io-client` to `window.location.origin` on namespace `/tasks` — nginx proxies `/socket.io` to backend in both dev (via `vite.config.ts` proxy) and prod (nginx.conf)
3. On `task:created` → push to `tasks`
4. On `task:updated` → replace task in `tasks` by id
5. On `task:deleted` → remove from `tasks` by id
6. On connect/disconnect → update `wsConnected`

**Drag-drop (vue-draggable-plus):**
```ts
async function onDrop(task: Task, newStatus: string) {
  const previousStatus = task.status
  task.status = newStatus  // optimistic
  try {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  } catch {
    task.status = previousStatus  // rollback
    // append error via system message pattern (not applicable here — just console.error acceptable for kanban)
  }
}
```

**Inline task creation (TODO column only):**
```ts
async function createTask() {
  const title = newTaskTitle.value.trim()
  if (!title) return
  newTaskTitle.value = ''
  addingTask.value = false
  await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, status: 'TODO', priority: 0 }),
  })
  // Socket.io task:created event will update the board automatically
}
```

### `TaskCard.vue`

**Props:** `task: Task`  
**Emits:** `delete: [id: number]`, `update-priority: [id: number, priority: number]`

**Priority badge:**
```ts
function priorityLabel(p: number): string {
  if (p >= 2) return t('tasks.priority.high')
  if (p === 1) return t('tasks.priority.medium')
  return t('tasks.priority.low')
}

function priorityClass(p: number): string {
  if (p >= 2) return 'badge-high'
  if (p === 1) return 'badge-medium'
  return 'badge-low'
}
```

**Due date display:** `new Date(task.dueDate).toLocaleDateString('vi-VN')` — `DD/MM/YYYY`.

**`···` menu:** Visible on hover (`group-hover:visible`). Opens `TaskCardMenu`.

### `TaskCardMenu.vue`

**Props:** `taskId: number`, `currentPriority: number`  
**Emits:** `delete`, `update-priority`

**Options:**
- Priority: `[CAO(2)] [TB(1)] [THẤP(0)]` — active state highlights current
- `Xóa` button → `window.confirm(...)` → emit `delete`

Positioned absolutely below `···` button. Closes on click-outside (`@click.away` or `v-click-outside`).

### New i18n Keys (14 keys each locale)

| Key | vi | en |
|---|---|---|
| `tasks.header` | `NHIỆM VỤ` | `TASKS` |
| `tasks.col.todo` | `CẦN LÀM` | `TODO` |
| `tasks.col.processing` | `ĐANG LÀM` | `IN PROGRESS` |
| `tasks.col.done` | `HOÀN THÀNH` | `DONE` |
| `tasks.col.failed` | `THẤT BẠI` | `FAILED` |
| `tasks.filter.label` | `LỌC:` | `FILTER:` |
| `tasks.priority.high` | `CAO` | `HIGH` |
| `tasks.priority.medium` | `TB` | `MED` |
| `tasks.priority.low` | `THẤP` | `LOW` |
| `tasks.add` | `+ thêm task` | `+ add task` |
| `tasks.add.placeholder` | `tiêu đề task_` | `task title_` |
| `tasks.menu.delete` | `Xóa` | `Delete` |
| `tasks.ws.connected` | `● ws kết nối` | `● ws connected` |
| `tasks.ws.disconnected` | `○ ws offline` | `○ ws offline` |

---

## Error Handling Matrix

| Scenario | Behavior |
|---|---|
| `GET /api/tasks` fails on mount | Hiển thị system error message trên board, board trống |
| `PATCH` status fails (drag-drop) | Rollback card về cột cũ (optimistic revert) |
| `POST` create task fails | Không thêm card (Socket.io `task:created` không đến) |
| Socket.io disconnect | `wsConnected = false` → badge `○ ws offline`; board vẫn functional qua REST |
| Delete confirm cancelled | Không làm gì |

---

## Testing Plan (Backend TDD)

**Write specs before implementation.**

### `tasks.gateway.spec.ts`
- `emitCreated(task)` calls `server.emit('task:created', task)`
- `emitUpdated(task)` calls `server.emit('task:updated', task)`
- `emitDeleted(5)` calls `server.emit('task:deleted', { id: 5 })`

### `tasks.service.spec.ts` (add to existing)
- `create()` calls `gateway.emitCreated()` with the created task
- `update()` calls `gateway.emitUpdated()` with the updated task
- `remove()` calls `gateway.emitDeleted()` with the task's id
- Existing tests must still pass

---

## New npm Dependencies

**Backend:**
```json
"@nestjs/websockets": "^10.0.0",
"@nestjs/platform-socket.io": "^10.0.0",
"socket.io": "^4.0.0"
```

**Frontend:**
```json
"socket.io-client": "^4.0.0",
"vue-draggable-plus": "^0.3.0"
```

---

## Out of Scope (Phase 3)

- Sub-tasks / checklist inside cards
- Task detail modal (edit description inline is deferred)
- Due date picker UI (text input only in Phase 4)
- Task assignment (single-user app)
- Drag-drop between browser tabs (single-tab scope)
- Agent-triggered task creation (Phase 6)

---

## Non-Breaking Contract

- All existing `TasksController` endpoints unchanged (`GET`, `POST`, `PATCH/:id`, `DELETE/:id`)
- `Task` Prisma schema unchanged (no migration needed)
- `ChatPanel`, `ArtifactsPanel`, `SidebarNav` unchanged
- All existing i18n keys unchanged — only additions
