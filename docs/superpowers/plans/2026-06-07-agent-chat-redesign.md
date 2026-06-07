# Agent Chat Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-session conversation history to the agent chat — sessions persist in SQLite, history is sent to Ollama on each request, and a modal UI lets users create/resume sessions.

**Architecture:** Two new Prisma models (`Session`, `ChatMessage`) + `SessionsModule` handle persistence. `OllamaProvider` signature changes from `(message: string)` to `(messages: OllamaMessage[])` and returns `finalText`. `AgentService` orchestrates: load history → stream → persist. Frontend gets a session modal triggered by a header button and renders agent replies as markdown.

**Tech Stack:** NestJS + Prisma (SQLite) · Vue 3 `<script setup lang="ts">` · marked@9 + DOMPurify (already installed) · vue-i18n v9

---

## File Map

### Create
| File | Responsibility |
|---|---|
| `backend/src/sessions/sessions.service.ts` | CRUD + history load + message persist + autoTitle |
| `backend/src/sessions/sessions.service.spec.ts` | Unit tests for service |
| `backend/src/sessions/sessions.controller.ts` | REST endpoints for sessions |
| `backend/src/sessions/sessions.controller.spec.ts` | Controller tests |
| `backend/src/sessions/sessions.module.ts` | Module wiring |
| `frontend/src/components/SessionModal.vue` | Session list modal component |

### Modify
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `Session` + `ChatMessage` models |
| `backend/src/agent/providers/llm-provider.interface.ts` | Add `OllamaMessage` type, update signature |
| `backend/src/agent/providers/ollama.provider.ts` | Accept `messages[]`, return `{ finalText }` |
| `backend/src/agent/providers/ollama.provider.spec.ts` | Update all call sites |
| `backend/src/agent/agent.service.ts` | Inject `SessionsService`, load history, persist |
| `backend/src/agent/agent.service.spec.ts` | Update tests |
| `backend/src/agent/agent.controller.ts` | Pass `sessionId` from dto |
| `backend/src/agent/dto/chat.dto.ts` | Add `sessionId: number` |
| `backend/src/app.module.ts` | Import `SessionsModule` |
| `frontend/src/components/ChatPanel.vue` | Session button, loadSession, markdown render |
| `frontend/src/locales/vi.json` | Add `sessions.*` keys |
| `frontend/src/locales/en.json` | Add `sessions.*` keys |

---

## Task 1: Prisma Schema — Add Session + ChatMessage

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add models to schema**

Open `backend/prisma/schema.prisma` and append after the last model:

```prisma
model Session {
  id        Int           @id @default(autoincrement())
  title     String        @default("New Session")
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  messages  ChatMessage[]
}

model ChatMessage {
  id        Int      @id @default(autoincrement())
  sessionId Int
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      String
  content   String
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend
npx prisma migrate dev --name add-sessions-chat-messages
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: add Session and ChatMessage models to Prisma schema"
```

---

## Task 2: SessionsService — CRUD + history + persist + autoTitle

**Files:**
- Create: `backend/src/sessions/sessions.service.spec.ts`
- Create: `backend/src/sessions/sessions.service.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/sessions/sessions.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SessionsService', () => {
  let service: SessionsService;

  const mockPrisma = {
    session: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    chatMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(SessionsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a session with default title', async () => {
      mockPrisma.session.create.mockResolvedValue({ id: 1, title: 'New Session' });
      const result = await service.create();
      expect(mockPrisma.session.create).toHaveBeenCalledWith({ data: {} });
      expect(result.id).toBe(1);
    });
  });

  describe('findAll', () => {
    it('returns sessions ordered by updatedAt desc with message count', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      await service.findAll();
      expect(mockPrisma.session.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { messages: true } } },
      });
    });
  });

  describe('remove', () => {
    it('deletes session by id', async () => {
      mockPrisma.session.delete.mockResolvedValue({ id: 2 });
      const result = await service.remove(2);
      expect(mockPrisma.session.delete).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(result).toEqual({ id: 2 });
    });
  });

  describe('getMessages', () => {
    it('returns messages for a session ordered by createdAt asc', async () => {
      const msgs = [{ id: 1, sessionId: 1, role: 'user', content: 'hi', createdAt: new Date() }];
      mockPrisma.session.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.chatMessage.findMany.mockResolvedValue(msgs);
      const result = await service.getMessages(1);
      expect(result).toEqual(msgs);
      expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: { sessionId: 1 },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('throws NotFoundException when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);
      await expect(service.getMessages(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHistory', () => {
    it('returns OllamaMessage array from chat messages', async () => {
      mockPrisma.chatMessage.findMany.mockResolvedValue([
        { id: 1, role: 'user', content: 'Hello', sessionId: 1, createdAt: new Date() },
        { id: 2, role: 'assistant', content: 'Hi there', sessionId: 1, createdAt: new Date() },
      ]);
      const result = await service.getHistory(1);
      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ]);
    });
  });

  describe('saveMessage', () => {
    it('creates a ChatMessage record', async () => {
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 1 });
      await service.saveMessage(1, 'user', 'test message');
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: { sessionId: 1, role: 'user', content: 'test message' },
      });
    });
  });

  describe('autoTitle', () => {
    it('sets title from first 5 words when user message count is 1', async () => {
      mockPrisma.chatMessage.count.mockResolvedValue(1);
      mockPrisma.session.update.mockResolvedValue({});
      await service.autoTitle(1, 'Create a new task for me today');
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { title: 'Create a new task for' },
      });
    });

    it('does nothing when message count is greater than 1', async () => {
      mockPrisma.chatMessage.count.mockResolvedValue(2);
      await service.autoTitle(1, 'another message');
      expect(mockPrisma.session.update).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
npx jest src/sessions/sessions.service.spec.ts --no-coverage
```

