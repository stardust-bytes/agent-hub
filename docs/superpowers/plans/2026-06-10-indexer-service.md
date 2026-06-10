# IndexerService Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a queue-based IndexerService with concurrency control to reduce system lag when the codebase watcher processes file changes.

**Architecture:** IndexerService manages a FIFO job queue with max 3 concurrent Ollama API calls. WorkspaceWatcherService.handleFileChange enqueues file paths instead of processing directly. KnowledgeService gains findByFilepath() to replace the O(n) findAll() + filter pattern.

**Tech Stack:** NestJS 10, TypeScript strict, Jest (TDD).

---

## File Map

**Create:**
- `backend/src/workspace/indexer.service.ts`
- `backend/src/workspace/indexer.service.spec.ts`

**Modify:**
- `backend/src/knowledge/knowledge.service.ts` — add `findByFilepath()`
- `backend/src/workspace/workspace-watcher.service.ts` — enqueue instead of direct process
- `backend/src/workspace/workspace-watcher.service.spec.ts` — update mocks
- `backend/src/workspace/workspace.module.ts` — add IndexerService to providers
- `backend/src/workspace/workspace.controller.ts` — add `GET /workspace/indexer/status`
- `backend/src/workspace/workspace.controller.spec.ts` — add status test

---

## Task 1: Add findByFilepath to KnowledgeService

**Files:**
- Modify: `backend/src/knowledge/knowledge.service.ts`

- [ ] **Step 1: Add findByFilepath method**

Read `backend/src/knowledge/knowledge.service.ts`, find the `create` method (around line 124), and add this new method after it:

```typescript
  async findByFilepath(filepath: string) {
    return this.prisma.knowledgeFile.findFirst({ where: { filepath } });
  }
```

- [ ] **Step 2: Verify build**

```bash
cd backend && npx jest src/knowledge --no-coverage
```

Expected: All knowledge tests pass (2 suites)

- [ ] **Step 3: Commit**

```bash
git add backend/src/knowledge/knowledge.service.ts
git commit -m "feat: add findByFilepath to KnowledgeService"
```

---

## Task 2: IndexerService (TDD)

**Files:**
- Create: `backend/src/workspace/indexer.service.ts`
- Create: `backend/src/workspace/indexer.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/workspace/indexer.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { IndexerService } from './indexer.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { WorkspaceService } from './workspace.service';

describe('IndexerService', () => {
  let service: IndexerService;
  const mockKnowledge = {
    findByFilepath: jest.fn().mockResolvedValue(null),
    createWithPath: jest.fn().mockResolvedValue({ id: 1 }),
    processFile: jest.fn().mockResolvedValue(undefined),
  };
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexerService,
        { provide: KnowledgeService, useValue: mockKnowledge },
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    service = module.get<IndexerService>(IndexerService);
  });

  it('enqueue adds file to pending queue', () => {
    service.enqueue('/test/file.ts');
    const status = service.getStatus();
    expect(status.pending).toBe(1);
    expect(status.processing).toBe(0);
  });

  it('enqueue deduplicates same file path', () => {
    service.enqueue('/test/file.ts');
    service.enqueue('/test/file.ts');
    const status = service.getStatus();
    expect(status.pending).toBe(1);
  });

  it('getStatus returns stats', () => {
    const status = service.getStatus();
    expect(status).toHaveProperty('pending');
    expect(status).toHaveProperty('processing');
    expect(status).toHaveProperty('done');
    expect(status).toHaveProperty('errors');
  });

  it('processes enqueued files', async () => {
    service.enqueue('/test/file.ts');
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(mockKnowledge.processFile).toHaveBeenCalled();
  });

  it('respects max concurrency', () => {
    for (let i = 0; i < 10; i++) service.enqueue(`/test/file${i}.ts`);
    const status = service.getStatus();
    expect(status.pending).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/workspace/indexer.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './indexer.service'`

- [ ] **Step 3: Implement IndexerService**

