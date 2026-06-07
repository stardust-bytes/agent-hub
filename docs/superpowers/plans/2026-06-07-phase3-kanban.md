# Phase 3 — Task Kanban Board (Real-time) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time Kanban Board for the existing `tasks` table — 4 columns, drag-drop status updates, Socket.io broadcast to all clients, and a filter bar by priority.

**Architecture:** `TasksGateway` (Socket.io namespace `/tasks`) emits events after every `TasksService` mutation. Frontend `KanbanBoard.vue` connects via `socket.io-client`, uses `vue-draggable-plus` for drag-drop, and applies optimistic UI with PATCH rollback on failure. `AppShell.vue` conditionally renders `TasksView` instead of `ChatPanel + ArtifactsPanel` when `activeView === 'tasks'`.

**Tech Stack:** NestJS `@nestjs/websockets`, `socket.io` v4, `vue-draggable-plus` v0.3, `socket.io-client` v4, Vue 3 `reactive`, `<script setup lang="ts">`.

---

## File Map

**Backend — Create:**
- `backend/src/tasks/tasks.gateway.ts`
- `backend/src/tasks/tasks.gateway.spec.ts`

**Backend — Modify:**
- `backend/src/tasks/tasks.service.ts` — inject `TasksGateway`, emit after each mutation
- `backend/src/tasks/tasks.service.spec.ts` — add gateway mock + 3 new emit tests
- `backend/src/tasks/tasks.module.ts` — add `TasksGateway` to providers
- `backend/package.json` — add `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`

**Frontend — Create:**
- `frontend/src/components/TasksView.vue`
- `frontend/src/components/KanbanBoard.vue`
- `frontend/src/components/TaskCard.vue`
- `frontend/src/components/TaskCardMenu.vue`

**Frontend — Modify:**
- `frontend/src/locales/vi.json` — add 15 new keys
- `frontend/src/locales/en.json` — add 15 new keys
- `frontend/src/components/AppShell.vue` — conditional TasksView render
- `frontend/package.json` — add `socket.io-client`, `vue-draggable-plus`

**No change needed:**
- `frontend/vite.config.ts` — already has `'/socket.io': { target: 'http://localhost:3001', ws: true }`
- `backend/prisma/schema.prisma` — Task model unchanged
- All existing REST endpoints — unchanged

---

## Task 1: Install Backend Dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install packages**

```bash
cd backend && npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

Expected: packages added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Verify installation**

```bash
node -e "require('@nestjs/websockets'); console.log('ok')"
```

Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: install @nestjs/websockets socket.io for Phase 3"
```

---

## Task 2: TasksGateway TDD

**Files:**
- Create: `backend/src/tasks/tasks.gateway.spec.ts`
- Create: `backend/src/tasks/tasks.gateway.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/tasks/tasks.gateway.spec.ts
import { TasksGateway } from './tasks.gateway';
import { Server } from 'socket.io';
import { Task } from '@prisma/client';

describe('TasksGateway', () => {
  let gateway: TasksGateway;
  const mockEmit = jest.fn();

  beforeEach(() => {
    gateway = new TasksGateway();
    (gateway as any).server = { emit: mockEmit } as unknown as Server;
    jest.clearAllMocks();
  });

  const mockTask: Task = {
    id: 1,
    title: 'Test task',
    description: null,
    status: 'TODO',
    priority: 0,
    dueDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('emitCreated emits task:created with task', () => {
    gateway.emitCreated(mockTask);
    expect(mockEmit).toHaveBeenCalledWith('task:created', mockTask);
  });

  it('emitUpdated emits task:updated with task', () => {
    gateway.emitUpdated(mockTask);
    expect(mockEmit).toHaveBeenCalledWith('task:updated', mockTask);
  });

  it('emitDeleted emits task:deleted with id object', () => {
    gateway.emitDeleted(5);
    expect(mockEmit).toHaveBeenCalledWith('task:deleted', { id: 5 });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest src/tasks/tasks.gateway.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './tasks.gateway'`

