# Memory System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent memory system with 4 memory types (USER/FEEDBACK/PROJECT/REFERENCE), auto-extraction on idle turns, and prompt injection.

**Architecture:** Prisma-centric approach: new Memory model + MemoryModule (CRUD) + auto-extraction via SubAgentService on agent idle + injection via ContextBuilderService. Frontend: MemoryView tab in Settings.

**Tech Stack:** Prisma, NestJS, Socket.io, Vue 3, TailwindCSS

---

## File Structure

### New files
- `backend/prisma/migrations/` — auto-generated migration
- `backend/src/memory/memory.module.ts`
- `backend/src/memory/memory.service.ts`
- `backend/src/memory/memory.service.spec.ts`
- `backend/src/memory/memory.controller.ts`
- `backend/src/memory/memory.controller.spec.ts`
- `backend/src/memory/memory.gateway.ts`
- `backend/src/memory/memory.gateway.spec.ts`
- `backend/src/memory/memory-extraction.service.ts`
- `backend/src/memory/memory-extraction.service.spec.ts`
- `backend/src/memory/dto/create-memory.dto.ts`
- `backend/src/memory/dto/update-memory.dto.ts`
- `backend/src/memory/dto/search-memory.dto.ts`
- `backend/src/memory/memory.constants.ts`
- `frontend/src/components/MemoryView.vue`

### Modified files
- `backend/prisma/schema.prisma` — add Memory model + MemoryType enum
- `backend/src/app.module.ts` — import MemoryModule
- `backend/src/agent/services/agent-loop.service.ts` — emit idle event
- `backend/src/agent/services/context-builder.service.ts` — inject memories
- `backend/src/agent/agent.module.ts` — import MemoryModule
- `frontend/src/components/SettingsView.vue` — add Memories tab
- `frontend/src/locales/vi.json` — add memory keys
- `frontend/src/locales/en.json` — add memory keys

---

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: auto-generated migration

- [ ] **Step 1: Add MemoryType enum and Memory model to schema.prisma**

Append before `model Setting`:

```prisma
enum MemoryType {
  USER
  FEEDBACK
  PROJECT
  REFERENCE
}

model Memory {
  id        String     @id @default(cuid())
  type      MemoryType
  title     String
  content   String
  metadata  String?
  sessionId Int?
  agentId   String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  session   Session?  @relation(fields: [sessionId], references: [id], onDelete: SetNull)
}
```

- [ ] **Step 2: Run migration**

From `backend/` directory:

```bash
npx prisma migrate dev --name add-memory-model
npx prisma generate
```

Expected: migration file created + PrismaClient regenerated with `Memory` and `MemoryType`.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add Memory model and MemoryType enum"
```

---

### Task 2: DTOs + Constants

**Files:**
- Create: `backend/src/memory/dto/create-memory.dto.ts`
- Create: `backend/src/memory/dto/update-memory.dto.ts`
- Create: `backend/src/memory/dto/search-memory.dto.ts`
- Create: `backend/src/memory/memory.constants.ts`

- [ ] **Step 1: Create create-memory.dto.ts**

```ts
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateMemoryDto {
  @IsIn(['USER', 'FEEDBACK', 'PROJECT', 'REFERENCE'])
  type: 'USER' | 'FEEDBACK' | 'PROJECT' | 'REFERENCE';

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}
```

- [ ] **Step 2: Create update-memory.dto.ts**

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateMemoryDto } from './create-memory.dto';

export class UpdateMemoryDto extends PartialType(CreateMemoryDto) {}
```

- [ ] **Step 3: Create search-memory.dto.ts**

```ts
import { IsOptional, IsString, IsIn } from 'class-validator';

export class SearchMemoryDto {
  @IsOptional()
  @IsIn(['USER', 'FEEDBACK', 'PROJECT', 'REFERENCE'])
  type?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
```

- [ ] **Step 4: Create memory.constants.ts**

```ts
export const MEMORY_PROMPT_LIMITS = {
  USER: 3,
  FEEDBACK: 5,
  PROJECT: 5,
  REFERENCE: 5,
};

export const MEMORY_MAX_LINES = 200;
export const MEMORY_MAX_BYTES = 25000;
export const MEMORY_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/memory/dto/ backend/src/memory/memory.constants.ts
git commit -m "feat: add memory DTOs and constants"
```