Create `backend/src/workspace/indexer.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { WorkspaceService } from './workspace.service';
import * as path from 'path';
import * as fs from 'fs/promises';

const DEFAULT_CONCURRENCY = 3;
const SUPPORTED_EXTS = ['.ts', '.js', '.py', '.md', '.txt', '.json', '.yaml', '.yml'];

interface IndexerStatus {
  pending: number;
  processing: number;
  done: number;
  errors: number;
}

@Injectable()
export class IndexerService {
  private queue: string[] = [];
  private processing = new Set<string>();
  private done = 0;
  private errors = 0;
  private concurrency = DEFAULT_CONCURRENCY;
  private running = false;

  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly workspace: WorkspaceService,
  ) {}

  enqueue(filePath: string): void {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTS.includes(ext)) return;
    const resolved = path.resolve(filePath);
    if (this.queue.includes(resolved) || this.processing.has(resolved)) return;
    this.queue.push(resolved);
    if (!this.running) {
      this.running = true;
      this.processNext();
    }
  }

  getStatus(): IndexerStatus {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      done: this.done,
      errors: this.errors,
    };
  }

  private async processNext(): Promise<void> {
    while (this.processing.size < this.concurrency && this.queue.length > 0) {
      const filePath = this.queue.shift()!;
      this.processing.add(filePath);
      this.processFile(filePath).finally(() => {
        this.processing.delete(filePath);
        this.processNext();
      });
    }
    if (this.processing.size === 0) {
      this.running = false;
    }
  }

  private async processFile(filePath: string): Promise<void> {
    try {
      const known = await this.knowledge.findByFilepath(filePath);
      if (known) {
        await this.knowledge.processFile(known.id);
      } else {
        const stats = await fs.stat(filePath);
        const mimeType = this.inferMimeType(path.extname(filePath).toLowerCase());
        const record = await this.knowledge.createWithPath(
          path.basename(filePath), filePath, stats.size, mimeType,
        );
        await this.knowledge.processFile(record.id);
      }
      this.done++;
    } catch {
      this.errors++;
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

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/workspace/indexer.service.spec.ts --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/workspace/indexer.service.ts backend/src/workspace/indexer.service.spec.ts
git commit -m "feat: add IndexerService with queue-based file processing and concurrency control"
```

---

## Task 3: Refactor WorkspaceWatcherService

**Files:**
- Modify: `backend/src/workspace/workspace-watcher.service.ts`
- Modify: `backend/src/workspace/workspace-watcher.service.spec.ts`

- [ ] **Step 1: Update WorkspaceWatcherService**

Read `backend/src/workspace/workspace-watcher.service.ts` and replace its content:

```typescript
import { Injectable } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { IndexerService } from './indexer.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import * as chokidar from 'chokidar';
import * as path from 'path';

@Injectable()
export class WorkspaceWatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private watching = false;
  private directory = '';

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly indexer: IndexerService,
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

    this.watcher.on('add', (filePath: string) => this.indexer.enqueue(filePath));
    this.watcher.on('change', (filePath: string) => this.indexer.enqueue(filePath));
    this.watcher.on('unlink', (filePath: string) => this.handleFileDelete(filePath));

    this.watching = true;
  }

  async stopWatch(): Promise<void> {
    if (this.watcher) await this.watcher.close();
    this.watcher = null;
    this.watching = false;
  }

  getStatus(): { watching: boolean; directory: string; indexedCount: number } {
    const s = this.indexer.getStatus();
    return { watching: this.watching, directory: this.directory, indexedCount: s.done };
  }

  private async handleFileDelete(filePath: string): Promise<void> {
    try {
      const known = await this.knowledge.findByFilepath(filePath);
      if (known) await this.knowledge.remove(known.id);
    } catch { /* ignore */ }
  }
}
```

- [ ] **Step 2: Update WorkspaceWatcherService spec**