Expected: `Cannot find module './sessions.service'`

- [ ] **Step 3: Implement SessionsService**

Create `backend/src/sessions/sessions.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OllamaMessage } from '../agent/providers/llm-provider.interface';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.session.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async create() {
    return this.prisma.session.create({ data: {} });
  }

  async remove(id: number) {
    return this.prisma.session.delete({ where: { id } });
  }

  async getMessages(sessionId: number) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    return this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getHistory(sessionId: number): Promise<OllamaMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  async saveMessage(sessionId: number, role: 'user' | 'assistant', content: string) {
    return this.prisma.chatMessage.create({
      data: { sessionId, role, content },
    });
  }

  async autoTitle(sessionId: number, firstMessage: string): Promise<void> {
    const count = await this.prisma.chatMessage.count({ where: { sessionId, role: 'user' } });
    if (count > 1) return;
    const title = firstMessage.split(' ').slice(0, 5).join(' ');
    await this.prisma.session.update({ where: { id: sessionId }, data: { title } });
  }
}
```

**Note:** `OllamaMessage` is imported from the interface file — Task 5 defines it. For now the import will fail until Task 5 runs; that's expected during incremental development.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/sessions/sessions.service.spec.ts --no-coverage
```

Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/src/sessions/sessions.service.ts backend/src/sessions/sessions.service.spec.ts
git commit -m "feat: add SessionsService with CRUD, history, persist, autoTitle"
```

---

## Task 3: SessionsController — REST endpoints

**Files:**
- Create: `backend/src/sessions/sessions.controller.spec.ts`
- Create: `backend/src/sessions/sessions.controller.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/sessions/sessions.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

describe('SessionsController', () => {
  let controller: SessionsController;

  const mockService = {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1, title: 'New Session' }),
    remove: jest.fn().mockResolvedValue({ id: 1 }),
    getMessages: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [{ provide: SessionsService, useValue: mockService }],
    }).compile();
    controller = module.get(SessionsController);
    jest.clearAllMocks();
  });

  it('findAll delegates to service', async () => {
    await controller.findAll();
    expect(mockService.findAll).toHaveBeenCalled();
  });

  it('create delegates to service', async () => {
    const result = await controller.create();
    expect(mockService.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 1, title: 'New Session' });
  });

  it('remove passes parsed id to service', async () => {
    await controller.remove(42);
    expect(mockService.remove).toHaveBeenCalledWith(42);
  });

  it('getMessages passes parsed id to service', async () => {
    await controller.getMessages(7);
    expect(mockService.getMessages).toHaveBeenCalledWith(7);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/sessions/sessions.controller.spec.ts --no-coverage
```

Expected: `Cannot find module './sessions.controller'`

- [ ] **Step 3: Implement SessionsController**

Create `backend/src/sessions/sessions.controller.ts`:

```typescript
import { Controller, Get, Post, Delete, Param, ParseIntPipe } from '@nestjs/common';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  findAll() {
    return this.sessionsService.findAll();
  }

  @Post()
  create() {
    return this.sessionsService.create();
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sessionsService.remove(id);
  }

  @Get(':id/messages')
  getMessages(@Param('id', ParseIntPipe) id: number) {
    return this.sessionsService.getMessages(id);
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/sessions/sessions.controller.spec.ts --no-coverage
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/src/sessions/sessions.controller.ts backend/src/sessions/sessions.controller.spec.ts
git commit -m "feat: add SessionsController with GET/POST/DELETE/GET-messages endpoints"
```

---

## Task 4: SessionsModule — wire up + register in AppModule

**Files:**
- Create: `backend/src/sessions/sessions.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create SessionsModule**

Create `backend/src/sessions/sessions.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';

@Module({
  providers: [SessionsService],
  controllers: [SessionsController],
  exports: [SessionsService],
})
export class SessionsModule {}
```

- [ ] **Step 2: Register in AppModule**

Replace the contents of `backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';
import { AgentModule } from './agent/agent.module';
import { OllamaModule } from './ollama/ollama.module';
import { SettingsModule } from './settings/settings.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TasksModule,
    AgentModule,
    OllamaModule,
    SettingsModule,
    KnowledgeModule,
    SessionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
```

- [ ] **Step 3: Verify build compiles**

```bash
npx jest --no-coverage
```

Expected: all existing tests pass (sessions service + controller tests pass too)

- [ ] **Step 4: Commit**

```bash
git add backend/src/sessions/sessions.module.ts backend/src/app.module.ts
git commit -m "feat: register SessionsModule in AppModule, export SessionsService"
```

---

## Task 5: LLMProvider interface + OllamaProvider — messages[] signature

**Files:**
- Modify: `backend/src/agent/providers/llm-provider.interface.ts`
- Modify: `backend/src/agent/providers/ollama.provider.ts`
- Modify: `backend/src/agent/providers/ollama.provider.spec.ts`

- [ ] **Step 1: Update LLMProvider interface**

Replace `backend/src/agent/providers/llm-provider.interface.ts`:

```typescript
import { Response } from 'express';

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

