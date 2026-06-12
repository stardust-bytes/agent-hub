# Token Usage Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track token usage (prompt + completion) from OpenAI/DeepSeek API calls and display in Settings → Usage tab.

**Architecture:** Capture usage at provider level (OpenAI API returns `usage` in final SSE chunk), save per-LLM-call to new `UsageRecord` SQLite table, expose via REST endpoints, display in Vue component.

**Tech Stack:** NestJS, Prisma/SQLite, Vue 3, TailwindCSS

---

### Task 1: Add UsageRecord Prisma model + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add UsageRecord model to schema.prisma**

Add after the existing `AgentFile` model:

```prisma
model UsageRecord {
  id               Int      @id @default(autoincrement())
  sessionId        Int?
  modelName        String
  providerType     String
  promptTokens     Int
  completionTokens Int
  totalTokens      Int
  createdAt        DateTime @default(now())

  session          Session? @relation(fields: [sessionId], references: [id], onDelete: SetNull)
}
```

- [ ] **Step 2: Generate migration and client**

Run:
```bash
cd backend
npx prisma migrate dev --name add-usage-record
npx prisma generate
```

Expected: Migration file created in `prisma/migrations/`, client regenerated.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add UsageRecord model to Prisma schema"
```

---

### Task 2: Create UsageService

**Files:**
- Create: `backend/src/usage/dto/create-usage.dto.ts`
- Create: `backend/src/usage/usage.service.ts`
- Create: `backend/src/usage/usage.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/usage/usage.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsageService } from './usage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsageDto } from './dto/create-usage.dto';