- [ ] **Step 3: Implement TasksGateway**

```typescript
// backend/src/tasks/tasks.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Task } from '@prisma/client';

@WebSocketGateway({
  namespace: '/tasks',
  cors: { origin: ['http://localhost:5173', 'http://localhost:3000'] },
})
export class TasksGateway {
  @WebSocketServer() server: Server;

  emitCreated(task: Task): void {
    this.server.emit('task:created', task);
  }

  emitUpdated(task: Task): void {
    this.server.emit('task:updated', task);
  }

  emitDeleted(id: number): void {
    this.server.emit('task:deleted', { id });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/tasks/tasks.gateway.spec.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/tasks/tasks.gateway.ts backend/src/tasks/tasks.gateway.spec.ts
git commit -m "feat: add TasksGateway with Socket.io emit methods TDD"
```

---

## Task 3: TasksService TDD Update

**Files:**
- Modify: `backend/src/tasks/tasks.service.spec.ts` — full replacement
- Modify: `backend/src/tasks/tasks.service.ts` — inject gateway, add emit calls

- [ ] **Step 1: Replace tasks.service.spec.ts with updated version including gateway**

```typescript
// backend/src/tasks/tasks.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksGateway } from './tasks.gateway';

const mockTask = {
  id: 1,
  title: 'Test',
  description: null,
  status: 'TODO',
  priority: 0,
  dueDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  task: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockGateway = {
  emitCreated: jest.fn(),
  emitUpdated: jest.fn(),
  emitDeleted: jest.fn(),
};

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TasksGateway, useValue: mockGateway },
      ],
    }).compile();
    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  it('findAll returns tasks ordered by createdAt desc', async () => {
    mockPrisma.task.findMany.mockResolvedValue([{ id: 1, title: 'Test' }]);
    const result = await service.findAll();
    expect(mockPrisma.task.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    expect(result).toEqual([{ id: 1, title: 'Test' }]);
  });

  it('create persists a task', async () => {
    const dto = { title: 'New task' };
    mockPrisma.task.create.mockResolvedValue({ id: 1, title: 'New task', status: 'TODO' });
    const result = await service.create(dto);
    expect(mockPrisma.task.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toMatchObject({ id: 1, title: 'New task' });
  });

  it('create calls gateway.emitCreated with created task', async () => {
    mockPrisma.task.create.mockResolvedValue(mockTask);
    await service.create({ title: 'Test' });
    expect(mockGateway.emitCreated).toHaveBeenCalledWith(mockTask);
  });

  it('update throws NotFoundException when task not found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(null);
    await expect(service.update(999, { title: 'x' })).rejects.toThrow(NotFoundException);
    expect(mockPrisma.task.update).not.toHaveBeenCalled();
  });

  it('update patches task when found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: 1, title: 'Old' });
    mockPrisma.task.update.mockResolvedValue({ id: 1, title: 'New' });
    const result = await service.update(1, { title: 'New' });
    expect(mockPrisma.task.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { title: 'New' } });
    expect(result).toMatchObject({ title: 'New' });
  });

  it('update calls gateway.emitUpdated with updated task', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(mockTask);
    const updated = { ...mockTask, status: 'DONE' };
    mockPrisma.task.update.mockResolvedValue(updated);
    await service.update(1, { status: 'DONE' });
    expect(mockGateway.emitUpdated).toHaveBeenCalledWith(updated);
  });

  it('remove throws NotFoundException when task not found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(null);
    await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    expect(mockPrisma.task.delete).not.toHaveBeenCalled();
  });

  it('remove deletes task when found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.task.delete.mockResolvedValue({ id: 1 });
    await service.remove(1);
    expect(mockPrisma.task.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('remove calls gateway.emitDeleted with task id', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(mockTask);
    mockPrisma.task.delete.mockResolvedValue(mockTask);
    await service.remove(1);
    expect(mockGateway.emitDeleted).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm new gateway tests fail**

```bash
npx jest src/tasks/tasks.service.spec.ts --no-coverage
```

Expected: FAIL — `TasksGateway` is not provided / `emitCreated is not a function`

- [ ] **Step 3: Update TasksService to inject gateway and emit**

```typescript
// backend/src/tasks/tasks.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksGateway } from './tasks.gateway';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: TasksGateway,
  ) {}

  findAll() {
    return this.prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreateTaskDto) {
    const task = await this.prisma.task.create({ data: dto });
    this.gateway.emitCreated(task);
    return task;
  }

  async update(id: number, dto: UpdateTaskDto) {
    await this.findOneOrFail(id);
    const task = await this.prisma.task.update({ where: { id }, data: dto });
    this.gateway.emitUpdated(task);
    return task;
  }

  async remove(id: number) {
    await this.findOneOrFail(id);
    const task = await this.prisma.task.delete({ where: { id } });
    this.gateway.emitDeleted(task.id);
    return task;
  }

  private async findOneOrFail(id: number) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }
}
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npx jest src/tasks/tasks.service.spec.ts --no-coverage
```

Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.service.spec.ts
git commit -m "feat: TasksService emits Socket.io events after each mutation"
```