export interface LLMProvider {
  streamChat(
    messages: OllamaMessage[],
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<{ finalText: string }>;
}
```

- [ ] **Step 2: Update OllamaProvider spec — update all call sites**

Replace `backend/src/agent/providers/ollama.provider.spec.ts` with the full updated file:

```typescript
import { Test } from '@nestjs/testing';
import { OllamaProvider } from './ollama.provider';
import { SettingsService } from '../../settings/settings.service';
import { TasksService } from '../../tasks/tasks.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { OllamaMessage } from './llm-provider.interface';

function makeReader(chunks: string[]) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    read: jest.fn(async () => {
      if (i < chunks.length) return { done: false as const, value: encoder.encode(chunks[i++]) };
      return { done: true as const, value: undefined };
    }),
  };
}

const userMsg: OllamaMessage = { role: 'user', content: 'hi' };

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  const mockTasksService = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
  };

  const mockKnowledgeService = {
    search: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OllamaProvider,
        {
          provide: SettingsService,
          useValue: { get: jest.fn().mockResolvedValue('http://localhost:11434') },
        },
        { provide: TasksService, useValue: mockTasksService },
        { provide: KnowledgeService, useValue: mockKnowledgeService },
      ],
    }).compile();
    provider = module.get(OllamaProvider);
  });

  afterEach(() => jest.restoreAllMocks());

  it('writes token events for each NDJSON content chunk', async () => {
    const reader = makeReader([
      '{"message":{"role":"assistant","content":"Hello"},"done":false}\n',
      '{"message":{"role":"assistant","content":" world"},"done":false}\n',
      '{"message":{"role":"assistant","content":""},"done":true}\n',
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    } as unknown as Response);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    const result = await provider.streamChat([userMsg], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"token":"Hello"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: {"token":" world"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(result.finalText).toBe('Hello world');
  });

  it('writes error event and [DONE] when fetch throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    const result = await provider.streamChat([userMsg], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"error":"ollama_unreachable"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(result.finalText).toBe('');
  });

  it('writes error event when Ollama returns non-ok status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValue({}),
    } as unknown as Response);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    const result = await provider.streamChat([userMsg], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"error":"ollama_error_404"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(result.finalText).toBe('');
  });

  it('stops writing when signal is aborted', async () => {
    const ctrl = new AbortController();
    const reader = makeReader([
      '{"message":{"role":"assistant","content":"Hi"},"done":false}\n',
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    } as unknown as Response);

    const mockRes = { write: jest.fn() };

    ctrl.abort();
    await provider.streamChat([userMsg], 'llama3.2', mockRes as any, ctrl.signal);

    expect(mockRes.write).not.toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('executes tool calls and loops back to Ollama', async () => {
    const task = { id: 42, title: 'Test task', status: 'TODO', priority: 1 };
    mockTasksService.create.mockResolvedValue(task);

    const reader = makeReader([
      JSON.stringify({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ function: { name: 'create_task', arguments: '{"title":"Test task","priority":1}' } }],
        },
        done: false,
      }) + '\n',
    ]);

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    } as unknown as Response);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'create a task' }], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolCall":{"name":"create_task","args":{"title":"Test task","priority":1}}}\n\n',
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolResult":{"name":"create_task","result":"Task #42 created: \\"Test task\\""}}\n\n',
    );
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('handles list_tasks with filtered results', async () => {
    const tasks = [
      { id: 1, title: 'Task A', status: 'TODO', priority: 0 },
      { id: 2, title: 'Task B', status: 'DONE', priority: 1 },
    ];
    mockTasksService.findAll.mockResolvedValue(tasks);

    const reader = makeReader([
      JSON.stringify({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ function: { name: 'list_tasks', arguments: '{"status":"TODO"}' } }],
        },
        done: false,
      }) + '\n',
    ]);

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    } as unknown as Response);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'list tasks' }], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolCall":{"name":"list_tasks","args":{"status":"TODO"}}}\n\n',
    );
    const resultCall = mockRes.write.mock.calls.find(
      (c: string[]) => c[0].includes('"toolResult"'),
    );
    expect(resultCall).toBeDefined();
    const resultPayload = JSON.parse(resultCall[0].replace('data: ', '').trim());
    expect(resultPayload.toolResult.name).toBe('list_tasks');
    expect(resultPayload.toolResult.result).toContain('Task A');
    expect(resultPayload.toolResult.result).not.toContain('Task B');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('handles search_knowledge results', async () => {
    const chunks = [{ filename: 'doc.md', text: 'relevant content' }];
    mockKnowledgeService.search.mockResolvedValue(chunks);

    const reader = makeReader([
      JSON.stringify({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ function: { name: 'search_knowledge', arguments: '{"query":"test"}' } }],
        },
        done: false,
      }) + '\n',
    ]);

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    } as unknown as Response);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'search test' }], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolCall":{"name":"search_knowledge","args":{"query":"test"}}}\n\n',
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolResult":{"name":"search_knowledge","result":"[doc.md]: relevant content"}}\n\n',
    );
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx jest src/agent/providers/ollama.provider.spec.ts --no-coverage
```

Expected: TypeScript errors / test failures due to old signature

- [ ] **Step 4: Update OllamaProvider implementation**

Replace `backend/src/agent/providers/ollama.provider.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { LLMProvider, OllamaMessage } from './llm-provider.interface';
import { SettingsService } from '../../settings/settings.service';
import { TasksService } from '../../tasks/tasks.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task in the task board',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          priority: { type: 'number', enum: [0, 1, 2], description: '0=low, 1=medium, 2=high' },
          description: { type: 'string', description: 'Optional description' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update a task status or priority',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Task ID' },
          status: { type: 'string', enum: ['TODO', 'PROCESSING', 'DONE', 'FAILED'] },
          priority: { type: 'number', enum: [0, 1, 2] },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'List all tasks, optionally filter by status',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['TODO', 'PROCESSING', 'DONE', 'FAILED'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: 'Search the knowledge base for relevant information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  },
];

