# Permissions System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm granular permission control cho tool execution — workspace operator có thể allow/deny từng tool hoặc dùng default policy.

**Architecture:** `PermissionsService` đọc/ghi config từ `Setting` table (key: `agent.permissions`). `AgentLoopService` check `isAllowed()` trước mỗi tool call trong EVALUATING phase. API `GET/PATCH /api/agent/permissions` để manage config.

**Tech Stack:** NestJS, TypeScript, class-validator, SQLite via SettingsService

---

### Task 1: PermissionsConfig types + UpdatePermissionsDto

**Files:**
- Create: `backend/src/agent/dto/permissions-config.ts`
- Create: `backend/src/agent/dto/update-permissions.dto.ts`

- [ ] **Step 1: Create permissions-config.ts**

```typescript
export interface PermissionsConfig {
  defaultPolicy: 'allow' | 'deny';
  allowedTools: string[];
  deniedTools: string[];
}

export const DEFAULT_PERMISSIONS_CONFIG: PermissionsConfig = {
  defaultPolicy: 'allow',
  allowedTools: [],
  deniedTools: [],
};
```

- [ ] **Step 2: Create update-permissions.dto.ts**

```typescript
import { IsString, IsArray, IsOptional, IsIn } from 'class-validator';

export class UpdatePermissionsDto {
  @IsOptional()
  @IsString()
  @IsIn(['allow', 'deny'])
  defaultPolicy?: 'allow' | 'deny';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedTools?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deniedTools?: string[];
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/dto/permissions-config.ts backend/src/agent/dto/update-permissions.dto.ts
git commit -m "feat: add PermissionsConfig types and UpdatePermissionsDto"
```

---

### Task 2: PermissionsService (TDD)

**Files:**
- Create: `backend/src/agent/services/permissions.service.spec.ts`
- Create: `backend/src/agent/services/permissions.service.ts`

