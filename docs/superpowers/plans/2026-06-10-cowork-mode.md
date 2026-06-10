# CoworkMode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace codebase watcher + RAG with tool-based cowork mode: user selects a project directory, agent uses grep/glob/read/write tools to explore and modify files on-demand.

**Architecture:** New CoworkModule manages project path (persisted in DB). CoworkService calls WorkspaceService.addAllowedPath() to open file access for the project directory. GrepExecutor and GlobExecutor give the LLM file search capabilities. ContextBuilderService injects the project path into the system prompt.

**Tech Stack:** NestJS 10, TypeScript strict, Jest (TDD).

---

## File Map

**Create:**
- `backend/src/cowork/cowork.module.ts`
- `backend/src/cowork/cowork.service.ts`
- `backend/src/cowork/cowork.service.spec.ts`
- `backend/src/cowork/cowork.controller.ts`
- `backend/src/cowork/cowork.controller.spec.ts`
- `backend/src/cowork/dto/set-project.dto.ts`
- `backend/src/tools/executors/grep.executor.ts`
- `backend/src/tools/executors/grep.executor.spec.ts`
- `backend/src/tools/executors/glob.executor.ts`
- `backend/src/tools/executors/glob.executor.spec.ts`

**Modify:**
- `backend/src/workspace/workspace.service.ts` — add `addAllowedPath()`
- `backend/src/workspace/workspace.service.spec.ts` — test new method
- `backend/src/app.module.ts` — import CoworkModule
- `backend/src/agent/services/context-builder.service.ts` — inject cowork path
- `backend/src/agent/services/context-builder.service.spec.ts` — update tests
- `backend/src/tools/tools.module.ts` — register grep + glob
- `backend/src/agent/services/agent-loop.service.ts` — register executors
- `frontend/src/components/FilesView.vue` — project selector UI
- `frontend/src/locales/vi.json` + `en.json` — i18n

---

## Task 1: Add addAllowedPath to WorkspaceService

**Files:**
- Modify: `backend/src/workspace/workspace.service.ts`
- Modify: `backend/src/workspace/workspace.service.spec.ts`

- [ ] **Step 1: Add addAllowedPath method**

Read `backend/src/workspace/workspace.service.ts` and add this method:

```typescript
  addAllowedPath(path: string): void {
    const resolved = path.resolve(path);
    if (!this.allowedPaths.includes(resolved)) {
      this.allowedPaths.push(resolved);
    }
  }
```

- [ ] **Step 2: Add test**

Read `backend/src/workspace/workspace.service.spec.ts` and add this test inside the describe block:

```typescript
  it('addAllowedPath adds a new allowed path at runtime', () => {
    const newPath = path.resolve('/new/allowed/path');
    service.addAllowedPath(newPath);
    expect(service.isPathAllowed(newPath)).toBe(true);
  });
```

- [ ] **Step 3: Run tests**

```bash
cd backend && npx jest src/workspace/workspace.service.spec.ts --no-coverage
```

Expected: PASS (8 tests)

- [ ] **Step 4: Commit**

```bash
git add backend/src/workspace/workspace.service.ts backend/src/workspace/workspace.service.spec.ts
git commit -m "feat: add addAllowedPath to WorkspaceService for runtime path permissions"
```

---

## Task 2: CoworkService (TDD)

**Files:**
- Create: `backend/src/cowork/cowork.service.ts`
- Create: `backend/src/cowork/cowork.service.spec.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p backend/src/cowork/dto
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/cowork/cowork.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CoworkService } from './cowork.service';
import { SettingsService } from '../settings/settings.service';
import { WorkspaceService } from '../workspace/workspace.service';

describe('CoworkService', () => {
  let service: CoworkService;
  const mockSettings = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const mockWorkspace = {
    addAllowedPath: jest.fn(),
    isPathAllowed: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoworkService,
        { provide: SettingsService, useValue: mockSettings },
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    service = module.get<CoworkService>(CoworkService);
  });

  it('setProject persists path and adds to allowed paths', async () => {
    await service.setProject('/test/project');
    expect(mockSettings.set).toHaveBeenCalledWith('cowork_project_path', '/test/project');
    expect(mockWorkspace.addAllowedPath).toHaveBeenCalledWith('/test/project');
  });

  it('getProject reads from settings', async () => {
    mockSettings.get.mockResolvedValue('/saved/path');
    const result = await service.getProject();
    expect(result).toBe('/saved/path');
  });

  it('clearProject removes from settings', async () => {
    await service.clearProject();
    expect(mockSettings.delete).toHaveBeenCalledWith('cowork_project_path');
  });

  it('getStatus returns project info', async () => {
    mockSettings.get.mockResolvedValue('/test/project');
    const status = await service.getStatus();
    expect(status.projectPath).toBe('/test/project');
    expect(status.isActive).toBe(true);
  });

  it('getStatus returns inactive when no project', async () => {
    mockSettings.get.mockResolvedValue(null);
    const status = await service.getStatus();
    expect(status.isActive).toBe(false);
    expect(status.projectPath).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && npx jest src/cowork/cowork.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './cowork.service'`

