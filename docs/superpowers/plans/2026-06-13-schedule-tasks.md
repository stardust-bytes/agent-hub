# Schedule Tasks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Kanban task system with scheduled agent runs — users create tasks with a prompt, frequency (with configurable time), model, and optional project path. Tasks auto-execute on schedule.

**Architecture:** New `ScheduleTask` + `ScheduleTaskLog` Prisma models → new `ScheduleTasksModule` (CRUD + runner + cron) → new `ScheduleTasksView` frontend → wire into router, replacing old Tasks route.

**Tech Stack:** NestJS, Prisma, SQLite, @nestjs/schedule, Vue 3, TailwindCSS

---

### Task 1: Prisma schema — add ScheduleTask and ScheduleTaskLog models

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add models to schema**

Add before the last closing bracket of schema.prisma (before the generator block or after existing models):

```prisma
model ScheduleTask {
  id            Int      @id @default(autoincrement())
  name          String
  description   String?
  prompt        String
  frequency     String   @default("manual")
  cronMinute    Int?
  cronHour      Int?
  cronDayOfWeek Int?
  modelId       Int?
  projectPath   String?
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  logs          ScheduleTaskLog[]
}

model ScheduleTaskLog {
  id          Int      @id @default(autoincrement())
  taskId      Int
  task        ScheduleTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  sessionId   Int?
  status      String   @default("PENDING")
  output      String?
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 2: Generate migration**

Run: `cd backend && npx prisma migrate dev --name add_schedule_tasks`
Expected: Migration created and applied. No errors.

- [ ] **Step 3: Generate Prisma client**

Run: `cd backend && npx prisma generate`
Expected: Client regenerated.

- [ ] **Step 4: Commit**

```
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: add ScheduleTask and ScheduleTaskLog models"
```

---

### Task 2: Backend — Create ScheduleTasks CRUD module

**Files:**
- Create: `backend/src/schedule-tasks/schedule-tasks.module.ts`
- Create: `backend/src/schedule-tasks/schedule-tasks.controller.ts`
- Create: `backend/src/schedule-tasks/schedule-tasks.service.ts`
- Create: `backend/src/schedule-tasks/dto/create-schedule-task.dto.ts`
- Create: `backend/src/schedule-tasks/dto/update-schedule-task.dto.ts`

- [ ] **Step 1: Create DTOs**

Create `backend/src/schedule-tasks/dto/create-schedule-task.dto.ts`:

```typescript
import { IsString, IsOptional, IsInt, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScheduleTaskDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  prompt: string;

  @IsOptional()
  @IsIn(['manual', 'hourly', 'daily', 'weekdays', 'weekly'])
  frequency?: string;

  @IsOptional()
  @IsInt()
  @Min(0) @Max(59)
  @Type(() => Number)
  cronMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(0) @Max(23)
  @Type(() => Number)
  cronHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0) @Max(6)
  @Type(() => Number)
  cronDayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  modelId?: number;

  @IsOptional()
  @IsString()
  projectPath?: string;
}
```

Create `backend/src/schedule-tasks/dto/update-schedule-task.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateScheduleTaskDto } from './create-schedule-task.dto';

export class UpdateScheduleTaskDto extends PartialType(CreateScheduleTaskDto) {}
```

- [ ] **Step 2: Create service**

Create `backend/src/schedule-tasks/schedule-tasks.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleTaskDto } from './dto/create-schedule-task.dto';
import { UpdateScheduleTaskDto } from './dto/update-schedule-task.dto';