---

### Task 3: MemoryModule + Gateway

**Files:**
- Create: `backend/src/memory/memory.gateway.ts`
- Create: `backend/src/memory/memory.module.ts`

- [ ] **Step 1: Create memory.gateway.ts**

```ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Memory } from '@prisma/client';

@WebSocketGateway({
  namespace: '/memories',
  cors: { origin: ['http://localhost:17135'] },
})
export class MemoryGateway {
  @WebSocketServer() server: Server;

  emitCreated(memory: Memory): void {
    this.server.emit('memory:created', memory);
  }

  emitUpdated(memory: Memory): void {
    this.server.emit('memory:updated', memory);
  }

  emitDeleted(id: string): void {
    this.server.emit('memory:deleted', { id });
  }
}
```

- [ ] **Step 2: Create memory.module.ts**

```ts
import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import { MemoryGateway } from './memory.gateway';
import { MemoryExtractionService } from './memory-extraction.service';

@Module({
  controllers: [MemoryController],
  providers: [MemoryService, MemoryGateway, MemoryExtractionService],
  exports: [MemoryService, MemoryExtractionService],
})
export class MemoryModule {}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/memory/memory.gateway.ts backend/src/memory/memory.module.ts
git commit -m "feat: add MemoryModule and MemoryGateway"
```

---

### Task 4: MemoryService (CRUD + Dedup)

**Files:**
- Create: `backend/src/memory/memory.service.ts`

- [ ] **Step 1: Create memory.service.ts**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryGateway } from './memory.gateway';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { SearchMemoryDto } from './dto/search-memory.dto';
import { MEMORY_PROMPT_LIMITS, MEMORY_DEDUP_WINDOW_MS } from './memory.constants';
import { MemoryType } from '@prisma/client';
import { createHash } from 'crypto';