- [ ] **Step 4: Implement CoworkService**

Create `backend/src/cowork/cowork.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { WorkspaceService } from '../workspace/workspace.service';
import * as path from 'path';

const PROJECT_KEY = 'cowork_project_path';

@Injectable()
export class CoworkService {
  constructor(
    private readonly settings: SettingsService,
    private readonly workspace: WorkspaceService,
  ) {}

  async setProject(projectPath: string): Promise<void> {
    const resolved = path.resolve(projectPath);
    await this.settings.set(PROJECT_KEY, resolved);
    this.workspace.addAllowedPath(resolved);
  }

  async getProject(): Promise<string | null> {
    return this.settings.get(PROJECT_KEY, null);
  }

  async clearProject(): Promise<void> {
    await this.settings.delete(PROJECT_KEY);
  }

  async getStatus(): Promise<{ projectPath: string | null; isActive: boolean }> {
    const projectPath = await this.getProject();
    return { projectPath, isActive: projectPath !== null };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && npx jest src/cowork/cowork.service.spec.ts --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/cowork/cowork.service.ts backend/src/cowork/cowork.service.spec.ts
git commit -m "feat: add CoworkService with project path management"
```

---

## Task 3: CoworkController (TDD)

**Files:**
- Create: `backend/src/cowork/cowork.controller.ts`
- Create: `backend/src/cowork/cowork.controller.spec.ts`
- Create: `backend/src/cowork/dto/set-project.dto.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/cowork/cowork.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CoworkController } from './cowork.controller';
import { CoworkService } from './cowork.service';

describe('CoworkController', () => {
  let controller: CoworkController;
  const mockService = {
    setProject: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockResolvedValue({ projectPath: '/test', isActive: true }),
    clearProject: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoworkController],
      providers: [{ provide: CoworkService, useValue: mockService }],
    }).compile();
    controller = module.get<CoworkController>(CoworkController);
  });

  it('setProject calls service.setProject', async () => {
    const result = await controller.setProject({ path: '/my/project' });
    expect(mockService.setProject).toHaveBeenCalledWith('/my/project');
    expect(result).toEqual({ ok: true });
  });

  it('getProject returns status from service', async () => {
    const result = await controller.getProject();
    expect(mockService.getStatus).toHaveBeenCalled();
    expect(result.projectPath).toBe('/test');
  });

  it('clearProject calls service.clearProject', async () => {
    const result = await controller.clearProject();
    expect(mockService.clearProject).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Create the DTO**

Create `backend/src/cowork/dto/set-project.dto.ts`:

```typescript
import { IsString } from 'class-validator';

