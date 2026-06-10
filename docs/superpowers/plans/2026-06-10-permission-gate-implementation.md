# Permission Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize mode-based tool/filesystem permissions into a single ModePolicy config, sandbox Agent mode file writes to `workspace_data/agent-output/session_{id}/`.

**Architecture:** Static `MODE_POLICY` config object defines per-mode policies (tool allow/deny, allowed paths, system prompt style). `ModePolicyService` resolves placeholders and filters tools. `ToolContext` (mode + sessionId) passed to executors so they can enforce mode-specific behavior.

**Tech Stack:** NestJS, TypeScript, Prisma, Jest

---

## File Structure

### New files:
- `backend/src/mode-policy/mode-policy.config.ts` — static MODE_POLICY object
- `backend/src/mode-policy/mode-policy.service.ts` — policy resolution + path placeholder replacement
- `backend/src/mode-policy/mode-policy.service.spec.ts` — unit tests for ModePolicyService
- `backend/src/mode-policy/mode-policy.module.ts` — exports ModePolicyService

### Modified files:
- `backend/src/tools/executors/tool-executor.interface.ts` — add ToolContext
- `backend/src/tools/executors/write-file.executor.ts` — agent mode sandbox
- `backend/src/tools/executors/write-file.executor.spec.ts` — update tests for agent sandbox
- `backend/src/agent/services/context-builder.service.ts` — use ModePolicyService
- `backend/src/agent/services/context-builder.service.spec.ts` — update tests
- `backend/src/agent/services/agent-loop.service.ts` — remove mode filter, pass ToolContext
- `backend/src/agent/services/agent-loop.service.spec.ts` — update tests
- `backend/src/agent/agent.module.ts` — import ModePolicyModule
- `backend/src/app.module.ts` — import ModePolicyModule

---

### Task 1: Create ModePolicy config + module + service

**Files:**
- Create: `backend/src/mode-policy/mode-policy.config.ts`
- Create: `backend/src/mode-policy/mode-policy.service.ts`
- Create: `backend/src/mode-policy/mode-policy.service.spec.ts`
- Create: `backend/src/mode-policy/mode-policy.module.ts`

- [ ] **Step 1: Create `mode-policy.config.ts`**

```typescript
export type SystemPromptStyle = 'chat' | 'agent' | 'cowork';

export interface ModePolicyEntry {
  enabledTools: '*' | string[];
  deniedTools: string[];
  allowedPaths: string[];
  systemPromptStyle: SystemPromptStyle;
  envContext: string[];
}

export const MODE_POLICY: Record<string, ModePolicyEntry> = {
  chat: {
    enabledTools: ['web_search', 'web_fetch'],
    deniedTools: [],
    allowedPaths: [],
    systemPromptStyle: 'chat',
    envContext: [],
  },
  agent: {
    enabledTools: '*',
    deniedTools: [
      'run_command',
      'read_file',
      'list_directory',
      'grep',
      'glob',
      'resume_plan',
    ],
    allowedPaths: ['{workspaceRoot}/agent-output'],
    systemPromptStyle: 'agent',
    envContext: ['platform'],
  },
  cowork: {
    enabledTools: '*',
    deniedTools: [],
    allowedPaths: ['{projectPath}', '{workspaceRoot}'],
    systemPromptStyle: 'cowork',
    envContext: ['platform', 'projectPath'],
  },
};
```

- [ ] **Step 2: Create `mode-policy.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MODE_POLICY, SystemPromptStyle } from './mode-policy.config';
import { ToolDefinition } from '../agent/services/context-builder.service';
import * as path from 'path';

export interface ToolInfo {
  name: string;
  description: string;
  parameters: string;
}

@Injectable()
export class ModePolicyService {
  private readonly workspaceRoot: string;

  constructor(private readonly config: ConfigService) {
    this.workspaceRoot = path.resolve(this.config.get<string>('WORKSPACE_ROOT', './workspace_data'));
  }

  getEnabledTools(mode: string, dbTools: ToolInfo[]): ToolDefinition[] {
    const policy = MODE_POLICY[mode] ?? MODE_POLICY.agent;
    const filtered = policy.enabledTools === '*'
      ? dbTools.filter(t => !policy.deniedTools.includes(t.name))
      : dbTools.filter(t => (policy.enabledTools as string[]).includes(t.name));
    return filtered.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: JSON.parse(t.parameters),
      },
    }));
  }

  isToolAllowed(mode: string, toolName: string): boolean {
    const policy = MODE_POLICY[mode] ?? MODE_POLICY.agent;
    if (policy.enabledTools !== '*' && !(policy.enabledTools as string[]).includes(toolName)) {
      return false;
    }
    return !policy.deniedTools.includes(toolName);
  }

  resolveAllowedPaths(mode: string, projectPath?: string | null): string[] {
    const policy = MODE_POLICY[mode] ?? MODE_POLICY.agent;
    const pp = projectPath ?? '';
    return policy.allowedPaths.map(p =>
      p.replace('{workspaceRoot}', this.workspaceRoot).replace('{projectPath}', pp)
    );
  }

  getSystemPromptStyle(mode: string): SystemPromptStyle {
    return (MODE_POLICY[mode] ?? MODE_POLICY.agent).systemPromptStyle;
  }

  getEnvContext(mode: string): string[] {
    return (MODE_POLICY[mode] ?? MODE_POLICY.agent).envContext;
  }
}
```