---

## Task 4: Wire TasksModule + Run All Backend Tests

**Files:**
- Modify: `backend/src/tasks/tasks.module.ts`

- [ ] **Step 1: Add TasksGateway to TasksModule**

```typescript
// backend/src/tasks/tasks.module.ts
import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksGateway } from './tasks.gateway';

@Module({
  controllers: [TasksController],
  providers: [TasksService, TasksGateway],
})
export class TasksModule {}
```

- [ ] **Step 2: Run all backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS. Should show approximately 18–20 tests across all modules.

If you see `Error: Nest can't resolve dependencies of the TasksService`, ensure `TasksGateway` is listed in `providers` above.

- [ ] **Step 3: Commit**

```bash
git add backend/src/tasks/tasks.module.ts
git commit -m "chore: wire TasksGateway into TasksModule"
```

---

## Task 5: Install Frontend Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install packages**

```bash
cd frontend && npm install socket.io-client vue-draggable-plus
```

Expected: packages added. `package.json` will show `socket.io-client` and `vue-draggable-plus` in dependencies.

- [ ] **Step 2: Verify TypeScript types are available**

```bash
npm run build 2>&1 | head -10
```

Expected: Build succeeds (no new type errors from the new packages).

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: install socket.io-client and vue-draggable-plus"
```

---

## Task 6: Frontend i18n Keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Replace vi.json with updated version**

```json
{
  "nav.chat": "Trò chuyện",
  "nav.tasks": "Nhiệm vụ",
  "nav.files": "Tệp tin",
  "nav.settings": "Cài đặt",
  "nav.lang": "VI",
  "chat.header": "AGENT CHAT",
  "chat.mode.stub": "chế độ stub",
  "chat.mode.ollama": "chế độ ollama",
  "chat.placeholder": "nhập lệnh hoặc câu hỏi_",
  "chat.system.init": "Agent đã khởi động. SQLite đã kết nối. Đang ở chế độ stub.",
  "chat.user.prefix": "$ người dùng",
  "chat.agent.prefix": "agent",
  "chat.system.prefix": "[hệ thống]",
  "chat.error.unreachable": "[lỗi] Không kết nối được agent. Backend đang chạy chưa?",
  "chat.loading": "…",
  "chat.model.offline": "ollama offline",
  "chat.stop": "◼ Dừng",
  "chat.thinking": "⟳ đang nghĩ...",
  "artifacts.header": "KẾT QUẢ",
  "artifacts.empty": "Chưa có kết quả",
  "artifacts.label.lastReply": "phản hồi cuối",
  "health.checking": "Đang kiểm tra...",
  "health.ok": "Backend: hoạt động · DB: đã kết nối",
  "health.error": "Không kết nối được backend",
  "tasks.header": "NHIỆM VỤ",
  "tasks.col.todo": "CẦN LÀM",
  "tasks.col.processing": "ĐANG LÀM",
  "tasks.col.done": "HOÀN THÀNH",
  "tasks.col.failed": "THẤT BẠI",
  "tasks.filter.label": "LỌC:",
  "tasks.priority.high": "CAO",
  "tasks.priority.medium": "TB",
  "tasks.priority.low": "THẤP",
  "tasks.add": "+ thêm task",
  "tasks.add.placeholder": "tiêu đề task_",
  "tasks.menu.delete": "Xóa",
  "tasks.menu.delete.confirm": "Xóa task này?",
  "tasks.ws.connected": "● ws kết nối",
  "tasks.ws.disconnected": "○ ws offline"
}
```

- [ ] **Step 2: Replace en.json with updated version**

```json
{
  "nav.chat": "Chat",
  "nav.tasks": "Tasks",
  "nav.files": "Files",
  "nav.settings": "Settings",
  "nav.lang": "EN",
  "chat.header": "AGENT CHAT",
  "chat.mode.stub": "stub mode",
  "chat.mode.ollama": "ollama mode",
  "chat.placeholder": "type a command or question_",
  "chat.system.init": "Agent initialized. SQLite connected. Stub mode active.",
  "chat.user.prefix": "$ user",
  "chat.agent.prefix": "agent",
  "chat.system.prefix": "[system]",
  "chat.error.unreachable": "[error] Could not reach agent. Is the backend running?",
  "chat.loading": "…",
  "chat.model.offline": "ollama offline",
  "chat.stop": "◼ Stop",
  "chat.thinking": "⟳ thinking...",
  "artifacts.header": "ARTIFACTS",
  "artifacts.empty": "No artifacts yet",
  "artifacts.label.lastReply": "last reply",
  "health.checking": "Checking backend...",
  "health.ok": "Backend: ok · DB: connected",
  "health.error": "Backend unreachable",
  "tasks.header": "TASKS",
  "tasks.col.todo": "TODO",
  "tasks.col.processing": "IN PROGRESS",
  "tasks.col.done": "DONE",
  "tasks.col.failed": "FAILED",
  "tasks.filter.label": "FILTER:",
  "tasks.priority.high": "HIGH",
  "tasks.priority.medium": "MED",
  "tasks.priority.low": "LOW",
  "tasks.add": "+ add task",
  "tasks.add.placeholder": "task title_",
  "tasks.menu.delete": "Delete",
  "tasks.menu.delete.confirm": "Delete this task?",
  "tasks.ws.connected": "● ws connected",
  "tasks.ws.disconnected": "○ ws offline"
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add Phase 3 i18n keys for Kanban Board"
```

---

## Task 7: TaskCardMenu Component

**Files:**
- Create: `frontend/src/components/TaskCardMenu.vue`

- [ ] **Step 1: Create TaskCardMenu.vue**

```vue
<!-- frontend/src/components/TaskCardMenu.vue -->
<template>
  <div class="absolute right-0 top-5 z-20 bg-cyber-dark border border-cyber-dim rounded min-w-[128px]">
    <div class="px-2 py-1.5 border-b border-cyber-border">
      <div class="text-[9px] text-cyber-accent/40 font-mono mb-1">{{ t('tasks.filter.label') }}</div>
      <div class="flex gap-1">
        <button
          v-for="p in PRIORITIES"
          :key="p.value"
          @click="$emit('update-priority', taskId, p.value)"
          :class="[
            'text-[8px] px-1.5 py-px rounded border font-mono transition-colors duration-150',
            p.value === currentPriority ? p.activeClass : p.inactiveClass,
          ]"
        >{{ t(p.labelKey) }}</button>
      </div>
    </div>
    <button
      @click="onDelete"
      class="w-full text-left px-2 py-1.5 text-xs font-mono text-red-400/70 hover:text-red-400 hover:bg-red-400/5 transition-colors duration-150"
    >{{ t('tasks.menu.delete') }}</button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  taskId: number
  currentPriority: number
}>()