@Injectable()
export class OllamaProvider implements LLMProvider {
  constructor(
    private readonly settings: SettingsService,
    private readonly tasksService: TasksService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  async streamChat(
    messages: OllamaMessage[],
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<{ finalText: string }> {
    if (signal.aborted) return { finalText: '' };

    const ollamaUrl = await this.settings.get('ollama.baseUrl', 'http://localhost:11434');

    const msgs: Array<Record<string, unknown>> = messages.map(m => ({ role: m.role, content: m.content }));

    const MAX_TOOL_CALLS = 10;
    let toolCallCount = 0;
    let finalText = '';

    while (!signal.aborted) {
      const body: Record<string, unknown> = { model, messages: msgs, stream: true };
      if (toolCallCount === 0) body.tools = TOOLS;

      let ollamaRes: globalThis.Response;
      try {
        ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });
      } catch {
        if (signal.aborted) return { finalText };
        res.write('data: {"error":"ollama_unreachable"}\n\n');
        res.write('data: [DONE]\n\n');
        return { finalText };
      }

      if (!ollamaRes.ok) {
        let detail = `ollama_error_${ollamaRes.status}`;
        try {
          const errBody = await ollamaRes.json() as { error?: string };
          if (errBody.error) detail = errBody.error;
        } catch { /* ignore */ }
        res.write(`data: ${JSON.stringify({ error: detail })}\n\n`);
        res.write('data: [DONE]\n\n');
        return { finalText };
      }

      const reader = ollamaRes.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let currentToolCalls: Array<{ function: { name: string; arguments: unknown } }> | null = null;
      let responseContent = '';

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
              responseContent += parsed.message.content;
              res.write(`data: ${JSON.stringify({ token: parsed.message.content })}\n\n`);
            }
            if (parsed.message?.tool_calls) {
              currentToolCalls = parsed.message.tool_calls;
            }
          } catch { /* skip malformed */ }
        }
      }

      if (signal.aborted) return { finalText };

      if (!currentToolCalls || currentToolCalls.length === 0) {
        currentToolCalls = this.detectTextToolCalls(responseContent);
      }

      const assistantMsg: Record<string, unknown> = { role: 'assistant', content: responseContent };
      if (currentToolCalls && currentToolCalls.length > 0) {
        assistantMsg.tool_calls = currentToolCalls.map(tc => ({
          function: {
            name: tc.function.name,
            arguments: typeof tc.function.arguments === 'string'
              ? tc.function.arguments
              : JSON.stringify(tc.function.arguments),
          },
        }));
      }
      msgs.push(assistantMsg);

      if (!currentToolCalls || currentToolCalls.length === 0 || toolCallCount >= MAX_TOOL_CALLS) {
        finalText = responseContent;
        break;
      }

      for (const tc of currentToolCalls) {
        if (signal.aborted) return { finalText };
        toolCallCount++;

        const name = tc.function.name;
        let args: Record<string, unknown> = {};
        if (typeof tc.function.arguments === 'string') {
          try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
        } else if (typeof tc.function.arguments === 'object' && tc.function.arguments !== null) {
          args = tc.function.arguments as Record<string, unknown>;
        }

        res.write(`data: ${JSON.stringify({ toolCall: { name, args } })}\n\n`);

        let result = '';
        try {
          result = await this.executeTool(name, args);
        } catch (e) {
          result = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
        }

        res.write(`data: ${JSON.stringify({ toolResult: { name, result } })}\n\n`);

        msgs.push({ role: 'tool', content: result });
      }

      currentToolCalls = null;
      responseContent = '';
    }

    if (!signal.aborted) {
      res.write('data: [DONE]\n\n');
    }

    return { finalText };
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'create_task': {
        const task = await this.tasksService.create({
          title: args.title as string,
          priority: args.priority as number | undefined,
          description: args.description as string | undefined,
        });
        return `Task #${task.id} created: "${task.title}"`;
      }
      case 'update_task': {
        const task = await this.tasksService.update(args.id as number, {
          status: args.status as string | undefined,
          priority: args.priority as number | undefined,
        });
        return `Task #${task.id} updated`;
      }
      case 'list_tasks': {
        const tasks = await this.tasksService.findAll();
        const filtered = args.status
          ? tasks.filter((t: { status: string }) => t.status === args.status)
          : tasks;
        if (filtered.length === 0) return 'No tasks found.';
        return filtered.map((t: { id: number; title: string; status: string; priority: number }) =>
          `#${t.id} ${t.title} [${t.status}] (priority: ${t.priority})`
        ).join('\n');
      }
      case 'search_knowledge': {
        const chunks = await this.knowledgeService.search(args.query as string);
        if (chunks.length === 0) return 'No relevant information found.';
        return chunks.map((c: { filename: string; text: string }) =>
          `[${c.filename}]: ${c.text}`
        ).join('\n---\n');
      }
      default:
        return `Unknown tool: ${name}`;
    }
  }

  private detectTextToolCalls(text: string): Array<{ function: { name: string; arguments: unknown } }> | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(trimmed) as { name?: string; arguments?: unknown };
      if (parsed.name && TOOLS.some(t => t.function.name === parsed.name)) {
        return [{ function: { name: parsed.name, arguments: parsed.arguments ?? {} } }];
      }
    } catch { /* not JSON */ }
    return null;
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest src/agent/providers/ollama.provider.spec.ts --no-coverage
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/src/agent/providers/llm-provider.interface.ts backend/src/agent/providers/ollama.provider.ts backend/src/agent/providers/ollama.provider.spec.ts
git commit -m "feat: update OllamaProvider to accept messages[] and return finalText"
```

---

## Task 6: AgentService + AgentController — wire sessions

**Files:**
- Modify: `backend/src/agent/dto/chat.dto.ts`
- Modify: `backend/src/agent/agent.service.ts`
- Modify: `backend/src/agent/agent.service.spec.ts`
- Modify: `backend/src/agent/agent.controller.ts`
- Modify: `backend/src/agent/agent.module.ts`

- [ ] **Step 1: Update ChatDto**

Replace `backend/src/agent/dto/chat.dto.ts`:

```typescript
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class ChatDto {
  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  sessionId: number;
}
```

- [ ] **Step 2: Write failing AgentService tests**

Replace `backend/src/agent/agent.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { SessionsService } from '../sessions/sessions.service';

