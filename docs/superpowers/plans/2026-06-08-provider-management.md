# Provider Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Provider + ProviderModel management system so all LLM calls go through a configured provider instead of hardcoded local Ollama defaults.

**Architecture:** Two new Prisma models (`Provider`, `ProviderModel`) feed a new `providers` NestJS module. `ChatDto` replaces `model: string` with `providerModelId: number`. `LLMCallerService` receives `baseUrl`/`key` as direct params (no more SettingsService). A new `ProvidersView` in the sidebar (accordion UI) lets users manage providers and their models.

**Tech Stack:** NestJS 10 + Prisma 5 (SQLite), class-validator, Vue 3 + TypeScript + vue-i18n v9 + TailwindCSS

---

## File Map

### Backend — New
- `backend/src/providers/providers.module.ts`
- `backend/src/providers/providers.controller.ts`
- `backend/src/providers/providers.service.ts`
- `backend/src/providers/providers.controller.spec.ts`
- `backend/src/providers/providers.service.spec.ts`
- `backend/src/providers/dto/create-provider.dto.ts`
- `backend/src/providers/dto/update-provider.dto.ts`
- `backend/src/providers/dto/create-provider-model.dto.ts`

### Backend — Modified
- `backend/prisma/schema.prisma` — add Provider, ProviderModel models
- `backend/src/app.module.ts` — add ProvidersModule, remove OllamaModule
- `backend/src/agent/dto/chat.dto.ts` — replace model with providerModelId
- `backend/src/agent/agent.controller.ts` — use providerModelId
- `backend/src/agent/agent.service.ts` — inject ProvidersService, resolve provider
- `backend/src/agent/agent.service.spec.ts` — update tests
- `backend/src/agent/agent.module.ts` — import ProvidersModule
- `backend/src/agent/providers/ollama.provider.ts` — add providerConfig param
- `backend/src/agent/providers/ollama.provider.spec.ts` — pass providerConfig in calls
- `backend/src/agent/services/llm-caller.service.ts` — remove SettingsService, add baseUrl/key params
- `backend/src/settings/settings.service.ts` — findAll returns {}
- `backend/src/settings/settings.service.spec.ts` — update findAll test
- `backend/src/settings/settings.controller.spec.ts` — update findAll mock

### Backend — Deleted
- `backend/src/ollama/` (entire directory — 5 files)

### Frontend — New
- `frontend/src/components/ProvidersView.vue`
- `frontend/src/components/ProviderFormModal.vue`

### Frontend — Modified
- `frontend/src/locales/vi.json` — add providers.* + chat.no_provider keys
- `frontend/src/locales/en.json` — same
- `frontend/src/components/SidebarNav.vue` — add ⚡ providers icon
- `frontend/src/components/BottomTabBar.vue` — add providers item
- `frontend/src/components/AppShell.vue` — add 'providers' to activeView
- `frontend/src/components/ModelSelector.vue` — use providerModelId instead of model string
- `frontend/src/components/ChatPanel.vue` — use providerModelId, fetch from /api/providers/models
- `frontend/src/components/SettingsView.vue` — remove ollama URL/model fields

---

## Task 1: Prisma Schema — Add Provider + ProviderModel

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add Provider and ProviderModel models to schema**

Append to `backend/prisma/schema.prisma` after the `Task` model:

```prisma
model Provider {
  id        Int             @id @default(autoincrement())
  name      String
  type      String          @default("ollama")
  baseUrl   String?
  key       String?
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  models    ProviderModel[]
}

model ProviderModel {
  id         Int      @id @default(autoincrement())
  providerId Int
  provider   Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  name       String
  createdAt  DateTime @default(now())
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_providers
npx prisma generate
```

Expected output: `The following migration(s) have been applied: .../add_providers/migration.sql`

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "chore: add Provider and ProviderModel prisma models"
```

---

## Task 2: ProvidersService (TDD)

**Files:**
- Create: `backend/src/providers/providers.service.spec.ts`
- Create: `backend/src/providers/providers.service.ts`
- Create: `backend/src/providers/dto/create-provider.dto.ts`
- Create: `backend/src/providers/dto/update-provider.dto.ts`
- Create: `backend/src/providers/dto/create-provider-model.dto.ts`

- [ ] **Step 1: Create DTOs**

`backend/src/providers/dto/create-provider.dto.ts`:
```typescript
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateProviderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  baseUrl?: string;

  @IsString()
  @IsOptional()
  key?: string;
}
```

`backend/src/providers/dto/update-provider.dto.ts`:
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateProviderDto } from './create-provider.dto';

export class UpdateProviderDto extends PartialType(CreateProviderDto) {}
```

`backend/src/providers/dto/create-provider-model.dto.ts`:
```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateProviderModelDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
```

- [ ] **Step 2: Write failing spec**