- [ ] **Step 3: Create `mode-policy.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ModePolicyService } from './mode-policy.service';
import { ConfigService } from '@nestjs/config';

describe('ModePolicyService', () => {
  let service: ModePolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModePolicyService,
        { provide: ConfigService, useValue: { get: () => './workspace_data' } },
      ],
    }).compile();
    service = module.get<ModePolicyService>(ModePolicyService);
  });

  describe('getEnabledTools', () => {
    const mockTools = [
      { name: 'web_search', description: 'Search web', parameters: '{}' },
      { name: 'web_fetch', description: 'Fetch URL', parameters: '{}' },
      { name: 'write_file', description: 'Write file', parameters: '{}' },
      { name: 'run_command', description: 'Run command', parameters: '{}' },
      { name: 'read_file', description: 'Read file', parameters: '{}' },
    ];

    it('should return only web tools for chat mode', () => {
      const result = service.getEnabledTools('chat', mockTools);
      expect(result.length).toBe(2);
      expect(result.map(t => t.function.name).sort()).toEqual(['web_fetch', 'web_search']);
    });

    it('should exclude denied tools for agent mode', () => {
      const result = service.getEnabledTools('agent', mockTools);
      const names = result.map(t => t.function.name);
      expect(names).toContain('web_search');
      expect(names).toContain('write_file');
      expect(names).not.toContain('run_command');
      expect(names).not.toContain('read_file');
    });

    it('should return all tools for cowork mode', () => {
      const result = service.getEnabledTools('cowork', mockTools);
      expect(result.length).toBe(5);
    });

    it('should default to agent policy for unknown modes', () => {
      const result = service.getEnabledTools('unknown', mockTools);
      expect(result.map(t => t.function.name)).not.toContain('run_command');
    });
  });

  describe('resolveAllowedPaths', () => {
    it('should resolve workspaceRoot placeholder', () => {
      const result = service.resolveAllowedPaths('agent');
      expect(result[0]).toMatch(/workspace_data[\\/]agent-output/);
    });

    it('should resolve projectPath placeholder for cowork', () => {
      const result = service.resolveAllowedPaths('cowork', '/home/project');
      expect(result[0]).toBe('/home/project');
      expect(result[1]).toMatch(/workspace_data/);
    });

    it('should return empty paths for chat', () => {
      const result = service.resolveAllowedPaths('chat');
      expect(result).toEqual([]);
    });
  });

  describe('isToolAllowed', () => {
    it('should deny run_command in agent mode', () => {
      expect(service.isToolAllowed('agent', 'run_command')).toBe(false);
    });

    it('should allow write_file in agent mode', () => {
      expect(service.isToolAllowed('agent', 'write_file')).toBe(true);
    });

    it('should deny web_search in chat mode', () => {
      expect(service.isToolAllowed('chat', 'write_file')).toBe(false);
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx jest src/mode-policy/mode-policy.service -v`
Expected: FAIL due to missing module registration

- [ ] **Step 5: Create `mode-policy.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ModePolicyService } from './mode-policy.service';

@Module({
  providers: [ModePolicyService],
  exports: [ModePolicyService],
})
export class ModePolicyModule {}
```

- [ ] **Step 6: Register ModePolicyModule in `app.module.ts`**

Add to imports: `ModePolicyModule,`

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest src/mode-policy/mode-policy.service -v`
Expected: PASS (4 tests)

- [ ] **Step 8: Commit**

```bash
git add backend/src/mode-policy/ backend/src/app.module.ts
git commit -m "feat: add ModePolicy config, service, module with tool filtering and path resolution"
```

---

### Task 2: Update ToolExecutor interface

**Files:**
- Modify: `backend/src/tools/executors/tool-executor.interface.ts`

- [ ] **Step 1: Add ToolContext interface + update ToolExecutor**

Replace the current content with:

```typescript
export interface ToolContext {
  mode: 'chat' | 'agent' | 'cowork';
  sessionId: number;
}