@Injectable()
export class ScheduleTasksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.scheduleTask.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        logs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  findOne(id: number) {
    return this.prisma.scheduleTask.findUnique({ where: { id } });
  }

  create(dto: CreateScheduleTaskDto) {
    return this.prisma.scheduleTask.create({ data: dto as any });
  }

  update(id: number, dto: UpdateScheduleTaskDto) {
    return this.prisma.scheduleTask.update({ where: { id }, data: dto as any });
  }

  remove(id: number) {
    return this.prisma.scheduleTask.delete({ where: { id } });
  }

  async findEligible(now: Date): Promise<any[]> {
    const tasks = await this.prisma.scheduleTask.findMany({
      where: { enabled: true, frequency: { not: 'manual' } },
    });
    return tasks.filter(task => {
      const minute = now.getMinutes();
      const hour = now.getHours();
      const day = now.getDay();
      const lastLog = (task as any).logs?.[0];
      const lastRunTime = lastLog?.createdAt ? new Date(lastLog.createdAt).getTime() : 0;

      switch (task.frequency) {
        case 'hourly':
          return task.cronMinute === minute && (now.getTime() - lastRunTime > 3600000);
        case 'daily':
          return task.cronHour === hour && task.cronMinute === minute
            && day >= 1 && day <= 5
            && (now.getTime() - lastRunTime > 86400000);
        case 'weekdays':
          return task.cronHour === hour && task.cronMinute === minute
            && day >= 1 && day <= 5
            && (now.getTime() - lastRunTime > 86400000);
        case 'weekly':
          return task.cronDayOfWeek === day && task.cronHour === hour
            && task.cronMinute === minute
            && (now.getTime() - lastRunTime > 86400000 * 7);
        default:
          return false;
      }
    });
  }
}
```

- [ ] **Step 3: Create controller**

Create `backend/src/schedule-tasks/schedule-tasks.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ScheduleTasksService } from './schedule-tasks.service';
import { ScheduleRunnerService } from './schedule-runner.service';
import { CreateScheduleTaskDto } from './dto/create-schedule-task.dto';
import { UpdateScheduleTaskDto } from './dto/update-schedule-task.dto';