`backend/src/providers/providers.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ProvidersService } from './providers.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  provider: {
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  providerModel: {
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('ProvidersService', () => {
  let service: ProvidersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvidersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ProvidersService>(ProvidersService);
    jest.clearAllMocks();
  });

  it('findAll returns providers with models', async () => {
    const providers = [{ id: 1, name: 'Local', type: 'ollama', baseUrl: null, key: null, models: [] }];
    mockPrisma.provider.findMany.mockResolvedValue(providers);
    const result = await service.findAll();
    expect(mockPrisma.provider.findMany).toHaveBeenCalledWith({ include: { models: true } });
    expect(result).toEqual(providers);
  });

  it('create stores provider and returns it', async () => {
    const created = { id: 1, name: 'Local', type: 'ollama', baseUrl: null, key: null };
    mockPrisma.provider.create.mockResolvedValue(created);
    const result = await service.create({ name: 'Local', type: 'ollama' });
    expect(mockPrisma.provider.create).toHaveBeenCalledWith({
      data: { name: 'Local', type: 'ollama', baseUrl: undefined, key: undefined },
    });
    expect(result).toEqual(created);
  });

  it('update patches provider and returns it', async () => {
    const updated = { id: 1, name: 'Updated', type: 'ollama', baseUrl: null, key: null };
    mockPrisma.provider.update.mockResolvedValue(updated);
    const result = await service.update(1, { name: 'Updated' });
    expect(mockPrisma.provider.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Updated' },
    });
    expect(result).toEqual(updated);
  });

  it('remove deletes provider', async () => {
    mockPrisma.provider.delete.mockResolvedValue({});
    await service.remove(1);
    expect(mockPrisma.provider.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('addModel creates model linked to provider', async () => {
    const model = { id: 10, providerId: 1, name: 'llama3.2' };
    mockPrisma.providerModel.create.mockResolvedValue(model);
    const result = await service.addModel(1, { name: 'llama3.2' });
    expect(mockPrisma.providerModel.create).toHaveBeenCalledWith({
      data: { providerId: 1, name: 'llama3.2' },
    });
    expect(result).toEqual(model);
  });

  it('removeModel deletes model', async () => {
    mockPrisma.providerModel.delete.mockResolvedValue({});
    await service.removeModel(1, 10);
    expect(mockPrisma.providerModel.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  it('findAllModels returns flat list with providerName', async () => {
    const models = [
      { id: 1, name: 'llama3.2', providerId: 1, provider: { id: 1, name: 'Local' } },
      { id: 2, name: 'gemma2',   providerId: 1, provider: { id: 1, name: 'Local' } },
    ];
    mockPrisma.providerModel.findMany.mockResolvedValue(models);
    const result = await service.findAllModels();
    expect(result).toEqual([
      { id: 1, name: 'llama3.2', providerId: 1, providerName: 'Local' },
      { id: 2, name: 'gemma2',   providerId: 1, providerName: 'Local' },
    ]);
  });

  it('findModelWithProvider returns model with provider or null', async () => {
    const model = { id: 1, name: 'llama3.2', providerId: 1, provider: { id: 1, baseUrl: null, key: null } };
    mockPrisma.providerModel.findUnique.mockResolvedValue(model);
    const result = await service.findModelWithProvider(1);
    expect(mockPrisma.providerModel.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: { provider: true },
    });
    expect(result).toEqual(model);
  });

  it('findModelWithProvider returns null when not found', async () => {
    mockPrisma.providerModel.findUnique.mockResolvedValue(null);
    const result = await service.findModelWithProvider(999);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run spec to confirm it fails**

```bash
cd backend && npx jest src/providers/providers.service.spec.ts
```

Expected: FAIL — `Cannot find module './providers.service'`

- [ ] **Step 4: Implement ProvidersService**

`backend/src/providers/providers.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { CreateProviderModelDto } from './dto/create-provider-model.dto';

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.provider.findMany({ include: { models: true } });
  }

  create(dto: CreateProviderDto) {
    return this.prisma.provider.create({
      data: { name: dto.name, type: dto.type ?? 'ollama', baseUrl: dto.baseUrl, key: dto.key },
    });
  }

  update(id: number, dto: UpdateProviderDto) {
    return this.prisma.provider.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.provider.delete({ where: { id } });
  }

  addModel(providerId: number, dto: CreateProviderModelDto) {
    return this.prisma.providerModel.create({ data: { providerId, name: dto.name } });
  }

  removeModel(_providerId: number, modelId: number) {
    return this.prisma.providerModel.delete({ where: { id: modelId } });
  }

  async findAllModels() {
    const models = await this.prisma.providerModel.findMany({ include: { provider: true } });
    return models.map(m => ({
      id: m.id,
      name: m.name,
      providerId: m.providerId,
      providerName: m.provider.name,
    }));
  }

  findModelWithProvider(id: number) {
    return this.prisma.providerModel.findUnique({
      where: { id },
      include: { provider: true },
    });
  }
}
```

- [ ] **Step 5: Run spec to confirm it passes**

```bash
cd backend && npx jest src/providers/providers.service.spec.ts
```

Expected: PASS — 9 tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/src/providers/
git commit -m "feat: add ProvidersService with CRUD and model management"
```

---

## Task 3: ProvidersController + Module + AppModule Wiring

**Files:**
- Create: `backend/src/providers/providers.controller.spec.ts`
- Create: `backend/src/providers/providers.controller.ts`
- Create: `backend/src/providers/providers.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Write failing controller spec**

`backend/src/providers/providers.controller.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

const mockService = {
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  addModel: jest.fn(),
  removeModel: jest.fn(),
  findAllModels: jest.fn(),
};

