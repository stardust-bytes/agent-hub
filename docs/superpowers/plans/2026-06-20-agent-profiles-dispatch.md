# Agent Profiles & Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add named, tool-scoped Agent Profiles plus controls (autonomous-dispatch toggle, concurrency cap, recursion block) and a `/agent <slug>` trigger on top of the existing sub-agent dispatch.

**Architecture:** A new `AgentProfile` Prisma model + `agent-profiles/` NestJS module supplies specializations. The agent loop resolves an optional `profile` slug on `spawn_subagent`/`delegate`, overrides the sub-agent system prompt, and filters tools (always stripping dispatch tools → depth-1). `ContextBuilderService` drops dispatch tools from the main agent when `agent.autoDispatch` is off. Users run a profile via `/agent <slug> <task>` parsed in `AgentService.streamChat`. A Settings tab manages profiles. Sub-agent runs already stream via `subagent:true` SSE events handled by the frontend.

**Tech Stack:** NestJS 10, Prisma 5 (SQLite), Vue 3 + Pinia + vue-router, Vitest/Jest, class-validator.

## Global Constraints

- Backend port `13596`; CORS origin only `http://localhost:17135`.
- All DB access via injected `PrismaService`; no raw SQL. Typed DTOs with `class-validator` on every POST/PATCH body. No `any`.
- Migrations are additive (nullable/defaulted columns); never edit historical migrations. Use `npx prisma migrate dev --name <name>` then `npx prisma generate`.
- Frontend: `font-mono`, max `rounded`, no shadows/gradients, icons from `vue-icons-plus/hi`, all user-facing strings via `t('key')` (vi primary, en secondary), `v-html` only via `DOMPurify`.
- Commit messages: lowercase type prefix (`feat`/`fix`/`test`/`chore`/`docs`), no trailing period, no `Co-Authored-By`.
- Update the relevant `AGENTS.md` before committing code that changes a module's status/files/endpoints/deps.

---

### Task 1: AgentProfile model, migration, and seed

**Files:**
- Modify: `backend/prisma/schema.prisma` (append model)
- Create: `backend/prisma/migrations/<generated>_add_agent_profile/migration.sql` (via CLI)
- Modify: `backend/prisma/seed.cjs` (seed 3 builtin profiles; add `profile` to dispatch tool schemas)

**Interfaces:**
- Produces: Prisma model `AgentProfile { id:Int, slug:string, name:string, description:string?, systemPrompt:string, allowedTools:string, modelId:int?, enabled:boolean, builtin:boolean, createdAt, updatedAt }`.

- [ ] **Step 1: Add the model to the schema**

Append to `backend/prisma/schema.prisma`:

```prisma
model AgentProfile {
  id           Int      @id @default(autoincrement())
  slug         String   @unique
  name         String
  description  String?
  systemPrompt String
  allowedTools String   @default("*")
  modelId      Int?
  enabled      Boolean  @default(true)
  builtin      Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

- [ ] **Step 2: Generate the migration**

Run: `cd backend && npx prisma migrate dev --name add_agent_profile`
Expected: a new migration folder is created and applied; `prisma generate` runs automatically.

- [ ] **Step 3: Seed builtin profiles and extend dispatch tool schemas**

In `backend/prisma/seed.cjs`, update the `spawn_subagent` and `delegate` entries to add an optional `profile` property, then add a profiles seed after the tools loop.

Replace the `spawn_subagent` parameters with:
```js
parameters: '{"type":"object","properties":{"task":{"type":"string","description":"The task for the sub-agent to complete. Be specific and include all context needed."},"profile":{"type":"string","description":"Optional agent profile slug to specialize the sub-agent."}},"required":["task"]}'
```
Replace the `delegate` parameters with:
```js
parameters: '{"type":"object","properties":{"tasks":{"type":"array","items":{"type":"string"},"description":"Array of subtask descriptions to execute in parallel"},"profile":{"type":"string","description":"Optional agent profile slug applied to all workers."}},"required":["tasks"]}'
```

Add before `main()`'s final log:
```js
const DEFAULT_PROFILES = [
  { slug: 'researcher', name: 'Researcher', description: 'Read-only research and synthesis', systemPrompt: 'You are a research sub-agent. Gather and synthesize information accurately. Report findings concisely with sources.', allowedTools: JSON.stringify(['search_knowledge','web_search','web_fetch','read_file','grep','glob','list_directory']), builtin: true },
  { slug: 'code-reviewer', name: 'Code Reviewer', description: 'Reviews code for bugs and clarity', systemPrompt: 'You are a code-review sub-agent. Inspect the code and report concrete issues (bugs, risks, simplifications) with file:line references. Do not modify files.', allowedTools: JSON.stringify(['read_file','grep','glob','list_directory']), builtin: true },
  { slug: 'explorer', name: 'Explorer', description: 'Broad codebase search', systemPrompt: 'You are an exploration sub-agent. Locate relevant files and summarize where things live. Return paths and short excerpts, not full files.', allowedTools: JSON.stringify(['grep','glob','list_directory','read_file']), builtin: true },
];
for (const p of DEFAULT_PROFILES) {
  await prisma.agentProfile.upsert({
    where: { slug: p.slug },
    update: { name: p.name, description: p.description, systemPrompt: p.systemPrompt, allowedTools: p.allowedTools, builtin: true },
    create: p,
  });
}
console.log(`Seeded ${DEFAULT_PROFILES.length} agent profiles`);
```

- [ ] **Step 4: Run the seed**

Run: `cd backend && node prisma/seed.cjs`
Expected: logs "Seeded N tools" and "Seeded 3 agent profiles" with no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/prisma/seed.cjs
git commit -m "feat: add AgentProfile model, migration, and seed"
```