const emit = defineEmits<{
  delete: []
  'update-priority': [id: number, priority: number]
}>()

const { t } = useI18n()

const PRIORITIES = [
  {
    value: 2,
    labelKey: 'tasks.priority.high',
    activeClass: 'text-red-400 border-red-400/50 bg-red-400/15',
    inactiveClass: 'text-red-400/50 border-red-400/20 hover:border-red-400/40',
  },
  {
    value: 1,
    labelKey: 'tasks.priority.medium',
    activeClass: 'text-cyber-orange border-cyber-orange/50 bg-cyber-orange/15',
    inactiveClass: 'text-cyber-orange/50 border-cyber-orange/20 hover:border-cyber-orange/40',
  },
  {
    value: 0,
    labelKey: 'tasks.priority.low',
    activeClass: 'text-cyber-accent border-cyber-dim bg-cyber-accent/15',
    inactiveClass: 'text-cyber-accent/50 border-cyber-border hover:border-cyber-dim',
  },
] as const

function onDelete() {
  if (window.confirm(t('tasks.menu.delete.confirm'))) {
    emit('delete')
  }
}
</script>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: No new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TaskCardMenu.vue
git commit -m "feat: add TaskCardMenu with priority selector and delete action"
```

---

## Task 8: TaskCard Component

**Files:**
- Create: `frontend/src/components/TaskCard.vue`

- [ ] **Step 1: Create TaskCard.vue**

```vue
<!-- frontend/src/components/TaskCard.vue -->
<template>
  <div
    class="bg-cyber-dark border border-cyber-border rounded p-2 cursor-grab select-none relative group transition-colors duration-150 hover:border-cyber-dim"
  >
    <div class="flex items-start justify-between gap-1">
      <span class="text-slate-100 text-[11px] leading-snug flex-1 font-mono">{{ task.title }}</span>
      <button
        @click.stop="menuOpen = !menuOpen"
        class="opacity-0 group-hover:opacity-100 text-cyber-accent/40 text-sm font-mono hover:text-cyber-accent/70 shrink-0 leading-none transition-colors duration-150"
      >···</button>
    </div>

    <p v-if="task.description" class="text-slate-100/38 text-[9px] mt-1 truncate font-mono">
      {{ task.description }}
    </p>

    <div class="flex items-center gap-1.5 mt-1.5">
      <span :class="['text-[8px] px-1 py-px rounded border font-mono', priorityClass(task.priority)]">
        {{ priorityLabel(task.priority) }}
      </span>
      <span v-if="task.dueDate" class="text-[8px] text-cyber-accent/40 font-mono">
        {{ formatDate(task.dueDate) }}
      </span>
    </div>

    <TaskCardMenu
      v-if="menuOpen"
      :task-id="task.id"
      :current-priority="task.priority"
      @delete="emit('delete', task.id); menuOpen = false"
      @update-priority="(id, p) => { emit('update-priority', id, p); menuOpen = false }"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TaskCardMenu from './TaskCardMenu.vue'

