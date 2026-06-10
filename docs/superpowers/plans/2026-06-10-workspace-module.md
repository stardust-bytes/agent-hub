# WorkspaceModule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated WorkspaceModule that centralizes path validation, file watching, and file operations — replacing duplicated `isPathAllowed()` logic in file executors and implementing the missing codebase watcher.

**Architecture:** WorkspaceService provides path validation + file I/O wrappers (single source of truth). WorkspaceWatcherService uses chokidar to watch `workspace_data/` and delegates indexing to KnowledgeService. File executors (WriteFileExecutor, ReadFileExecutor, ListDirectoryExecutor) inject WorkspaceService instead of duplicating path logic. Frontend FilesView.vue calls `/api/workspace/watch` instead of the non-existent `/api/knowledge/watch`.

**Tech Stack:** NestJS 10, chokidar 3, Prisma 5, Vue 3, TypeScript strict.

---

## File Map

**Create:**
- `backend/src/workspace/workspace.module.ts`
- `backend/src/workspace/workspace.service.ts`
- `backend/src/workspace/workspace.service.spec.ts`
- `backend/src/workspace/workspace-watcher.service.ts`
- `backend/src/workspace/workspace-watcher.service.spec.ts`
- `backend/src/workspace/workspace.controller.ts`
- `backend/src/workspace/workspace.controller.spec.ts`
- `backend/src/workspace/dto/watch.dto.ts`

**Modify:**
- `backend/src/app.module.ts` — add WorkspaceModule
- `backend/src/knowledge/knowledge.service.ts` — add `createWithPath()` method for watcher
- `backend/src/tools/executors/write-file.executor.ts` — inject WorkspaceService
- `backend/src/tools/executors/write-file.executor.spec.ts` — update mocks
- `backend/src/tools/executors/read-file.executor.ts` — inject WorkspaceService
- `backend/src/tools/executors/read-file.executor.spec.ts` — update mocks
- `backend/src/tools/executors/list-directory.executor.ts` — inject WorkspaceService
- `backend/src/tools/executors/list-directory.executor.spec.ts` — update mocks
- `frontend/src/components/FilesView.vue` — update endpoint + add stop-watch

---

## Task 1: WorkspaceService (TDD)

**Files:**
- Create: `backend/src/workspace/workspace.service.ts`
- Create: `backend/src/workspace/workspace.service.spec.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p backend/src/workspace/dto
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/workspace/workspace.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WorkspaceService } from './workspace.service';
import * as path from 'path';
import * as os from 'os';

const OLD_ENV = process.env;

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  const workspaceRoot = path.resolve('./workspace_data');

  beforeEach(async () => {
    process.env = { ...OLD_ENV };
    delete process.env.ALLOWED_PATHS;
    delete process.env.USERPROFILE;
    delete process.env.HOME;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('./workspace_data') } },
      ],
    }).compile();
    service = module.get<WorkspaceService>(WorkspaceService);
  });

  afterAll(() => { process.env = OLD_ENV; });

  it('getWorkspaceRoot returns resolved workspace path', () => {
    expect(service.getWorkspaceRoot()).toBe(workspaceRoot);
  });

  it('isPathAllowed allows workspace root', () => {
    expect(service.isPathAllowed(workspaceRoot)).toBe(true);
  });

  it('isPathAllowed allows path inside workspace root', () => {
    expect(service.isPathAllowed(path.join(workspaceRoot, 'uploads', 'test.txt'))).toBe(true);
  });

  it('isPathAllowed rejects path outside workspace root', () => {
    expect(service.isPathAllowed(path.resolve(os.tmpdir(), '..', 'outside.txt'))).toBe(false);
  });

  it('isPathAllowed rejects process.cwd() when not in ALLOWED_PATHS', () => {
    expect(service.isPathAllowed(process.cwd())).toBe(false);
  });

  it('isPathAllowed respects ALLOWED_PATHS env var', () => {
    process.env.ALLOWED_PATHS = '/custom/allowed';
    const module2 = new WorkspaceService(new (jest.fn<ConfigService, []>() as any));
    // Re-create with env set
  });
});
```