export class SetProjectDto {
  @IsString()
  path: string;
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && npx jest src/cowork/cowork.controller.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 4: Implement CoworkController**

Create `backend/src/cowork/cowork.controller.ts`:

```typescript
import { Controller, Get, Post, Delete, Body } from '@nestjs/common';
import { CoworkService } from './cowork.service';
import { SetProjectDto } from './dto/set-project.dto';

@Controller('cowork')
export class CoworkController {
  constructor(private readonly cowork: CoworkService) {}

  @Post('project')
  async setProject(@Body() dto: SetProjectDto) {
    await this.cowork.setProject(dto.path);
    return { ok: true };
  }

  @Get('project')
  async getProject() {
    return this.cowork.getStatus();
  }

  @Delete('project')
  async clearProject() {
    await this.cowork.clearProject();
    return { ok: true };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && npx jest src/cowork/cowork.controller.spec.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/cowork/cowork.controller.ts backend/src/cowork/cowork.controller.spec.ts backend/src/cowork/dto/set-project.dto.ts
git commit -m "feat: add CoworkController with project CRUD endpoints"
```

---

## Task 4: CoworkModule + AppModule Wiring

**Files:**
- Create: `backend/src/cowork/cowork.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create CoworkModule**

Create `backend/src/cowork/cowork.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CoworkService } from './cowork.service';
import { CoworkController } from './cowork.controller';
import { SettingsModule } from '../settings/settings.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [SettingsModule, WorkspaceModule],
  controllers: [CoworkController],
  providers: [CoworkService],
  exports: [CoworkService],
})
export class CoworkModule {}
```

- [ ] **Step 2: Register in AppModule**

Read `backend/src/app.module.ts`, add:

```typescript
import { CoworkModule } from './cowork/cowork.module';
```

And add `CoworkModule,` to the imports array.

- [ ] **Step 3: Run all tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS (33+ suites)

- [ ] **Step 4: Commit**

```bash
git add backend/src/cowork/cowork.module.ts backend/src/app.module.ts
git commit -m "feat: add CoworkModule and register in AppModule"
```

---

## Task 5: GrepExecutor (TDD)

**Files:**
- Create: `backend/src/tools/executors/grep.executor.ts`
- Create: `backend/src/tools/executors/grep.executor.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/tools/executors/grep.executor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GrepExecutor } from './grep.executor';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as fs from 'fs';
import * as path from 'path';

const tmpDir = fs.mkdtempSync('grep-test-');
const testFile = path.join(tmpDir, 'test.txt');
fs.writeFileSync(testFile, 'hello world\nfoo bar\nhello again');

describe('GrepExecutor', () => {
  let executor: GrepExecutor;
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrepExecutor,
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    executor = module.get<GrepExecutor>(GrepExecutor);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('grep returns matching lines', async () => {
    const result = await executor.execute({ pattern: 'hello', path: tmpDir });
    expect(result).toContain('hello world');
    expect(result).toContain('hello again');
    expect(result).not.toContain('foo bar');
  });

  it('grep returns error when path not allowed', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(false);
    const result = await executor.execute({ pattern: 'test', path: '/etc' });
    expect(result).toContain('not allowed');
  });

  it('grep returns no matches message when no results', async () => {
    const result = await executor.execute({ pattern: 'nonexistent', path: tmpDir });
    expect(result).toBe('No matches found.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/tools/executors/grep.executor.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement GrepExecutor**

Create `backend/src/tools/executors/grep.executor.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GrepExecutor implements ToolExecutor {
  readonly name = 'grep';

  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const pattern = args.pattern as string | undefined;
    const searchPath = (args.path as string) || '.';
    const include = args.include as string | undefined;
    if (!pattern) return 'Error: pattern is required.';
    const resolved = path.resolve(searchPath);
    if (!this.workspace.isPathAllowed(resolved)) return `Error: path "${searchPath}" is not allowed.`;

    const results: string[] = [];
    try {
      this.searchDir(resolved, pattern, include, results);
      if (results.length === 0) return 'No matches found.';
      return results.slice(0, 50).join('\n');
    } catch (e) {
      return `Error during search: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  private searchDir(dir: string, pattern: string, include: string | undefined, results: string[]): void {
    const re = new RegExp(pattern, 'i');
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        this.searchDir(fullPath, pattern, include, results);
      } else if (entry.isFile()) {
        if (include && !entry.name.endsWith(include)) continue;
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i])) {
              results.push(`${fullPath}:${i + 1}:${lines[i].trim().substring(0, 200)}`);
            }
          }
        } catch { /* skip unreadable files */ }
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/tools/executors/grep.executor.spec.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/executors/grep.executor.ts backend/src/tools/executors/grep.executor.spec.ts
git commit -m "feat: add GrepExecutor for searching file contents"
```

---

## Task 6: GlobExecutor (TDD)

**Files:**
- Create: `backend/src/tools/executors/glob.executor.ts`
- Create: `backend/src/tools/executors/glob.executor.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/tools/executors/glob.executor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GlobExecutor } from './glob.executor';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as fs from 'fs';
import * as path from 'path';

const tmpDir = fs.mkdtempSync('glob-test-');
fs.writeFileSync(path.join(tmpDir, 'test.ts'), '');
fs.writeFileSync(path.join(tmpDir, 'test.js'), '');
fs.mkdirSync(path.join(tmpDir, 'sub'));
fs.writeFileSync(path.join(tmpDir, 'sub', 'deep.ts'), '');