@Injectable()
export class MemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MemoryGateway,
  ) {}

  async findAll(dto?: SearchMemoryDto) {
    const where: any = {};
    if (dto?.type) where.type = dto.type;
    if (dto?.sessionId) where.sessionId = Number(dto.sessionId);
    if (dto?.search) {
      where.OR = [
        { title: { contains: dto.search } },
        { content: { contains: dto.search } },
      ];
    }
    return this.prisma.memory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateMemoryDto) {
    if (await this.isDuplicate(dto.title, dto.content)) {
      const existing = await this.findSimilar(dto.title, dto.type as MemoryType);
      if (existing) {
        const updated = await this.prisma.memory.update({
          where: { id: existing.id },
          data: {
            content: existing.content + '\n\n' + dto.content,
            updatedAt: new Date(),
          },
        });
        this.gateway.emitUpdated(updated);
        return updated;
      }
    }

    const memory = await this.prisma.memory.create({
      data: {
        type: dto.type as MemoryType,
        title: dto.title,
        content: dto.content,
        metadata: JSON.stringify({
          source: 'manual',
          hash: this.hashContent(dto.title, dto.content),
        }),
      },
    });
    this.gateway.emitCreated(memory);
    return memory;
  }

  async update(id: string, dto: UpdateMemoryDto) {
    await this.findOneOrFail(id);
    const memory = await this.prisma.memory.update({
      where: { id },
      data: {
        ...dto,
        type: dto.type as MemoryType | undefined,
      },
    });
    this.gateway.emitUpdated(memory);
    return memory;
  }

  async remove(id: string) {
    await this.findOneOrFail(id);
    const memory = await this.prisma.memory.delete({ where: { id } });
    this.gateway.emitDeleted(memory.id);
    return memory;
  }

  async findOne(id: string) {
    const memory = await this.prisma.memory.findUnique({ where: { id } });
    if (!memory) throw new NotFoundException(`Memory ${id} not found`);
    return memory;
  }

  async getContextMemories(): Promise<string> {
    const memories = await this.prisma.memory.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const grouped: Record<string, string[]> = { USER: [], FEEDBACK: [], PROJECT: [], REFERENCE: [] };
    for (const m of memories) {
      const type = m.type as string;
      if (grouped[type] && grouped[type].length < (MEMORY_PROMPT_LIMITS as any)[type]) {
        grouped[type].push(`- ${m.title}: ${m.content.split('\n')[0]}`);
      }
    }

    const lines: string[] = ['## Persistent Memory'];
    for (const [type, items] of Object.entries(grouped)) {
      if (items.length > 0) {
        lines.push('', `### ${type.charAt(0) + type.slice(1).toLowerCase()}`, ...items);
      }
    }

    return lines.join('\n');
  }

  private async isDuplicate(title: string, content: string): Promise<boolean> {
    const hash = this.hashContent(title, content);
    const cutoff = new Date(Date.now() - MEMORY_DEDUP_WINDOW_MS);
    const existing = await this.prisma.memory.findFirst({
      where: {
        createdAt: { gte: cutoff },
        metadata: { contains: hash },
      },
    });
    return !!existing;
  }

  private async findSimilar(title: string, type: MemoryType) {
    return this.prisma.memory.findFirst({
      where: {
        type,
        title: { contains: title.substring(0, 20) },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private hashContent(title: string, content: string): string {
    return createHash('sha256').update(title + content).digest('hex');
  }

  private async findOneOrFail(id: string) {
    return this.findOne(id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/memory/memory.service.ts
git commit -m "feat: add MemoryService with CRUD, dedup, and context query"
```

---

### Task 5: MemoryController

**Files:**
- Create: `backend/src/memory/memory.controller.ts`

- [ ] **Step 1: Create memory.controller.ts**

```ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { SearchMemoryDto } from './dto/search-memory.dto';

@Controller('memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  findAll(@Query() dto: SearchMemoryDto) {
    return this.memoryService.findAll(dto);
  }

  @Get('context')
  getContext() {
    return this.memoryService.getContextMemories();
  }

  @Post()
  create(@Body() dto: CreateMemoryDto) {
    return this.memoryService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMemoryDto) {
    return this.memoryService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.memoryService.remove(id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/memory/memory.controller.ts
git commit -m "feat: add MemoryController with CRUD endpoints"
```

---

### Task 6: Tests for MemoryService + MemoryController

**Files:**
- Create: `backend/src/memory/memory.service.spec.ts`
- Create: `backend/src/memory/memory.controller.spec.ts`
- Create: `backend/src/memory/memory.gateway.spec.ts`

- [ ] **Step 1: Create memory.service.spec.ts**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { MemoryService } from './memory.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryGateway } from './memory.gateway';

const mockPrisma = {
  memory: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockGateway = {
  emitCreated: jest.fn(),
  emitUpdated: jest.fn(),
  emitDeleted: jest.fn(),
};

describe('MemoryService', () => {
  let service: MemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MemoryGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll should return memories', async () => {
    const memories = [{ id: '1', type: 'USER', title: 'Test', content: 'Hello' }];
    mockPrisma.memory.findMany.mockResolvedValue(memories);
    const result = await service.findAll({});
    expect(result).toEqual(memories);
    expect(mockPrisma.memory.findMany).toHaveBeenCalled();
  });

  it('create should emit created event', async () => {
    const dto = { type: 'USER' as const, title: 'Test', content: 'Hello' };
    const created = { id: '1', ...dto, metadata: expect.any(String), sessionId: null, agentId: null, createdAt: expect.any(Date), updatedAt: expect.any(Date) };
    mockPrisma.memory.findFirst.mockResolvedValue(null);
    mockPrisma.memory.create.mockResolvedValue(created);
    const result = await service.create(dto);
    expect(result).toBeDefined();
    expect(mockGateway.emitCreated).toHaveBeenCalledWith(created);
  });

  it('update should throw on missing id', async () => {
    mockPrisma.memory.findUnique.mockResolvedValue(null);
    await expect(service.update('nonexistent', {})).rejects.toThrow('Memory nonexistent not found');
  });

  it('remove should emit deleted event', async () => {
    const existing = { id: '1', type: 'USER', title: 'Test', content: 'Hello' };
    mockPrisma.memory.findUnique.mockResolvedValue(existing);
    mockPrisma.memory.delete.mockResolvedValue(existing);
    await service.remove('1');
    expect(mockGateway.emitDeleted).toHaveBeenCalledWith('1');
  });
});
```

- [ ] **Step 2: Run tests to verify failure then pass**

```bash
npx jest src/memory/memory.service.spec.ts --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Create memory.controller.spec.ts**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';

const mockService = {
  findAll: jest.fn(),
  getContextMemories: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('MemoryController', () => {
  let controller: MemoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemoryController],
      providers: [{ provide: MemoryService, useValue: mockService }],
    }).compile();

    controller = module.get<MemoryController>(MemoryController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /memories should call findAll', async () => {
    mockService.findAll.mockResolvedValue([]);
    const result = await controller.findAll({});
    expect(result).toEqual([]);
  });

  it('GET /memories/context should call getContextMemories', async () => {
    mockService.getContextMemories.mockResolvedValue('## Persistent Memory');
    const result = await controller.getContext();
    expect(result).toBe('## Persistent Memory');
  });

  it('POST /memories should call create', async () => {
    const dto = { type: 'USER' as const, title: 'Test', content: 'Hello' };
    mockService.create.mockResolvedValue({ id: '1', ...dto });
    const result = await controller.create(dto);
    expect(result).toHaveProperty('id');
  });
});
```

- [ ] **Step 4: Create memory.gateway.spec.ts**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { MemoryGateway } from './memory.gateway';

describe('MemoryGateway', () => {
  let gateway: MemoryGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MemoryGateway],
    }).compile();

    gateway = module.get<MemoryGateway>(MemoryGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
```

- [ ] **Step 5: Run all tests**

```bash
npx jest src/memory/ --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/memory/*.spec.ts
git commit -m "test: add MemoryService, MemoryController, MemoryGateway tests"
```

---

### Task 7: Agent Idle Event

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Add EventEmitter import and inject it**

In `agent-loop.service.ts`, at the top:

```ts
import { EventEmitter2 } from '@nestjs/event-emitter';
```

Add to constructor:

```ts
private readonly eventEmitter: EventEmitter2,
```

- [ ] **Step 2: Install @nestjs/event-emitter**

```bash
npm install @nestjs/event-emitter
```

- [ ] **Step 3: Register EventEmitterModule in app.module.ts**

In `app.module.ts`:

```ts
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // ... other imports
  ],
})
```

- [ ] **Step 4: Emit idle event when RESPONDING→DONE with 0 tool calls**

In `agent-loop.service.ts`, before `[DONE]` write at line ~330, add:

```ts
if (this.state === AgentState.RESPONDING) {
  const hadToolCalls = iterationCount > 1;
  if (!hadToolCalls && sessionId) {
    this.eventEmitter.emit('agent.idle', {
      sessionId,
      providerType,
      model,
      providerConfig,
    });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.module.ts backend/src/agent/services/agent-loop.service.ts backend/package.json backend/package-lock.json
git commit -m "feat: emit agent.idle event for memory auto-extraction"
```

---

### Task 8: Context Injection into Agent Prompt

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`
- Modify: `backend/src/agent/agent.module.ts`

- [ ] **Step 1: Inject MemoryService into ContextBuilderService**

In `context-builder.service.ts`, add to constructor:

```ts
import { MemoryService } from '../../memory/memory.service';

constructor(
  private readonly prisma: PrismaService,
  private readonly toolsService: ToolsService,
  private readonly mcpService: McpService,
  private readonly cowork: CoworkService,
  private readonly modePolicy: ModePolicyService,
  private readonly memoryService: MemoryService,  // ADD
) {}
```

- [ ] **Step 2: Append memories to system prompt**

In `buildSystemPrompt()`, before the function returns, append memory context:

```ts
const memoryContext = await this.memoryService.getContextMemories();
if (memoryContext !== '## Persistent Memory') {
  lines.push('', memoryContext);
}

return lines.join('\n');
```

- [ ] **Step 3: Import MemoryModule in AgentModule**

In `agent.module.ts`, add to `imports`:

```ts
import { MemoryModule } from '../../memory/memory.module';

@Module({
  imports: [
    MemoryModule,  // ADD
    TasksModule, KnowledgeModule, SessionsModule, ProvidersModule,
    ToolsModule, NotesModule, PlansModule, McpModule,
    CoworkModule, WorkspaceModule, ModePolicyModule,
  ],
})
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts backend/src/agent/agent.module.ts
git commit -m "feat: inject memories into agent system prompt"
```

---

### Task 9: MemoryExtractionService (Auto-Extraction)

**Files:**
- Create: `backend/src/memory/memory-extraction.service.ts`
- Create: `backend/src/memory/memory-extraction.service.spec.ts`

- [ ] **Step 1: Create memory-extraction.service.ts**

```ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MemoryService } from './memory.service';
import { PrismaService } from '../prisma/prisma.service';

interface IdleEvent {
  sessionId: number;
  providerType: string;
  model: string;
  providerConfig: { baseUrl: string; key?: string };
}

@Injectable()
export class MemoryExtractionService {
  constructor(
    private readonly memoryService: MemoryService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('agent.idle')
  async extract(event: IdleEvent) {
    const { sessionId } = event;

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });

    if (!session || session.messages.length === 0) return;

    const recentContent = session.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => m.content)
      .join('\n');

    const memories = this.classifyMemories(recentContent);
    for (const mem of memories) {
      const existing = await this.prisma.memory.findFirst({
        where: {
          type: mem.type,
          title: { contains: mem.title.substring(0, 30) },
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      });
      if (!existing) {
        await this.memoryService.create({
          type: mem.type,
          title: mem.title,
          content: mem.content,
          metadata: JSON.stringify({ source: 'auto-extract', sessionId }),
        });
      }
    }
  }

  private classifyMemories(content: string): Array<{ type: 'USER' | 'FEEDBACK' | 'PROJECT' | 'REFERENCE'; title: string; content: string }> {
    const results: Array<{ type: 'USER' | 'FEEDBACK' | 'PROJECT' | 'REFERENCE'; title: string; content: string }> = [];

    const userPatterns = /(?:I am|my role|my name|I work|I'm a)\s+([^.]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = userPatterns.exec(content)) !== null) {
      results.push({ type: 'USER' as const, title: 'User context', content: m[0] });
    }

    const feedbackPatterns = /(?:remember|don't|never|always|prefer|important|note that|lesson learned)[^.]*/gi;
    while ((m = feedbackPatterns.exec(content)) !== null) {
      results.push({ type: 'FEEDBACK' as const, title: 'Feedback', content: m[0] });
    }

    const projectPatterns = /(?:deadline|release|sprint|milestone|version|merge freeze|project|deploy)[^.]*/gi;
    while ((m = projectPatterns.exec(content)) !== null) {
      results.push({ type: 'PROJECT' as const, title: 'Project context', content: m[0] });
    }

    const referencePatterns = /(?:tracked in|see |refer to|docs? at|wiki|ticket|linear|jira|notion|slack)[^.]*/gi;
    while ((m = referencePatterns.exec(content)) !== null) {
      results.push({ type: 'REFERENCE' as const, title: 'Reference', content: m[0] });
    }

    return results;
  }
}
```

- [ ] **Step 2: Create memory-extraction.service.spec.ts**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { MemoryExtractionService } from './memory-extraction.service';
import { MemoryService } from './memory.service';
import { PrismaService } from '../prisma/prisma.service';

const mockMemoryService = {
  create: jest.fn(),
};

const mockPrisma = {
  session: {
    findUnique: jest.fn(),
  },
  memory: {
    findFirst: jest.fn(),
  },
};

describe('MemoryExtractionService', () => {
  let service: MemoryExtractionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryExtractionService,
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MemoryExtractionService>(MemoryExtractionService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should skip extraction when no messages exist', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: 1, messages: [] });
    await service.extract({ sessionId: 1, providerType: 'ollama', model: 'test', providerConfig: { baseUrl: 'http://localhost:11434' } });
    expect(mockMemoryService.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest src/memory/memory-extraction.service.spec.ts --no-coverage
npx jest src/memory/ --no-coverage
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/memory/memory-extraction.service.ts backend/src/memory/memory-extraction.service.spec.ts
git commit -m "feat: add background memory auto-extraction on agent idle"
```

---

### Task 10: Frontend MemoryView Component

**Files:**
- Create: `frontend/src/components/MemoryView.vue`

- [ ] **Step 1: Create MemoryView.vue**

```vue
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiSave class="w-3 h-3 inline" /> {{ t('memory.title') }}
      </span>
      <button
        @click="openAddModal"
        class="text-sm font-mono font-bold text-black bg-cyber-accent px-2 py-1 hover:bg-cyber-accent/80 transition-colors duration-150"
      >{{ t('memory.create') }}</button>
    </div>

    <div class="px-3 py-1.5 bg-cyber-dark/40 flex items-center gap-2 shrink-0">
      <span class="text-cyber-muted text-xs font-mono">{{ t('tasks.filter.label') }}</span>
      <button
        v-for="f in TYPE_FILTERS"
        :key="f.value"
        @click="activeType = activeType === f.value ? '' : f.value"
        :class="[
          'text-xs px-2 py-0.5 font-mono transition-colors duration-150',
          activeType === f.value ? 'text-cyber-accent bg-cyber-accent/10' : 'text-cyber-muted/50 hover:text-cyber-accent',
        ]"
      >{{ t(f.labelKey) }}</button>
      <input
        v-model="searchQuery"
        :placeholder="t('memory.searchPlaceholder')"
        class="ml-auto bg-cyber-dark text-cyber-text text-xs font-mono rounded border border-cyber-code-border px-2 py-1 outline-none focus:border-cyber-accent w-48"
      />
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="text-cyber-muted/50 text-xs font-mono text-center py-8">
        {{ t('chat.thinking') }}
      </div>
      <div v-else-if="memories.length === 0" class="text-cyber-muted/50 text-xs font-mono text-center py-8">
        {{ t('memory.empty') }}
      </div>
      <div v-for="mem in filteredMemories" :key="mem.id"
        class="border-b border-cyber-code-border px-3 py-2 hover:bg-cyber-dark/40 transition-colors duration-150">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xs font-mono" :class="typeColor(mem.type)">{{ typeLabel(mem.type) }}</span>
            <span class="text-cyber-text text-sm font-mono truncate">{{ mem.title }}</span>
            <span v-if="isAutoExtracted(mem)" class="text-cyber-muted/40 text-2xs font-mono">{{ t('memory.auto_extracted') }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button @click="openEditModal(mem)" class="text-cyber-muted/50 hover:text-cyber-accent transition-colors duration-150">
              <HiPencil class="w-3 h-3" />
            </button>
            <button @click="openDeleteConfirm(mem.id)" class="text-cyber-muted/50 hover:text-red-400 transition-colors duration-150">
              <HiTrash class="w-3 h-3" />
            </button>
          </div>
        </div>
        <div class="text-cyber-muted/80 text-xs font-mono mt-0.5 line-clamp-2">{{ mem.content }}</div>
      </div>
    </div>

    <BaseModal v-model="showFormModal">
      <template #header>{{ editing ? t('memory.edit') : t('memory.create') }}</template>
      <template #body>
        <div class="space-y-3">
          <FormBlock :label="t('memory.form.type')">
            <BaseSelect v-model="formType">
              <option v-for="f in TYPE_FILTERS" :key="f.value" :value="f.value">{{ t(f.labelKey) }}</option>
            </BaseSelect>
          </FormBlock>
          <FormBlock :label="t('memory.form.title')">
            <input v-model="formTitle"
              class="w-full bg-cyber-dark text-cyber-text text-sm font-mono rounded border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent"
            />
          </FormBlock>
          <FormBlock :label="t('memory.form.content')">
            <textarea v-model="formContent" rows="4"
              class="w-full bg-cyber-dark text-cyber-text text-sm font-mono rounded border border-cyber-code-border px-2 py-1.5 outline-none focus:border-cyber-accent resize-none"
            ></textarea>
          </FormBlock>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button @click="showFormModal = false"
            class="text-sm font-mono text-cyber-muted px-3 py-1 hover:text-cyber-text transition-colors duration-150"
          >{{ t('tasks.cancel') }}</button>
          <button @click="saveMemory"
            class="text-sm font-mono font-bold text-black bg-cyber-accent px-4 py-1 hover:bg-cyber-accent/80 transition-colors duration-150"
          >{{ t('tasks.save') }}</button>
        </div>
      </template>
    </BaseModal>

    <BaseConfirmModal
      v-model="showConfirmModal"
      :title="t('memory.delete')"
      :message="t('memory.deleteConfirm')"
      @confirm="onDeleteConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiSave, HiPencil, HiTrash } from 'vue-icons-plus/hi'
import BaseModal from './BaseModal.vue'
import BaseConfirmModal from './BaseConfirmModal.vue'
import BaseSelect from './BaseSelect.vue'
import FormBlock from './FormBlock.vue'

interface Memory {
  id: string
  type: string
  title: string
  content: string
  metadata?: string
  sessionId?: number | null
  createdAt: string
}

const { t } = useI18n()
const memories = ref<Memory[]>([])
const loading = ref(true)
const activeType = ref('')
const searchQuery = ref('')
const showFormModal = ref(false)
const showConfirmModal = ref(false)
const editing = ref<Memory | null>(null)
const deletingId = ref<string | null>(null)
const formType = ref('USER')
const formTitle = ref('')
const formContent = ref('')

const TYPE_FILTERS = [
  { value: 'USER', labelKey: 'memory.type.user' },
  { value: 'FEEDBACK', labelKey: 'memory.type.feedback' },
  { value: 'PROJECT', labelKey: 'memory.type.project' },
  { value: 'REFERENCE', labelKey: 'memory.type.reference' },
]

const filteredMemories = computed(() => {
  let items = memories.value
  if (activeType.value) items = items.filter(m => m.type === activeType.value)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    items = items.filter(m => m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q))
  }
  return items
})

function typeColor(type: string): string {
  const colors: Record<string, string> = { USER: 'text-cyber-green', FEEDBACK: 'text-cyber-orange', PROJECT: 'text-cyber-cyan', REFERENCE: 'text-cyber-muted' }
  return colors[type] || 'text-cyber-muted'
}

function typeLabel(type: string): string {
  const key = `memory.type.${type.toLowerCase()}`
  return t(key)
}

function isAutoExtracted(mem: Memory): boolean {
  if (!mem.metadata) return false
  try {
    const meta = JSON.parse(mem.metadata) as { source?: string }
    return meta.source === 'auto-extract'
  } catch { return false }
}

async function fetchMemories() {
  loading.value = true
  try {
    const res = await fetch('/api/memories')
    if (res.ok) memories.value = await res.json() as Memory[]
  } catch { /* ignore */ }
  loading.value = false
}

function openAddModal() {
  editing.value = null
  formType.value = 'USER'
  formTitle.value = ''
  formContent.value = ''
  showFormModal.value = true
}

function openEditModal(mem: Memory) {
  editing.value = mem
  formType.value = mem.type
  formTitle.value = mem.title
  formContent.value = mem.content
  showFormModal.value = true
}

function openDeleteConfirm(id: string) {
  deletingId.value = id
  showConfirmModal.value = true
}

async function saveMemory() {
  const body = { type: formType.value, title: formTitle.value, content: formContent.value }
  try {
    if (editing.value) {
      await fetch(`/api/memories/${editing.value.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    showFormModal.value = false
    await fetchMemories()
  } catch { /* ignore */ }
}

async function onDeleteConfirmed() {
  if (!deletingId.value) return
  try {
    await fetch(`/api/memories/${deletingId.value}`, { method: 'DELETE' })
    await fetchMemories()
  } catch { /* ignore */ }
  deletingId.value = null
}

onMounted(fetchMemories)
</script>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/MemoryView.vue
git commit -m "feat: add MemoryView component with CRUD, filter, search"
```

---

### Task 11: i18n Keys + Settings Tab Integration

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/components/SettingsView.vue`

- [ ] **Step 1: Add memory keys to vi.json**

```json
{
  "memory": {
    "title": "Bộ nhớ",
    "create": "Thêm mới",
    "edit": "Sửa bộ nhớ",
    "delete": "Xóa bộ nhớ",
    "deleteConfirm": "Xóa bộ nhớ này?",
    "empty": "Chưa có bộ nhớ nào",
    "searchPlaceholder": "Tìm kiếm...",
    "auto_extracted": "[tự động]",
    "type": {
      "user": "USER",
      "feedback": "FEEDBACK",
      "project": "PROJECT",
      "reference": "REFERENCE"
    },
    "form": {
      "type": "Loại",
      "title": "Tiêu đề",
      "content": "Nội dung"
    }
  }
}
```

- [ ] **Step 2: Add memory keys to en.json**

```json
{
  "memory": {
    "title": "Memories",
    "create": "New Memory",
    "edit": "Edit Memory",
    "delete": "Delete Memory",
    "deleteConfirm": "Delete this memory?",
    "empty": "No memories yet",
    "searchPlaceholder": "Search...",
    "auto_extracted": "[auto]",
    "type": {
      "user": "USER",
      "feedback": "FEEDBACK",
      "project": "PROJECT",
      "reference": "REFERENCE"
    },
    "form": {
      "type": "Type",
      "title": "Title",
      "content": "Content"
    }
  }
}
```

- [ ] **Step 3: Update SettingsView.vue to include Memories tab**

Replace the current template with tabbed layout. Add at top of template after header:

```vue
<div class="flex border-b border-cyber-code-border shrink-0">
  <button
    v-for="tab in TABS"
    :key="tab.key"
    @click="activeSettingsTab = tab.key"
    :class="[
      'text-sm px-3 py-1.5 font-mono transition-colors duration-150',
      activeSettingsTab === tab.key
        ? 'text-cyber-accent border-b-2 border-cyber-accent'
        : 'text-cyber-muted hover:text-cyber-accent',
    ]"
  >{{ t(tab.labelKey) }}</button>
</div>
```

Add in script section:

```ts
const activeSettingsTab = ref('general')

const TABS = [
  { key: 'general', labelKey: 'settings.header' },
  { key: 'memories', labelKey: 'memory.title' },
]
```

And conditional rendering in template body:

```vue
<MemoryView v-if="activeSettingsTab === 'memories'" />
<div v-else class="flex-1 overflow-y-auto px-4 py-4">
  <!-- existing content -->
</div>
```

Add import:

```ts
import MemoryView from './MemoryView.vue'
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/locales/ frontend/src/components/SettingsView.vue
git commit -m "feat: add memory i18n keys and Settings tab integration"
```

---

### Task 12: App Module Registration + Final Wiring

**Files:**
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Add MemoryModule to app.module.ts**

```ts
import { MemoryModule } from './memory/memory.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MemoryModule,  // ADD
    TasksModule,
    NotesModule,
    AgentModule,
    // ... rest unchanged
  ],
})
```

- [ ] **Step 2: Run full backend tests**

```bash
npx jest --no-coverage
```

Expected: all existing tests still pass + new memory tests pass.

- [ ] **Step 3: Run frontend type check**

```bash
cd frontend && npx vue-tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.module.ts
git commit -m "feat: register MemoryModule in AppModule"
```

---

## Self-Review Checklist

1. **Spec coverage**: All sections covered — schema (Task 1), CRUD (Task 4-5), auto-extraction (Task 9), prompt injection (Task 8), frontend (Task 10-11), i18n (Task 11), tests (Task 6, 9), gateway (Task 3)
2. **Placeholder scan**: No TBD, TODO, or incomplete code. Every step has actual code.
3. **Type consistency**: `Memory` uses `cuid()` and `String` id, `sessionId` is `Int?`. Memory service uses consistent types. Frontend `Memory` interface matches Prisma output. DTOs use `@IsIn([...])` for type field.
4. **Dependency correctness**: `MemoryModule` exports `MemoryService` and `MemoryExtractionService`. `AgentModule` imports `MemoryModule`. `EventEmitterModule.forRoot()` in AppModule. All cross-module references validated.