describe('ProvidersController', () => {
  let controller: ProvidersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProvidersController],
      providers: [{ provide: ProvidersService, useValue: mockService }],
    }).compile();
    controller = module.get<ProvidersController>(ProvidersController);
    jest.clearAllMocks();
  });

  it('GET /providers/models calls findAllModels', async () => {
    const flat = [{ id: 1, name: 'llama3.2', providerId: 1, providerName: 'Local' }];
    mockService.findAllModels.mockResolvedValue(flat);
    const result = await controller.getAllModels();
    expect(mockService.findAllModels).toHaveBeenCalled();
    expect(result).toEqual(flat);
  });

  it('GET /providers calls findAll', async () => {
    mockService.findAll.mockResolvedValue([]);
    const result = await controller.findAll();
    expect(mockService.findAll).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('POST /providers calls create with dto', async () => {
    const dto = { name: 'Local', type: 'ollama' };
    const created = { id: 1, ...dto };
    mockService.create.mockResolvedValue(created);
    const result = await controller.create(dto as any);
    expect(mockService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it('PATCH /providers/:id calls update', async () => {
    const updated = { id: 1, name: 'Updated' };
    mockService.update.mockResolvedValue(updated);
    const result = await controller.update(1, { name: 'Updated' } as any);
    expect(mockService.update).toHaveBeenCalledWith(1, { name: 'Updated' });
    expect(result).toEqual(updated);
  });

  it('DELETE /providers/:id calls remove', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await controller.remove(1);
    expect(mockService.remove).toHaveBeenCalledWith(1);
  });

  it('POST /providers/:id/models calls addModel', async () => {
    const model = { id: 10, providerId: 1, name: 'llama3.2' };
    mockService.addModel.mockResolvedValue(model);
    const result = await controller.addModel(1, { name: 'llama3.2' } as any);
    expect(mockService.addModel).toHaveBeenCalledWith(1, { name: 'llama3.2' });
    expect(result).toEqual(model);
  });

  it('DELETE /providers/:id/models/:modelId calls removeModel', async () => {
    mockService.removeModel.mockResolvedValue(undefined);
    await controller.removeModel(1, 10);
    expect(mockService.removeModel).toHaveBeenCalledWith(1, 10);
  });
});
```

- [ ] **Step 2: Run spec to confirm it fails**

```bash
cd backend && npx jest src/providers/providers.controller.spec.ts
```

Expected: FAIL — `Cannot find module './providers.controller'`

- [ ] **Step 3: Implement ProvidersController**

`backend/src/providers/providers.controller.ts`:
```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { CreateProviderModelDto } from './dto/create-provider-model.dto';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get('models')
  getAllModels() {
    return this.providersService.findAllModels();
  }

  @Get()
  findAll() {
    return this.providersService.findAll();
  }

  @Post()
  create(@Body() dto: CreateProviderDto) {
    return this.providersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProviderDto) {
    return this.providersService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.providersService.remove(id);
  }

  @Post(':id/models')
  addModel(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateProviderModelDto) {
    return this.providersService.addModel(id, dto);
  }

  @Delete(':id/models/:modelId')
  async removeModel(
    @Param('id', ParseIntPipe) id: number,
    @Param('modelId', ParseIntPipe) modelId: number,
  ) {
    await this.providersService.removeModel(id, modelId);
  }
}
```

- [ ] **Step 4: Run spec to confirm it passes**

```bash
cd backend && npx jest src/providers/providers.controller.spec.ts
```

Expected: PASS — 7 tests pass

- [ ] **Step 5: Create ProvidersModule**

`backend/src/providers/providers.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

@Module({
  controllers: [ProvidersController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
```

- [ ] **Step 6: Register ProvidersModule in AppModule**

Replace entire `backend/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';
import { AgentModule } from './agent/agent.module';
import { SettingsModule } from './settings/settings.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { SessionsModule } from './sessions/sessions.module';
import { ProvidersModule } from './providers/providers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TasksModule,
    AgentModule,
    SettingsModule,
    KnowledgeModule,
    SessionsModule,
    ProvidersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
```

- [ ] **Step 7: Run all providers tests**

```bash
cd backend && npx jest src/providers
```

Expected: PASS — 16 tests pass (9 service + 7 controller)

- [ ] **Step 8: Commit**

```bash
git add backend/src/providers/ backend/src/app.module.ts
git commit -m "feat: add ProvidersController, ProvidersModule; register in AppModule"
```

---

## Task 4: Refactor LLM Call Chain (LLMCallerService + OllamaProvider)

**Files:**
- Modify: `backend/src/agent/services/llm-caller.service.ts`
- Modify: `backend/src/agent/providers/ollama.provider.ts`
- Modify: `backend/src/agent/providers/ollama.provider.spec.ts`

- [ ] **Step 1: Update LLMCallerService — remove SettingsService, add baseUrl/key params**

Replace entire `backend/src/agent/services/llm-caller.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OllamaMessage } from '../providers/llm-provider.interface';
import { ToolDefinition } from './context-builder.service';

export interface StreamChunk {
  type: 'token' | 'tool_call' | 'thinking' | 'done' | 'error';
  token?: string;
  toolCall?: { name: string; arguments: unknown };
  thinking?: string;
  error?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

@Injectable()
export class LLMCallerService {
  private readonly logger = new Logger(LLMCallerService.name);

  async *streamChat(
    model: string,
    messages: OllamaMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal,
    baseUrl: string,
    key?: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (signal.aborted) return;

    const msgs: Array<Record<string, unknown>> = [
      ...messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
      })),
    ];

    const body: Record<string, unknown> = {
      model,
      messages: msgs,
      stream: true,
    };
    if (tools.length > 0) {
      body.tools = tools;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }

    let ollamaRes: globalThis.Response;
    try {
      ollamaRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      if (signal.aborted) return;
      yield { type: 'error', error: 'ollama_unreachable' };
      return;
    }

    if (!ollamaRes.ok) {
      let detail = `ollama_error_${ollamaRes.status}`;
      try {
        const errBody = await ollamaRes.json() as { error?: string };
        if (errBody.error) detail = errBody.error;
      } catch { }
      yield { type: 'error', error: detail };
      return;
    }

    const reader = ollamaRes.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: unknown } }> };
            done?: boolean;
          };
          if (parsed.message?.content) {
            yield { type: 'token', token: parsed.message.content };
          }
          if (parsed.message?.tool_calls) {
            for (const tc of parsed.message.tool_calls) {
              yield {
                type: 'tool_call',
                toolCall: {
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                },
              };
            }
          }
        } catch { }
      }
    }

    yield { type: 'done' };
  }
}
```

- [ ] **Step 2: Update OllamaProvider — add providerConfig parameter, thread through to LLMCallerService**

In `backend/src/agent/providers/ollama.provider.ts`, change the `streamChat` signature and update the single call to `this.llmCaller.streamChat`:

Change the method signature from:
```typescript
async streamChat(
  messages: OllamaMessage[],
  model: string,
  res: Response,
  signal: AbortSignal,
  sessionId?: number,
  mode: string = 'agent',
): Promise<{ finalText: string }>
```
To:
```typescript
async streamChat(
  messages: OllamaMessage[],
  model: string,
  res: Response,
  signal: AbortSignal,
  sessionId?: number,
  mode: string = 'agent',
  providerConfig: { baseUrl: string; key?: string } = { baseUrl: 'http://localhost:11434' },
): Promise<{ finalText: string }>
```

Change the single `this.llmCaller.streamChat(...)` call (line ~51) from:
```typescript
const stream = this.llmCaller.streamChat(model, context.messages, tools, signal);
```
To:
```typescript
const stream = this.llmCaller.streamChat(model, context.messages, tools, signal, providerConfig.baseUrl, providerConfig.key);
```

- [ ] **Step 3: Update ollama.provider.spec.ts — add providerConfig to test calls that need it**

The mock for `LLMCallerService` already accepts any parameters. The only change needed: `LLMCallerService` no longer requires `SettingsService` in the module, so the spec's module setup doesn't need it. Verify no `SettingsService` is imported in the spec — it isn't, so no change needed.

Run the tests to confirm they still pass without changes:

```bash
cd backend && npx jest src/agent/providers/ollama.provider.spec.ts
```

Expected: PASS — all existing tests pass (no breaking change, providerConfig has a default value)

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/services/llm-caller.service.ts backend/src/agent/providers/ollama.provider.ts
git commit -m "refactor: LLMCallerService accepts baseUrl/key directly; OllamaProvider passes providerConfig"
```

---

## Task 5: ChatDto + AgentController + AgentService (TDD)

**Files:**
- Modify: `backend/src/agent/dto/chat.dto.ts`
- Modify: `backend/src/agent/agent.controller.ts`
- Modify: `backend/src/agent/agent.service.spec.ts`
- Modify: `backend/src/agent/agent.service.ts`
- Modify: `backend/src/agent/agent.module.ts`

- [ ] **Step 1: Update ChatDto**

Replace entire `backend/src/agent/dto/chat.dto.ts`:
```typescript
import { IsString, IsOptional, IsInt, IsIn } from 'class-validator';

export class ChatDto {
  @IsString()
  message: string;

  @IsInt()
  providerModelId: number;

  @IsInt()
  sessionId: number;

  @IsString()
  @IsOptional()
  @IsIn(['agent', 'chat'])
  mode?: string;
}
```

- [ ] **Step 2: Update AgentController to use providerModelId**

Replace entire `backend/src/agent/agent.controller.ts`:
```typescript
import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AgentService } from './agent.service';
import { ChatDto } from './dto/chat.dto';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  async chatStream(
    @Body() dto: ChatDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const ctrl = new AbortController();
    req.on('close', () => ctrl.abort());

    try {
      await this.agentService.streamChat(dto.message, dto.providerModelId, res, ctrl.signal, dto.sessionId, dto.mode ?? 'agent');
    } catch {
      res.write('data: {"error":"internal_error"}\n\n');
    } finally {
      res.end();
    }
  }
}
```

- [ ] **Step 3: Update agent.service.spec.ts**