Read `backend/src/workspace/workspace-watcher.service.spec.ts` and replace its content:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceWatcherService } from './workspace-watcher.service';
import { WorkspaceService } from './workspace.service';
import { IndexerService } from './indexer.service';
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
  const mockIndexer = {
    enqueue: jest.fn(),
    getStatus: jest.fn().mockReturnValue({ pending: 0, processing: 0, done: 5, errors: 0 }),
  };
  const mockKnowledge = {
    findByFilepath: jest.fn().mockResolvedValue(null),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceWatcherService,
        { provide: WorkspaceService, useValue: mockWorkspace },
        { provide: IndexerService, useValue: mockIndexer },
        { provide: KnowledgeService, useValue: mockKnowledge },
      ],
    }).compile();
    service = module.get<WorkspaceWatcherService>(WorkspaceWatcherService);
  });

  it('startWatch sets watching to true', async () => {
    await service.startWatch();
    expect(service.getStatus().watching).toBe(true);
  });

  it('startWatch uses provided directory if given', async () => {
    await service.startWatch('/fake/workspace/subdir');
    expect(service.getStatus().directory).toBe('/fake/workspace/subdir');
  });

  it('stopWatch sets watching to false', async () => {
    await service.startWatch();
    await service.stopWatch();
    expect(service.getStatus().watching).toBe(false);
    expect(mockChokidar.close).toHaveBeenCalled();
  });

  it('getStatus returns state from indexer', () => {
    const status = service.getStatus();
    expect(status.indexedCount).toBe(5);
    expect(status.watching).toBe(false);
  });

  it('delegates file changes to indexer.enqueue', async () => {
    await service.startWatch();
    const addHandler = mockChokidar.on.mock.calls.find(c => c[0] === 'add')?.[1];
    if (addHandler) addHandler('/fake/workspace/test.ts');
    expect(mockIndexer.enqueue).toHaveBeenCalledWith('/fake/workspace/test.ts');
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd backend && npx jest src/workspace/workspace-watcher.service.spec.ts --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 4: Run all workspace tests**

```bash
cd backend && npx jest src/workspace --no-coverage
```

Expected: PASS (4 suites — service, watcher, controller, indexer)

- [ ] **Step 5: Commit**

```bash
git add backend/src/workspace/workspace-watcher.service.ts backend/src/workspace/workspace-watcher.service.spec.ts
git commit -m "refactor: WorkspaceWatcherService delegates file processing to IndexerService"
```

---

## Task 4: Register IndexerService + Add Status Endpoint

**Files:**
- Modify: `backend/src/workspace/workspace.module.ts`
- Modify: `backend/src/workspace/workspace.controller.ts`
- Modify: `backend/src/workspace/workspace.controller.spec.ts`

- [ ] **Step 1: Register IndexerService in WorkspaceModule**

Read `backend/src/workspace/workspace.module.ts` and add `IndexerService` to providers:

```typescript
import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceWatcherService } from './workspace-watcher.service';
import { IndexerService } from './indexer.service';
import { WorkspaceController } from './workspace.controller';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceWatcherService, IndexerService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
```

- [ ] **Step 2: Add status endpoint to WorkspaceController**

Read `backend/src/workspace/workspace.controller.ts` and add:

```typescript
import { Controller, Get, Post, Delete, Body } from '@nestjs/common';
import { WorkspaceWatcherService } from './workspace-watcher.service';
import { IndexerService } from './indexer.service';
import { WatchDto } from './dto/watch.dto';

@Controller('workspace')
export class WorkspaceController {
  constructor(
    private readonly watcher: WorkspaceWatcherService,
    private readonly indexer: IndexerService,
  ) {}

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

  @Get('indexer/status')
  getIndexerStatus() {
    return this.indexer.getStatus();
  }
}
```

- [ ] **Step 3: Update controller spec**

Read `backend/src/workspace/workspace.controller.spec.ts` and update:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceWatcherService } from './workspace-watcher.service';
import { IndexerService } from './indexer.service';

describe('WorkspaceController', () => {
  let controller: WorkspaceController;
  const mockWatcher = {
    startWatch: jest.fn().mockResolvedValue(undefined),
    stopWatch: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockReturnValue({ watching: false, directory: '', indexedCount: 0 }),
  };
  const mockIndexer = {
    getStatus: jest.fn().mockReturnValue({ pending: 0, processing: 0, done: 0, errors: 0 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceController],
      providers: [
        { provide: WorkspaceWatcherService, useValue: mockWatcher },
        { provide: IndexerService, useValue: mockIndexer },
      ],
    }).compile();
    controller = module.get<WorkspaceController>(WorkspaceController);
  });

  it('watch starts the watcher', async () => {
    const result = await controller.watch({ directory: '/test/dir' });
    expect(mockWatcher.startWatch).toHaveBeenCalledWith('/test/dir');
    expect(result).toEqual({ ok: true, directory: '/test/dir' });
  });

  it('getStatus returns watcher state', () => {
    const result = controller.getStatus();
    expect(mockWatcher.getStatus).toHaveBeenCalled();
    expect(result).toHaveProperty('watching');
  });

  it('stopWatch stops the watcher', async () => {
    const result = await controller.stopWatch();
    expect(mockWatcher.stopWatch).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('getIndexerStatus returns indexer state', () => {
    const result = controller.getIndexerStatus();
    expect(mockIndexer.getStatus).toHaveBeenCalled();
    expect(result).toHaveProperty('pending');
    expect(result).toHaveProperty('done');
  });
});
```

- [ ] **Step 4: Run all tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS (32+ suites, ~170+ tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/workspace/workspace.module.ts backend/src/workspace/workspace.controller.ts backend/src/workspace/workspace.controller.spec.ts
git commit -m "feat: register IndexerService, add GET /workspace/indexer/status endpoint"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Full backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS

- [ ] **Step 2: Review commit log**

```bash
git log --oneline -6
```

Expected: Clean history