describe('AgentService', () => {
  let service: AgentService;

  const mockProvider = { streamChat: jest.fn().mockResolvedValue({ finalText: 'Great response' }) };
  const mockSessionsService = {
    getHistory: jest.fn().mockResolvedValue([]),
    saveMessage: jest.fn().mockResolvedValue(undefined),
    autoTitle: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: OllamaProvider, useValue: mockProvider },
        { provide: SessionsService, useValue: mockSessionsService },
      ],
    }).compile();
    service = module.get(AgentService);
    jest.clearAllMocks();
  });

  it('loads history, builds messages array, calls provider', async () => {
    mockProvider.streamChat.mockResolvedValue({ finalText: 'Hello!' });
    mockSessionsService.getHistory.mockResolvedValue([{ role: 'user', content: 'Hi' }]);
    const mockRes = {} as any;
    const signal = new AbortController().signal;

    await service.streamChat('World', 'llama3.2', mockRes, signal, 1);

    expect(mockSessionsService.getHistory).toHaveBeenCalledWith(1);
    expect(mockProvider.streamChat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Hi' }, { role: 'user', content: 'World' }],
      'llama3.2',
      mockRes,
      signal,
    );
  });

  it('persists user message and assistant response after stream', async () => {
    mockProvider.streamChat.mockResolvedValue({ finalText: 'Hello!' });
    mockSessionsService.getHistory.mockResolvedValue([]);
    const signal = new AbortController().signal;

    await service.streamChat('World', 'llama3.2', {} as any, signal, 1);

    expect(mockSessionsService.saveMessage).toHaveBeenCalledWith(1, 'user', 'World');
    expect(mockSessionsService.saveMessage).toHaveBeenCalledWith(1, 'assistant', 'Hello!');
    expect(mockSessionsService.autoTitle).toHaveBeenCalledWith(1, 'World');
  });

  it('does not persist when signal is aborted before stream completes', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    mockProvider.streamChat.mockResolvedValue({ finalText: '' });
    mockSessionsService.getHistory.mockResolvedValue([]);

    await service.streamChat('msg', 'llama3.2', {} as any, ctrl.signal, 1);

    expect(mockSessionsService.saveMessage).not.toHaveBeenCalled();
    expect(mockSessionsService.autoTitle).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx jest src/agent/agent.service.spec.ts --no-coverage
```

Expected: failures due to missing `SessionsService` injection

- [ ] **Step 4: Update AgentService**

Replace `backend/src/agent/agent.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { OllamaProvider } from './providers/ollama.provider';
import { OllamaMessage } from './providers/llm-provider.interface';
import { SessionsService } from '../sessions/sessions.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly provider: OllamaProvider,
    private readonly sessionsService: SessionsService,
  ) {}

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
    sessionId: number,
  ): Promise<void> {
    const history = await this.sessionsService.getHistory(sessionId);
    const messages: OllamaMessage[] = [...history, { role: 'user', content: message }];

    const { finalText } = await this.provider.streamChat(messages, model, res, signal);

    if (!signal.aborted) {
      await this.sessionsService.saveMessage(sessionId, 'user', message);
      await this.sessionsService.saveMessage(sessionId, 'assistant', finalText);
      await this.sessionsService.autoTitle(sessionId, message);
    }
  }
}
```

- [ ] **Step 5: Update AgentController to pass sessionId**

Replace `backend/src/agent/agent.controller.ts`:

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
      await this.agentService.streamChat(
        dto.message,
        dto.model ?? 'llama3.2',
        res,
        ctrl.signal,
        dto.sessionId,
      );
    } catch {
      res.write('data: {"error":"internal_error"}\n\n');
    } finally {
      res.end();
    }
  }
}
```

- [ ] **Step 6: Update AgentModule to import SessionsModule**