interface Task {
  id: number
  title: string
  description?: string | null
  status: string
  priority: number
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  delete: [id: number]
  'update-priority': [id: number, priority: number]
}>()

const { t } = useI18n()
const menuOpen = ref(false)

function priorityLabel(p: number): string {
  if (p >= 2) return t('tasks.priority.high')
  if (p === 1) return t('tasks.priority.medium')
  return t('tasks.priority.low')
}

function priorityClass(p: number): string {
  if (p >= 2) return 'text-red-400 border-red-400/30 bg-red-400/10'
  if (p === 1) return 'text-cyber-orange border-cyber-orange/30 bg-cyber-orange/10'
  return 'text-cyber-accent border-cyber-border bg-cyber-accent/10'
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('vi-VN')
}
</script>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: No new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TaskCard.vue
git commit -m "feat: add TaskCard component with priority badge and hover menu"
```

---

## Task 9: KanbanBoard Component

**Files:**
- Create: `frontend/src/components/KanbanBoard.vue`

- [ ] **Step 1: Create KanbanBoard.vue**

```vue
<!-- frontend/src/components/KanbanBoard.vue -->
<template>
  <div class="flex flex-1 overflow-hidden">
    <div
      v-for="col in COLUMNS"
      :key="col.key"
      class="flex-1 flex flex-col border-r border-cyber-border/50 last:border-r-0 min-w-0"
    >
      <div class="px-2 py-2 border-b border-cyber-border/50 flex items-center gap-2 shrink-0 bg-cyber-dark/30">
        <span :class="['text-[9px] tracking-widest font-mono uppercase', col.headerClass]">
          {{ t(col.labelKey) }}
        </span>
        <span class="text-[8px] bg-cyber-accent/10 text-cyber-accent/50 px-1 rounded font-mono">
          {{ visibleCount(col.key) }}
        </span>
      </div>

      <VueDraggable
        v-model="columnTasks[col.key]"
        group="tasks"
        class="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 min-h-[40px]"
        @add="(e) => onAdd(e, col.key)"
      >
        <div
          v-for="task in columnTasks[col.key]"
          :key="task.id"
          v-show="shouldShow(task)"
        >
          <TaskCard
            :task="task"
            @delete="deleteTask"
            @update-priority="updatePriority"
          />
        </div>
      </VueDraggable>

      <div v-if="col.key === 'TODO'" class="px-2 pb-2 shrink-0">
        <form v-if="addingTask" @submit.prevent="createTask" class="flex gap-1">
          <input
            v-model="newTaskTitle"
            :placeholder="t('tasks.add.placeholder')"
            @keydown.escape="addingTask = false; newTaskTitle = ''"
            @blur="if (!newTaskTitle.trim()) addingTask = false"
            class="flex-1 bg-cyber-dark border border-cyber-dim rounded px-2 py-1 text-[10px] font-mono text-slate-100 placeholder-cyber-accent/30 outline-none"
            autofocus
          />
        </form>
        <button
          v-else
          @click="addingTask = true"
          class="w-full text-[9px] font-mono text-cyber-accent/40 border border-dashed border-cyber-border rounded px-2 py-1.5 hover:text-cyber-accent/70 hover:border-cyber-accent/30 transition-colors duration-150 text-left"
        >{{ t('tasks.add') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { io, Socket } from 'socket.io-client'
import { useI18n } from 'vue-i18n'
import TaskCard from './TaskCard.vue'

interface Task {
  id: number
  title: string
  description?: string | null
  status: string
  priority: number
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  activeFilters: Set<number>
}>()

const emit = defineEmits<{
  'ws-status': [connected: boolean]
}>()

const { t } = useI18n()

const STATUS_KEYS = ['TODO', 'PROCESSING', 'DONE', 'FAILED'] as const

const COLUMNS = [
  { key: 'TODO',       labelKey: 'tasks.col.todo',       headerClass: 'text-cyber-accent' },
  { key: 'PROCESSING', labelKey: 'tasks.col.processing', headerClass: 'text-cyber-orange' },
  { key: 'DONE',       labelKey: 'tasks.col.done',       headerClass: 'text-cyber-green' },
  { key: 'FAILED',     labelKey: 'tasks.col.failed',     headerClass: 'text-red-400'      },
]

const columnTasks = reactive<Record<string, Task[]>>({
  TODO: [], PROCESSING: [], DONE: [], FAILED: [],
})

const addingTask = ref(false)
const newTaskTitle = ref('')

let socket: Socket | null = null

function shouldShow(task: Task): boolean {
  return props.activeFilters.size === 0 || props.activeFilters.has(task.priority)
}

function visibleCount(status: string): number {
  return (columnTasks[status] ?? []).filter(t => shouldShow(t)).length
}

function populateColumns(tasks: Task[]) {
  for (const key of STATUS_KEYS) columnTasks[key] = []
  for (const task of tasks) {
    if (columnTasks[task.status]) columnTasks[task.status].push(task)
  }
}

async function onAdd(evt: { newIndex?: number }, newStatus: string) {
  if (evt.newIndex === undefined) return
  const task = columnTasks[newStatus][evt.newIndex]
  if (!task || task.status === newStatus) return

  const oldStatus = task.status
  task.status = newStatus

  try {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch {
    task.status = oldStatus
    columnTasks[newStatus] = columnTasks[newStatus].filter(t => t.id !== task.id)
    columnTasks[oldStatus].push(task)
  }
}

async function deleteTask(id: number) {
  for (const key of STATUS_KEYS) {
    const idx = columnTasks[key].findIndex(t => t.id === id)
    if (idx !== -1) { columnTasks[key].splice(idx, 1); break }
  }
  await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
}

async function updatePriority(id: number, priority: number) {
  for (const key of STATUS_KEYS) {
    const task = columnTasks[key].find(t => t.id === id)
    if (task) { task.priority = priority; break }
  }
  await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priority }),
  })
}

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
}