describe('UsageService', () => {
  let service: UsageService;
  let prisma: PrismaService;

  const mockPrisma = {
    usageRecord: {
      create: jest.fn().mockResolvedValue({
        id: 1,
        sessionId: 1,
        modelName: 'gpt-4',
        providerType: 'openai',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        createdAt: new Date(),
      }),
      aggregate: jest.fn().mockResolvedValue([
        { _sum: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 }, _count: { id: 10 } },
      ]),
      groupBy: jest.fn().mockResolvedValue([
        { sessionId: 1, _sum: { promptTokens: 200, completionTokens: 100, totalTokens: 300 } },
      ]),
      findMany: jest.fn().mockResolvedValue([
        { id: 1, sessionId: 1, modelName: 'gpt-4', providerType: 'openai', promptTokens: 100, completionTokens: 50, totalTokens: 150, createdAt: new Date() },
      ]),
    },
    session: {
      findUnique: jest.fn().mockResolvedValue({ id: 1, title: 'Chat 1' }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsageService>(UsageService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('record', () => {
    it('should create a usage record', async () => {
      const dto: CreateUsageDto = {
        sessionId: 1,
        modelName: 'gpt-4',
        providerType: 'openai',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      };
      const result = await service.record(dto);
      expect(result.promptTokens).toBe(100);
      expect(prisma.usageRecord.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('getTotal', () => {
    it('should return aggregated totals', async () => {
      mockPrisma.usageRecord.aggregate.mockResolvedValue([
        { _sum: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 }, _count: { id: 10 } },
      ]);
      const result = await service.getTotal();
      expect(result.promptTokens).toBe(1000);
      expect(result.completionTokens).toBe(500);
      expect(result.totalTokens).toBe(1500);
      expect(result.requestCount).toBe(10);
    });

    it('should handle empty DB', async () => {
      mockPrisma.usageRecord.aggregate.mockResolvedValue([
        { _sum: { promptTokens: null, completionTokens: null, totalTokens: null }, _count: { id: 0 } },
      ]);
      const result = await service.getTotal();
      expect(result.promptTokens).toBe(0);
      expect(result.completionTokens).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.requestCount).toBe(0);
    });
  });

  describe('getPerSession', () => {
    it('should return per-session breakdown', async () => {
      const result = await service.getPerSession();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('sessionId');
      expect(result[0]).toHaveProperty('promptTokens');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/usage/usage.service --no-cache`
Expected: FAIL — cannot find module

- [ ] **Step 3: Create CreateUsageDto**

Create `backend/src/usage/dto/create-usage.dto.ts`:

```typescript
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateUsageDto {
  @IsOptional()
  @IsInt()
  sessionId?: number;

  @IsString()
  modelName: string;

  @IsString()
  providerType: string;

  @IsInt()
  @Min(0)
  promptTokens: number;

  @IsInt()
  @Min(0)
  completionTokens: number;

  @IsInt()
  @Min(0)
  totalTokens: number;
}
```

- [ ] **Step 4: Create UsageService**

Create `backend/src/usage/usage.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsageDto } from './dto/create-usage.dto';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async record(dto: CreateUsageDto) {
    return this.prisma.usageRecord.create({ data: dto });
  }

  async getTotal(): Promise<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    requestCount: number;
  }> {
    const [result] = await this.prisma.usageRecord.aggregate({
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
      _count: { id: true },
    });
    return {
      promptTokens: result._sum.promptTokens ?? 0,
      completionTokens: result._sum.completionTokens ?? 0,
      totalTokens: result._sum.totalTokens ?? 0,
      requestCount: result._count.id,
    };
  }

  async getPerSession(): Promise<
    Array<{
      sessionId: number;
      sessionTitle: string;
      modelName: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }>
  > {
    const groups = await this.prisma.usageRecord.groupBy({
      by: ['sessionId', 'modelName'],
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
    });

    const result = [];
    for (const g of groups) {
      if (g.sessionId === null) continue;
      const session = await this.prisma.session.findUnique({ where: { id: g.sessionId } });
      result.push({
        sessionId: g.sessionId,
        sessionTitle: session?.title ?? `Session #${g.sessionId}`,
        modelName: g.modelName,
        promptTokens: g._sum.promptTokens ?? 0,
        completionTokens: g._sum.completionTokens ?? 0,
        totalTokens: g._sum.totalTokens ?? 0,
      });
    }
    return result;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/usage/usage.service --no-cache`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/usage/
git commit -m "feat: add UsageService with record, getTotal, getPerSession"
```

---

### Task 3: Create UsageController

**Files:**
- Create: `backend/src/usage/usage.controller.ts`
- Create: `backend/src/usage/usage.controller.spec.ts`
- Create: `backend/src/usage/usage.module.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/usage/usage.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';

describe('UsageController', () => {
  let controller: UsageController;
  let service: UsageService;

  const mockService = {
    getTotal: jest.fn().mockResolvedValue({
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
      requestCount: 10,
    }),
    getPerSession: jest.fn().mockResolvedValue([
      { sessionId: 1, sessionTitle: 'Chat 1', modelName: 'gpt-4', promptTokens: 200, completionTokens: 100, totalTokens: 300 },
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsageController],
      providers: [{ provide: UsageService, useValue: mockService }],
    }).compile();

    controller = module.get<UsageController>(UsageController);
    service = module.get<UsageService>(UsageService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /api/usage', () => {
    it('should return total usage', async () => {
      const result = await controller.getTotal();
      expect(result.promptTokens).toBe(1000);
      expect(service.getTotal).toHaveBeenCalled();
    });
  });

  describe('GET /api/usage/sessions', () => {
    it('should return per-session breakdown', async () => {
      const result = await controller.getPerSession();
      expect(result.length).toBe(1);
      expect(service.getPerSession).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/usage/usage.controller --no-cache`
Expected: FAIL — cannot find module

- [ ] **Step 3: Create UsageController**

Create `backend/src/usage/usage.controller.ts`:

```typescript
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { UsageService } from './usage.service';

@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  async getTotal() {
    return this.usageService.getTotal();
  }

  @Get('sessions')
  async getPerSession() {
    return this.usageService.getPerSession();
  }
}
```

- [ ] **Step 4: Create UsageModule**

Create `backend/src/usage/usage.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';

@Module({
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/usage/usage.controller --no-cache`
Expected: PASS

- [ ] **Step 6: Register UsageModule in AppModule**

In `backend/src/app.module.ts`, add `UsageModule` to the `imports` array:

```typescript
import { UsageModule } from './usage/usage.module';

@Module({
  imports: [
    // ... existing imports
    UsageModule,
  ],
})
```

- [ ] **Step 7: Run all usage tests**

Run: `cd backend && npx jest src/usage --no-cache`
Expected: PASS (all tests)

- [ ] **Step 8: Commit**

```bash
git add backend/src/usage/ backend/src/app.module.ts
git commit -m "feat: add UsageController and UsageModule with /api/usage endpoints"
```

---

### Task 4: Capture usage from OpenAIProvider

**Files:**
- Modify: `backend/src/agent/providers/openai.provider.ts`
- Test: `backend/src/agent/providers/openai.provider.spec.ts` (or adjust existing)

- [ ] **Step 1: Write the failing test**

If `openai.provider.spec.ts` exists, add a test case. Otherwise create it:

```typescript
import { OpenAIProvider } from './openai.provider';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
  });

  it('should yield usage in done chunk when API returns usage', async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => {
          const encoder = new TextEncoder();
          const chunks = [
            'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
            'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
            'data: [DONE]\n\n',
          ];
          let idx = 0;
          return {
            read: async () => {
              if (idx >= chunks.length) return { done: true };
              return { done: false, value: encoder.encode(chunks[idx++]) };
            },
            cancel: jest.fn(),
          };
        },
      },
    } as any;

    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const results: any[] = [];
    for await (const chunk of provider.stream({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [],
      signal: new AbortController().signal,
      baseUrl: 'http://localhost:11434',
    })) {
      results.push(chunk);
    }

    const doneChunk = results.find(r => r.type === 'done');
    expect(doneChunk).toBeDefined();
    expect(doneChunk.usage).toBeDefined();
    expect(doneChunk.usage.promptTokens).toBe(10);
    expect(doneChunk.usage.completionTokens).toBe(5);
    expect(doneChunk.usage.totalTokens).toBe(15);
  });
});
```

Run: `cd backend && npx jest src/agent/providers/openai.provider --no-cache`
Expected: FAIL (or PASS if the test already passes — verify)

- [ ] **Step 2: Modify OpenAIProvider to parse and yield usage**

In `backend/src/agent/providers/openai.provider.ts`, modify the SSE parsing to capture the `usage` field. After the `[DONE]` payload check and before returning:

In the existing code, after `if (payload === '[DONE]')` block, add usage capture from the final non-DONE chunk:

The key change: parse the `usage` from the last chunk that has it. OpenAI sends `usage` on a chunk that also has `choices[0].delta: {}` right before `[DONE]`.

Modify the existing code in the `while (!signal.aborted)` loop:

After line 134 (where `pendingToolCalls.clear()` happens after `finish_reason === 'tool_calls'`), add usage capture in the `[DONE]` handler:

```typescript
if (payload === '[DONE]') {
  for (const [, tc] of pendingToolCalls) {
    let parsedArgs: unknown;
    try { parsedArgs = JSON.parse(tc.arguments); } catch { parsedArgs = tc.arguments; }
    yield { type: 'tool_call', toolCall: { name: tc.name, arguments: parsedArgs }, reasoningContent };
  }
  pendingToolCalls.clear();
  // Check if we have usage from a previous chunk
  if (lastUsage) {
    yield { type: 'done', usage: lastUsage };
  } else {
    yield { type: 'done' };
  }
  return;
}
```

Add a `lastUsage` variable at the top of the method (after `let reasoningContent = '';`):

```typescript
let lastUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
```

And inside the parse loop, when processing a chunk with `usage`:

```typescript
if (parsed.usage) {
  lastUsage = {
    promptTokens: parsed.usage.prompt_tokens,
    completionTokens: parsed.usage.completion_tokens,
    totalTokens: parsed.usage.total_tokens,
  };
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd backend && npx jest src/agent/providers/openai.provider --no-cache`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/providers/openai.provider.ts
git commit -m "feat: capture token usage from OpenAI API stream responses"
```

---

### Task 5: Capture usage in AgentLoopService

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Inject UsageService into AgentLoopService**

In `backend/src/agent/services/agent-loop.service.ts`, add import and inject:

```typescript
import { UsageService } from '../../usage/usage.service';
```

Add to constructor:
```typescript
private readonly usageService: UsageService,
```

Add to module registration in `agent.module.ts` — ensure `UsageModule` is imported or `UsageService` is provided.

- [ ] **Step 2: Modify executeStep to return usage**

Change the return type to include usage:

```typescript
private async executeStep(
  model: string,
  messages: OllamaMessage[],
  tools: ToolDefinition[],
  signal: AbortSignal,
  providerConfig: { baseUrl: string; key?: string },
  res: WriteStream,
  sessionId?: number,
  providerType: string = 'ollama',
): Promise<{ text: string; toolCalls: Array<{ name: string; arguments: unknown }>; reasoningContent?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
```

In the `for await (const chunk of stream)` loop, after the `case 'done':` add usage tracking:

```typescript
case 'done':
  if (chunk.usage) usage = chunk.usage;
  break;
```

And declare `usage` at the top:
```typescript
let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
```

Return it:
```typescript
return { text, toolCalls, reasoningContent: reasoningContent || undefined, usage };
```

- [ ] **Step 3: Save usage after executeStep in the run() loop**

After the `executeStep` call in `run()` method (around line 141-143), capture usage:

```typescript
({ text, toolCalls } = await this.executeStep(
  model, messages, activeTools, signal, providerConfig, res, sessionId, providerType,
));

// If usage was returned and we have a session, record it
// (usage will be available from executeStep's return)
```

But wait — the current code destructures `text` and `toolCalls` but not `usage`. We need to capture usage:

```typescript
const stepResult = await this.executeStep(
  model, messages, activeTools, signal, providerConfig, res, sessionId, providerType,
);
text = stepResult.text;
toolCalls = stepResult.toolCalls;

if (stepResult.usage && sessionId) {
  this.usageService.record({
    sessionId,
    modelName: model,
    providerType,
    promptTokens: stepResult.usage.promptTokens,
    completionTokens: stepResult.usage.completionTokens,
    totalTokens: stepResult.usage.totalTokens,
  }).catch(() => {});
}
```

- [ ] **Step 4: Run existing tests to verify no regression**

Run: `cd backend && npx jest src/agent`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts backend/src/agent/agent.module.ts
git commit -m "feat: record token usage after each LLM call in agent loop"
```

---

### Task 6: Create UsageView frontend component

**Files:**
- Create: `frontend/src/components/UsageView.vue`

- [ ] **Step 1: Create UsageView.vue**

Create `frontend/src/components/UsageView.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { HiOutlineChartBar } from 'vue-icons-plus/hi';

const { t } = useI18n();

interface UsageTotal {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
}

interface SessionUsage {
  sessionId: number;
  sessionTitle: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

const total = ref<UsageTotal | null>(null);
const sessions = ref<SessionUsage[]>([]);
const loading = ref(true);
const error = ref('');

function formatNum(n: number): string {
  return n.toLocaleString('vi-VN');
}

async function fetchData() {
  loading.value = true;
  error.value = '';
  try {
    const [totalRes, sessionsRes] = await Promise.all([
      fetch('/api/usage'),
      fetch('/api/usage/sessions'),
    ]);
    if (!totalRes.ok || !sessionsRes.ok) throw new Error('fetch_failed');
    total.value = await totalRes.json() as UsageTotal;
    sessions.value = await sessionsRes.json() as SessionUsage[];
  } catch {
    error.value = t('chat.error.unreachable');
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <div class="flex items-center gap-2 text-cyber-cyan text-sm mb-2">
      <HiOutlineChartBar class="w-4 h-4" />
      <span>{{ t('usage.header') }}</span>
    </div>

    <div v-if="loading" class="text-cyber-muted text-xs">⟳ {{ t('chat.loading') }}</div>

    <div v-else-if="error" class="text-red-500 text-xs">{{ error }}</div>

    <template v-else>
      <div v-if="total && total.requestCount > 0" class="border border-cyber-code-border rounded p-3">
        <div class="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
          <span class="text-cyber-muted">{{ t('usage.total_prompt') }}:</span>
          <span class="text-cyber-text text-right font-mono">{{ formatNum(total.promptTokens) }}</span>
          <span class="text-cyber-muted">{{ t('usage.total_completion') }}:</span>
          <span class="text-cyber-text text-right font-mono">{{ formatNum(total.completionTokens) }}</span>
          <span class="border-t border-cyber-code-border pt-1 text-cyber-muted">{{ t('usage.total_all') }}:</span>
          <span class="border-t border-cyber-code-border pt-1 text-cyber-cyan text-right font-mono">{{ formatNum(total.totalTokens) }}</span>
          <span class="text-cyber-muted">{{ t('usage.total_requests') }}:</span>
          <span class="text-cyber-text text-right font-mono">{{ formatNum(total.requestCount) }}</span>
        </div>
      </div>

      <div v-else class="text-cyber-muted text-xs border border-cyber-code-border rounded p-3">
        {{ t('usage.empty') }}
      </div>

      <div v-if="sessions.length > 0" class="border border-cyber-code-border rounded">
        <div class="text-cyber-muted text-xs px-3 py-2 border-b border-cyber-code-border">
          {{ t('usage.per_session') }}
        </div>
        <table class="w-full text-xs">
          <thead>
            <tr class="text-cyber-muted border-b border-cyber-code-border">
              <th class="text-left px-3 py-1.5 font-mono">{{ t('usage.session') }}</th>
              <th class="text-left px-3 py-1.5 font-mono">{{ t('usage.model') }}</th>
              <th class="text-right px-3 py-1.5 font-mono">{{ t('usage.prompt') }}</th>
              <th class="text-right px-3 py-1.5 font-mono">{{ t('usage.completion') }}</th>
              <th class="text-right px-3 py-1.5 font-mono">{{ t('usage.total') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sessions" :key="s.sessionId" class="border-b border-cyber-code-border last:border-b-0 hover:bg-cyber-row">
              <td class="px-3 py-1.5 text-cyber-text truncate max-w-[120px]">{{ s.sessionTitle }}</td>
              <td class="px-3 py-1.5 text-cyber-muted">{{ s.modelName }}</td>
              <td class="px-3 py-1.5 text-right font-mono text-cyber-text">{{ formatNum(s.promptTokens) }}</td>
              <td class="px-3 py-1.5 text-right font-mono text-cyber-text">{{ formatNum(s.completionTokens) }}</td>
              <td class="px-3 py-1.5 text-right font-mono text-cyber-cyan">{{ formatNum(s.totalTokens) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Add i18n keys**

Add to `frontend/src/locales/vi.json`:
```json
"usage": {
  "header": "Usage",
  "total_prompt": "Prompt tokens",
  "total_completion": "Completion tokens",
  "total_all": "Tổng tokens",
  "total_requests": "Số request",
  "per_session": "Chi tiết theo session",
  "empty": "Chưa có dữ liệu usage",
  "model": "Model",
  "session": "Session",
  "prompt": "Prompt",
  "completion": "Compl",
  "total": "Tổng"
}
```

Add to `frontend/src/locales/en.json`:
```json
"usage": {
  "header": "Usage",
  "total_prompt": "Prompt tokens",
  "total_completion": "Completion tokens",
  "total_all": "Total tokens",
  "total_requests": "Requests",
  "per_session": "Per-session breakdown",
  "empty": "No usage data yet",
  "model": "Model",
  "session": "Session",
  "prompt": "Prompt",
  "completion": "Compl",
  "total": "Total"
}
```

- [ ] **Step 3: Check typecheck**

Run: `cd frontend && npm run type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/UsageView.vue frontend/src/locales/
git commit -m "feat: add UsageView component with total and per-session breakdown"
```

---

### Task 7: Add Usage tab in SettingsView

**Files:**
- Modify: `frontend/src/components/SettingsView.vue`

- [ ] **Step 1: Read the current SettingsView.vue**

Read `frontend/src/components/SettingsView.vue` to understand existing tab pattern.

- [ ] **Step 2: Add Usage tab button**

Add a tab button alongside the existing "Memories" tab button. Assuming the existing tab setup uses a `activeTab` ref and conditional rendering:

```vue
<button
  :class="['px-3 py-1 text-xs font-mono border border-cyber-code-border rounded transition-colors duration-150', activeTab === 'usage' ? 'bg-cyber-accent text-black' : 'text-cyber-muted hover:text-cyber-text']"
  @click="activeTab = 'usage'"
>
  Usage
</button>
```

- [ ] **Step 3: Conditionally render UsageView**

```vue
<UsageView v-if="activeTab === 'usage'" />
```

And add the import:
```typescript
import UsageView from './UsageView.vue';
```

- [ ] **Step 4: Run typecheck**

Run: `cd frontend && npm run type-check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SettingsView.vue
git commit -m "feat: add Usage tab to SettingsView"
```

---

### Task 8: Update backend AGENTS.md and verify full test suite

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && npx jest`
Expected: PASS (all existing tests + new usage tests)

- [ ] **Step 2: Update backend/AGENTS.md**

Add `UsageModule` to module map, add usage endpoints to API table, add UsageRecord to Prisma schema section, add new DTOs and files to file listing.

- [ ] **Step 3: Commit**

```bash
git add backend/AGENTS.md
git commit -m "docs: update AGENTS.md with usage module, endpoints, and schema"
```