Replace entire `backend/src/agent/agent.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { SessionsService } from '../sessions/sessions.service';
import { ContextBuilderService } from './services/context-builder.service';
import { ProvidersService } from '../providers/providers.service';

describe('AgentService', () => {
  let service: AgentService;
  const mockProvider = { streamChat: jest.fn().mockResolvedValue({ finalText: 'Great response' }) };
  const mockSessionsService = {
    getHistory: jest.fn().mockResolvedValue([]),
    saveMessage: jest.fn().mockResolvedValue(undefined),
    autoTitle: jest.fn().mockResolvedValue(undefined),
  };
  const mockContextBuilder = {
    build: jest.fn().mockResolvedValue({
      systemPrompt: 'You are a helpful AI assistant.',
      messages: [],
      tools: [],
    }),
  };
  const mockProvidersService = {
    findModelWithProvider: jest.fn().mockResolvedValue({
      id: 5,
      name: 'llama3.2',
      providerId: 1,
      provider: { id: 1, name: 'Local', type: 'ollama', baseUrl: 'http://localhost:11434', key: null },
    }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: OllamaProvider, useValue: mockProvider },
        { provide: SessionsService, useValue: mockSessionsService },
        { provide: ContextBuilderService, useValue: mockContextBuilder },
        { provide: ProvidersService, useValue: mockProvidersService },
      ],
    }).compile();
    service = module.get(AgentService);
    jest.clearAllMocks();
  });

  it('resolves provider model and calls OllamaProvider with providerConfig', async () => {
    mockProvider.streamChat.mockResolvedValue({ finalText: 'Hello!' });
    mockSessionsService.getHistory.mockResolvedValue([{ role: 'user', content: 'Hi' }]);
    mockProvidersService.findModelWithProvider.mockResolvedValue({
      id: 5, name: 'llama3.2', providerId: 1,
      provider: { id: 1, baseUrl: 'http://localhost:11434', key: null },
    });
    const mockRes = {} as any;
    const signal = new AbortController().signal;

    await service.streamChat('World', 5, mockRes, signal, 1);

    expect(mockProvidersService.findModelWithProvider).toHaveBeenCalledWith(5);
    expect(mockProvider.streamChat).toHaveBeenCalled();
    const callArgs = mockProvider.streamChat.mock.calls[0];
    expect(callArgs[1]).toBe('llama3.2');
    expect(callArgs[6]).toEqual({ baseUrl: 'http://localhost:11434', key: undefined });
  });

  it('writes provider_not_found error when providerModelId does not exist', async () => {
    mockProvidersService.findModelWithProvider.mockResolvedValue(null);
    const mockRes = { write: jest.fn() } as any;
    const signal = new AbortController().signal;

    await service.streamChat('World', 999, mockRes, signal, 1);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"error":"provider_not_found"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(mockProvider.streamChat).not.toHaveBeenCalled();
  });

  it('persists user message and assistant response after stream', async () => {
    mockProvider.streamChat.mockResolvedValue({ finalText: 'Hello!' });
    const signal = new AbortController().signal;

    await service.streamChat('World', 5, {} as any, signal, 1);

    expect(mockSessionsService.saveMessage).toHaveBeenCalledWith(1, 'user', 'World');
    expect(mockSessionsService.saveMessage).toHaveBeenCalledWith(1, 'assistant', 'Hello!');
    expect(mockSessionsService.autoTitle).toHaveBeenCalledWith(1, 'World');
  });

  it('does not persist when signal is aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    mockProvider.streamChat.mockResolvedValue({ finalText: '' });

    await service.streamChat('msg', 5, {} as any, ctrl.signal, 1);

    expect(mockSessionsService.saveMessage).not.toHaveBeenCalled();
    expect(mockSessionsService.autoTitle).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run spec to confirm it fails**

```bash
cd backend && npx jest src/agent/agent.service.spec.ts
```

Expected: FAIL — `AgentService.streamChat` still takes `model: string` parameter

- [ ] **Step 5: Implement updated AgentService**

Replace entire `backend/src/agent/agent.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { OllamaProvider } from './providers/ollama.provider';
import { OllamaMessage } from './providers/llm-provider.interface';
import { SessionsService } from '../sessions/sessions.service';
import { ContextBuilderService } from './services/context-builder.service';
import { AgentRunState } from './dto/agent-run-state';
import { ProvidersService } from '../providers/providers.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly provider: OllamaProvider,
    private readonly sessionsService: SessionsService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly providersService: ProvidersService,
  ) {}

  async streamChat(
    message: string,
    providerModelId: number,
    res: Response,
    signal: AbortSignal,
    sessionId: number,
    mode: string = 'agent',
  ): Promise<void> {
    const providerModel = await this.providersService.findModelWithProvider(providerModelId);
    if (!providerModel) {
      res.write('data: {"error":"provider_not_found"}\n\n');
      res.write('data: [DONE]\n\n');
      return;
    }

    const providerConfig = {
      baseUrl: providerModel.provider.baseUrl ?? 'http://localhost:11434',
      key: providerModel.provider.key ?? undefined,
    };

    const runState = new AgentRunState(10, String(sessionId));
    const context = await this.contextBuilder.build(runState, sessionId);

    const history = await this.sessionsService.getHistory(sessionId);
    const messages: OllamaMessage[] = [
      { role: 'system', content: context.systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    if (!signal.aborted) {
      await this.sessionsService.saveMessage(sessionId, 'user', message);
    }

    const { finalText } = await this.provider.streamChat(
      messages, providerModel.name, res, signal, sessionId, mode, providerConfig,
    );

    if (!signal.aborted && finalText) {
      await this.sessionsService.saveMessage(sessionId, 'assistant', finalText);
      await this.sessionsService.autoTitle(sessionId, message);
    }
  }
}
```

- [ ] **Step 6: Update AgentModule to import ProvidersModule**

Replace entire `backend/src/agent/agent.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { LLMCallerService } from './services/llm-caller.service';
import { ContextBuilderService } from './services/context-builder.service';
import { TasksModule } from '../tasks/tasks.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [TasksModule, KnowledgeModule, SessionsModule, ProvidersModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    OllamaProvider,
    LLMCallerService,
    ContextBuilderService,
  ],
})
export class AgentModule {}
```

- [ ] **Step 7: Run agent tests to confirm all pass**

```bash
cd backend && npx jest src/agent
```

Expected: PASS — all agent tests pass (service spec: 4 tests; provider spec: ~12 tests; controller spec: passes)

- [ ] **Step 8: Commit**

```bash
git add backend/src/agent/
git commit -m "feat: AgentService uses providerModelId to resolve provider config for LLM calls"
```

---

## Task 6: SettingsService — Remove Ollama Block (TDD)

**Files:**
- Modify: `backend/src/settings/settings.service.spec.ts`
- Modify: `backend/src/settings/settings.service.ts`
- Modify: `backend/src/settings/settings.controller.spec.ts`

- [ ] **Step 1: Update settings.service.spec.ts**

Replace entire `backend/src/settings/settings.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  setting: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  it('findAll returns empty object', async () => {
    const result = await service.findAll();
    expect(result).toEqual({});
    expect(mockPrisma.setting.findUnique).not.toHaveBeenCalled();
  });

  it('upsert creates or updates a setting', async () => {
    mockPrisma.setting.upsert.mockResolvedValue({ key: 'some.key', value: 'val' });
    await service.upsert('some.key', 'val');
    expect(mockPrisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: 'some.key' },
      update: { value: 'val' },
      create: { key: 'some.key', value: 'val' },
    });
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd backend && npx jest src/settings/settings.service.spec.ts
```

Expected: FAIL — `findAll returns empty object` fails because current `findAll()` returns `{ ollama: {...} }`

- [ ] **Step 3: Update SettingsService.findAll()**

Replace `findAll` method in `backend/src/settings/settings.service.ts`:

Old:
```typescript
async findAll(): Promise<{ ollama: { baseUrl: string; defaultModel: string } }> {
  const baseUrl = await this.get('ollama.baseUrl', 'http://localhost:11434');
  const defaultModel = await this.get('ollama.defaultModel', 'llama3.2');
  return { ollama: { baseUrl, defaultModel } };
}
```

New (replace the entire method):
```typescript
async findAll(): Promise<Record<string, never>> {
  return {};
}
```

- [ ] **Step 4: Run service spec to confirm it passes**

```bash
cd backend && npx jest src/settings/settings.service.spec.ts
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Update settings.controller.spec.ts**