- [ ] **Step 1: Write the failing test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from './permissions.service';
import { SettingsService } from '../../settings/settings.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let settingsService: { get: jest.Mock; upsert: jest.Mock };

  beforeEach(async () => {
    settingsService = { get: jest.fn(), upsert: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();
    service = module.get<PermissionsService>(PermissionsService);
  });

  describe('getConfig', () => {
    it('returns default config when setting is empty', async () => {
      settingsService.get.mockResolvedValue('');
      const config = await service.getConfig();
      expect(config).toEqual({ defaultPolicy: 'allow', allowedTools: [], deniedTools: [] });
    });

    it('returns stored config when setting exists', async () => {
      const stored = { defaultPolicy: 'deny', allowedTools: ['list_tasks'], deniedTools: [] };
      settingsService.get.mockResolvedValue(JSON.stringify(stored));
      const config = await service.getConfig();
      expect(config).toEqual(stored);
    });

    it('returns default config when stored JSON is invalid', async () => {
      settingsService.get.mockResolvedValue('not-valid-json');
      const config = await service.getConfig();
      expect(config).toEqual({ defaultPolicy: 'allow', allowedTools: [], deniedTools: [] });
    });
  });

  describe('isAllowed', () => {
    it('allows tool when defaultPolicy is allow and tool is not denied', async () => {
      settingsService.get.mockResolvedValue('');
      expect(await service.isAllowed('create_task')).toBe(true);
    });

    it('denies tool when in deniedTools even if also in allowedTools', async () => {
      settingsService.get.mockResolvedValue(JSON.stringify({
        defaultPolicy: 'allow',
        allowedTools: ['web_fetch'],
        deniedTools: ['web_fetch'],
      }));
      expect(await service.isAllowed('web_fetch')).toBe(false);
    });

    it('allows tool in allowedTools when defaultPolicy is deny', async () => {
      settingsService.get.mockResolvedValue(JSON.stringify({
        defaultPolicy: 'deny',
        allowedTools: ['list_tasks'],
        deniedTools: [],
      }));
      expect(await service.isAllowed('list_tasks')).toBe(true);
    });

    it('denies tool when defaultPolicy is deny and tool not in allowedTools', async () => {
      settingsService.get.mockResolvedValue(JSON.stringify({
        defaultPolicy: 'deny',
        allowedTools: ['list_tasks'],
        deniedTools: [],
      }));
      expect(await service.isAllowed('create_task')).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('merges updates with current config and persists', async () => {
      settingsService.get.mockResolvedValue('');
      settingsService.upsert.mockResolvedValue(undefined);
      const result = await service.updateConfig({ defaultPolicy: 'deny' });
      expect(result).toEqual({ defaultPolicy: 'deny', allowedTools: [], deniedTools: [] });
      expect(settingsService.upsert).toHaveBeenCalledWith(
        'agent.permissions',
        JSON.stringify({ defaultPolicy: 'deny', allowedTools: [], deniedTools: [] }),
      );
    });

    it('merges deniedTools with existing config', async () => {
      const existing = { defaultPolicy: 'allow', allowedTools: [], deniedTools: [] };
      settingsService.get.mockResolvedValue(JSON.stringify(existing));
      settingsService.upsert.mockResolvedValue(undefined);
      const result = await service.updateConfig({ deniedTools: ['web_fetch', 'delete_tasks'] });
      expect(result.deniedTools).toEqual(['web_fetch', 'delete_tasks']);
      expect(result.defaultPolicy).toBe('allow');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/agent/services/permissions.service.spec.ts --verbose 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module './permissions.service'`

- [ ] **Step 3: Write the implementation**

```typescript
import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { PermissionsConfig, DEFAULT_PERMISSIONS_CONFIG } from '../dto/permissions-config';

@Injectable()
export class PermissionsService {
  private static readonly SETTING_KEY = 'agent.permissions';

  constructor(private readonly settingsService: SettingsService) {}

  async getConfig(): Promise<PermissionsConfig> {
    const raw = await this.settingsService.get(PermissionsService.SETTING_KEY, '');
    if (!raw) return { ...DEFAULT_PERMISSIONS_CONFIG };
    try {
      return JSON.parse(raw) as PermissionsConfig;
    } catch {
      return { ...DEFAULT_PERMISSIONS_CONFIG };
    }
  }

  async updateConfig(updates: Partial<PermissionsConfig>): Promise<PermissionsConfig> {
    const current = await this.getConfig();
    const updated = { ...current, ...updates };
    await this.settingsService.upsert(PermissionsService.SETTING_KEY, JSON.stringify(updated));
    return updated;
  }

  async isAllowed(toolName: string): Promise<boolean> {
    const config = await this.getConfig();
    if (config.deniedTools.includes(toolName)) return false;
    if (config.allowedTools.includes(toolName)) return true;
    return config.defaultPolicy === 'allow';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/agent/services/permissions.service.spec.ts --verbose 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/services/permissions.service.ts backend/src/agent/services/permissions.service.spec.ts
git commit -m "feat: add PermissionsService with config management and tool permission check"
```

---

### Task 3: Permissions API endpoints

**Files:**
- Modify: `backend/src/agent/agent.controller.ts`
- Modify: `backend/src/agent/agent.service.ts`

- [ ] **Step 1: Update agent.service.ts — inject PermissionsService + expose methods**

Replace the entire `agent.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { AgentLoopService } from './services/agent-loop.service';
import { ContextBuilderService } from './services/context-builder.service';
import { SessionsService } from '../sessions/sessions.service';
import { ProvidersService } from '../providers/providers.service';
import { PermissionsService } from './services/permissions.service';
import { PermissionsConfig } from './dto/permissions-config';

@Injectable()
export class AgentService {
  constructor(
    private readonly agentLoop: AgentLoopService,
    private readonly sessionsService: SessionsService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly providersService: ProvidersService,
    private readonly permissionsService: PermissionsService,
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

    const context = await this.contextBuilder.build(
      { step: 0, maxIterations: 10, roomId: String(sessionId), steps: [], startTime: Date.now(), currentState: 'PLANNING' } as any,
      sessionId,
    );

    const history = await this.sessionsService.getHistory(sessionId);

    if (!signal.aborted) {
      await this.sessionsService.saveMessage(sessionId, 'user', message);
    }

    const providerType = providerModel.provider.type ?? 'ollama';

    const finalText = await this.agentLoop.run(
      providerType,
      providerModel.name,
      context.systemPrompt,
      history,
      message,
      context.tools,
      res,
      signal,
      sessionId,
      mode,
      providerConfig,
    );

    if (!signal.aborted && finalText) {
      await this.sessionsService.saveMessage(sessionId, 'assistant', finalText);
      await this.sessionsService.autoTitle(sessionId, message);
    }
  }

  async getPermissions(): Promise<PermissionsConfig> {
    return this.permissionsService.getConfig();
  }

  async updatePermissions(updates: Partial<PermissionsConfig>): Promise<PermissionsConfig> {
    return this.permissionsService.updateConfig(updates);
  }
}
```

- [ ] **Step 2: Update agent.controller.ts — add GET/PATCH endpoints**

Replace the entire `agent.controller.ts`:

```typescript
import { Controller, Post, Get, Patch, Body, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AgentService } from './agent.service';
import { ChatDto } from './dto/chat.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { PermissionsConfig } from './dto/permissions-config';

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

  @Get('permissions')
  async getPermissions(): Promise<PermissionsConfig> {
    return this.agentService.getPermissions();
  }

  @Patch('permissions')
  async updatePermissions(@Body() dto: UpdatePermissionsDto): Promise<PermissionsConfig> {
    return this.agentService.updatePermissions(dto);
  }
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 4: Run tests**

```bash
cd backend && npx jest src/agent --verbose 2>&1 | tail -30
```

Expected: All tests pass (agent.service.spec.ts may need PermissionsService mock — see next step if it fails)

- [ ] **Step 5: Fix agent.service.spec.ts if needed**

If `agent.service.spec.ts` fails with "No provider for PermissionsService", open it and add the mock:

```typescript
{ provide: PermissionsService, useValue: { getConfig: jest.fn(), updateConfig: jest.fn() } },
```

Also add the import at the top:
```typescript
import { PermissionsService } from './services/permissions.service';
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/agent/agent.controller.ts backend/src/agent/agent.service.ts
git commit -m "feat: add GET/PATCH /api/agent/permissions endpoints"
```

---

### Task 4: Integrate permission check into AgentLoopService

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`
- Modify: `backend/src/agent/services/agent-loop.service.spec.ts`

- [ ] **Step 1: Inject PermissionsService into AgentLoopService**

In `agent-loop.service.ts`, add import at top (after existing imports):

```typescript
import { PermissionsService } from './permissions.service';
```

Add `PermissionsService` to the constructor (after `knowledgeService`):

```typescript
constructor(
  private readonly llmController: LLMControllerService,
  private readonly sessionsService: SessionsService,
  private readonly knowledgeService: KnowledgeService,
  private readonly permissionsService: PermissionsService,
  createTask: CreateTaskExecutor,
  // ... rest unchanged
```

- [ ] **Step 2: Add permission check in EVALUATING phase**

Find the block that starts with:
```typescript
res.write(`data: ${JSON.stringify({ toolCall: { name, args } })}\n\n`);
if (sessionId) {
  await this.sessionsService.saveMessage(sessionId, 'tool', `${name}(${JSON.stringify(args)})`, name, false);
}

let result: string;
```

Replace it with:

```typescript
res.write(`data: ${JSON.stringify({ toolCall: { name, args } })}\n\n`);
if (sessionId) {
  await this.sessionsService.saveMessage(sessionId, 'tool', `${name}(${JSON.stringify(args)})`, name, false);
}

const allowed = await this.permissionsService.isAllowed(name);
if (!allowed) {
  const denyMsg = `Tool "${name}" is not permitted by workspace policy.`;
  res.write(`data: ${JSON.stringify({ toolResult: { name, result: denyMsg } })}\n\n`);
  if (sessionId) {
    await this.sessionsService.saveMessage(sessionId, 'tool', denyMsg, name, true);
  }
  messages.push({ role: 'tool', content: denyMsg });
  continue;
}

let result: string;
```

- [ ] **Step 3: Update agent-loop.service.spec.ts — add PermissionsService mock**

In the `providers` array inside `beforeEach`, add after the last executor mock (before the closing bracket `]`):

```typescript
{ provide: PermissionsService, useValue: { isAllowed: jest.fn().mockResolvedValue(true) } },
```

Add the import at the top of the file:

```typescript
import { PermissionsService } from './permissions.service';
```

Also expose `permissionsService` in the outer scope:

```typescript
let permissionsService: { isAllowed: jest.Mock };
```

And in `beforeEach`, after `service = module.get(AgentLoopService)`:

```typescript
permissionsService = module.get(PermissionsService);
```

- [ ] **Step 4: Add permission denial test**

Add this describe block at the end of the `AgentLoopService` describe block (before the closing `}`):

```typescript
describe('Permissions', () => {
  it('skips denied tool and emits denial toolResult', async () => {
    const toolCall: StreamChunk = {
      type: 'tool_call',
      toolCall: { name: 'web_fetch', arguments: { url: 'http://example.com' } },
    };
    llmController.stream = buildStreamMock(
      [toolCall, DONE],
      [{ type: 'token', token: 'I cannot fetch that URL' }, DONE],
    );
    permissionsService.isAllowed.mockImplementation(async (name: string) => name !== 'web_fetch');

    const res = mockRes();
    const signal = new AbortController().signal;
    const result = await service.run(
      'ollama', 'llama3', 'You are helpful', [], 'fetch URL',
      defaultTools, res, signal, undefined, 'agent', defaultConfig,
    );

    expect(webFetch.execute).not.toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(
      'data: ' + JSON.stringify({ toolResult: { name: 'web_fetch', result: 'Tool "web_fetch" is not permitted by workspace policy.' } }) + '\n\n',
    );
    expect(result).toBe('I cannot fetch that URL');
  });
});
```

- [ ] **Step 5: Run tests to verify**

```bash
cd backend && npx jest src/agent/services/agent-loop.service.spec.ts --verbose 2>&1 | tail -30
```

Expected: All tests PASS including the new permission test

- [ ] **Step 6: Run full test suite**

```bash
cd backend && npx jest --passWithNoTests 2>&1 | tail -10
```

Expected: All suites pass

- [ ] **Step 7: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts backend/src/agent/services/agent-loop.service.spec.ts
git commit -m "feat: enforce permission check in AgentLoopService before tool execution"
```

---

### Task 5: Register PermissionsService in AgentModule + update AGENTS.md

**Files:**
- Modify: `backend/src/agent/agent.module.ts`
- Modify: `backend/src/agent/AGENTS.md`

- [ ] **Step 1: Add PermissionsService to AgentModule providers**

In `agent.module.ts`, add import:

```typescript
import { PermissionsService } from './services/permissions.service';
```

Add `PermissionsService` to the providers array (after `ContextBuilderService`):

```typescript
providers: [
  AgentService,
  AgentLoopService,
  LLMControllerService,
  OllamaProvider,
  ContextBuilderService,
  PermissionsService,
  CreateTaskExecutor,
  // ... rest unchanged
],
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 3: Run full test suite**

```bash
cd backend && npx jest --passWithNoTests 2>&1 | tail -10
```

Expected: All suites pass

- [ ] **Step 4: Update AGENTS.md**

In `backend/src/agent/AGENTS.md`, add `PermissionsService` to the Responsibility section:

```
- `PermissionsService` — reads/writes `agent.permissions` config from SettingsService. `isAllowed(toolName)` returns true/false based on `deniedTools`, `allowedTools`, and `defaultPolicy`.
```

Add to Files section:

```
│   ├── permissions.service.ts      — permission config CRUD + isAllowed() check
│   └── permissions.service.spec.ts
```

Add to dto/ section:

```
│   ├── permissions-config.ts  — PermissionsConfig interface + DEFAULT_PERMISSIONS_CONFIG
│   └── update-permissions.dto.ts  — DTO for PATCH /api/agent/permissions body
```

Add to API section new endpoints:

```
| `GET` | `/api/agent/permissions` | Get current permissions config |
| `PATCH` | `/api/agent/permissions` | Update permissions config |
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/agent.module.ts backend/src/agent/AGENTS.md docs/superpowers/specs/2026-06-09-permissions-system-design.md docs/superpowers/plans/2026-06-09-permissions-system.md
git commit -m "feat: register PermissionsService in AgentModule and update docs"
```