Replace `backend/src/agent/agent.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { TasksModule } from '../tasks/tasks.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [TasksModule, KnowledgeModule, SessionsModule],
  controllers: [AgentController],
  providers: [AgentService, OllamaProvider],
})
export class AgentModule {}
```

- [ ] **Step 7: Run all backend tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add backend/src/agent/
git commit -m "feat: wire AgentService to SessionsService — load history, persist messages"
```

---

## Task 7: i18n — add sessions.* locale keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add keys to vi.json**

Add the following keys inside `frontend/src/locales/vi.json` (before the closing `}`):

```json
  "sessions.header": "SESSIONS",
  "sessions.new": "+ Mới",
  "sessions.empty": "Chưa có session nào",
  "sessions.messages": "{n} tin nhắn",
  "sessions.delete.confirm": "Xóa session này?"
```

- [ ] **Step 2: Add keys to en.json**

Add the following keys inside `frontend/src/locales/en.json` (before the closing `}`):

```json
  "sessions.header": "SESSIONS",
  "sessions.new": "+ New",
  "sessions.empty": "No sessions yet",
  "sessions.messages": "{n} messages",
  "sessions.delete.confirm": "Delete this session?"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add sessions.* i18n keys for vi and en locales"
```

---

## Task 8: SessionModal.vue — session list modal component

**Files:**
- Create: `frontend/src/components/SessionModal.vue`

- [ ] **Step 1: Create SessionModal.vue**

Create `frontend/src/components/SessionModal.vue`:

```vue
<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-cyber-dark/80 z-50 flex items-center justify-center"
      @click.self="$emit('update:modelValue', false)"
    >
      <div class="w-80 bg-cyber-bg border border-cyber-border flex flex-col max-h-[480px]">
        <div class="px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0">
          <span class="text-cyber-accent text-xs font-mono tracking-widest">{{ t('sessions.header') }}</span>
          <div class="flex items-center gap-2">
            <button
              @click="createSession"
              class="text-cyber-accent/70 text-xs font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent"
            >{{ t('sessions.new') }}</button>
            <button
              @click="$emit('update:modelValue', false)"
              class="text-cyber-accent/50 text-xs font-mono transition-colors duration-150 hover:text-cyber-accent"
            >✕</button>
          </div>
        </div>

        <div class="overflow-y-auto flex-1">
          <div v-if="sessions.length === 0" class="px-3 py-4 text-xs text-cyber-accent/40 font-mono">
            {{ t('sessions.empty') }}
          </div>
          <div
            v-for="s in sessions"
            :key="s.id"
            class="px-3 py-2 border-b border-cyber-border flex items-center justify-between cursor-pointer transition-colors duration-150 hover:bg-cyber-dark"
            :class="s.id === currentSessionId
              ? 'border-l-2 border-l-cyber-accent'
              : 'border-l-2 border-l-transparent'"
            @click="selectSession(s.id)"
          >
            <div class="min-w-0 flex-1">
              <div class="text-xs font-mono text-slate-100 truncate">{{ s.title }}</div>
              <div class="text-[10px] font-mono text-cyber-accent/40 mt-0.5">
                {{ formatDate(s.createdAt) }} · {{ t('sessions.messages', { n: s._count.messages }) }}
              </div>
            </div>
            <button
              @click.stop="deleteSession(s.id)"
              class="text-cyber-accent/30 text-xs font-mono ml-2 shrink-0 transition-colors duration-150 hover:text-red-400"
            >✕</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface SessionItem {
  id: number
  title: string
  createdAt: string
  _count: { messages: number }
}

const props = defineProps<{
  modelValue: boolean
  currentSessionId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', sessionId: number): void
  (e: 'created', sessionId: number): void
}>()

const { t } = useI18n()
const sessions = ref<SessionItem[]>([])

async function fetchSessions() {
  try {
    const res = await fetch('/api/sessions')
    if (!res.ok) return
    sessions.value = (await res.json()) as SessionItem[]
  } catch { /* ignore fetch errors */ }
}

async function createSession() {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) return
    const session = (await res.json()) as SessionItem
    await fetchSessions()
    emit('created', session.id)
    emit('update:modelValue', false)
  } catch { /* ignore */ }
}

async function deleteSession(id: number) {
  if (!confirm(t('sessions.delete.confirm'))) return
  try {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    await fetchSessions()
    if (id === props.currentSessionId) {
      const first = sessions.value[0]
      if (first) emit('select', first.id)
    }
  } catch { /* ignore */ }
}

function selectSession(id: number) {
  emit('select', id)
  emit('update:modelValue', false)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN')
}