Replace line:
```typescript
const expected = { ollama: { baseUrl: 'http://localhost:11434', defaultModel: 'llama3.2' } };
```
With:
```typescript
const expected = {};
```

- [ ] **Step 6: Run all settings tests**

```bash
cd backend && npx jest src/settings
```

Expected: PASS — all tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/src/settings/
git commit -m "refactor: SettingsService.findAll returns empty object; ollama settings replaced by providers"
```

---

## Task 7: Remove OllamaModule

**Files:**
- Delete: `backend/src/ollama/` (entire directory)
- Already modified: `backend/src/app.module.ts` (OllamaModule already removed in Task 3)

- [ ] **Step 1: Delete the ollama directory and stage the deletion**

```bash
cd backend
git rm -r src/ollama
```

- [ ] **Step 2: Verify no remaining references to OllamaModule or OllamaService**

```bash
cd backend && grep -r "OllamaModule\|OllamaService\|OllamaController" src/ --include="*.ts"
```

Expected: no output (zero matches)

- [ ] **Step 3: Run full backend test suite**

```bash
cd backend && npx jest
```

Expected: PASS — all tests pass with no reference to ollama module

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove OllamaModule — model list now served by ProvidersModule"
```

---

## Task 8: Frontend i18n — Add Providers Keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add providers keys to vi.json**

Add the following entries inside `frontend/src/locales/vi.json`, before the closing `}`:
```json
  "providers.header": "PROVIDERS",
  "providers.add": "+ thêm provider",
  "providers.empty": "Chưa có provider nào",
  "providers.edit": "Sửa provider",
  "providers.delete.confirm": "Xóa provider này?",
  "providers.form.name": "Tên",
  "providers.form.type": "Loại",
  "providers.form.baseUrl": "Base URL (tùy chọn)",
  "providers.form.key": "API Key (tùy chọn)",
  "providers.form.save": "Lưu",
  "providers.form.cancel": "Hủy",
  "providers.models.add": "+ thêm model",
  "providers.models.placeholder": "tên model_",
  "providers.models.delete.confirm": "Xóa model này?",
  "chat.no_provider": "Chưa có provider. Thêm trong ⚡ Providers.",
  "nav.providers": "Providers"
```

- [ ] **Step 2: Add providers keys to en.json**

Add the following entries inside `frontend/src/locales/en.json`, before the closing `}`:
```json
  "providers.header": "PROVIDERS",
  "providers.add": "+ add provider",
  "providers.empty": "No providers yet",
  "providers.edit": "Edit provider",
  "providers.delete.confirm": "Delete this provider?",
  "providers.form.name": "Name",
  "providers.form.type": "Type",
  "providers.form.baseUrl": "Base URL (optional)",
  "providers.form.key": "API Key (optional)",
  "providers.form.save": "Save",
  "providers.form.cancel": "Cancel",
  "providers.models.add": "+ add model",
  "providers.models.placeholder": "model name_",
  "providers.models.delete.confirm": "Delete this model?",
  "chat.no_provider": "No provider configured. Add one in ⚡ Providers.",
  "nav.providers": "Providers"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/
git commit -m "feat: add i18n keys for providers management and chat.no_provider"
```

---

## Task 9: ProviderFormModal + ProvidersView

**Files:**
- Create: `frontend/src/components/ProviderFormModal.vue`
- Create: `frontend/src/components/ProvidersView.vue`

- [ ] **Step 1: Create ProviderFormModal.vue**

`frontend/src/components/ProviderFormModal.vue`:
```vue
<template>
  <BaseModal v-model="modelValue" :closable="true" max-height="80vh" @update:model-value="$emit('update:modelValue', $event)">
    <template #header>
      <span class="text-cyber-accent text-xs tracking-widest font-mono">
        {{ editing ? t('providers.edit') : t('providers.add') }}
      </span>
    </template>

    <div class="px-3 py-3 space-y-3">
      <div>
        <label class="text-cyber-muted text-[0.625rem] font-mono block mb-1">{{ t('providers.form.name') }}</label>
        <input
          v-model="form.name"
          class="w-full bg-cyber-dark text-slate-100 text-xs px-2 py-1.5 font-mono outline-none border border-cyber-accent/10 focus:border-cyber-accent/40"
          autocomplete="off"
        />
      </div>
      <div>
        <label class="text-cyber-muted text-[0.625rem] font-mono block mb-1">{{ t('providers.form.baseUrl') }}</label>
        <input
          v-model="form.baseUrl"
          class="w-full bg-cyber-dark text-slate-100 text-xs px-2 py-1.5 font-mono outline-none border border-cyber-accent/10 focus:border-cyber-accent/40"
          placeholder="http://localhost:11434"
          autocomplete="off"
        />
      </div>
      <div>
        <label class="text-cyber-muted text-[0.625rem] font-mono block mb-1">{{ t('providers.form.key') }}</label>
        <input
          v-model="form.key"
          type="password"
          class="w-full bg-cyber-dark text-slate-100 text-xs px-2 py-1.5 font-mono outline-none border border-cyber-accent/10 focus:border-cyber-accent/40"
          autocomplete="new-password"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          @click="$emit('update:modelValue', false)"
          class="px-3 py-1 text-xs font-mono text-cyber-muted hover:text-slate-100 transition-colors duration-150"
        >{{ t('providers.form.cancel') }}</button>
        <button
          @click="save"
          :disabled="!form.name.trim() || saving"
          class="px-3 py-1 text-xs font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
        >{{ t('providers.form.save') }}</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

interface Provider {
  id: number
  name: string
  type: string
  baseUrl: string | null
  key: string | null
}

const props = defineProps<{
  modelValue: boolean
  editing: Provider | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const { t } = useI18n()

const form = ref({ name: '', baseUrl: '', key: '' })
const saving = ref(false)

watch(() => props.modelValue, (open) => {
  if (open) {
    form.value = {
      name: props.editing?.name ?? '',
      baseUrl: props.editing?.baseUrl ?? '',
      key: '',
    }
  }
})

async function save() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    const body: Record<string, string> = { name: form.value.name.trim(), type: 'ollama' }
    if (form.value.baseUrl.trim()) body.baseUrl = form.value.baseUrl.trim()
    if (form.value.key.trim()) body.key = form.value.key.trim()

    const url = props.editing ? `/api/providers/${props.editing.id}` : '/api/providers'
    const method = props.editing ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    emit('saved')
    emit('update:modelValue', false)
  } catch { /* ignore */ }
  saving.value = false
}
</script>
```

