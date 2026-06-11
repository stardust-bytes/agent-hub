# Multi-Agent Subagent Spawn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `spawn_subagent` tool that lets the main agent delegate sub-tasks to a subagent with its own state machine loop.

**Architecture:** Re-entrant call to `AgentLoopService.run()` from within a tool executor. The subagent gets its own system prompt, AgentRunState, and tool set (same tools minus `spawn_subagent`). SSE events get `"subagent":true` marker for frontend distinction. No message persistence for subagent.

**Tech Stack:** NestJS, Prisma, SSE streaming, Vue 3

---

### Task 1: Refactor AgentLoopService to use WriteStream interface

**Files:**
- Create: `src/agent/dto/write-stream.interface.ts`
- Modify: `src/agent/services/agent-loop.service.ts` (type change only)
- Verify: `src/agent/agent.service.ts` (callers still compile)

- [ ] **Step 1: Create WriteStream interface**

Write `backend/src/agent/dto/write-stream.interface.ts`:
```typescript
export interface WriteStream {
  write(data: string): boolean;
}
```

- [ ] **Step 2: Change `res` parameter type in AgentLoopService methods**

In `backend/src/agent/services/agent-loop.service.ts`:
- Import `WriteStream` from `../dto/write-stream.interface`
- Change ALL `res: Response` to `res: WriteStream` in method signatures: `run()`, `executePlan()`, `runPlanMode()`, `runForStep()`
- Remove unused `import { Response } from 'express'`
- Keep all `res.write()` calls unchanged (they work the same)

- [ ] **Step 3: Update AgentService to match**

In `backend/src/agent/agent.service.ts`:
- The `streamChat()` method still passes `res: Response` (from Express controller)
- No change needed — Express Response satisfies `{ write(s: string): boolean }`

- [ ] **Step 4: Verify compilation**

Run: `cd backend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/dto/write-stream.interface.ts backend/src/agent/services/agent-loop.service.ts
git commit -m "refactor: extract WriteStream interface from Response type"
```

---

### Task 2: Create SubagentService

**Files:**
- Create: `backend/src/agent/subagent/subagent.service.ts`
- Create: `backend/src/agent/subagent/subagent.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Write `backend/src/agent/subagent/subagent.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { SubagentService } from './subagent.service';
import { AgentLoopService } from '../services/agent-loop.service';
import { PermissionsService } from '../services/permissions.service';