watch(() => props.modelValue, (val) => {
  if (val) fetchSessions()
})
</script>
```

- [ ] **Step 2: Verify TypeScript — run type check**

```bash
cd frontend
npm run type-check
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SessionModal.vue
git commit -m "feat: add SessionModal component with session list, create, delete, resume"
```

---

## Task 9: ChatPanel.vue — session button + loadSession + markdown rendering

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Replace ChatPanel.vue with updated version**

Replace the entire `frontend/src/components/ChatPanel.vue`:

```vue
<template>
  <div class="flex flex-col bg-cyber-bg min-w-0">
    <div class="px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-cyber-accent text-xs tracking-widest font-mono">
          <HiTerminal class="w-3 h-3 inline" /> {{ t('chat.header') }}
        </span>
        <ModelSelector
          v-model="selectedModel"
          :models="availableModels"
          :disabled="streaming"
        />
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="showSessionModal = true"
          class="text-cyber-accent/70 text-xs font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent"
        >{{ t('sessions.header') }}</button>
        <button
          v-if="streaming"
          @click="stopStream"
          class="text-cyber-accent/80 text-xs font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent"
        >{{ t('chat.stop') }}</button>
        <span class="text-[#888888] text-xs font-mono">
          {{ ollamaOnline ? t('chat.mode.ollama') : t('chat.mode.stub') }}
        </span>
      </div>
    </div>

    <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
      <div v-for="(msg, i) in messages" :key="i" class="font-mono">

        <!-- Thinking block -->
        <div v-if="msg.role === 'system' && (msg.content === '⟳ thinking...' || msg.content === '⟳ đang nghĩ...')"
          class="border-l-2 border-cyber-accent/30 pl-3 py-1">
          <div class="text-xs text-cyber-accent/60 font-mono">⟳ {{ msg.content.replace('⟳ ', '') }}</div>
        </div>

        <!-- Tool call block -->
        <div v-else-if="msg.role === 'tool' && !msg.isResult"
          class="border-l-2 border-[#FFA500]/50 pl-3 py-1.5">
          <div class="text-[11px] text-[#FFA500] font-mono mb-0.5">[⚙] {{ msg.content }}</div>
        </div>

        <!-- Tool result block -->
        <div v-else-if="msg.role === 'tool' && msg.isResult"
          class="border-l-2 border-cyber-green/50 pl-3 py-1.5">
          <div class="text-[11px] text-cyber-green font-mono">{{ msg.content }}</div>
        </div>

        <!-- Agent answer block (markdown rendered) -->
        <div v-else-if="msg.role === 'agent'"
          class="border-l-2 border-cyber-accent/20 pl-3 py-1">
          <div class="text-xs text-cyber-accent/60 mb-0.5 font-mono">
            <HiChevronRight class="w-3 h-3 inline" /> {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
          </div>
          <div
            v-if="msg.typing"
            class="text-sm leading-relaxed break-words text-[#EEEEEE]"
          >{{ msg.content }}<span class="animate-blink text-cyber-accent ml-px">&#9608;</span></div>
          <div
            v-else
            class="text-sm leading-relaxed break-words text-[#EEEEEE] markdown-body"
            v-html="renderMarkdown(msg.content)"
          />
        </div>

        <!-- User message block -->
        <div v-else-if="msg.role === 'user'"
          class="border-l-2 border-cyber-accent/20 pl-3 py-1">
          <div class="text-xs text-cyber-accent/80 mb-0.5 font-mono">{{ rolePrefix(msg.role) }} · {{ msg.timestamp }}</div>
          <div class="text-sm leading-relaxed break-words text-[#EEEEEE]">{{ msg.content }}</div>
        </div>

        <!-- System message (other) -->
        <div v-else-if="msg.role === 'system'"
          class="pl-3 py-0.5">
          <div class="text-xs text-[#888888] font-mono">{{ msg.content }}</div>
        </div>

      </div>
    </div>

    <div class="px-3 py-2 bg-cyber-dark shrink-0">
      <form @submit.prevent="submit" class="flex items-center gap-2 bg-cyber-dark px-3 py-2">
        <span class="text-cyber-accent text-sm font-mono">$</span>
        <span v-if="!streaming" class="animate-blink text-[#EEEEEE] text-sm">█</span>
        <input
          ref="inputEl"
          v-model="input"
          class="flex-1 bg-transparent text-[#EEEEEE] text-sm outline-none font-mono placeholder-[#888888]/40 caret-white"
          :placeholder="t('chat.placeholder')"
          :disabled="streaming"
          autocomplete="off"
          spellcheck="false"
        />
      </form>
    </div>

    <SessionModal
      v-model="showSessionModal"
      :currentSessionId="currentSessionId"
      @select="loadSession"
      @created="loadSession"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { HiTerminal, HiChevronRight } from 'vue-icons-plus/hi'
import ModelSelector from './ModelSelector.vue'
import SessionModal from './SessionModal.vue'

interface Message {
  role: 'user' | 'agent' | 'system' | 'tool'
  content: string
  timestamp: string
  typing?: boolean
  toolName?: string
  isResult?: boolean
}

interface DbMessage {
  id: number
  sessionId: number
  role: string
  content: string
  createdAt: string
}

const { t } = useI18n()

const messages = ref<Message[]>([
  { role: 'system', content: t('chat.system.init'), timestamp: now() },
])
const input = ref('')
const streaming = ref(false)
const selectedModel = ref(localStorage.getItem('workspace.model') ?? 'llama3.2')
const availableModels = ref<string[]>([])
const ollamaOnline = ref(true)
const abortController = ref<AbortController | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const messagesEl = ref<HTMLElement | null>(null)
const currentSessionId = ref<number | null>(null)
const showSessionModal = ref(false)

function now(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false })
}

function rolePrefix(role: string): string {
  if (role === 'user') return t('chat.user.prefix')
  if (role === 'agent') return t('chat.agent.prefix')
  if (role === 'system') return t('chat.system.prefix')
  return ''
}

function renderMarkdown(content: string): string {
  try {
    return DOMPurify.sanitize(marked.parse(content) as string)
  } catch {
    return DOMPurify.sanitize(content)
  }
}

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