---

### Task 2: AgentProfilesService

**Files:**
- Create: `backend/src/agent-profiles/agent-profiles.service.ts`
- Test: `backend/src/agent-profiles/agent-profiles.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`.
- Produces: `AgentProfilesService` with `findAll(): Promise<AgentProfile[]>`, `findBySlug(slug: string): Promise<AgentProfile | null>`, `findEnabled(): Promise<AgentProfile[]>`, `create(dto): Promise<AgentProfile>`, `update(id, dto): Promise<AgentProfile>`, `remove(id): Promise<AgentProfile>` (throws if `builtin`).

- [ ] **Step 1: Write the failing test**

Create `backend/src/agent-profiles/agent-profiles.service.spec.ts`:
```ts
import { AgentProfilesService } from './agent-profiles.service';

describe('AgentProfilesService', () => {
  const builtin = { id: 1, slug: 'researcher', builtin: true };
  let prisma: any;
  let service: AgentProfilesService;

  beforeEach(() => {
    prisma = {
      agentProfile: {
        findMany: jest.fn().mockResolvedValue([builtin]),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 2, ...data })),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new AgentProfilesService(prisma);
  });

  it('finds a profile by slug', async () => {
    prisma.agentProfile.findUnique.mockResolvedValue(builtin);
    expect(await service.findBySlug('researcher')).toEqual(builtin);
    expect(prisma.agentProfile.findUnique).toHaveBeenCalledWith({ where: { slug: 'researcher' } });
  });

  it('refuses to delete a builtin profile', async () => {
    prisma.agentProfile.findUnique.mockResolvedValue(builtin);
    await expect(service.remove(1)).rejects.toThrow('profile_builtin_readonly');
    expect(prisma.agentProfile.delete).not.toHaveBeenCalled();
  });

  it('deletes a non-builtin profile', async () => {
    prisma.agentProfile.findUnique.mockResolvedValue({ id: 3, builtin: false });
    await service.remove(3);
    expect(prisma.agentProfile.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/agent-profiles/agent-profiles.service.spec.ts`
Expected: FAIL — cannot find module `./agent-profiles.service`.

- [ ] **Step 3: Implement the service**

Create `backend/src/agent-profiles/agent-profiles.service.ts`:
```ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentProfileDto } from './dto/create-agent-profile.dto';
import { UpdateAgentProfileDto } from './dto/update-agent-profile.dto';

@Injectable()
export class AgentProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.agentProfile.findMany({ orderBy: { name: 'asc' } });
  }

  findEnabled() {
    return this.prisma.agentProfile.findMany({ where: { enabled: true }, orderBy: { name: 'asc' } });
  }

  findBySlug(slug: string) {
    return this.prisma.agentProfile.findUnique({ where: { slug } });
  }

  create(dto: CreateAgentProfileDto) {
    return this.prisma.agentProfile.create({ data: { ...dto, builtin: false } });
  }

  async update(id: number, dto: UpdateAgentProfileDto) {
    return this.prisma.agentProfile.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    const existing = await this.prisma.agentProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('profile_not_found');
    if (existing.builtin) throw new BadRequestException('profile_builtin_readonly');
    return this.prisma.agentProfile.delete({ where: { id } });
  }
}
```

Note: Steps for the DTO files referenced here are completed in Task 3; create empty-but-valid DTO stubs now is unnecessary because Jest tests this service with mocked Prisma and does not import the controller. To keep the file compiling, also create the DTOs in Task 3 before building. If running `jest` only on this spec, the DTO imports must resolve — so create the two DTO files from Task 3 Step 3 now as well.

- [ ] **Step 4: Create the DTOs (shared with Task 3)**