@Controller('schedule-tasks')
export class ScheduleTasksController {
  constructor(
    private readonly service: ScheduleTasksService,
    private readonly runner: ScheduleRunnerService,
  ) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Post()
  create(@Body() dto: CreateScheduleTaskDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateScheduleTaskDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

  @Post(':id/run')
  runNow(@Param('id', ParseIntPipe) id: number) { return this.runner.runNow(id); }

  @Get(':id/logs')
  getLogs(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.scheduleTaskLog.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

Note: inject PrismaService for the logs query, or better, add a `getLogs` method to the service.

- [ ] **Step 4: Create module**

Create `backend/src/schedule-tasks/schedule-tasks.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ScheduleTasksController } from './schedule-tasks.controller';
import { ScheduleTasksService } from './schedule-tasks.service';
import { ScheduleRunnerService } from './schedule-runner.service';
import { ScheduleCronService } from './schedule-cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [PrismaModule, AgentModule],
  controllers: [ScheduleTasksController],
  providers: [ScheduleTasksService, ScheduleRunnerService, ScheduleCronService],
})
export class ScheduleTasksModule {}
```

- [ ] **Step 5: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS (may need to create runner and cron first — skip this step if they don't exist yet)

- [ ] **Step 6: Commit**

```
git add backend/src/schedule-tasks
git commit -m "feat: add ScheduleTasks CRUD module, DTOs, controller, service"
```

---

### Task 3: Backend — ScheduleRunnerService + ScheduleCronService

**Files:**
- Create: `backend/src/schedule-tasks/schedule-runner.service.ts`
- Create: `backend/src/schedule-tasks/schedule-cron.service.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Create runner service**

Create `backend/src/schedule-tasks/schedule-runner.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentLoopService } from '../agent/services/agent-loop.service';
import { ContextBuilderService } from '../agent/services/context-builder.service';
import { ProvidersService } from '../providers/providers.service';
import { SessionsService } from '../sessions/sessions.service';
import { CoworkService } from '../cowork/cowork.service';
import { AgentRunState } from '../agent/dto/agent-run-state';

class CapturingWriteStream {
  private buffer = ''
  write(data: string) { this.buffer += data; return true; }
  end() {}
  getOutput() { return this.buffer; }
}

@Injectable()
export class ScheduleRunnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentLoop: AgentLoopService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly providersService: ProvidersService,
    private readonly sessionsService: SessionsService,
    private readonly cowork: CoworkService,
  ) {}

  async runNow(taskId: number) {
    const task = await this.prisma.scheduleTask.findUnique({ where: { id: taskId } });
    if (!task) throw new Error(`ScheduleTask ${taskId} not found`);

    const log = await this.prisma.scheduleTaskLog.create({
      data: { taskId, status: 'RUNNING', startedAt: new Date() },
    });

    try {
      const session = await this.sessionsService.create();
      const projectPath = task.projectPath ?? undefined;

      if (task.projectPath) {
        await this.cowork.setProject(task.projectPath).catch(() => {});
      }

      let providerType = 'ollama';
      let providerConfig = { baseUrl: 'http://localhost:11434' };

      if (task.modelId) {
        const model = await this.providersService.findModelWithProvider(task.modelId);
        if (model) {
          providerType = model.provider.type ?? 'ollama';
          providerConfig = {
            baseUrl: model.provider.baseUrl ?? 'http://localhost:11434',
            key: model.provider.key ?? undefined,
          };
        }
      }

      const stream = new CapturingWriteStream();
      const signal = new AbortController().signal;
      const runState = { step: 0, maxIterations: 10, roomId: String(session.id), steps: [], startTime: Date.now(), currentState: 'PLANNING' } as AgentRunState;
      const context = await this.contextBuilder.build(runState, session.id);

      const finalText = await this.agentLoop.run(
        providerType, 'default', context.systemPrompt, [],
        task.prompt, context.tools, stream as any, signal, session.id, projectPath ?? undefined, providerConfig,
      );

      const output = finalText || stream.getOutput();

      await this.prisma.scheduleTaskLog.update({
        where: { id: log.id },
        data: { status: 'SUCCESS', output, completedAt: new Date(), sessionId: session.id },
      });

      return this.prisma.scheduleTaskLog.findUnique({ where: { id: log.id } });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      await this.prisma.scheduleTaskLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', output: errorMsg, completedAt: new Date() },
      });
      return this.prisma.scheduleTaskLog.findUnique({ where: { id: log.id } });
    }
  }
}
```

- [ ] **Step 2: Create cron service**

Create `backend/src/schedule-tasks/schedule-cron.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduleTasksService } from './schedule-tasks.service';
import { ScheduleRunnerService } from './schedule-runner.service';