async function loadSession(sessionId: number) {
  currentSessionId.value = sessionId
  try {
    const res = await fetch(`/api/sessions/${sessionId}/messages`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const dbMessages = (await res.json()) as DbMessage[]
    messages.value = [
      { role: 'system', content: t('chat.system.init'), timestamp: now() },
      ...dbMessages.map((m) => ({
        role: (m.role === 'assistant' ? 'agent' : m.role) as Message['role'],
        content: m.content,
        timestamp: new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
      })),
    ]
    await scrollToBottom()
  } catch {
    messages.value.push({
      role: 'system',
      content: t('chat.error.unreachable'),
      timestamp: now(),
    })
  }
}

onMounted(async () => {
  inputEl.value?.focus()

  try {
    const sessionRes = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (sessionRes.ok) {
      const session = (await sessionRes.json()) as { id: number }
      currentSessionId.value = session.id
    }
  } catch { /* ignore — session creation failed, submit guard handles null */ }

  try {
    const res = await fetch('/api/ollama/models')
    if (!res.ok) throw new Error('fetch failed')
    const models = (await res.json()) as string[]
    availableModels.value = models
    if (models.length > 0 && !models.includes(selectedModel.value)) {
      selectedModel.value = models[0]
    }
  } catch {
    ollamaOnline.value = false
  }
})

watch(selectedModel, (val) => {
  localStorage.setItem('workspace.model', val)
})

function stopStream() {
  abortController.value?.abort()
}

async function submit() {
  const text = input.value.trim()
  if (!text || streaming.value || currentSessionId.value === null) return
  input.value = ''
  streaming.value = true

  messages.value.push({ role: 'user', content: text, timestamp: now() })
  await scrollToBottom()

  const ctrl = new AbortController()
  abortController.value = ctrl

  const thinkingMsg: Message = { role: 'system', content: t('chat.thinking'), timestamp: now() }
  messages.value.push(thinkingMsg)
  await scrollToBottom()

  const agentMsg: Message = { role: 'agent', content: '', timestamp: now(), typing: true }
  const msgIdx = messages.value.length
  messages.value.push(agentMsg)
  await scrollToBottom()

  function clearThinking() {
    const idx = messages.value.indexOf(thinkingMsg)
    if (idx !== -1) messages.value[idx].content = ''
  }

  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        model: selectedModel.value,
        sessionId: currentSessionId.value,
      }),
      signal: ctrl.signal,
    })

    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let done = false

    while (!done) {
      const { done: streamDone, value } = await reader.read()
      if (streamDone) break

      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') { done = true; break }
        try {
          const parsed = JSON.parse(payload) as Record<string, unknown>

          if (parsed.error) {
            done = true
            agentMsg.typing = false
            messages.value.push({
              role: 'system',
              content: `${t('chat.error.unreachable')} (${String(parsed.error)})`,
              timestamp: now(),
            })
            await scrollToBottom()
          } else if (parsed.toolCall) {
            clearThinking()
            const tc = parsed.toolCall as { name: string; args: Record<string, unknown> }
            const argsStr = Object.entries(tc.args).map(([k, v]) => `${k}=${v}`).join(', ')
            messages.value.push({
              role: 'tool',
              content: `${tc.name}(${argsStr})`,
              timestamp: now(),
              toolName: tc.name,
              isResult: false,
            })
            await scrollToBottom()
          } else if (parsed.toolResult) {
            const tr = parsed.toolResult as { name: string; result: string }
            messages.value.push({
              role: 'tool',
              content: tr.result,
              timestamp: now(),
              toolName: tr.name,
              isResult: true,
            })
            await scrollToBottom()
          } else if (parsed.token) {
            clearThinking()
            messages.value[msgIdx].content += String(parsed.token)
            if (!done) scrollToBottom()
          }
        } catch { /* skip malformed SSE line */ }
      }
    }

    messages.value[msgIdx].typing = false
    await scrollToBottom()
  } catch (e) {
    messages.value[msgIdx].typing = false
    if (e instanceof Error && e.name !== 'AbortError') {
      messages.value.push({
        role: 'system',
        content: `${t('chat.error.unreachable')} (${e.message})`,
        timestamp: now(),
      })
      await scrollToBottom()
    }
  } finally {
    clearThinking()
    streaming.value = false
    abortController.value = null
  }
}
</script>
```

- [ ] **Step 2: Run frontend type check**

```bash
cd frontend
npm run type-check
```

Expected: no TypeScript errors

- [ ] **Step 3: Start dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:5173`. Verify:
1. Chat loads with a new session created automatically (no console errors)
2. "SESSIONS" button appears in header — click opens modal with current session listed
3. "+ Mới" in modal creates a new session, switches to it, clears chat
4. Send a message — history appears in session, tool calls render in orange, agent replies render markdown
5. Switch to previous session in modal — old messages load correctly
6. Reload page — new session created fresh (previous sessions still in modal)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: add session button, loadSession, markdown rendering to ChatPanel"
```

---

## Task 10: Final integration check

- [ ] **Step 1: Run all backend tests**

```bash
cd backend
npx jest --no-coverage
```

Expected: all tests pass, zero failures

- [ ] **Step 2: Run frontend type check**

```bash
cd frontend
npm run type-check
```

Expected: no errors

- [ ] **Step 3: Commit summary**

```bash
git log --oneline -8
```

Verify the 8 commits are present in order: schema → service → controller → module → provider → agent → i18n → modal → chat panel