- [ ] **Step 2: Create ProvidersView.vue**

`frontend/src/components/ProvidersView.vue`:
```vue
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-xs tracking-widest font-mono">⚡ {{ t('providers.header') }}</span>
      <button
        @click="openAddModal"
        class="text-cyber-accent text-xs font-mono hover:bg-cyber-accent/10 px-2 py-0.5 transition-colors duration-150"
      >{{ t('providers.add') }}</button>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3">
      <div v-if="providers.length === 0" class="text-cyber-muted text-xs font-mono py-4">
        {{ t('providers.empty') }}
      </div>

      <div
        v-for="provider in providers"
        :key="provider.id"
        class="mb-2 border border-cyber-accent/10"
      >
        <!-- Provider header row -->
        <div
          @click="toggleExpand(provider.id)"
          class="flex items-center justify-between px-3 py-2 bg-cyber-dark cursor-pointer hover:bg-cyber-accent/5 transition-colors duration-150"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-cyber-accent/60 text-[10px] shrink-0">{{ expanded.has(provider.id) ? '▼' : '▶' }}</span>
            <span class="text-slate-100 text-xs font-mono truncate">{{ provider.name }}</span>
            <span class="text-[9px] font-mono text-cyber-accent/50 border border-cyber-accent/20 px-1 shrink-0">{{ provider.type }}</span>
            <span v-if="provider.baseUrl" class="text-[9px] text-cyber-muted font-mono truncate hidden sm:block">{{ provider.baseUrl }}</span>
          </div>
          <div class="flex items-center gap-3 shrink-0 ml-2">
            <button @click.stop="openEditModal(provider)" class="text-cyber-accent/40 text-xs hover:text-cyber-accent transition-colors duration-150">✎</button>
            <button @click.stop="confirmDeleteProvider(provider)" class="text-red-400/40 text-xs hover:text-red-400 transition-colors duration-150">✕</button>
          </div>
        </div>

        <!-- Expanded models section -->
        <div v-if="expanded.has(provider.id)" class="px-3 py-2 bg-cyber-bg border-t border-cyber-accent/5">
          <div class="text-[9px] text-cyber-accent/50 tracking-widest font-mono mb-2">MODELS</div>

          <div v-if="provider.models.length === 0" class="text-cyber-muted text-[10px] font-mono mb-1">—</div>
          <div
            v-for="model in provider.models"
            :key="model.id"
            class="flex items-center justify-between py-0.5"
          >
            <span class="text-xs text-slate-300 font-mono">{{ model.name }}</span>
            <button
              @click="deleteModel(provider.id, model.id)"
              class="text-red-400/40 text-[10px] hover:text-red-400 transition-colors duration-150 ml-2"
            >✕</button>
          </div>

          <!-- Add model inline -->
          <div v-if="addingModelFor === provider.id" class="flex items-center gap-2 mt-2">
            <input
              ref="modelInputEl"
              v-model="newModelName"
              @keyup.enter="submitAddModel(provider.id)"
              @keyup.escape="addingModelFor = null"
              class="flex-1 bg-cyber-dark text-xs font-mono text-slate-100 px-2 py-0.5 outline-none border border-cyber-accent/30"
              :placeholder="t('providers.models.placeholder')"
              autocomplete="off"
            />
            <button @click="submitAddModel(provider.id)" class="text-cyber-accent text-[10px] hover:text-cyber-accent/70">✓</button>
            <button @click="addingModelFor = null" class="text-cyber-muted text-[10px] hover:text-slate-100">✕</button>
          </div>
          <button
            v-else
            @click="startAddModel(provider.id)"
            class="text-cyber-accent/60 text-[10px] font-mono hover:text-cyber-accent transition-colors duration-150 mt-1 block"
          >{{ t('providers.models.add') }}</button>
        </div>
      </div>
    </div>

    <ProviderFormModal
      v-model="showModal"
      :editing="editingProvider"
      @saved="loadProviders"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import ProviderFormModal from './ProviderFormModal.vue'

interface ProviderModel {
  id: number
  name: string
}

interface Provider {
  id: number
  name: string
  type: string
  baseUrl: string | null
  key: string | null
  models: ProviderModel[]
}

const { t } = useI18n()

const providers = ref<Provider[]>([])
const expanded = ref<Set<number>>(new Set())
const showModal = ref(false)
const editingProvider = ref<Provider | null>(null)
const addingModelFor = ref<number | null>(null)
const newModelName = ref('')
const modelInputEl = ref<HTMLInputElement | null>(null)

async function loadProviders() {
  try {
    const res = await fetch('/api/providers')
    if (res.ok) providers.value = await res.json() as Provider[]
  } catch { /* ignore */ }
}

function toggleExpand(id: number) {
  if (expanded.value.has(id)) {
    expanded.value.delete(id)
  } else {
    expanded.value.add(id)
  }
}

function openAddModal() {
  editingProvider.value = null
  showModal.value = true
}

function openEditModal(provider: Provider) {
  editingProvider.value = provider
  showModal.value = true
}

async function confirmDeleteProvider(provider: Provider) {
  if (!confirm(t('providers.delete.confirm'))) return
  try {
    await fetch(`/api/providers/${provider.id}`, { method: 'DELETE' })
    await loadProviders()
  } catch { /* ignore */ }
}

function startAddModel(providerId: number) {
  addingModelFor.value = providerId
  newModelName.value = ''
  nextTick(() => modelInputEl.value?.focus())
}

async function submitAddModel(providerId: number) {
  const name = newModelName.value.trim()
  if (!name) return
  try {
    const res = await fetch(`/api/providers/${providerId}/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      await loadProviders()
      addingModelFor.value = null
      newModelName.value = ''
    }
  } catch { /* ignore */ }
}

async function deleteModel(providerId: number, modelId: number) {
  if (!confirm(t('providers.models.delete.confirm'))) return
  try {
    await fetch(`/api/providers/${providerId}/models/${modelId}`, { method: 'DELETE' })
    await loadProviders()
  } catch { /* ignore */ }
}