Create `backend/src/agent-profiles/dto/create-agent-profile.dto.ts`:
```ts
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateAgentProfileDto {
  @IsString() @IsNotEmpty() slug: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsString() @IsNotEmpty() systemPrompt: string;
  @IsOptional() @IsString() allowedTools?: string;
  @IsOptional() @IsInt() modelId?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
```

Create `backend/src/agent-profiles/dto/update-agent-profile.dto.ts`:
```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateAgentProfileDto } from './create-agent-profile.dto';

export class UpdateAgentProfileDto extends PartialType(CreateAgentProfileDto) {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/agent-profiles/agent-profiles.service.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/agent-profiles
git commit -m "feat: add AgentProfilesService with builtin-delete guard"
```

---

### Task 3: AgentProfilesController + module

**Files:**
- Create: `backend/src/agent-profiles/agent-profiles.controller.ts`
- Create: `backend/src/agent-profiles/agent-profiles.module.ts`
- Test: `backend/src/agent-profiles/agent-profiles.controller.spec.ts`
- Modify: `backend/src/app.module.ts` (register module)

**Interfaces:**
- Consumes: `AgentProfilesService` (Task 2), DTOs (Task 2 Step 4).
- Produces: routes `GET /api/agent-profiles`, `POST /api/agent-profiles`, `PATCH /api/agent-profiles/:id`, `DELETE /api/agent-profiles/:id`. Exports `AgentProfilesService`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/agent-profiles/agent-profiles.controller.spec.ts`:
```ts
import { AgentProfilesController } from './agent-profiles.controller';