onMounted(async () => {
  try {
    const res = await fetch('/api/tasks')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    populateColumns(await res.json() as Task[])
  } catch {
    // board starts empty
  }

  socket = io('/tasks')
  socket.on('connect', () => emit('ws-status', true))
  socket.on('disconnect', () => emit('ws-status', false))

  socket.on('task:created', (task: Task) => {
    if (columnTasks[task.status]) columnTasks[task.status].push(task)
  })

  socket.on('task:updated', (task: Task) => {
    for (const key of STATUS_KEYS) {
      const idx = columnTasks[key].findIndex(t => t.id === task.id)
      if (idx !== -1) { columnTasks[key].splice(idx, 1); break }
    }
    if (columnTasks[task.status]) columnTasks[task.status].push(task)
  })

  socket.on('task:deleted', ({ id }: { id: number }) => {
    for (const key of STATUS_KEYS) {
      const idx = columnTasks[key].findIndex(t => t.id === id)
      if (idx !== -1) { columnTasks[key].splice(idx, 1); break }
    }
  })
})

onUnmounted(() => {
  socket?.disconnect()
})
</script>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: No new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/KanbanBoard.vue
git commit -m "feat: add KanbanBoard with drag-drop, Socket.io real-time, and inline task creation"
```

---

## Task 10: TasksView Component

**Files:**
- Create: `frontend/src/components/TasksView.vue`

- [ ] **Step 1: Create TasksView.vue**

```vue
<!-- frontend/src/components/TasksView.vue -->
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 border-b border-cyber-border bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-orange text-xs tracking-widest font-mono">
        <HiClipboardList class="w-3 h-3 inline" /> {{ t('tasks.header') }}
      </span>
      <span :class="['text-xs font-mono', wsConnected ? 'text-cyber-green' : 'text-cyber-accent/30']">
        {{ wsConnected ? t('tasks.ws.connected') : t('tasks.ws.disconnected') }}
      </span>
    </div>

    <div class="px-3 py-1.5 border-b border-cyber-border/50 bg-cyber-dark/40 flex items-center gap-2 shrink-0">
      <span class="text-cyber-accent/40 text-[9px] font-mono">{{ t('tasks.filter.label') }}</span>
      <button
        v-for="p in PRIORITY_FILTERS"
        :key="p.value"
        @click="toggleFilter(p.value)"
        :class="[
          'text-[9px] px-2 py-0.5 rounded border font-mono transition-colors duration-150',
          activeFilters.has(p.value) ? p.activeClass : p.inactiveClass,
        ]"
      >{{ t(p.labelKey) }}</button>
    </div>

    <KanbanBoard
      :active-filters="activeFilters"
      class="flex-1 overflow-hidden"
      @ws-status="wsConnected = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiClipboardList } from 'vue-icons-plus/hi'