Hmm, the last test is tricky because the service reads env in constructor. Let me adjust the test approach — set env before module creation:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WorkspaceService } from './workspace.service';
import * as path from 'path';
import * as os from 'os';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let configGet: jest.Mock;
  const workspaceRoot = path.resolve('./workspace_data');

  async function createService(envOverrides?: Record<string, string>) {
    const env = { ...process.env };
    if (envOverrides) Object.assign(process.env, envOverrides);
    const module = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('./workspace_data') } },
      ],
    }).compile();
    if (envOverrides) process.env = env;
    return module.get<WorkspaceService>(WorkspaceService);
  }

  beforeEach(async () => {
    delete process.env.ALLOWED_PATHS;
    delete process.env.USERPROFILE;
    delete process.env.HOME;
    service = await createService();
  });

  it('getWorkspaceRoot returns resolved workspace path', () => {
    expect(service.getWorkspaceRoot()).toBe(workspaceRoot);
  });

  it('isPathAllowed allows workspace root', () => {
    expect(service.isPathAllowed(workspaceRoot)).toBe(true);
  });

  it('isPathAllowed allows path inside workspace root', () => {
    expect(service.isPathAllowed(path.join(workspaceRoot, 'uploads', 'test.txt'))).toBe(true);
  });

  it('isPathAllowed rejects path outside workspace root', () => {
    expect(service.isPathAllowed(path.resolve(os.tmpdir(), '..', 'outside.txt'))).toBe(false);
  });

  it('isPathAllowed rejects process.cwd() by default', () => {
    expect(service.isPathAllowed(process.cwd())).toBe(false);
  });

  it('isPathAllowed allows temp dir', () => {
    expect(service.isPathAllowed(os.tmpdir())).toBe(true);
  });

  it('isPathAllowed allows extra paths from ALLOWED_PATHS env', async () => {
    const svc = await createService({ ALLOWED_PATHS: '/custom/allowed' });
    expect(svc.isPathAllowed('/custom/allowed')).toBe(true);
    expect(svc.isPathAllowed('/custom/allowed/sub/file.ts')).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && npx jest src/workspace/workspace.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './workspace.service'`

- [ ] **Step 4: Implement WorkspaceService**

Create `backend/src/workspace/workspace.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

@Injectable()
export class WorkspaceService {
  private readonly workspaceRoot: string;
  private readonly allowedPaths: string[];

  constructor(private readonly config: ConfigService) {
    this.workspaceRoot = path.resolve(this.config.get<string>('WORKSPACE_ROOT', './workspace_data'));
    const envPaths = process.env.ALLOWED_PATHS
      ? process.env.ALLOWED_PATHS.split(',').map(p => path.resolve(p.trim()))
      : [];
    this.allowedPaths = [
      this.workspaceRoot,
      path.resolve(os.tmpdir()),
      ...(process.env.USERPROFILE ? [path.resolve(process.env.USERPROFILE)] : []),
      ...(process.env.HOME ? [path.resolve(process.env.HOME)] : []),
      ...envPaths,
    ];
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  isPathAllowed(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    return this.allowedPaths.some(dir => resolved === dir || resolved.startsWith(dir + path.sep));
  }

  async writeFile(filePath: string, content: string): Promise<{ bytesWritten: number; resolved: string }> {
    if (!this.isPathAllowed(filePath)) throw new Error(`Path "${filePath}" is not allowed.`);
    const resolved = path.resolve(filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
    return { bytesWritten: Buffer.byteLength(content, 'utf-8'), resolved };
  }

  async readFile(filePath: string): Promise<string> {
    if (!this.isPathAllowed(filePath)) throw new Error(`Path "${filePath}" is not allowed.`);
    return fs.readFile(path.resolve(filePath), 'utf-8');
  }

  async listDirectory(dirPath: string): Promise<string> {
    if (!this.isPathAllowed(dirPath)) throw new Error(`Path "${dirPath}" is not allowed.`);
    const resolved = path.resolve(dirPath);
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    return entries.map(e => `${e.isDirectory() ? 'd' : '-'} ${e.name}`).join('\n');
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && npx jest src/workspace/workspace.service.spec.ts --no-coverage
```

Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/workspace/workspace.service.ts backend/src/workspace/workspace.service.spec.ts
git commit -m "feat: add WorkspaceService with path validation and file ops"
```

---

## Task 2: WorkspaceWatcherService (TDD)

**Files:**
- Create: `backend/src/workspace/workspace-watcher.service.ts`
- Create: `backend/src/workspace/workspace-watcher.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/workspace/workspace-watcher.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceWatcherService } from './workspace-watcher.service';
import { WorkspaceService } from './workspace.service';
import { KnowledgeService } from '../knowledge/knowledge.service';

const mockChokidar = {
  watch: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('chokidar', () => mockChokidar);

describe('WorkspaceWatcherService', () => {
  let service: WorkspaceWatcherService;
  const mockWorkspace = {
    getWorkspaceRoot: jest.fn().mockReturnValue('/fake/workspace'),
    isPathAllowed: jest.fn().mockReturnValue(true),
  };
  const mockKnowledge = {
    create: jest.fn(),
    processFile: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceWatcherService,
        { provide: WorkspaceService, useValue: mockWorkspace },
        { provide: KnowledgeService, useValue: mockKnowledge },
      ],
    }).compile();
    service = module.get<WorkspaceWatcherService>(WorkspaceWatcherService);
  });

  it('startWatch sets watching to true', async () => {
    await service.startWatch();
    expect(mockChokidar.watch).toHaveBeenCalled();
    const status = service.getStatus();
    expect(status.watching).toBe(true);
    expect(status.directory).toBe('/fake/workspace');
  });

  it('startWatch uses provided directory if given', async () => {
    await service.startWatch('/fake/workspace/subdir');
    expect(mockChokidar.watch).toHaveBeenCalled();
    expect(service.getStatus().directory).toBe('/fake/workspace/subdir');
  });

  it('stopWatch sets watching to false', async () => {
    await service.startWatch();
    await service.stopWatch();
    expect(service.getStatus().watching).toBe(false);
    expect(mockChokidar.close).toHaveBeenCalled();
  });

  it('getStatus returns correct state when not watching', () => {
    const status = service.getStatus();
    expect(status.watching).toBe(false);
    expect(status.directory).toBe('');
    expect(status.indexedCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/workspace/workspace-watcher.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './workspace-watcher.service'`

- [ ] **Step 3: Add createWithPath method to KnowledgeService**

Read `backend/src/knowledge/knowledge.service.ts`, find the `create` method, and add this new method after it:

```typescript
async createWithPath(filename: string, filepath: string, size: number, mimeType: string) {
    return this.prisma.knowledgeFile.create({
      data: { filename, filepath, size, mimeType, status: 'indexing' },
    });
  }
```

This allows the watcher to create KnowledgeFile records pointing to the actual file location instead of copying to the uploads directory.

- [ ] **Step 4: Implement WorkspaceWatcherService**

Create `backend/src/workspace/workspace-watcher.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs/promises';

const SUPPORTED_EXTS = ['.ts', '.js', '.py', '.md', '.txt', '.json', '.yaml', '.yml'];
const DEBOUNCE_MS = 300;

@Injectable()
export class WorkspaceWatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private watching = false;
  private directory = '';
  private indexedCount = 0;
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly knowledge: KnowledgeService,
  ) {}

  async startWatch(directory?: string): Promise<void> {
    if (this.watching) return;
    this.directory = directory
      ? path.resolve(directory)
      : this.workspace.getWorkspaceRoot();

    if (!this.workspace.isPathAllowed(this.directory)) {
      throw new Error(`Directory "${this.directory}" is not allowed.`);
    }

    this.watcher = chokidar.watch(this.directory, {
      ignored: /(node_modules|\.git|dist|\.lancedb|dev\.db|dev\.db-journal)/,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on('add', (filePath: string) => this.handleFileChange(filePath, 'add'));
    this.watcher.on('change', (filePath: string) => this.handleFileChange(filePath, 'change'));
    this.watcher.on('unlink', (filePath: string) => this.handleFileDelete(filePath));

    this.watching = true;
  }

  async stopWatch(): Promise<void> {
    if (this.watcher) await this.watcher.close();
    this.watcher = null;
    this.watching = false;
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
  }

  getStatus(): { watching: boolean; directory: string; indexedCount: number } {
    return { watching: this.watching, directory: this.directory, indexedCount: this.indexedCount };
  }

  private async handleFileChange(filePath: string, _event: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTS.includes(ext)) return;

    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(filePath, setTimeout(async () => {
      this.debounceTimers.delete(filePath);
      try {
        const existingFiles = await this.knowledge.findAll();
        const known = existingFiles.find((f: { filepath: string }) => f.filepath === filePath);
        if (known) {
          await this.knowledge.processFile(known.id);
        } else {
          const stats = await fs.stat(filePath);
          const mimeType = this.inferMimeType(ext);
          const record = await this.knowledge.createWithPath(
            path.basename(filePath), filePath, stats.size, mimeType,
          );
          await this.knowledge.processFile(record.id);
        }
        this.indexedCount++;
      } catch { /* file may have been deleted between timer and execution */ }
    }, DEBOUNCE_MS));
  }

  private async handleFileDelete(filePath: string): Promise<void> {
    const existingFiles = await this.knowledge.findAll();
    const known = existingFiles.find((f: { filepath: string }) => f.filepath === filePath);
    if (known) {
      await this.knowledge.remove(known.id);
    }
  }

  private inferMimeType(ext: string): string {
    const mimeMap: Record<string, string> = {
      '.ts': 'text/typescript',
      '.js': 'text/javascript',
      '.py': 'text/x-python',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
    };
    return mimeMap[ext] || 'text/plain';
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && npx jest src/workspace/workspace-watcher.service.spec.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/knowledge/knowledge.service.ts backend/src/workspace/workspace-watcher.service.ts backend/src/workspace/workspace-watcher.service.spec.ts
git commit -m "feat: add WorkspaceWatcherService with chokidar-based file watching"
```

---

## Task 3: WorkspaceController (TDD)

**Files:**
- Create: `backend/src/workspace/workspace.controller.ts`
- Create: `backend/src/workspace/workspace.controller.spec.ts`
- Create: `backend/src/workspace/dto/watch.dto.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/workspace/workspace.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceWatcherService } from './workspace-watcher.service';

describe('WorkspaceController', () => {
  let controller: WorkspaceController;
  const mockWatcher = {
    startWatch: jest.fn().mockResolvedValue(undefined),
    stopWatch: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockReturnValue({ watching: false, directory: '', indexedCount: 0 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceController],
      providers: [{ provide: WorkspaceWatcherService, useValue: mockWatcher }],
    }).compile();
    controller = module.get<WorkspaceController>(WorkspaceController);
  });

  it('watch starts the watcher', async () => {
    const result = await controller.watch({ directory: '/test/dir' });
    expect(mockWatcher.startWatch).toHaveBeenCalledWith('/test/dir');
    expect(result).toEqual({ ok: true, directory: '/test/dir' });
  });

  it('watch uses default directory when not provided', async () => {
    const result = await controller.watch({});
    expect(mockWatcher.startWatch).toHaveBeenCalledWith(undefined);
    expect(result.ok).toBe(true);
  });

  it('getStatus returns watcher state', () => {
    const result = controller.getStatus();
    expect(mockWatcher.getStatus).toHaveBeenCalled();
    expect(result).toHaveProperty('watching');
    expect(result).toHaveProperty('directory');
    expect(result).toHaveProperty('indexedCount');
  });

  it('stopWatch stops the watcher', async () => {
    const result = await controller.stopWatch();
    expect(mockWatcher.stopWatch).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/workspace/workspace.controller.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './workspace.controller'`

- [ ] **Step 3: Create WatchDto**

Create `backend/src/workspace/dto/watch.dto.ts`:

```typescript
import { IsOptional, IsString } from 'class-validator';

export class WatchDto {
  @IsOptional()
  @IsString()
  directory?: string;
}
```

- [ ] **Step 4: Implement WorkspaceController**

Create `backend/src/workspace/workspace.controller.ts`:

```typescript
import { Controller, Get, Post, Delete, Body } from '@nestjs/common';
import { WorkspaceWatcherService } from './workspace-watcher.service';
import { WatchDto } from './dto/watch.dto';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly watcher: WorkspaceWatcherService) {}

  @Post('watch')
  async watch(@Body() dto: WatchDto) {
    const directory = dto.directory;
    await this.watcher.startWatch(directory);
    return { ok: true, directory: directory || this.watcher.getStatus().directory };
  }

  @Get('watch/status')
  getStatus() {
    return this.watcher.getStatus();
  }

  @Delete('watch')
  async stopWatch() {
    await this.watcher.stopWatch();
    return { ok: true };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && npx jest src/workspace/workspace.controller.spec.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/workspace/workspace.controller.ts backend/src/workspace/workspace.controller.spec.ts backend/src/workspace/dto/watch.dto.ts
git commit -m "feat: add WorkspaceController with watch/status/stop endpoints"
```

---

## Task 4: WorkspaceModule + Register in AppModule

**Files:**
- Create: `backend/src/workspace/workspace.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create WorkspaceModule**

Create `backend/src/workspace/workspace.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceWatcherService } from './workspace-watcher.service';
import { WorkspaceController } from './workspace.controller';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceWatcherService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
```

- [ ] **Step 2: Register in AppModule**

Read `backend/src/app.module.ts`, then add:

```typescript
// Add import at top
import { WorkspaceModule } from './workspace/workspace.module';

// Add to imports array
    WorkspaceModule,
```

- [ ] **Step 3: Run all backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS (previous tests + 16 new ones from workspace module)

- [ ] **Step 4: Commit**

```bash
git add backend/src/workspace/workspace.module.ts backend/src/app.module.ts
git commit -m "feat: add WorkspaceModule and register in AppModule"
```

---

## Task 5: Refactor File Executors to Inject WorkspaceService

**Files:**
- Modify: `backend/src/tools/executors/write-file.executor.ts`
- Modify: `backend/src/tools/executors/write-file.executor.spec.ts`
- Modify: `backend/src/tools/executors/read-file.executor.ts`
- Modify: `backend/src/tools/executors/read-file.executor.spec.ts`
- Modify: `backend/src/tools/executors/list-directory.executor.ts`
- Modify: `backend/src/tools/executors/list-directory.executor.spec.ts`

### 5a. WriteFileExecutor

- [ ] **Step 1: Update WriteFileExecutor**

Read `backend/src/tools/executors/write-file.executor.ts`, then replace its content:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';

@Injectable()
export class WriteFileExecutor implements ToolExecutor {
  readonly name = 'write_file';

  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = args.path as string | undefined;
    const content = args.content as string | undefined;
    if (!filePath || content === undefined) return 'Error: path and content are required.';
    if (!this.workspace.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`;
    try {
      const { bytesWritten, resolved } = await this.workspace.writeFile(filePath, content);
      return `Written ${bytesWritten} bytes to ${resolved}`;
    } catch (e) {
      return `Error writing file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 2: Update WriteFileExecutor spec**

Read `backend/src/tools/executors/write-file.executor.spec.ts`, then update it to mock WorkspaceService:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { WriteFileExecutor } from './write-file.executor';
import { WorkspaceService } from '../../workspace/workspace.service';

describe('WriteFileExecutor', () => {
  let executor: WriteFileExecutor;
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
    writeFile: jest.fn().mockResolvedValue({ bytesWritten: 5, resolved: '/workspace/test.txt' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WriteFileExecutor,
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    executor = module.get<WriteFileExecutor>(WriteFileExecutor);
  });

  it('write_file writes content and returns byte count', async () => {
    const result = await executor.execute({ path: 'test.txt', content: 'hello' });
    expect(mockWorkspace.writeFile).toHaveBeenCalledWith('test.txt', 'hello');
    expect(result).toBe('Written 5 bytes to /workspace/test.txt');
  });

  it('write_file returns error when path not allowed', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(false);
    const result = await executor.execute({ path: '/etc/passwd', content: 'x' });
    expect(result).toBe('Error: path "/etc/passwd" is not allowed.');
  });
});
```

- [ ] **Step 3: Update ReadFileExecutor**

Read `backend/src/tools/executors/read-file.executor.ts`, then replace its content:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';

@Injectable()
export class ReadFileExecutor implements ToolExecutor {
  readonly name = 'read_file';

  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = args.path as string | undefined;
    if (!filePath) return 'Error: path is required.';
    if (!this.workspace.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`;
    try {
      const content = await this.workspace.readFile(filePath);
      const maxSize = 100 * 1024;
      if (content.length > maxSize) {
        return content.substring(0, maxSize) + `\n... [truncated ${content.length - maxSize} bytes]`;
      }
      return content;
    } catch (e) {
      return `Error reading file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 4: Update ReadFileExecutor spec**

Read `backend/src/tools/executors/read-file.executor.spec.ts`, then update it:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ReadFileExecutor } from './read-file.executor';
import { WorkspaceService } from '../../workspace/workspace.service';

describe('ReadFileExecutor', () => {
  let executor: ReadFileExecutor;
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
    readFile: jest.fn().mockResolvedValue('file content'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadFileExecutor,
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    executor = module.get<ReadFileExecutor>(ReadFileExecutor);
  });

  it('read_file reads file content', async () => {
    const result = await executor.execute({ path: 'test.txt' });
    expect(mockWorkspace.readFile).toHaveBeenCalledWith('test.txt');
    expect(result).toBe('file content');
  });

  it('read_file returns error when path not allowed', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(false);
    const result = await executor.execute({ path: '/etc/passwd' });
    expect(result).toBe('Error: path "/etc/passwd" is not allowed.');
  });
});
```

- [ ] **Step 5: Update ListDirectoryExecutor**

Read `backend/src/tools/executors/list-directory.executor.ts`, then replace its content:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';

@Injectable()
export class ListDirectoryExecutor implements ToolExecutor {
  readonly name = 'list_directory';

  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const dirPath = (args.path as string) || '.';
    if (!this.workspace.isPathAllowed(dirPath)) return `Error: path "${dirPath}" is not allowed.`;
    try {
      return await this.workspace.listDirectory(dirPath);
    } catch (e) {
      return `Error listing directory: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 6: Update ListDirectoryExecutor spec**

Read `backend/src/tools/executors/list-directory.executor.spec.ts`, then update it:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ListDirectoryExecutor } from './list-directory.executor';
import { WorkspaceService } from '../../workspace/workspace.service';

describe('ListDirectoryExecutor', () => {
  let executor: ListDirectoryExecutor;
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
    listDirectory: jest.fn().mockResolvedValue('- file1.txt\n- file2.ts\nd subdir'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListDirectoryExecutor,
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    executor = module.get<ListDirectoryExecutor>(ListDirectoryExecutor);
  });

  it('list_directory lists entries', async () => {
    const result = await executor.execute({ path: '.' });
    expect(mockWorkspace.listDirectory).toHaveBeenCalledWith('.');
    expect(result).toContain('file1.txt');
  });

  it('list_directory returns error when path not allowed', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(false);
    const result = await executor.execute({ path: '/etc' });
    expect(result).toBe('Error: path "/etc" is not allowed.');
  });
});
```

- [ ] **Step 7: Run all backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS (~19 suites)

- [ ] **Step 8: Commit**

```bash
git add backend/src/tools/executors/write-file.executor.ts backend/src/tools/executors/write-file.executor.spec.ts backend/src/tools/executors/read-file.executor.ts backend/src/tools/executors/read-file.executor.spec.ts backend/src/tools/executors/list-directory.executor.ts backend/src/tools/executors/list-directory.executor.spec.ts
git commit -m "refactor: inject WorkspaceService into file executors, remove process.cwd() from ALLOWED_PATHS defaults"
```

---

## Task 6: Update Frontend FilesView

**Files:**
- Modify: `frontend/src/components/FilesView.vue`

- [ ] **Step 1: Read FilesView.vue**

Read `frontend/src/components/FilesView.vue` to find the watch-related code.

- [ ] **Step 2: Update watch endpoint and add stop-watch**

Locate the `toggleWatch` function and the watcher status section. Make these changes:

1. Change the watch endpoint from `/api/knowledge/watch` to `/api/workspace/watch`
2. Change the status endpoint from `/api/knowledge/watch/status` to `/api/workspace/watch/status`
3. Add stop-watch functionality (call `DELETE /api/workspace/watch`)
4. Add status polling with `setInterval` while watching

Update the `<script>` section:

```typescript
const watchDir = ref('')
const watching = ref(false)
const indexedCount = ref(0)
let watchPollTimer: ReturnType<typeof setInterval> | null = null

async function toggleWatch() {
  if (watching.value) {
    // Stop watching
    try {
      await fetch('/api/workspace/watch', { method: 'DELETE' })
      watching.value = false
      if (watchPollTimer) {
        clearInterval(watchPollTimer)
        watchPollTimer = null
      }
    } catch { /* ignore */ }
    return
  }
  if (!watchDir.value.trim()) return
  try {
    const res = await fetch('/api/workspace/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory: watchDir.value }),
    })
    if (res.ok) {
      watching.value = true
      watchPollTimer = setInterval(pollWatchStatus, 3000)
    }
  } catch { /* ignore */ }
}

async function pollWatchStatus() {
  try {
    const res = await fetch('/api/workspace/watch/status')
    if (res.ok) {
      const data = await res.json()
      watching.value = data.watching
      indexedCount.value = data.indexedCount
    }
  } catch { /* ignore */ }
}

onUnmounted(() => {
  if (watchPollTimer) clearInterval(watchPollTimer)
})
```

Update the watcher UI section to show a stop button:

```html
<div class="border-t border-cyber-accent/10 pt-4">
  <div class="text-[#888888] text-[10px] font-mono mb-2">{{ t('files.watch.title') }}</div>
  <div class="flex gap-2 items-center">
    <span class="text-[#888888] text-xs font-mono">{{ t('files.watch.path') }}</span>
    <input v-model="watchDir" :disabled="watching" placeholder="/workspace" class="flex-1 bg-cyber-dark text-[#EEEEEE] text-sm px-2 py-1.5 font-mono outline-none" />
    <button @click="toggleWatch" class="px-3 py-1.5 text-xs font-mono transition-colors duration-150" :class="watching ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20' : 'text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20'">
      {{ watching ? t('files.watch.stop') : t('files.watch.btn') }}
    </button>
  </div>
  <div v-if="watching" class="text-cyber-green text-[10px] font-mono mt-1">{{ t('files.watch.status') }} ({{ indexedCount }} files)</div>
</div>
```

- [ ] **Step 3: Add missing locale keys**

Read `frontend/src/locales/vi.json` and `frontend/src/locales/en.json`, add:

**vi.json:**
```json
  "files.watch.stop": "Dừng",
```

**en.json:**
```json
  "files.watch.stop": "Stop",
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -10
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FilesView.vue frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: update FilesView to use /api/workspace/watch endpoints with stop-watch"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Full frontend build**

```bash
cd frontend && npm run build
```

- [ ] **Step 2: Full backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS (~19 suites)

- [ ] **Step 3: Review commit log**

```bash
git log --oneline -10
```

Expected: Clean commit history with logical steps.