export interface ToolExecutor {
  readonly name: string;
  execute(args: Record<string, unknown>, context?: ToolContext): Promise<string>;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/tools/executors/tool-executor.interface.ts
git commit -m "refactor: add ToolContext to ToolExecutor interface for mode-aware execution"
```

---

### Task 3: Update WriteFileExecutor with agent sandbox

**Files:**
- Modify: `backend/src/tools/executors/write-file.executor.ts`
- Modify: `backend/src/tools/executors/write-file.executor.spec.ts`

- [ ] **Step 1: Update `write-file.executor.ts` with sandbox logic**

Replace the execute method with agent path sandboxing:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class WriteFileExecutor implements ToolExecutor {
  readonly name = 'write_file';

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const content = args.content as string | undefined;
    if (content === undefined) return 'Error: path and content are required.';

    let filePath: string;

    if (context?.mode === 'agent') {
      const rawPath = (args.path as string) || 'output.txt';
      const filename = rawPath.split(/[\\/]/).pop() || 'output.txt';
      const sessionDir = path.join(
        this.workspace.getWorkspaceRoot(),
        'agent-output',
        `session_${context.sessionId}`,
      );
      filePath = path.join(sessionDir, filename);
      await fs.mkdir(sessionDir, { recursive: true });
    } else {
      filePath = args.path as string;
      if (!filePath) return 'Error: path is required.';
      if (!this.workspace.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`;
    }

    try {
      const { bytesWritten, resolved } = await this.workspace.writeFile(filePath, content);
      const filename = resolved.split(/[\\/]/).pop() || 'file';
      const workspaceRoot = this.workspace.getWorkspaceRoot();
      if (resolved.startsWith(workspaceRoot)) {
        const agentFile = await this.prisma.agentFile.create({
          data: { filename, path: resolved, sessionId: context?.sessionId ?? 0 },
        });
        return `Written ${bytesWritten} bytes. [Download "${filename}"](api/files/agent/${agentFile.id}/download)`;
      }
      return `Written ${bytesWritten} bytes to ${resolved}`;
    } catch (e) {
      return `Error writing file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 2: Read existing test file to understand current test pattern**

Read: `backend/src/tools/executors/write-file.executor.spec.ts`

- [ ] **Step 3: Update tests to cover agent mode sandbox**

Add these test cases to the existing spec file:

```typescript
it('should sandbox path in agent mode to session folder', async () => {
  const result = await executor.execute(
    { path: '../../evil/payload.js', content: 'test' },
    { mode: 'agent', sessionId: 5 },
  );
  expect(workspace.isPathAllowed).not.toHaveBeenCalled();
  expect(workspace.writeFile).toHaveBeenCalled();
  const callPath = (workspace.writeFile as jest.Mock).mock.calls[0][0];
  expect(callPath).toContain('agent-output');
  expect(callPath).toContain('session_5');
  expect(callPath).toContain('payload.js');
});

it('should use filename only and ignore directory parts in agent mode', async () => {
  const result = await executor.execute(
    { path: '../../evil/payload.js', content: 'test' },
    { mode: 'agent', sessionId: 1 },
  );
  const callPath = (workspace.writeFile as jest.Mock).mock.calls[0][0];
  expect(callPath).not.toContain('../../evil');
  expect(callPath).toContain('payload.js');
});

it('should default to output.txt when path is empty in agent mode', async () => {
  const result = await executor.execute(
    { content: 'test' },
    { mode: 'agent', sessionId: 1 },
  );
  const callPath = (workspace.writeFile as jest.Mock).mock.calls[0][0];
  expect(callPath).toContain('output.txt');
});

it('should still check isPathAllowed in non-agent mode', async () => {
  const result = await executor.execute(
    { path: 'allowed/file.txt', content: 'test' },
    { mode: 'cowork', sessionId: 0 },
  );
  expect(workspace.isPathAllowed).toHaveBeenCalledWith('allowed/file.txt');
});
```

- [ ] **Step 4: Run tests to verify**

Run: `npx jest src/tools/executors/write-file.executor -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/executors/write-file.executor.ts backend/src/tools/executors/write-file.executor.spec.ts
git commit -m "feat: sandbox agent mode file writes to agent-output/session_{id}"
```

---

### Task 4: Refactor ContextBuilderService to use ModePolicyService

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`
- Modify: `backend/src/agent/services/context-builder.service.spec.ts`

- [ ] **Step 1: Inject ModePolicyService and replace getEnabledTools body**

Add to constructor:
```typescript
private readonly modePolicy: ModePolicyService,
```

Replace the `getEnabledTools` method body with:

```typescript
private async getEnabledTools(mode: string = 'agent'): Promise<ToolDefinition[]> {
    const dbTools = await this.toolsService.findEnabled();
    const tools = this.modePolicy.getEnabledTools(mode, dbTools);

    if (mode === 'cowork') {
      try {
        const mcpTools = await this.mcpService.getAllTools();
        for (const t of mcpTools) {
          tools.push({
            type: 'function' as const,
            function: {
              name: t.name,
              description: t.description ?? '',
              parameters: t.parameters,
            },
          });
        }
      } catch { }
    }
    return tools;
  }
```

- [ ] **Step 2: Add agent output path info to buildSystemPrompt**

Add to the `lines` array, before the `System Environment` section:

```typescript
if (mode === 'agent') {
  const agentPaths = this.modePolicy.resolveAllowedPaths('agent');
  const agentOutputPath = agentPaths[0] ?? '{workspaceRoot}/agent-output';
  lines.push('',
    'When writing files, use relative paths (e.g., "output.txt").',
    `Files will be saved to: ${agentOutputPath}/session_{sessionId}`,
    'Files written here are automatically downloadable via links returned by write_file.',
  );
}
```

Note: Add import for `ModePolicyService` at the top.

- [ ] **Step 3: Update context-builder.service.spec.ts**

Read the existing test file and update:
1. Add `ModePolicyService` to the providers mock list
2. Provide mock: `{ provide: ModePolicyService, useValue: { getEnabledTools: jest.fn(), resolveAllowedPaths: jest.fn().mockReturnValue(['/tmp/agent-output']), ... } }`
3. Update any existing tests that mock `ToolsService.findEnabled()` — the mock results now pass through `modePolicy.getEnabledTools()`

- [ ] **Step 4: Run tests**

Run: `npx jest src/agent/services/context-builder.service -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts backend/src/agent/services/context-builder.service.spec.ts
git commit -m "refactor: use ModePolicyService in ContextBuilderService, add agent output path to system prompt"
```

---

### Task 5: Refactor AgentLoopService — remove mode filter, pass ToolContext

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`
- Modify: `backend/src/agent/services/agent-loop.service.spec.ts`

- [ ] **Step 1: Remove mode-based tool filter block in AgentLoopService.run()**

Delete lines 116-121 (the `let activeTools: ToolDefinition[]; ... else { activeTools = tools; }` block).

Replace with just: `const activeTools = tools;`

- [ ] **Step 2: Update executeTool method to accept and pass ToolContext**

Change the method:

```typescript
private async executeTool(name: string, args: Record<string, unknown>, context?: ToolContext): Promise<string> {
```

At every call site of `executeTool`, pass `{ mode, sessionId }`:

```typescript
// In the main loop (around line 176):
result = await this.executeTool(name, args, { mode, sessionId: sessionId ?? 0 });

// In runForStep (around line 584):
result = await this.executeTool(name, args, { mode: 'cowork', sessionId: sessionId ?? 0 });
```

Add import:
```typescript
import { ToolContext } from '../../tools/executors/tool-executor.interface';
```

- [ ] **Step 3: Update agent-loop.service.spec.ts**

Read the existing test file. Update:
1. Any test that directly tests tool filtering by mode — these should now be removed since filtering moved to ContextBuilder
2. Any mock calls to `executeTool` — add `ToolContext` parameter
3. Verify tests still pass

- [ ] **Step 4: Run tests**

Run: `npx jest src/agent/services/agent-loop.service -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts backend/src/agent/services/agent-loop.service.spec.ts
git commit -m "refactor: remove hardcoded mode filter from AgentLoopService, pass ToolContext to executors"
```

---

### Task 6: Register ModePolicyModule in agent.module.ts

**Files:**
- Modify: `backend/src/agent/agent.module.ts`

- [ ] **Step 1: Add ModePolicyModule to imports**

```typescript
import { ModePolicyModule } from '../mode-policy/mode-policy.module';

@Module({
  imports: [
    // ... existing imports
    ModePolicyModule,
  ],
  // ...
})
```

- [ ] **Step 2: Run full test suite**

Run: `npx jest`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/agent.module.ts
git commit -m "chore: register ModePolicyModule in agent module"
```

---

### Task 7: Self-review and verification

- [ ] **Step 1: Verify integration by reviewing all changed files**

Check:
- `ModePolicyService.getEnabledTools('agent', ...)` excludes: run_command, read_file, list_directory, grep, glob, resume_plan
- `WriteFileExecutor` creates files under `agent-output/session_{id}/` only in agent mode
- Cowork mode files still go to user-specified project path
- Chat mode has no file tools enabled
- All existing tests pass

- [ ] **Step 2: Run full test suite**

Run: `npx jest`
Expected: All PASS

- [ ] **Step 3: Final commit with docs update**

```bash
git add docs/superpowers/plans/2026-06-10-permission-gate-implementation.md
git commit -m "docs: add permission gate implementation plan"
```