import KanbanBoard from './KanbanBoard.vue'

const { t } = useI18n()
const wsConnected = ref(false)
const activeFilters = reactive(new Set<number>())

const PRIORITY_FILTERS = [
  {
    value: 2,
    labelKey: 'tasks.priority.high',
    activeClass: 'text-red-400 border-red-400/50 bg-red-400/10',
    inactiveClass: 'text-red-400/40 border-red-400/20 hover:border-red-400/40',
  },
  {
    value: 1,
    labelKey: 'tasks.priority.medium',
    activeClass: 'text-cyber-orange border-cyber-orange/50 bg-cyber-orange/10',
    inactiveClass: 'text-cyber-orange/40 border-cyber-orange/20 hover:border-cyber-orange/40',
  },
  {
    value: 0,
    labelKey: 'tasks.priority.low',
    activeClass: 'text-cyber-accent border-cyber-dim bg-cyber-accent/10',
    inactiveClass: 'text-cyber-accent/40 border-cyber-border hover:border-cyber-dim',
  },
] as const

function toggleFilter(priority: number) {
  if (activeFilters.has(priority)) activeFilters.delete(priority)
  else activeFilters.add(priority)
}
</script>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: No new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TasksView.vue
git commit -m "feat: add TasksView with filter bar and ws status indicator"
```

---

## Task 11: AppShell Update + Final Build Verify

**Files:**
- Modify: `frontend/src/components/AppShell.vue`

- [ ] **Step 1: Update AppShell.vue to conditionally render TasksView**

```vue
<!-- frontend/src/components/AppShell.vue -->
<template>
  <div class="flex h-screen bg-cyber-bg font-mono overflow-hidden">
    <SidebarNav :active-view="activeView" @navigate="activeView = $event" />
    <TasksView v-if="activeView === 'tasks'" class="flex-1" />
    <template v-else>
      <ChatPanel
        class="border-r border-cyber-border"
        style="width: 45%"
        @last-message="lastAgentMessage = $event"
      />
      <ArtifactsPanel class="flex-1" :last-message="lastAgentMessage" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SidebarNav from './SidebarNav.vue'
import ChatPanel from './ChatPanel.vue'
import ArtifactsPanel from './ArtifactsPanel.vue'
import TasksView from './TasksView.vue'

const activeView = ref<'chat' | 'tasks' | 'files'>('chat')
const lastAgentMessage = ref('')
</script>
```

- [ ] **Step 2: Run full frontend type-check and build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Run all backend tests one final time**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AppShell.vue
git commit -m "feat: integrate TasksView into AppShell, hide chat panels when tasks active"
```

---

## Verification

Manual end-to-end test (requires both backend and frontend running):

```bash
# Terminal 1 — backend
cd backend && npm run start:dev

# Terminal 2 — frontend dev server
cd frontend && npm run dev
```

1. Open `http://localhost:5173`
2. Click 📋 in sidebar → board appears, chat panels hide
3. `+ thêm task` → type a title → Enter → card appears in CẦN LÀM
4. Drag card to ĐANG LÀM → status updates, backend emits `task:updated`
5. Open a second browser tab → drag a card in tab 1 → card moves in tab 2 (real-time)
6. Click `···` on a card → priority picker + delete button appear
7. Toggle CAO filter → only high-priority cards remain visible
8. WS status indicator shows green `● ws kết nối`