onMounted(loadProviders)
</script>
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ProviderFormModal.vue frontend/src/components/ProvidersView.vue
git commit -m "feat: add ProvidersView (accordion) and ProviderFormModal components"
```

---

## Task 10: SidebarNav + BottomTabBar + AppShell

**Files:**
- Modify: `frontend/src/components/SidebarNav.vue`
- Modify: `frontend/src/components/BottomTabBar.vue`
- Modify: `frontend/src/components/AppShell.vue`

- [ ] **Step 1: Update SidebarNav.vue**

Replace entire `frontend/src/components/SidebarNav.vue`:
```vue
<template>
  <nav class="w-32 bg-cyber-dark hidden sm:flex flex-col items-stretch py-3 gap-1 shrink-0">
    <div class="flex items-center justify-center gap-2 px-3 py-1 mb-1">
      <span class="text-xs text-cyber-accent font-bold truncate">171305-wp</span>
    </div>

    <button
      v-for="item in navItems"
      :key="item.view"
      @click="$emit('navigate', item.view)"
      :class="[
        'w-full px-3 py-2 rounded flex items-center gap-2 transition-colors duration-150',
        activeView === item.view
          ? 'bg-cyber-accent/10 text-cyber-accent'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <component :is="item.icon" class="w-4 h-4 shrink-0" />
      <span class="text-xs truncate">{{ t(item.labelKey) }}</span>
    </button>

    <div class="flex-1" />

    <button
      @click="$emit('navigate', 'settings')"
      :class="[
        'w-full px-3 py-2 rounded flex items-center gap-2 transition-colors duration-150',
        activeView === 'settings'
          ? 'bg-cyber-accent/10 text-cyber-accent'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <HiCog class="w-4 h-4 shrink-0" />
      <span class="text-xs truncate">{{ t('nav.settings') }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiChatAlt2, HiClipboardList, HiFolder, HiCog } from 'vue-icons-plus/hi'

defineProps<{ activeView: 'chat' | 'tasks' | 'files' | 'settings' | 'providers' }>()
defineEmits<{ navigate: [view: 'chat' | 'tasks' | 'files' | 'settings' | 'providers'] }>()

const { t } = useI18n()

interface NavItem {
  view: 'chat' | 'tasks' | 'files' | 'providers'
  labelKey: string
  icon: Component
}

const navItems: NavItem[] = [
  { view: 'chat',      labelKey: 'nav.chat',      icon: HiChatAlt2 },
  { view: 'tasks',     labelKey: 'nav.tasks',     icon: HiClipboardList },
  { view: 'files',     labelKey: 'nav.files',     icon: HiFolder },
  { view: 'providers', labelKey: 'nav.providers', icon: HiCog },
]
</script>
```

Note: `HiCog` is reused for the providers icon (⚡ is a Unicode char without a matching HeroIcon). The settings button at the bottom no longer uses the same icon loop, so `HiCog` is used for providers in the loop and also for the standalone settings button — this is intentional for now.

- [ ] **Step 2: Update BottomTabBar.vue**

Replace entire `frontend/src/components/BottomTabBar.vue`:
```vue
<template>
  <nav class="flex sm:hidden items-center bg-cyber-dark border-t border-cyber-code-border h-[3rem] shrink-0">
    <button
      v-for="item in navItems"
      :key="item.view"
      :title="t(item.labelKey)"
      @click="$emit('navigate', item.view)"
      :class="[
        'flex flex-col items-center justify-center gap-0.5 flex-1 h-full font-mono text-[0.5rem] transition-colors duration-150',
        activeView === item.view
          ? 'text-cyber-accent bg-cyber-accent/10'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <component :is="item.icon" class="w-[1.125rem] h-[1.125rem]" />
      <span>{{ t(item.labelKey) }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiChatAlt2, HiClipboardList, HiFolder, HiCog } from 'vue-icons-plus/hi'

defineProps<{ activeView: 'chat' | 'tasks' | 'files' | 'settings' | 'providers' }>()
defineEmits<{ navigate: [view: 'chat' | 'tasks' | 'files' | 'settings' | 'providers'] }>()

const { t } = useI18n()

interface NavItem {
  view: 'chat' | 'tasks' | 'files' | 'settings' | 'providers'
  labelKey: string
  icon: Component
}

const navItems: NavItem[] = [
  { view: 'chat',      labelKey: 'nav.chat',      icon: HiChatAlt2 },
  { view: 'tasks',     labelKey: 'nav.tasks',     icon: HiClipboardList },
  { view: 'files',     labelKey: 'nav.files',     icon: HiFolder },
  { view: 'providers', labelKey: 'nav.providers', icon: HiCog },
  { view: 'settings',  labelKey: 'nav.settings',  icon: HiCog },
]
</script>
```

- [ ] **Step 3: Update AppShell.vue**

Replace entire `frontend/src/components/AppShell.vue`:
```vue
<template>
  <div class="flex flex-col h-screen bg-cyber-bg font-mono overflow-hidden">
    <div class="flex flex-1 overflow-hidden">
      <SidebarNav :active-view="activeView" @navigate="activeView = $event" />
      <FilesView      v-if="activeView === 'files'"     class="flex-1 overflow-hidden" />
      <SettingsView   v-else-if="activeView === 'settings'"  class="flex-1 overflow-hidden" />
      <TasksView      v-else-if="activeView === 'tasks'"     class="flex-1 overflow-hidden" @ws-status="wsConnected = $event" />
      <ProvidersView  v-else-if="activeView === 'providers'" class="flex-1 overflow-hidden" />
      <ChatPanel      v-else                                  class="flex-1 overflow-hidden" />
    </div>
    <BottomTabBar :active-view="activeView" @navigate="activeView = $event" />
    <StatusBar
      :db-connected="dbConnected"
      :ws-connected="wsConnected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SidebarNav from './SidebarNav.vue'
import BottomTabBar from './BottomTabBar.vue'
import ChatPanel from './ChatPanel.vue'
import TasksView from './TasksView.vue'
import SettingsView from './SettingsView.vue'
import FilesView from './FilesView.vue'
import ProvidersView from './ProvidersView.vue'
import StatusBar from './StatusBar.vue'

const activeView = ref<'chat' | 'tasks' | 'files' | 'settings' | 'providers'>('chat')
const dbConnected = ref(true)
const wsConnected = ref(false)
</script>
```

- [ ] **Step 4: Type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SidebarNav.vue frontend/src/components/BottomTabBar.vue frontend/src/components/AppShell.vue
git commit -m "feat: add providers nav to SidebarNav, BottomTabBar, AppShell"
```

---

## Task 11: ModelSelector — Use providerModelId

**Files:**
- Modify: `frontend/src/components/ModelSelector.vue`

- [ ] **Step 1: Replace ModelSelector.vue**