describe('AgentProfilesController', () => {
  const service = {
    findAll: jest.fn().mockResolvedValue([{ id: 1 }]),
    create: jest.fn().mockResolvedValue({ id: 2 }),
    update: jest.fn().mockResolvedValue({ id: 2 }),
    remove: jest.fn().mockResolvedValue({ id: 2 }),
  } as any;
  const controller = new AgentProfilesController(service);

  it('lists profiles', async () => {
    expect(await controller.findAll()).toEqual([{ id: 1 }]);
  });

  it('deletes by numeric id', async () => {
    await controller.remove('2');
    expect(service.remove).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/agent-profiles/agent-profiles.controller.spec.ts`
Expected: FAIL — cannot find module `./agent-profiles.controller`.

- [ ] **Step 3: Implement controller and module**

Create `backend/src/agent-profiles/agent-profiles.controller.ts`:
```ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { AgentProfilesService } from './agent-profiles.service';
import { CreateAgentProfileDto } from './dto/create-agent-profile.dto';
import { UpdateAgentProfileDto } from './dto/update-agent-profile.dto';

@Controller('agent-profiles')
export class AgentProfilesController {
  constructor(private readonly service: AgentProfilesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateAgentProfileDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAgentProfileDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
```

(The test calls `controller.remove('2')`; `ParseIntPipe` only runs through HTTP, so the unit test passes a string and the controller forwards it — update the test expectation to `service.remove('2')` OR keep the controller signature as `id: number` and have the test pass `2`. Use the test as written by changing its call to `await controller.remove(2 as any)` and assertion to `toHaveBeenCalledWith(2)`.)

Create `backend/src/agent-profiles/agent-profiles.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AgentProfilesService } from './agent-profiles.service';
import { AgentProfilesController } from './agent-profiles.controller';

@Module({
  controllers: [AgentProfilesController],
  providers: [AgentProfilesService],
  exports: [AgentProfilesService],
})
export class AgentProfilesModule {}
```

- [ ] **Step 4: Register the module**

In `backend/src/app.module.ts`, import `AgentProfilesModule` and add it to the `imports` array (place it after `AgentModule`).

- [ ] **Step 5: Run tests and build**

Run: `cd backend && npx jest src/agent-profiles && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 6: Create the module AGENTS.md**

Create `backend/src/agent-profiles/AGENTS.md` documenting purpose, files, endpoints (the 4 routes), DTOs, dependencies (PrismaService), and that it is consumed by AgentModule. Follow the format of `backend/src/notes/AGENTS.md`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/agent-profiles backend/src/app.module.ts
git commit -m "feat: add agent-profiles REST module"
```

---

### Task 4: Sub-agent tool filtering + concurrency helpers

**Files:**
- Create: `backend/src/agent/subagent/subagent-tools.util.ts`
- Test: `backend/src/agent/subagent/subagent-tools.util.spec.ts`

**Interfaces:**
- Consumes: `ToolDefinition` from `../services/context-builder.service`.
- Produces:
  - `filterSubagentTools(tools: ToolDefinition[], allowedTools?: string): ToolDefinition[]` — always removes `spawn_subagent` and `delegate`; if `allowedTools` is a JSON array string, keeps only those names; `"*"`/undefined keeps the rest.
  - `runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>` — runs `fn` over items with at most `limit` in flight, preserving input order.

- [ ] **Step 1: Write the failing test**

Create `backend/src/agent/subagent/subagent-tools.util.spec.ts`:
```ts
import { filterSubagentTools, runWithConcurrency } from './subagent-tools.util';

const def = (name: string) => ({ type: 'function' as const, function: { name, description: '', parameters: {} } });

describe('filterSubagentTools', () => {
  const tools = [def('read_file'), def('grep'), def('spawn_subagent'), def('delegate'), def('web_search')];

  it('always strips dispatch tools (recursion block)', () => {
    const names = filterSubagentTools(tools, '*').map(t => t.function.name);
    expect(names).not.toContain('spawn_subagent');
    expect(names).not.toContain('delegate');
    expect(names).toContain('read_file');
  });

  it('restricts to allowedTools list', () => {
    const names = filterSubagentTools(tools, JSON.stringify(['read_file', 'grep'])).map(t => t.function.name);
    expect(names).toEqual(['read_file', 'grep']);
  });
});

describe('runWithConcurrency', () => {
  it('preserves order and caps parallelism', async () => {
    let inFlight = 0, maxInFlight = 0;
    const fn = async (n: number) => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--; return n * 2;
    };
    const out = await runWithConcurrency([1, 2, 3, 4, 5], 2, fn);
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/agent/subagent/subagent-tools.util.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the utilities**

Create `backend/src/agent/subagent/subagent-tools.util.ts`:
```ts
import { ToolDefinition } from '../services/context-builder.service';

const DISPATCH_TOOLS = new Set(['spawn_subagent', 'delegate']);

export function filterSubagentTools(tools: ToolDefinition[], allowedTools?: string): ToolDefinition[] {
  let allowed: Set<string> | null = null;
  if (allowedTools && allowedTools !== '*') {
    try {
      const parsed = JSON.parse(allowedTools);
      if (Array.isArray(parsed)) allowed = new Set(parsed.map(String));
    } catch { /* treat as wildcard */ }
  }
  return tools.filter(t => {
    const name = t.function.name;
    if (DISPATCH_TOOLS.has(name)) return false;
    if (allowed && !allowed.has(name)) return false;
    return true;
  });
}

export async function runWithConcurrency<T, R>(
  items: T[], limit: number, fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/agent/subagent/subagent-tools.util.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/subagent/subagent-tools.util.ts backend/src/agent/subagent/subagent-tools.util.spec.ts
git commit -m "feat: add subagent tool-filter and concurrency helpers"
```

---

### Task 5: Apply profile + concurrency in SubagentService

**Files:**
- Modify: `backend/src/agent/subagent/subagent.service.ts`
- Test: `backend/src/agent/subagent/subagent.service.spec.ts` (extend)

**Interfaces:**
- Consumes: `filterSubagentTools`, `runWithConcurrency` (Task 4).
- Produces: `spawn(...)` and `delegate(...)` gain a trailing optional `systemPromptOverride?: string`; `delegate` caps parallelism at `MAX_PARALLEL = 4` via `runWithConcurrency`; `spawn` uses `systemPromptOverride` when provided.

- [ ] **Step 1: Write the failing test**

Add to `backend/src/agent/subagent/subagent.service.spec.ts` a test that `spawn` forwards the override prompt to `agentLoop.run`:
```ts
it('uses the profile system prompt override when provided', async () => {
  const agentLoop = { run: jest.fn().mockResolvedValue('done') } as any;
  const service = new (require('./subagent.service').SubagentService)(agentLoop);
  const res = { write: jest.fn() };
  const tools: any[] = [];
  await service.spawn('do x', 'ollama', 'm', { baseUrl: 'u' }, tools, new AbortController().signal, res, 1, undefined, 'CUSTOM PROMPT');
  const promptArg = agentLoop.run.mock.calls[0][2];
  expect(promptArg).toBe('CUSTOM PROMPT');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/agent/subagent/subagent.service.spec.ts -t "profile system prompt"`
Expected: FAIL — current `spawn` ignores the extra arg and builds a generic prompt.

- [ ] **Step 3: Update SubagentService**

In `backend/src/agent/subagent/subagent.service.ts`:
- Add import: `import { runWithConcurrency } from './subagent-tools.util';`
- Add a constant near the top of the class: `private static readonly MAX_PARALLEL = 4;`
- Change `spawn(...)` signature to append `systemPromptOverride?: string` and set:
```ts
const subagentPrompt = systemPromptOverride ??
  (`You are a sub-agent. Your task: ${task}\n\n` +
   'You have access to the same workspace tools. Complete the task and report back concisely.');
```
- Change `delegate(...)` signature to append `systemPromptOverride?: string`, and replace the `tasks.map(...)` + `Promise.allSettled` block with:
```ts
const results = await runWithConcurrency(tasks, SubagentService.MAX_PARALLEL, async (task, i) => {
  res.write(`data: ${JSON.stringify({ delegateProgress: { requestId, index: i, subtask: task, status: 'running' } })}\n\n`);
  try {
    const summary = await this.spawn(task, providerType, model, providerConfig, tools, signal, res, sessionId, projectPath, systemPromptOverride);
    return { index: i, task, status: 'completed' as const, summary: summary.slice(0, 200) };
  } catch (err) {
    return { index: i, task, status: 'failed' as const, summary: (err as Error).message ?? 'Unknown error' };
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/agent/subagent`
Expected: PASS (existing + new test).

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/subagent/subagent.service.ts backend/src/agent/subagent/subagent.service.spec.ts
git commit -m "feat: support profile prompt override and concurrency cap in SubagentService"
```

---

### Task 6: Resolve profile in the agent loop dispatch

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts` (spawn_subagent/delegate handlers, ~lines 297-329)
- Modify: `backend/src/agent/agent.module.ts` (import `AgentProfilesModule`)
- Test: `backend/src/agent/services/agent-loop.service.spec.ts` (add a focused test if the loop is unit-testable; otherwise cover via the helper tests in Task 4 and a controller-level check)

**Interfaces:**
- Consumes: `AgentProfilesService.findBySlug`, `filterSubagentTools` (Task 4), `SubagentService.spawn/delegate` override param (Task 5).
- Produces: when `args.profile` is set and resolves to an enabled profile, the sub-agent uses that profile's prompt + filtered tools; an unknown/disabled slug yields a tool result string `Error: unknown agent profile "<slug>"` without throwing. With no profile, sub-agent tools are still passed through `filterSubagentTools(activeTools)` (dispatch tools stripped).

- [ ] **Step 1: Add the dependency**

In `backend/src/agent/agent.module.ts`, import `AgentProfilesModule` and add it to `imports`. Inject `AgentProfilesService` into `AgentLoopService` (constructor) — it is exported by `AgentProfilesModule`.

- [ ] **Step 2: Write the failing test**

Add to `backend/src/agent/services/agent-loop.service.spec.ts` a test (mirroring existing mocks in that file) asserting that calling the loop with a `spawn_subagent` tool call whose `args.profile = 'nope'` (no such profile) produces a tool result containing `unknown agent profile`. Use the file's existing harness for constructing `AgentLoopService` with mocked dependencies; add a mocked `agentProfilesService = { findBySlug: jest.fn().mockResolvedValue(null) }`.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest src/agent/services/agent-loop.service.spec.ts -t "unknown agent profile"`
Expected: FAIL.

- [ ] **Step 4: Implement profile resolution**

In `backend/src/agent/services/agent-loop.service.ts`, add import:
```ts
import { filterSubagentTools } from '../subagent/subagent-tools.util';
import { AgentProfilesService } from '../../agent-profiles/agent-profiles.service';
```
Inject `private readonly agentProfilesService: AgentProfilesService` in the constructor.

Replace the `spawn_subagent` branch body with:
```ts
const argsObj = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {};
const task = String(argsObj.task ?? '');
const profileSlug = argsObj.profile ? String(argsObj.profile) : undefined;
if (!task) {
  result = 'Error: spawn_subagent requires a "task" parameter';
} else {
  let promptOverride: string | undefined;
  let allowedTools: string | undefined;
  if (profileSlug) {
    const profile = await this.agentProfilesService.findBySlug(profileSlug);
    if (!profile || !profile.enabled) {
      result = `Error: unknown agent profile "${profileSlug}"`;
    } else {
      promptOverride = profile.systemPrompt;
      allowedTools = profile.allowedTools;
    }
  }
  if (result === undefined) {
    const subTools = filterSubagentTools(activeTools, allowedTools);
    try {
      result = await this.subagentService.spawn(
        task, providerType, model, providerConfig, subTools, signal, res, sessionId, projectPath, promptOverride,
      );
    } catch (e) {
      result = `Error: Subagent failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```
(Initialize `let result: string | undefined;` so the `result === undefined` guard works, and ensure the `delegate` branch and the fall-through `else` still assign `result`.)

Apply the analogous change to the `delegate` branch: read `argsObj.profile`, resolve profile the same way, compute `subTools = filterSubagentTools(activeTools, allowedTools)`, and call `this.subagentService.delegate(taskList, providerType, model, providerConfig, subTools, signal, res, sessionId, projectPath, promptOverride)`.

- [ ] **Step 5: Run tests and build**

Run: `cd backend && npx jest src/agent && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 6: Update agent/AGENTS.md**

In `backend/src/agent/AGENTS.md`, add `AgentProfilesModule` to Dependencies and note that `spawn_subagent`/`delegate` accept an optional `profile` slug (prompt + scoped tools; dispatch tools always stripped → depth 1).

- [ ] **Step 7: Commit**

```bash
git add backend/src/agent
git commit -m "feat: resolve agent profile and scope tools in dispatch"
```

---

### Task 7: Autonomous-dispatch toggle in ContextBuilder

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts` (`getEnabledTools`, constructor)
- Test: `backend/src/agent/services/context-builder.service.spec.ts` (extend)

**Interfaces:**
- Consumes: `SettingsService.get(key, fallback)`.
- Produces: `getEnabledTools()` removes `spawn_subagent` and `delegate` from the main agent's tool list when `Setting agent.autoDispatch === 'false'` (default keeps them).

- [ ] **Step 1: Write the failing test**

Add to `context-builder.service.spec.ts` a test: with `settingsService.get` returning `'false'` for `agent.autoDispatch`, the result of `build()` has `tools` excluding `spawn_subagent`/`delegate`; with `'true'`/default they remain. Use the existing spec's mock setup; add a `settingsService = { get: jest.fn() }` mock and pass it to the constructor.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/agent/services/context-builder.service.spec.ts -t "autoDispatch"`
Expected: FAIL — constructor has no SettingsService / tools not filtered.

- [ ] **Step 3: Implement the toggle**

In `context-builder.service.ts`:
- Add `import { SettingsService } from '../../settings/settings.service';`
- Add `private readonly settings: SettingsService` to the constructor.
- At the end of `getEnabledTools()`, before `return tools;`:
```ts
const autoDispatch = (await this.settings.get('agent.autoDispatch', 'true')) !== 'false';
if (!autoDispatch) {
  return tools.filter(t => t.function.name !== 'spawn_subagent' && t.function.name !== 'delegate');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/agent/services/context-builder.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts backend/src/agent/services/context-builder.service.spec.ts
git commit -m "feat: gate autonomous dispatch behind agent.autoDispatch setting"
```

---

### Task 8: `/agent <slug> <task>` command

**Files:**
- Create: `backend/src/agent/dto/agent-command.util.ts` (pure parser)
- Test: `backend/src/agent/dto/agent-command.util.spec.ts`
- Modify: `backend/src/agent/agent.service.ts` (`streamChat`)

**Interfaces:**
- Consumes: `AgentProfilesService.findBySlug` / `findEnabled`, `filterSubagentTools`, `ContextBuilderService.build(runState, sessionId, systemPromptOverride)`, `AgentLoopService.run(...)`.
- Produces: `parseAgentCommand(message: string): { slug: string; task: string } | null` (matches `^/agent <slug> <task>` where slug is `[a-z0-9-]+`).

- [ ] **Step 1: Write the failing test**

Create `backend/src/agent/dto/agent-command.util.spec.ts`:
```ts
import { parseAgentCommand } from './agent-command.util';

describe('parseAgentCommand', () => {
  it('parses slug and task', () => {
    expect(parseAgentCommand('/agent researcher find the bug')).toEqual({ slug: 'researcher', task: 'find the bug' });
  });
  it('returns null for non-agent messages', () => {
    expect(parseAgentCommand('hello world')).toBeNull();
  });
  it('returns null when task is missing', () => {
    expect(parseAgentCommand('/agent researcher')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/agent/dto/agent-command.util.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

Create `backend/src/agent/dto/agent-command.util.ts`:
```ts
export function parseAgentCommand(message: string): { slug: string; task: string } | null {
  const m = message.match(/^\/agent\s+([a-z0-9-]+)\s+([\s\S]+)$/);
  if (!m) return null;
  const task = m[2].trim();
  if (!task) return null;
  return { slug: m[1], task };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/agent/dto/agent-command.util.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into streamChat**

In `backend/src/agent/agent.service.ts`:
- Inject `private readonly agentProfiles: AgentProfilesService` (import from `../../agent-profiles/agent-profiles.service`) — `AgentProfilesModule` is already imported into `AgentModule` from Task 6.
- Import `parseAgentCommand` and `filterSubagentTools`.
- After the provider/projectPath resolution and **before** the `/plan` block, add:
```ts
const agentCmd = parseAgentCommand(message);
if (agentCmd) {
  const profile = await this.agentProfiles.findBySlug(agentCmd.slug);
  if (!profile || !profile.enabled) {
    const enabled = await this.agentProfiles.findEnabled();
    const slugs = enabled.map(p => p.slug).join(', ') || '(none)';
    res.write(`data: ${JSON.stringify({ error: `unknown agent profile "${agentCmd.slug}". Available: ${slugs}` })}\n\n`);
    res.write('data: [DONE]\n\n');
    return;
  }
  let cmdProviderType = providerType;
  let cmdModel = providerModel.name;
  let cmdProviderConfig = providerConfig;
  if (profile.modelId) {
    const pm = await this.providersService.findModelWithProvider(profile.modelId);
    if (pm) {
      cmdProviderType = pm.provider.type ?? 'ollama';
      cmdModel = pm.name;
      cmdProviderConfig = { baseUrl: pm.provider.baseUrl ?? 'http://localhost:11434', key: pm.provider.key ?? undefined };
    }
  }
  const runState = { step: 0, maxIterations: 10, roomId: String(sessionId), steps: [], startTime: Date.now(), currentState: 'PLANNING' } as AgentRunState;
  const context = await this.contextBuilder.build(runState, sessionId, profile.systemPrompt);
  const tools = filterSubagentTools(context.tools, profile.allowedTools);
  const history = await this.sessionsService.getHistory(sessionId);
  if (!signal.aborted) await this.sessionsService.saveMessage(sessionId, 'user', message);
  await this.agentLoop.run(cmdProviderType, cmdModel, profile.systemPrompt, history, agentCmd.task, tools, res, signal, sessionId, cmdProviderConfig);
  return;
}
```

- [ ] **Step 6: Run tests and build**

Run: `cd backend && npx jest src/agent && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/agent/dto/agent-command.util.ts backend/src/agent/dto/agent-command.util.spec.ts backend/src/agent/agent.service.ts
git commit -m "feat: add /agent slash command to run a profile"
```

---

### Task 9: Frontend data layer (api + store)

**Files:**
- Create: `frontend/src/api/agentProfiles.ts`
- Create: `frontend/src/stores/agentProfiles.ts`

**Interfaces:**
- Consumes: `request`/`errorCode` from `./client`.
- Produces: `AgentProfile` type; `listAgentProfiles/createAgentProfile/updateAgentProfile/deleteAgentProfile`; `useAgentProfilesStore` with `profiles`, `error`, `load`, `create`, `update`, `remove`.

- [ ] **Step 1: Write the api module**

Create `frontend/src/api/agentProfiles.ts`:
```ts
import { request } from './client'

export interface AgentProfile {
  id: number
  slug: string
  name: string
  description?: string | null
  systemPrompt: string
  allowedTools: string
  modelId?: number | null
  enabled: boolean
  builtin: boolean
}

type ProfileBody = Omit<AgentProfile, 'id' | 'builtin'>

export function listAgentProfiles() {
  return request<AgentProfile[]>('/agent-profiles', { errorCode: 'agents.fetch_failed' })
}
export function createAgentProfile(body: ProfileBody) {
  return request<AgentProfile>('/agent-profiles', { method: 'POST', body, errorCode: 'agents.save_failed' })
}
export function updateAgentProfile(id: number, body: Partial<ProfileBody>) {
  return request<AgentProfile>(`/agent-profiles/${id}`, { method: 'PATCH', body, errorCode: 'agents.save_failed' })
}
export function deleteAgentProfile(id: number) {
  return request<void>(`/agent-profiles/${id}`, { method: 'DELETE', errorCode: 'agents.delete_failed' })
}
```

- [ ] **Step 2: Write the store**

Create `frontend/src/stores/agentProfiles.ts`:
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/agentProfiles'
import { errorCode } from '../api/client'

export const useAgentProfilesStore = defineStore('agentProfiles', () => {
  const profiles = ref<api.AgentProfile[]>([])
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    try { profiles.value = await api.listAgentProfiles() }
    catch (e) { error.value = errorCode(e) }
  }
  async function create(body: Parameters<typeof api.createAgentProfile>[0]) { await api.createAgentProfile(body); await load() }
  async function update(id: number, body: Parameters<typeof api.updateAgentProfile>[1]) { await api.updateAgentProfile(id, body); await load() }
  async function remove(id: number) { await api.deleteAgentProfile(id); await load() }

  return { profiles, error, load, create, update, remove }
})
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run type-check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/agentProfiles.ts frontend/src/stores/agentProfiles.ts
git commit -m "feat: add agent profiles api client and store"
```

---

### Task 10: Frontend Agents tab + slash command + i18n

**Files:**
- Create: `frontend/src/components/AgentsView.vue`
- Modify: `frontend/src/components/SettingsView.vue` (add "Agents" tab rendering `AgentsView`)
- Modify: `frontend/src/components/SlashMenu.vue` (add `/agent` suggestion listing enabled slugs)
- Modify: `frontend/src/locales/vi.json`, `frontend/src/locales/en.json` (add `agents.*` keys)

**Interfaces:**
- Consumes: `useAgentProfilesStore` (Task 9), `useProvidersStore` (for model select), `BaseConfirmModal`, `ModelSelector`.
- Produces: an `agents` settings tab; SlashMenu entries `/agent <slug>`.

- [ ] **Step 1: Add i18n keys**

In `frontend/src/locales/vi.json` and `en.json`, add an `agents` object with keys: `header`, `add`, `name`, `slug`, `description`, `systemPrompt`, `allowedTools`, `model`, `enabled`, `builtin`, `save`, `delete`, `test`, `autoDispatch`, `fetch_failed`, `save_failed`, `delete_failed`. vi values in Vietnamese, en in English. Example (vi): `"agents": { "header": "Agents", "add": "Thêm agent", ... }`.

- [ ] **Step 2: Build AgentsView**

Create `frontend/src/components/AgentsView.vue` using `<script setup lang="ts">`: on mount call `store.load()`; render the standard header pattern (see `components/AGENTS.md`); list profiles (name, slug, builtin badge, enabled toggle); a create/edit form with fields name, slug, description, systemPrompt (textarea), allowedTools (comma input stored as JSON array string or `*`), model via `ModelSelector`, enabled checkbox; delete via `BaseConfirmModal` (hidden for `builtin`). All strings via `t('agents.*')`, `font-mono`, no `rounded-lg`/shadows/gradients, icons from `vue-icons-plus/hi`.

- [ ] **Step 3: Register the Agents tab in SettingsView**

In `frontend/src/components/SettingsView.vue`: import `AgentsView`, add an `agents` entry to the tab list/registry (mirroring how `ProvidersView`/`ToolsView` tabs are added), and render `<AgentsView v-if="tab === 'agents'" />`. Add an `agent.autoDispatch` toggle here calling `settings` API (reuse the existing settings PATCH used by other toggles in this view).

- [ ] **Step 4: Add /agent to SlashMenu**

In `frontend/src/components/SlashMenu.vue`: fetch enabled profiles (via the store) and add suggestions of the form `/agent <slug>` with the profile name as description, filtered by the current input. Follow the existing suggestion item structure in that file.

- [ ] **Step 5: Type-check and run**

Run: `cd frontend && npm run type-check`
Expected: no errors. Then `npm run build` to confirm the app compiles.

- [ ] **Step 6: Update frontend AGENTS.md files**

In `frontend/src/components/AGENTS.md` and `frontend/AGENTS.md`, add `AgentsView.vue` (settings tab), and note the `/agent` SlashMenu entry and the `agentProfiles` api/store.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat: add Agents settings tab, /agent slash command, and i18n"
```

---

## Self-Review

**Spec coverage:**
- §3 data model → Task 1. `agent.autoDispatch` setting → Task 7 (default-true via `get` fallback; no seed needed).
- §4.1 module/service/controller/DTOs → Tasks 2–3.
- §4.2 profile arg + resolution + tool scoping + recursion strip + concurrency cap + autonomous toggle → Tasks 4–7.
- §4.3 `/agent` parser + run → Task 8.
- §5 frontend (api/store/view/tab/SlashMenu/i18n) → Tasks 9–10.
- §6 error handling → Task 2 (builtin guard), Task 6 (unknown slug in loop), Task 8 (unknown slug in chat), global ValidationPipe.
- §8 testing → unit specs in Tasks 2,3,4,5,6,7,8.

**Placeholder scan:** Frontend Tasks 10 Steps 2–4 describe component construction in prose rather than full `.vue` code because they must follow existing, unread component conventions (ToolsView/ProvidersView tab wiring, SlashMenu item shape); the implementer is directed to mirror the named existing files. All backend steps contain complete code.

**Type consistency:** `filterSubagentTools(tools, allowedTools?)` and `runWithConcurrency(items, limit, fn)` signatures match across Tasks 4–8. `spawn`/`delegate` gain the same trailing `systemPromptOverride?: string` in Tasks 5–6. `parseAgentCommand` returns `{ slug, task } | null` consistently. `AgentProfile.allowedTools` is a JSON string everywhere (BE + FE).

**Note for implementer:** Task 2 Step 3 and Task 3 controller note clarify that the controller unit test should pass a numeric id (`ParseIntPipe` runs only over HTTP). Resolve the `result` variable typing in Task 6 Step 4 by declaring `let result: string | undefined;` and ensuring every branch assigns it before use.