describe('GlobExecutor', () => {
  let executor: GlobExecutor;
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobExecutor,
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    executor = module.get<GlobExecutor>(GlobExecutor);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('glob finds files matching pattern', async () => {
    const result = await executor.execute({ pattern: '**/*.ts', path: tmpDir });
    expect(result).toContain('test.ts');
    expect(result).toContain('deep.ts');
    expect(result).not.toContain('test.js');
  });

  it('glob returns error when path not allowed', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(false);
    const result = await executor.execute({ pattern: '*', path: '/etc' });
    expect(result).toContain('not allowed');
  });

  it('glob returns no matches when nothing found', async () => {
    const result = await executor.execute({ pattern: '**/*.xyz', path: tmpDir });
    expect(result).toBe('No files found.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/tools/executors/glob.executor.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement GlobExecutor**

Create `backend/src/tools/executors/glob.executor.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GlobExecutor implements ToolExecutor {
  readonly name = 'glob';

  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const pattern = args.pattern as string | undefined;
    const searchPath = (args.path as string) || '.';
    if (!pattern) return 'Error: pattern is required.';
    const resolved = path.resolve(searchPath);
    if (!this.workspace.isPathAllowed(resolved)) return `Error: path "${searchPath}" is not allowed.`;

    const results: string[] = [];
    const re = this.patternToRegex(pattern);

    try {
      this.walkDir(resolved, '', re, results);
      if (results.length === 0) return 'No files found.';
      return results.join('\n');
    } catch (e) {
      return `Error during glob: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '___DOUBLESTAR___')
      .replace(/\*/g, '[^/\\\\]*')
      .replace(/___DOUBLESTAR___/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
  }

  private walkDir(baseDir: string, relative: string, re: RegExp, results: string[]): void {
    const dirPath = path.join(baseDir, relative);
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const relPath = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        this.walkDir(baseDir, relPath, re, results);
      } else if (entry.isFile()) {
        if (re.test(relPath) || re.test(entry.name)) {
          results.push(path.join(baseDir, relPath));
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/tools/executors/glob.executor.spec.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/executors/glob.executor.ts backend/src/tools/executors/glob.executor.spec.ts
git commit -m "feat: add GlobExecutor for finding files by pattern"
```

---

## Task 7: Register Grep + Glob in ToolsModule + AgentLoop

**Files:**
- Modify: `backend/src/tools/tools.module.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Register in ToolsModule**

Read `backend/src/tools/tools.module.ts`, add imports and register providers:

```typescript
import { GrepExecutor } from './executors/grep.executor';
import { GlobExecutor } from './executors/glob.executor';
```

Add to providers array: `GrepExecutor, GlobExecutor,`

- [ ] **Step 2: Register in AgentLoopService executorMap**

Read `backend/src/agent/services/agent-loop.service.ts`, find the executorMap construction and add:

```typescript
import { GrepExecutor } from '../tools/executors/grep.executor';
import { GlobExecutor } from '../tools/executors/glob.executor';
```

Add to constructor params: `private readonly grep: GrepExecutor, private readonly glob: GlobExecutor,`

Add to executorMap: `[grep.name, grep], [glob.name, glob],`

- [ ] **Step 3: Run all tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/tools/tools.module.ts backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: register GrepExecutor and GlobExecutor in tools and agent loop"
```

---

## Task 8: Inject Cowork Project Path into System Prompt

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`
- Modify: `backend/src/agent/services/context-builder.service.spec.ts`

- [ ] **Step 1: Read ContextBuilderService**

Read `backend/src/agent/services/context-builder.service.ts`. Find the `buildSystemPrompt` method and update it to accept and include the project path.

If CoworkModule is not available as a direct import (circular dependency risk), inject it via the constructor. Read the file, add:

```typescript
import { CoworkService } from '../../cowork/cowork.service';
```

Add to constructor: `private readonly cowork: CoworkService,`

In `buildSystemPrompt`, after the tool description section, add:

```typescript
    const project = await this.cowork.getProject();
    if (project) {
      systemPrompt += `\nCurrent working project: ${project}\nFile operations are available in this directory.\n`;
    }
```

Note: If you encounter a circular dependency between CoworkModule and AgentModule, use `@Inject(forwardRef(() => CoworkService))` or inject `SettingsService` directly instead.

- [ ] **Step 2: Run tests**

```bash
cd backend && npx jest src/agent/services/context-builder.service.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 3: Run all tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts backend/src/agent/services/context-builder.service.spec.ts
git commit -m "feat: inject cowork project path into agent system prompt"
```

---

## Task 9: Update FilesView UI

**Files:**
- Modify: `frontend/src/components/FilesView.vue`
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Read FilesView.vue**

Read `frontend/src/components/FilesView.vue`.

- [ ] **Step 2: Update the template**

Replace the "Codebase watcher" section with a "Workspace" project selector:

```html
        <!-- Workspace / Cowork -->
        <div class="border-t border-cyber-accent/10 pt-4">
          <div class="text-[#888888] text-[10px] font-mono mb-2">{{ t('cowork.title') }}</div>
          <div class="flex gap-2 items-center">
            <span class="text-[#888888] text-xs font-mono">{{ t('cowork.path') }}</span>
            <input v-model="projectPath" :disabled="!!connectedProject" placeholder="/path/to/project"
              class="flex-1 bg-cyber-dark text-[#EEEEEE] text-sm px-2 py-1.5 font-mono outline-none" />
            <input ref="projectDirInput" type="file" webkitdirectory class="hidden" @change="onProjectDirChange" />
            <button @click="browseProjectDir" :disabled="!!connectedProject"
              class="px-3 py-1.5 text-xs font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 transition-colors duration-150">
              {{ t('cowork.browse') }}
            </button>
            <button @click="toggleProject"
              class="px-3 py-1.5 text-xs font-mono transition-colors duration-150"
              :class="connectedProject ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20' : 'text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20'">
              {{ connectedProject ? t('cowork.disconnect') : t('cowork.connect') }}
            </button>
          </div>
          <div v-if="connectedProject" class="text-cyber-green text-[10px] font-mono mt-1">{{ t('cowork.connected') }} {{ connectedProject }}</div>
        </div>
```

- [ ] **Step 3: Update the script**

Replace the watcher-related variables and functions with cowork equivalents:

```typescript
const projectPath = ref('')
const connectedProject = ref<string | null>(null)
const projectDirInput = ref<HTMLInputElement | null>(null)

function browseProjectDir() {
  projectDirInput.value?.click()
}

function onProjectDirChange() {
  const f = projectDirInput.value?.files?.[0]
  if (!f) return
  const raw = (f as unknown as { path?: string }).path
  const fullPath = f.webkitRelativePath
    ? f.webkitRelativePath.split('/')[0]
    : f.name
  projectPath.value = raw || fullPath
}

async function toggleProject() {
  if (connectedProject.value) {
    try {
      await fetch('/api/cowork/project', { method: 'DELETE' })
      connectedProject.value = null
    } catch { /* ignore */ }
    return
  }
  if (!projectPath.value.trim()) return
  try {
    const res = await fetch('/api/cowork/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectPath.value }),
    })
    if (res.ok) {
      connectedProject.value = projectPath.value
      localStorage.setItem('workspace.projectPath', projectPath.value)
    }
  } catch { /* ignore */ }
}

async function loadProject() {
  try {
    const res = await fetch('/api/cowork/project')
    if (res.ok) {
      const data = await res.json()
      if (data.isActive) {
        connectedProject.value = data.projectPath
        projectPath.value = data.projectPath
      }
    }
  } catch { /* ignore */ }
}
```

Update `onMounted` to call `loadProject()`:

```typescript
onMounted(async () => {
  await loadFiles()
  await loadProject()
  if (files.value.some(f => f.status === 'indexing')) startPolling()
})
```

- [ ] **Step 4: Add locale keys**

**vi.json:** add after existing `files.*` keys:
```json
  "cowork.title": "Workspace",
  "cowork.path": "Đường dẫn:",
  "cowork.browse": "Chọn",
  "cowork.connect": "Kết nối",
  "cowork.disconnect": "Ngắt kết nối",
  "cowork.connected": "● Đang làm việc với:",
```

**en.json:** add after existing `files.*` keys:
```json
  "cowork.title": "Workspace",
  "cowork.path": "Directory:",
  "cowork.browse": "Browse",
  "cowork.connect": "Connect",
  "cowork.disconnect": "Disconnect",
  "cowork.connected": "● Working with:",
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npm run build 2>&1
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/FilesView.vue frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: update FilesView to cowork project selector, replace watcher UI"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Full backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS

- [ ] **Step 2: Frontend build**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Review commit log**

```bash
git log --oneline -10
```

Expected: Clean commit history.