describe('SubagentService', () => {
  let service: SubagentService;
  let agentLoop: jest.Mocked<AgentLoopService>;

  beforeEach(async () => {
    agentLoop = { run: jest.fn().mockResolvedValue('subagent result') } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubagentService,
        { provide: AgentLoopService, useValue: agentLoop },
        { provide: PermissionsService, useValue: { isAllowed: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    service = module.get<SubagentService>(SubagentService);
  });

  it('should call AgentLoopService.run with subagent system prompt', async () => {
    const mockRes = { write: jest.fn() };
    await service.spawn(
      'refactor this function',
      'ollama', 'llama3.2',
      { baseUrl: 'http://localhost:11434' },
      [],
      new AbortController().signal,
      mockRes as any,
      1, 'agent',
    );

    expect(agentLoop.run).toHaveBeenCalledTimes(1);
    const callArgs = agentLoop.run.mock.calls[0];
    expect(callArgs[0]).toBe('ollama');   // providerType
    expect(callArgs[2]).toContain('refactor this function');  // systemPrompt
  });

  it('should return the subagent result', async () => {
    agentLoop.run.mockResolvedValue('done: refactored successfully');

    const result = await service.spawn(
      'refactor this function',
      'ollama', 'llama3.2',
      { baseUrl: 'http://localhost:11434' },
      [],
      new AbortController().signal,
      { write: jest.fn() } as any,
      1, 'agent',
    );

    expect(result).toBe('done: refactored successfully');
  });

  it('should prefix SSE events with subagent:true marker', async () => {
    const writeFn = jest.fn();
    agentLoop.run.mockImplementation(async (_pt, _m, _sp, _h, _um, _t, res: any) => {
      res.write('data: {"token":"hello"}\n\n');
      return 'done';
    });

    await service.spawn(
      'test task',
      'ollama', 'llama3.2',
      { baseUrl: 'http://localhost:11434' },
      [],
      new AbortController().signal,
      { write: writeFn } as any,
      1, 'agent',
    );

    expect(writeFn).toHaveBeenCalledWith(
      expect.stringContaining('"subagent":true'),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/agent/subagent/subagent.service -v`
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Write SubagentService**

Write `backend/src/agent/subagent/subagent.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { AgentLoopService } from '../services/agent-loop.service';
import { ToolDefinition } from '../services/context-builder.service';
import { WriteStream } from '../dto/write-stream.interface';

@Injectable()
export class SubagentService {
  constructor(private readonly agentLoop: AgentLoopService) {}

  async spawn(
    task: string,
    providerType: string,
    model: string,
    providerConfig: { baseUrl: string; key?: string },
    tools: ToolDefinition[],
    signal: AbortSignal,
    res: WriteStream,
    sessionId?: number,
    mode: string = 'agent',
  ): Promise<string> {
    const subagentPrompt =
      `You are a sub-agent. Your task: ${task}\n\n` +
      'You have access to the same workspace tools. Complete the task and report back concisely.';

    const subRes = this.createPrefixedResponse(res);

    return this.agentLoop.run(
      providerType, model, subagentPrompt, [], task,
      tools, subRes, signal, sessionId, mode, providerConfig,
    );
  }

  private createPrefixedResponse(res: WriteStream): WriteStream {
    const originalWrite = res.write.bind(res);
    return {
      write(data: string): boolean {
        // Suppress subagent [DONE] — would prematurely terminate main SSE stream.
        // Convert to subagent:done JSON event instead.
        if (data.includes('data: [DONE]')) {
          return originalWrite('data: {"subagent":true,"done":true}\n\n');
        }
        // Add subagent:true marker to all JSON SSE events
        const modified = data.replace(
          /^(data: )(\{.*?\})(\n\n)$/gm,
          (_match: string, prefix: string, json: string, suffix: string) => {
            try {
              const parsed = JSON.parse(json);
              parsed.subagent = true;
              return `${prefix}${JSON.stringify(parsed)}${suffix}`;
            } catch {
              return _match;
            }
          },
        );
        return originalWrite(modified);
      },
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/agent/subagent/subagent.service -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/subagent/subagent.service.ts backend/src/agent/subagent/subagent.service.spec.ts
git commit -m "feat: add SubagentService with SSE event prefixing"
```

---

### Task 3: Create SubagentExecutor (ToolExecutor)

**Files:**
- Create: `backend/src/tools/executors/spawn-subagent.executor.ts`
- Create: `backend/src/tools/executors/spawn-subagent.executor.spec.ts`

- [ ] **Step 1: Write the failing test**

Write `backend/src/tools/executors/spawn-subagent.executor.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { SpawnSubagentExecutor } from './spawn-subagent.executor';
import { SubagentService } from '../../agent/subagent/subagent.service';

describe('SpawnSubagentExecutor', () => {
  let executor: SpawnSubagentExecutor;
  let subagentService: jest.Mocked<SubagentService>;

  beforeEach(async () => {
    subagentService = { spawn: jest.fn().mockResolvedValue('result') } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpawnSubagentExecutor,
        { provide: SubagentService, useValue: subagentService },
      ],
    }).compile();

    executor = module.get<SpawnSubagentExecutor>(SpawnSubagentExecutor);
  });

  it('should have name "spawn_subagent"', () => {
    expect(executor.name).toBe('spawn_subagent');
  });

  it('should call SubagentService.spawn with task from args', async () => {
    await executor.execute({ task: 'analyze code' }, { mode: 'agent', sessionId: 1 });

    expect(subagentService.spawn).toHaveBeenCalledWith(
      'analyze code',
      expect.any(String),
      expect.any(String),
      expect.any(Object),
      expect.any(Array),
      expect.any(AbortSignal),
      expect.any(Object),
      1,
      'agent',
    );
  });

  it('should return error if task is missing', async () => {
    const result = await executor.execute({}, { mode: 'agent', sessionId: 1 });
    expect(result).toContain('Error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/tools/executors/spawn-subagent.executor -v`
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Write SpawnSubagentExecutor**

Write `backend/src/tools/executors/spawn-subagent.executor.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from './tool-executor.interface';
import { SubagentService } from '../../agent/subagent/subagent.service';

@Injectable()
export class SpawnSubagentExecutor implements ToolExecutor {
  readonly name = 'spawn_subagent';

  constructor(private readonly subagentService: SubagentService) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const task = args.task as string | undefined;
    if (!task) {
      return 'Error: spawn_subagent requires a "task" parameter';
    }

    throw new Error('spawn_subagent cannot be called directly via execute() — use AgentLoopService');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/tools/executors/spawn-subagent.executor -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/executors/spawn-subagent.executor.ts backend/src/tools/executors/spawn-subagent.executor.spec.ts
git commit -m "feat: add SpawnSubagentExecutor tool definition"
```

---

### Task 4: Update ContextBuilderService to include spawn_subagent tool definition

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`

- [ ] **Step 1: Add spawn_subagent tool definition in getEnabledTools**

In `backend/src/agent/services/context-builder.service.ts`, modify `getEnabledTools()` method.

After the MCP tools block (line 157), add:

```typescript
// Add spawn_subagent tool (always available in agent and cowork mode)
if (mode === 'agent' || mode === 'cowork') {
  tools.push({
    type: 'function' as const,
    function: {
      name: 'spawn_subagent',
      description: 'Spawn a sub-agent to complete a specific task. ' +
        'Use when you need to delegate independent work that can run in parallel ' +
        'or when a task requires focused attention.',
      parameters: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'The task for the sub-agent to complete. ' +
              'Be specific and include all context needed.',
          },
        },
        required: ['task'],
      },
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd backend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts
git commit -m "feat: add spawn_subagent tool definition to context builder"
```

---

### Task 5: Integrate subagent handling into AgentLoopService

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`
- Modify: `backend/src/agent/agent.module.ts`
- Modify: `backend/src/tools/tools.module.ts`

- [ ] **Step 1: Update AgentLoopService — inject SubagentService and handle spawn_subagent**

In `backend/src/agent/services/agent-loop.service.ts`:
- Import `SubagentService` from `../subagent/subagent.service`
- Add `private readonly subagentService: SubagentService` to constructor
- Add `spawn_subagent` to `executorMap` — but map it to a special handler, not a regular executor

The challenge: `spawn_subagent` cannot be executed via the regular `executeTool()` path because it needs access to the current provider config, tools list, signal, and response stream. It needs to be handled **inline** in the agent loop.

Add this to the `executeTool()` method:
```typescript
if (name === 'spawn_subagent') {
  const task = (args.task as string) ?? '';
  if (!task) return 'Error: spawn_subagent requires a "task" parameter';
  return this.subagentService.spawn(
    task, providerType, model, providerConfig,
    activeTools, signal, res, sessionId,
    mode as 'chat' | 'agent' | 'cowork',
  );
}
```

But wait — `executeTool()` doesn't have access to `providerType`, `model`, `providerConfig`, `activeTools`, or `signal`. These are local variables in `run()`. I need to either:
A. Pass them as extra context
B. Store them as instance variables
C. Handle `spawn_subagent` at the loop level (in EVALUATING phase), not in the tool execution

Option C is cleanest. In `run()`, during tool call iteration:

```typescript
// Before the regular executeTool call:
if (name === 'spawn_subagent') {
  const task = typeof args === 'object' && args !== null ? String((args as any).task ?? '') : '';
  if (!task) {
    result = 'Error: spawn_subagent requires a "task" parameter';
  } else {
    try {
      result = await this.subagentService.spawn(
        task, providerType, model, providerConfig,
        activeTools, signal, res, sessionId,
        mode as 'chat' | 'agent' | 'cowork',
      );
    } catch (e) {
      result = `Error: Subagent failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
  // After result, continue with the normal flow (emit toolResult, etc.)
}
```

The full modification to agent-loop.service.ts: In the EVALUATING phase, BEFORE calling `executeTool(name, args, context)`, check if `name === 'spawn_subagent'`. If so, handle it inline with SubagentService.

- [ ] **Step 2: Add SubagentService to AgentModule and ToolsModule**

In `backend/src/agent/agent.module.ts`:
- Import `SubagentService` from `./subagent/subagent.service`
- Add `SubagentService` to `providers: []` array

In `backend/src/tools/tools.module.ts`:
- Import `SpawnSubagentExecutor` from `./executors/spawn-subagent.executor`
- Add `SpawnSubagentExecutor` to `EXECUTORS` array and `providers: []` and `exports: []`

Also need to create `SubagentModule` or just register `SubagentService` directly in AgentModule.

- [ ] **Step 3: Verify compilation**

Run: `cd backend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Run existing tests**

Run: `cd backend && npx jest`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts backend/src/agent/agent.module.ts backend/src/tools/tools.module.ts
git commit -m "feat: integrate spawn_subagent into agent loop execution"
```

---

### Task 6: Update CoworkView.vue SSE handler for subagent events

**Files:**
- Modify: `frontend/src/components/CoworkView.vue`

- [ ] **Step 1: Add subagent event handling in the SSE reader**

In `frontend/src/components/CoworkView.vue`, find the SSE parsing loop (around line 511-589). After `if (parsed.error) { ... }`, add:

```typescript
} else if (parsed.subagent) {
  clearThinking()
  if (parsed.done) {
    // Subagent done — do NOT stop the SSE stream (main agent continues)
  } else if (parsed.token) {
    // Subagent streaming text tokens
    const idx = getOrCreateAgentMsg()
    messages.value[idx].content += String(parsed.token)
    if (!done) scrollToBottom()
  } else if (parsed.toolCall) {
    currentAgentIdx = -1
    const tc = parsed.toolCall as { name: string; args: Record<string, unknown> }
    const argsStr = Object.entries(tc.args).map(([k, v]) => `${k}=${v}`).join(', ')
    messages.value.push({
      role: 'tool',
      content: `[subagent] ${tc.name}(${argsStr})`,
      timestamp: now(),
      toolName: tc.name,
      isResult: false,
    })
    await scrollToBottom()
  } else if (parsed.toolResult) {
    const tr = parsed.toolResult as { name: string; result: string }
    messages.value.push({
      role: 'tool',
      content: `[subagent] ${tr.name}: ${tr.result}`,
      timestamp: now(),
      toolName: tr.name,
      isResult: true,
    })
    await scrollToBottom()
  } else if (parsed.thinking) {
    currentAgentIdx = -1
    messages.value.push({
      role: 'system',
      content: `⟳ [subagent] ${String(parsed.thinking)}`,
      timestamp: now(),
    })
    await scrollToBottom()
  }
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CoworkView.vue
git commit -m "feat: handle subagent SSE events in CoworkView"
```

---

### Task 7: Update ChatPanel.vue SSE handler for subagent events

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Add subagent event handling**

In `frontend/src/components/ChatPanel.vue`, find the SSE parsing loop (around line 237-259). After `} else if (parsed.error) { ... }`, add the same subagent handling block as Task 5 (exact same code pattern).

- [ ] **Step 2: Verify TypeScript**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: handle subagent SSE events in ChatPanel"
```

---

### Task 8: Update AGENTS.md files

**Files:**
- Modify: `backend/src/agent/AGENTS.md`
- Modify: `backend/src/tools/AGENTS.md` (if exists)

- [ ] **Step 1: Update agent AGENTS.md**

In `backend/src/agent/AGENTS.md`:
- Add `SubagentService` to module map
- Add `SubagentModule` to module list (if created)
- Add "SubagentService — orchestrates sub-loop execution, prefixes SSE events"

- [ ] **Step 2: Commit**

```bash
git add backend/src/agent/AGENTS.md
git commit -m "docs: update AGENTS.md with subagent module"
```