Replace entire `frontend/src/components/ModelSelector.vue`:
```vue
<template>
  <BaseSelect
    :model-value="modelValue !== null ? String(modelValue) : ''"
    :options="selectOptions"
    :disabled="disabled || selectOptions.length === 0"
    :placeholder="selectOptions.length === 0 ? t('chat.no_provider') : undefined"
    @update:model-value="$emit('update:modelValue', $event ? Number($event) : null)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseSelect from './BaseSelect.vue'

interface ProviderModelFlat {
  id: number
  name: string
  providerName: string
  providerId: number
}

const props = defineProps<{
  models: ProviderModelFlat[]
  modelValue: number | null
  disabled: boolean
}>()

defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()

const selectOptions = computed(() =>
  props.models.map(m => ({
    value: String(m.id),
    label: `${m.providerName} / ${m.name}`,
  }))
)
</script>
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors (ChatPanel will have type errors until updated in next task)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ModelSelector.vue
git commit -m "feat: ModelSelector uses providerModelId (number) instead of model string"
```

---

## Task 12: ChatPanel — Use providerModelId

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

The ChatPanel needs 4 changes:
1. Fetch models from `/api/providers/models` instead of `/api/ollama/models`
2. `selectedModel` → `selectedModelId: number | null`
3. Send `providerModelId` instead of `model` in the POST body
4. Disable submit when `selectedModelId === null`

- [ ] **Step 1: Update the `onMounted` fetch — change URL and response shape**

Find and replace the `onMounted` block:

Old:
```typescript
onMounted(async () => {
  inputEl.value?.focus()
  try {
    const res = await fetch('/api/ollama/models')
    if (!res.ok) throw new Error('fetch failed')
    const models = (await res.json()) as string[]
    availableModels.value = models
    emit('update:ollamaOnline', true)
    if (models.length > 0 && !models.includes(selectedModel.value)) {
      selectedModel.value = models[0]
    }
  } catch {
    ollamaOnline.value = false
    emit('update:ollamaOnline', false)
    availableModels.value = [selectedModel.value]
  }
})
```

New:
```typescript
onMounted(async () => {
  inputEl.value?.focus()
  try {
    const res = await fetch('/api/providers/models')
    if (!res.ok) throw new Error('fetch failed')
    const models = (await res.json()) as ProviderModelFlat[]
    availableModels.value = models
    if (models.length > 0) {
      const savedId = Number(localStorage.getItem('workspace.modelId'))
      selectedModelId.value = models.find(m => m.id === savedId)?.id ?? models[0].id
    }
  } catch {
    availableModels.value = []
  }
})
```

- [ ] **Step 2: Update state declarations and types**

Add the `ProviderModelFlat` interface and change state variables.

After the `interface Message` block, add:
```typescript
interface ProviderModelFlat {
  id: number
  name: string
  providerName: string
  providerId: number
}
```

Replace:
```typescript
const selectedModel = ref(localStorage.getItem('workspace.model') ?? 'llama3.2')
const availableModels = ref<string[]>([])
const ollamaOnline = ref(true)
```

With:
```typescript
const selectedModelId = ref<number | null>(null)
const availableModels = ref<ProviderModelFlat[]>([])
```

- [ ] **Step 3: Update the `watch` for localStorage persistence**

Replace:
```typescript
watch(selectedModel, (val) => {
  localStorage.setItem('workspace.model', val)
})
```

With:
```typescript
watch(selectedModelId, (val) => {
  if (val !== null) localStorage.setItem('workspace.modelId', String(val))
})
```

- [ ] **Step 4: Update the submit guard and POST body**

In the `submit` function, replace:
```typescript
body: JSON.stringify({ message: text, model: selectedModel.value, sessionId: currentSessionId.value, mode: agentMode.value ? 'agent' : 'chat' }),
```

With:
```typescript
body: JSON.stringify({ message: text, providerModelId: selectedModelId.value, sessionId: currentSessionId.value, mode: agentMode.value ? 'agent' : 'chat' }),
```

Also update the `submit` guard at the top of the function:

Replace:
```typescript
if (!text || streaming.value) return
```

With:
```typescript
if (!text || streaming.value || selectedModelId.value === null) return
```

- [ ] **Step 5: Update the ModelSelector binding in the template**

Find in template:
```html
<ModelSelector
  v-model="selectedModel"
  :models="availableModels"
  :disabled="streaming"
/>
```

Replace with:
```html
<ModelSelector
  v-model="selectedModelId"
  :models="availableModels"
  :disabled="streaming"
/>
```

- [ ] **Step 6: Remove unused emit and ollamaOnline refs**

Remove these lines if they remain after the changes:
```typescript
const ollamaOnline = ref(true)
```
```typescript
const emit = defineEmits<{
  (e: 'update:ollamaOnline', value: boolean): void
}>()
```
(Also remove any `emit('update:ollamaOnline', ...)` calls)

- [ ] **Step 7: Type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: ChatPanel uses providerModelId from ProvidersService instead of Ollama model string"
```

---

## Task 13: SettingsView — Remove Ollama Fields

**Files:**
- Modify: `frontend/src/components/SettingsView.vue`

- [ ] **Step 1: Remove ollama URL and defaultModel sections from SettingsView**

Replace entire `frontend/src/components/SettingsView.vue`:
```vue
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-xs tracking-widest font-mono">
        <HiCog class="w-3 h-3 inline" /> {{ t('settings.header') }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">
        <div class="border-t border-cyber-accent/10 pt-4">
          <div class="text-cyber-muted text-[0.625rem] font-mono mb-2">{{ t('settings.info') }}</div>
          <div class="text-xs font-mono text-cyber-muted space-y-1">
            <div>{{ t('settings.version') }}: 0.1.0</div>
            <div :class="healthy ? 'text-cyber-green' : 'text-red-400'">
              ● {{ healthy ? t('health.ok') : t('health.error') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiCog } from 'vue-icons-plus/hi'

const { t } = useI18n()
const healthy = ref(false)

onMounted(async () => {
  try {
    const healthRes = await fetch('/api/health')
    if (healthRes.ok) {
      const h = await healthRes.json() as { status: string }
      healthy.value = h.status === 'ok'
    }
  } catch { /* ignore */ }
})
</script>
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors

- [ ] **Step 3: Run full backend test suite one final time**

```bash
cd backend && npx jest
```

Expected: PASS — all tests pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SettingsView.vue
git commit -m "refactor: remove ollama URL/model fields from SettingsView; managed via ProvidersView"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] `GET /api/providers/models` returns flat list → ModelSelector populates correctly
- [ ] `POST /api/agent/chat` with valid `providerModelId` streams tokens correctly
- [ ] `POST /api/agent/chat` with invalid `providerModelId` writes `provider_not_found` error event
- [ ] Adding a provider in ProvidersView, then adding a model → model appears in ModelSelector
- [ ] No reference to `OllamaModule`, `OllamaService`, `ollama.baseUrl` setting remains in backend
- [ ] `npm run type-check` passes in frontend
- [ ] `npx jest` passes all tests in backend