@Injectable()
export class ScheduleCronService {
  constructor(
    private readonly taskService: ScheduleTasksService,
    private readonly runner: ScheduleRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkSchedules() {
    const now = new Date();
    const tasks = await this.taskService.findEligible(now);
    for (const task of tasks) {
      await this.runner.runNow(task.id).catch(e =>
        console.error(`[ScheduleCron] Task ${task.id} failed:`, e.message)
      );
    }
  }
}
```

- [ ] **Step 3: Install @nestjs/schedule**

Run: `cd backend && npm install @nestjs/schedule`
Expected: added to package.json dependencies.

- [ ] **Step 4: Register ScheduleModule in ScheduleTasksModule**

Update `backend/src/schedule-tasks/schedule-tasks.module.ts` to import `ScheduleModule`:

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
// ...
@Module({
  imports: [PrismaModule, AgentModule, ScheduleModule.forRoot()],
  // ...
})
```

- [ ] **Step 5: Wire module in app.module.ts**

Edit `backend/src/app.module.ts`. Add `ScheduleTasksModule` to the imports array:

```typescript
import { ScheduleTasksModule } from './schedule-tasks/schedule-tasks.module';
// ...
@Module({
  imports: [
    // ... existing imports
    ScheduleTasksModule,
  ],
})
```

- [ ] **Step 6: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```
git add backend/package.json backend/package-lock.json backend/src/schedule-tasks backend/src/app.module.ts
git commit -m "feat: add ScheduleRunnerService, ScheduleCronService, wire module"
```

---

### Task 4: Frontend — API layer + ScheduleTasksView

**Files:**
- Create: `frontend/src/api/scheduleTasks.ts`
- Create: `frontend/src/components/ScheduleTasksView.vue`

- [ ] **Step 1: Create API layer**

Create `frontend/src/api/scheduleTasks.ts`:

```typescript
import { request } from './client'

export interface ScheduleTask {
  id: number
  name: string
  description: string | null
  prompt: string
  frequency: string
  cronMinute: number | null
  cronHour: number | null
  cronDayOfWeek: number | null
  modelId: number | null
  projectPath: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
  logs?: ScheduleTaskLog[]
}

export interface ScheduleTaskLog {
  id: number
  taskId: number
  sessionId: number | null
  status: string
  output: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export function listTasks() {
  return request<ScheduleTask[]>('/schedule-tasks', { errorCode: 'schedules.fetch_failed' })
}

export function createTask(body: Partial<ScheduleTask>) {
  return request<ScheduleTask>('/schedule-tasks', { method: 'POST', body, errorCode: 'schedules.save_failed' })
}

export function updateTask(id: number, body: Partial<ScheduleTask>) {
  return request<ScheduleTask>(`/schedule-tasks/${id}`, { method: 'PATCH', body, errorCode: 'schedules.save_failed' })
}

export function deleteTask(id: number) {
  return request<void>(`/schedule-tasks/${id}`, { method: 'DELETE', errorCode: 'schedules.delete_failed' })
}

export function runTask(id: number) {
  return request<ScheduleTaskLog>(`/schedule-tasks/${id}/run`, { method: 'POST', errorCode: 'schedules.run_failed' })
}

export function getTaskLogs(id: number) {
  return request<ScheduleTaskLog[]>(`/schedule-tasks/${id}/logs`, { errorCode: 'schedules.fetch_failed' })
}
```

- [ ] **Step 2: Create ScheduleTasksView.vue**

Create `frontend/src/components/ScheduleTasksView.vue`:

```vue
<template>
  <div class="flex flex-col bg-cyber-bg min-w-0 h-full">
    <div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-cyber-code-border shrink-0 bg-cyber-dark">
      <HiClock class="w-3 h-3 text-cyber-accent" />
      <span class="text-sm text-cyber-accent font-mono">{{ t('schedules.header') }}</span>
      <button @click="showForm = true; editingTask = null"
        class="ml-auto text-xs text-cyber-accent font-mono px-2 py-0.5 border border-cyber-accent/30 rounded transition-colors duration-150 hover:bg-cyber-accent/10">
        + {{ t('schedules.add') }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3">
      <div v-if="tasks.length === 0" class="flex items-center justify-center h-full">
        <div class="text-sm text-cyber-muted font-mono">{{ t('schedules.empty') }}</div>
      </div>

      <div v-for="task in tasks" :key="task.id" class="border border-cyber-code-border rounded mb-2 bg-cyber-dark">
        <div class="flex items-center gap-3 px-3 py-2">
          <div class="w-2 h-2 rounded-full shrink-0"
            :class="task.enabled ? 'bg-cyber-green' : 'bg-cyber-muted'"></div>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-cyber-text font-mono truncate">{{ task.name }}</div>
            <div class="text-xs text-cyber-muted font-mono flex items-center gap-2 mt-0.5">
              <span class="px-1 border border-cyber-code-border text-2xs"
                :class="frequencyClass(task.frequency)">{{ t(`schedules.frequency.${task.frequency}`) }}</span>
              <span v-if="task.modelId">· {{ t('schedules.hasModel') }}</span>
              <span v-if="task.projectPath">· {{ task.projectPath.replace(/\\/g, '/').split('/').pop() }}</span>
            </div>
          </div>
          <div class="text-xs text-cyber-muted font-mono shrink-0">
            <span v-if="task.logs?.[0]"
              :class="task.logs[0].status === 'SUCCESS' ? 'text-cyber-green' : task.logs[0].status === 'FAILED' ? 'text-red-400' : 'text-cyber-orange'">
              {{ task.logs[0].status }}
            </span>
          </div>
          <div class="flex gap-1 shrink-0">
            <button @click="runNow(task.id)" class="text-xs text-cyber-accent/70 font-mono px-1.5 py-0.5 border border-cyber-code-border rounded transition-colors duration-150 hover:text-cyber-accent hover:border-cyber-accent/40">▶</button>
            <button @click="editTask(task)" class="text-xs text-cyber-muted font-mono px-1.5 py-0.5 border border-cyber-code-border rounded transition-colors duration-150 hover:text-cyber-accent">✎</button>
            <button @click="confirmDelete(task)" class="text-xs text-cyber-muted font-mono px-1.5 py-0.5 border border-cyber-code-border rounded transition-colors duration-150 hover:text-red-400">✕</button>
          </div>
        </div>
        <div v-if="expandedLogs === task.id" class="border-t border-cyber-code-border px-3 py-2 max-h-48 overflow-y-auto">
          <div v-if="!task.logs || task.logs.length === 0" class="text-xs text-cyber-muted font-mono">{{ t('schedules.logs.empty') }}</div>
          <div v-for="log in task.logs" :key="log.id" class="text-xs text-cyber-text font-mono py-1 border-b border-cyber-code-border last:border-0">
            <span class="text-cyber-muted">{{ log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : '' }}</span>
            <span :class="log.status === 'SUCCESS' ? 'text-cyber-green' : log.status === 'FAILED' ? 'text-red-400' : 'text-cyber-orange'"> {{ log.status }}</span>
            <div v-if="log.output" class="text-2xs text-cyber-muted mt-0.5 whitespace-pre-wrap truncate">{{ log.output }}</div>
          </div>
        </div>
      </div>
    </div>

    <BaseModal v-model="showForm">
      <template #header>
        <span class="text-sm text-cyber-text font-mono">{{ editingTask ? t('schedules.edit') : t('schedules.add') }}</span>
      </template>
      <div class="p-3 space-y-3">
        <input v-model="form.name" class="w-full bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono" :placeholder="t('schedules.form.name')" />
        <input v-model="form.description" class="w-full bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono" :placeholder="t('schedules.form.description')" />
        <textarea v-model="form.prompt" rows="4" class="w-full bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono" :placeholder="t('schedules.form.prompt')"></textarea>
        <div class="flex gap-2">
          <select v-model="form.frequency" class="flex-1 bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono">
            <option v-for="f in FREQUENCIES" :key="f" :value="f">{{ t(`schedules.frequency.${f}`) }}</option>
          </select>
          <input v-if="form.frequency !== 'manual'" v-model.number="form.cronMinute" type="number" min="0" max="59" class="w-16 bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono text-center" placeholder="mm" />
          <input v-if="['daily','weekdays','weekly'].includes(form.frequency)" v-model.number="form.cronHour" type="number" min="0" max="23" class="w-16 bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono text-center" placeholder="hh" />
          <select v-if="form.frequency === 'weekly'" v-model.number="form.cronDayOfWeek" class="flex-1 bg-cyber-bg border border-cyber-code-border rounded px-2 py-1.5 text-sm text-cyber-text font-mono">
            <option v-for="(label, idx) in DAYS" :key="idx" :value="idx">{{ label }}</option>
          </select>
        </div>
        <div class="text-xs text-cyber-muted font-mono" v-if="form.frequency !== 'manual'">
          {{ scheduleDescription }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button @click="showForm = false" class="text-xs text-cyber-muted font-mono px-3 py-1.5 border border-cyber-code-border rounded transition-colors duration-150 hover:text-cyber-text">{{ t('tasks.form.cancel') }}</button>
          <button @click="saveTask" class="text-xs text-white font-mono px-3 py-1.5 bg-cyber-accent rounded transition-colors duration-150 hover:bg-cyber-accent/80">{{ t('tasks.form.save') }}</button>
        </div>
      </template>
    </BaseModal>

    <BaseConfirmModal v-model="showConfirm" :message="t('schedules.deleteConfirm')" @confirm="onDeleteConfirmed" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiClock } from 'vue-icons-plus/hi'
import BaseModal from './BaseModal.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'
import * as api from '../api/scheduleTasks'
import type { ScheduleTask } from '../api/scheduleTasks'

const { t } = useI18n()

const FREQUENCIES = ['manual', 'hourly', 'daily', 'weekdays', 'weekly']
const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

const tasks = ref<ScheduleTask[]>([])
const showForm = ref(false)
const showConfirm = ref(false)
const editingTask = ref<ScheduleTask | null>(null)
const expandedLogs = ref<number | null>(null)
const deletingTask = ref<ScheduleTask | null>(null)

const form = ref({
  name: '',
  description: '',
  prompt: '',
  frequency: 'manual',
  cronMinute: 0,
  cronHour: 0,
  cronDayOfWeek: 0,
  modelId: null as number | null,
  projectPath: null as string | null,
})

const scheduleDescription = computed(() => {
  const f = form.value.frequency
  if (f === 'hourly') return t('schedules.hint.hourly', { m: String(form.value.cronMinute).padStart(2, '0') })
  if (['daily', 'weekdays', 'weekly'].includes(f)) {
    const time = `${String(form.value.cronHour).padStart(2, '0')}:${String(form.value.cronMinute).padStart(2, '0')}`
    if (f === 'weekly') return t('schedules.hint.weekly', { day: DAYS[form.value.cronDayOfWeek] || 'CN', time })
    if (f === 'weekdays') return t('schedules.hint.weekdays', { time })
    return t('schedules.hint.daily', { time })
  }
  return ''
})

function frequencyClass(f: string) {
  if (f === 'manual') return 'text-cyber-muted'
  if (f === 'hourly') return 'text-cyber-cyan'
  if (f === 'daily') return 'text-cyber-green'
  if (f === 'weekdays') return 'text-cyber-orange'
  return 'text-cyber-accent'
}

onMounted(async () => {
  try { tasks.value = await api.listTasks() } catch { /* ignore */ }
})

function editTask(task: ScheduleTask) {
  editingTask.value = task
  form.value = {
    name: task.name,
    description: task.description ?? '',
    prompt: task.prompt,
    frequency: task.frequency,
    cronMinute: task.cronMinute ?? 0,
    cronHour: task.cronHour ?? 0,
    cronDayOfWeek: task.cronDayOfWeek ?? 0,
    modelId: task.modelId,
    projectPath: task.projectPath,
  }
  showForm.value = true
}

function resetForm() {
  form.value = { name: '', description: '', prompt: '', frequency: 'manual', cronMinute: 0, cronHour: 0, cronDayOfWeek: 0, modelId: null, projectPath: null }
}

async function saveTask() {
  try {
    const body = { ...form.value }
    if (editingTask.value) {
      const updated = await api.updateTask(editingTask.value.id, body)
      const idx = tasks.value.findIndex(t => t.id === editingTask.value!.id)
      if (idx >= 0) tasks.value[idx] = updated
    } else {
      const created = await api.createTask(body)
      tasks.value.unshift(created)
    }
    showForm.value = false
    resetForm()
    editingTask.value = null
  } catch { /* ignore */ }
}

async function runNow(id: number) {
  try {
    await api.runTask(id)
    tasks.value = await api.listTasks()
  } catch { /* ignore */ }
}

function confirmDelete(task: ScheduleTask) {
  deletingTask.value = task
  showConfirm.value = true
}

async function onDeleteConfirmed() {
  if (!deletingTask.value) return
  try {
    await api.deleteTask(deletingTask.value.id)
    tasks.value = tasks.value.filter(t => t.id !== deletingTask.value!.id)
  } catch { /* ignore */ }
  deletingTask.value = null
}
</script>
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add frontend/src/api/scheduleTasks.ts frontend/src/components/ScheduleTasksView.vue
git commit -m "feat: add ScheduleTasksView and API layer"
```

---

### Task 5: Frontend — Update router + i18n

**Files:**
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Update router**

Edit `frontend/src/router/index.ts`:

Replace:
```typescript
import TasksView from '../components/TasksView.vue'
// ...
{ path: '/tasks', name: 'tasks', component: TasksView },
```

With:
```typescript
import ScheduleTasksView from '../components/ScheduleTasksView.vue'
// ...
{ path: '/tasks', name: 'tasks', component: ScheduleTasksView },
```

- [ ] **Step 2: Add i18n keys to vi.json**

Add to `frontend/src/locales/vi.json`:

```json
"schedules": {
  "header": "Tác vụ định kỳ",
  "add": "Tác vụ mới",
  "edit": "Sửa tác vụ",
  "empty": "Chưa có tác vụ nào",
  "frequency": {
    "manual": "Thủ công",
    "hourly": "Mỗi giờ",
    "daily": "Hàng ngày",
    "weekdays": "Ngày trong tuần",
    "weekly": "Hàng tuần"
  },
  "hasModel": "có model",
  "logs": {
    "header": "Lịch sử chạy",
    "empty": "Chưa có lịch sử"
  },
  "form": {
    "name": "Tên tác vụ",
    "description": "Mô tả (tùy chọn)",
    "prompt": "Prompt cho agent"
  },
  "hint": {
    "hourly": "Chạy ở phút :{m} mỗi giờ",
    "daily": "Chạy lúc {time} mỗi ngày",
    "weekdays": "Chạy lúc {time} thứ 2–6",
    "weekly": "Chạy lúc {time} {day} hàng tuần"
  },
  "deleteConfirm": "Bạn có chắc muốn xóa tác vụ này?",
  "runNow": "Chạy ngay"
}
```

- [ ] **Step 3: Add i18n keys to en.json**

Add to `frontend/src/locales/en.json`:

```json
"schedules": {
  "header": "Schedule Tasks",
  "add": "New Task",
  "edit": "Edit Task",
  "empty": "No tasks yet",
  "frequency": {
    "manual": "Manual",
    "hourly": "Hourly",
    "daily": "Daily",
    "weekdays": "Weekdays",
    "weekly": "Weekly"
  },
  "hasModel": "has model",
  "logs": {
    "header": "Execution Logs",
    "empty": "No logs yet"
  },
  "form": {
    "name": "Task name",
    "description": "Description (optional)",
    "prompt": "Agent prompt"
  },
  "hint": {
    "hourly": "Runs at minute :{m} of each hour",
    "daily": "Runs at {time} every day",
    "weekdays": "Runs at {time} Mon–Fri",
    "weekly": "Runs at {time} every {day}"
  },
  "deleteConfirm": "Are you sure you want to delete this task?",
  "runNow": "Run Now"
}
```

- [ ] **Step 4: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add frontend/src/router/index.ts frontend/src/locales
git commit -m "feat: schedule tasks - update router and add i18n keys"
```

---

### Task 6: Backend — add getLogs method to service

- [ ] **Step 1: Add getLogs to service**

Edit `backend/src/schedule-tasks/schedule-tasks.service.ts`, add method:

```typescript
async getLogs(taskId: number) {
  return this.prisma.scheduleTaskLog.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  });
}
```

- [ ] **Step 2: Update controller to use service.getLogs**

Edit `backend/src/schedule-tasks/schedule-tasks.controller.ts`, replace the `getLogs` method:

```typescript
@Get(':id/logs')
getLogs(@Param('id', ParseIntPipe) id: number) {
  return this.service.getLogs(id);
}
```

- [ ] **Step 3: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add backend/src/schedule-tasks
git commit -m "fix: add getLogs method to ScheduleTasksService"
```

---

## Verification

After all tasks:

```bash
cd frontend && npm run type-check && npm run build
cd backend && npx tsc --noEmit
```

Expected: all PASS.
