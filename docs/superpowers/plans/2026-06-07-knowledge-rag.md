# Phase 5 — Knowledge Base & RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add document upload, vector search (RAG), and codebase watcher so the AI agent can answer from indexed context.

**Architecture:** `KnowledgeModule` handles upload → chunk → embed (Ollama) → store (LanceDB). `AgentService` runs vector search on each query and injects top-3 chunks into the Ollama prompt. `FilesView.vue` provides UI for upload, list, delete, and codebase watching.

**Tech Stack:** NestJS 10, Prisma 5, LanceDB, Ollama embeddings, pdf-parse, mammoth, chokidar, Vue 3, vue-i18n.

---

## File Map

**Backend — Install:**
- `backend/package.json` — add `@lancedb/lancedb`, `pdf-parse`, `mammoth`, `chokidar`

**Backend — Prisma:**
- `backend/prisma/schema.prisma` — add `KnowledgeFile` model

**Backend — Create:**
- `backend/src/knowledge/knowledge.module.ts`
- `backend/src/knowledge/knowledge.service.ts`
- `backend/src/knowledge/knowledge.service.spec.ts`
- `backend/src/knowledge/knowledge.controller.ts`
- `backend/src/knowledge/knowledge.controller.spec.ts`
- `backend/src/knowledge/dto/search.dto.ts`

**Backend — Modify:**
- `backend/src/app.module.ts` — add `KnowledgeModule`
- `backend/src/agent/agent.service.ts` — inject `KnowledgeService`, RAG pipeline
- `backend/src/agent/agent.service.spec.ts` — mock `KnowledgeService`
- `backend/src/agent/agent.module.ts` — add `KnowledgeModule` (or rely on @Global)

**Frontend — Create:**
- `frontend/src/components/FilesView.vue`

**Frontend — Modify:**
- `frontend/src/locales/vi.json`
- `frontend/src/locales/en.json`
- `frontend/src/components/AppShell.vue` — conditional FilesView render
- `frontend/src/components/SidebarNav.vue` — update types for `files`

---

## Task 1: Install Backend Dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install packages**

```bash
cd backend && npm install @lancedb/lancedb pdf-parse mammoth chokidar
```

- [ ] **Step 2: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: install LanceDB, pdf-parse, mammoth, chokidar for Phase 5"
```

---

## Task 2: Prisma Migration — Add KnowledgeFile Model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add KnowledgeFile model**

Append after `Setting` model:

```prisma
model KnowledgeFile {
  id         Int      @id @default(autoincrement())
  filename   String
  filepath   String
  size       Int
  mimeType   String
  status     String   @default("indexing")
  chunkCount Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_knowledge_file
npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add KnowledgeFile model to Prisma schema"
```

---

## Task 3: KnowledgeService TDD (Core)

**Files:**
- Create: `backend/src/knowledge/knowledge.service.ts`
- Create: `backend/src/knowledge/knowledge.service.spec.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p backend/src/knowledge/dto
```

- [ ] **Step 2: Write failing tests**

Create `backend/src/knowledge/knowledge.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KnowledgeService } from './knowledge.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  knowledgeFile: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('KnowledgeService', () => {
  let service: KnowledgeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('./workspace_data') } },
      ],
    }).compile();
    service = module.get<KnowledgeService>(KnowledgeService);
    jest.clearAllMocks();
  });

  it('findAll returns all knowledge files', async () => {
    const files = [{ id: 1, filename: 'test.md', size: 100, status: 'ready' }];
    mockPrisma.knowledgeFile.findMany.mockResolvedValue(files);
    const result = await service.findAll();
    expect(result).toEqual(files);
    expect(mockPrisma.knowledgeFile.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
  });

  it('remove deletes file record and returns it', async () => {
    const file = { id: 1, filename: 'test.md', filepath: '/tmp/test.md' };
    mockPrisma.knowledgeFile.findUnique.mockResolvedValue(file);
    mockPrisma.knowledgeFile.delete.mockResolvedValue(file);
    const result = await service.remove(1);
    expect(result.id).toBe(1);
  });

  it('remove throws when file not found', async () => {
    mockPrisma.knowledgeFile.findUnique.mockResolvedValue(null);
    await expect(service.remove(999)).rejects.toThrow('not found');
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd backend && npx jest src/knowledge/knowledge.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './knowledge.service'`

- [ ] **Step 4: Implement KnowledgeService**

Create `backend/src/knowledge/knowledge.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll() {
    return this.prisma.knowledgeFile.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async remove(id: number) {
    const file = await this.prisma.knowledgeFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException(`KnowledgeFile ${id} not found`);
    return this.prisma.knowledgeFile.delete({ where: { id } });
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest src/knowledge/knowledge.service.spec.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/knowledge/
git commit -m "feat: add KnowledgeService with findAll and remove TDD"
```

---

## Task 4: KnowledgeController TDD

**Files:**
- Create: `backend/src/knowledge/knowledge.controller.ts`
- Create: `backend/src/knowledge/knowledge.controller.spec.ts`
- Create: `backend/src/knowledge/dto/search.dto.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/knowledge/knowledge.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

describe('KnowledgeController', () => {
  let controller: KnowledgeController;
  const mockService = {
    findAll: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeController],
      providers: [{ provide: KnowledgeService, useValue: mockService }],
    }).compile();
    controller = module.get<KnowledgeController>(KnowledgeController);
    jest.clearAllMocks();
  });

  it('getAll returns files from service', async () => {
    const files = [{ id: 1, filename: 'test.md' }];
    mockService.findAll.mockResolvedValue(files);
    const result = await controller.getAll();
    expect(result).toEqual(files);
  });

  it('deleteFile calls service.remove', async () => {
    mockService.remove.mockResolvedValue({ id: 1 });
    const result = await controller.deleteFile('1');
    expect(mockService.remove).toHaveBeenCalledWith(1);
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest src/knowledge/knowledge.controller.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Create SearchDto**

Create `backend/src/knowledge/dto/search.dto.ts`:

```typescript
import { IsString } from 'class-validator';

export class SearchDto {
  @IsString()
  query: string;
}
```

- [ ] **Step 4: Create KnowledgeController**

Create `backend/src/knowledge/knowledge.controller.ts`:

```typescript
import { Controller, Get, Delete, Param, ParseIntPipe } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  async getAll() {
    return this.knowledgeService.findAll();
  }

  @Delete(':id')
  async deleteFile(@Param('id', ParseIntPipe) id: number) {
    await this.knowledgeService.remove(id);
    return { ok: true };
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest src/knowledge/ --no-coverage
```

Expected: PASS (5 tests — 3 service + 2 controller)

- [ ] **Step 6: Commit**

```bash
git add backend/src/knowledge/
git commit -m "feat: add KnowledgeController with GET/DELETE endpoints TDD"
```

---

## Task 5: KnowledgeModule + Register in AppModule

**Files:**
- Create: `backend/src/knowledge/knowledge.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create KnowledgeModule**

```typescript
import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
})
export class KnowledgeModule {}
```

- [ ] **Step 2: Register in AppModule**

Add import to `backend/src/app.module.ts`:
```typescript
import { KnowledgeModule } from './knowledge/knowledge.module';
```
Add to `imports` array: `KnowledgeModule,`

- [ ] **Step 3: Run all backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS (~12 suites, ~43 tests)

- [ ] **Step 4: Commit**

```bash
git add backend/src/knowledge/knowledge.module.ts backend/src/app.module.ts
git commit -m "chore: add KnowledgeModule to AppModule"
```

---

## Task 6: RAG Pipeline in AgentService

**Files:**
- Modify: `backend/src/agent/agent.service.ts`
- Modify: `backend/src/agent/agent.service.spec.ts`

- [ ] **Step 1: Update AgentService to inject KnowledgeService**

The current `AgentService` delegates to `OllamaProvider`. For RAG, we embed the user's message, search LanceDB for top-3 chunks, and pass context to Ollama. Since `AgentService` is a thin delegation layer, the RAG logic should go in `OllamaProvider.streamChat()`.

Update `OllamaProvider` to accept context from knowledge base:

In `backend/src/agent/agent.service.ts`, add RAG step before calling `provider.streamChat()`:

```typescript
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { OllamaProvider } from './providers/ollama.provider';
import { KnowledgeService } from '../knowledge/knowledge.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly provider: OllamaProvider,
    private readonly knowledge: KnowledgeService,
  ) {}

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<void> {
    let context = '';
    try {
      const chunks = await this.knowledge.search(message);
      if (chunks.length > 0) {
        context = 'Context from knowledge base:\n' + chunks.map((c: { filename: string; text: string }) =>
          `[File: ${c.filename}]\n${c.text}`
        ).join('\n---\n') + '\n';
      }
    } catch { /* RAG failure should not block chat */ }
    await this.provider.streamChat(message, model, res, signal, context);
  }
}
```

Update `OllamaProvider` interface and implementation to accept optional `context` parameter.

Update `backend/src/agent/providers/llm-provider.interface.ts`:

```typescript
import { Response } from 'express';

export interface LLMProvider {
  streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
    context?: string,
  ): Promise<void>;
}
```

- [ ] **Step 2: Update AgentService spec**

Replace spec to mock `KnowledgeService`:

```typescript
import { Test } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { KnowledgeService } from '../knowledge/knowledge.service';

describe('AgentService', () => {
  let service: AgentService;
  const mockProvider = { streamChat: jest.fn().mockResolvedValue(undefined) };
  const mockKnowledge = { search: jest.fn().mockResolvedValue([]) };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: OllamaProvider, useValue: mockProvider },
        { provide: KnowledgeService, useValue: mockKnowledge },
      ],
    }).compile();
    service = module.get(AgentService);
    jest.clearAllMocks();
  });

  it('streamChat delegates to provider with empty context when no knowledge', async () => {
    const mockRes = {} as any;
    const signal = new AbortController().signal;
    await service.streamChat('hello', 'llama3.2', mockRes, signal);
    expect(mockProvider.streamChat).toHaveBeenCalledWith('hello', 'llama3.2', mockRes, signal, '');
  });
});
```

- [ ] **Step 3: Run tests to confirm they pass**

```bash
npx jest src/agent/agent.service.spec.ts --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/agent.service.ts backend/src/agent/agent.service.spec.ts backend/src/agent/providers/llm-provider.interface.ts
git commit -m "feat: add RAG pipeline to AgentService — search knowledge before streaming"
```

---

## Task 7: Frontend Locale Keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add locale keys**

Append to both files:

**vi.json:**
```json
  "files.header": "KIẾN THỨC",
  "files.dropzone": "Thả file hoặc click để upload",
  "files.filter": "Lọc theo tên...",
  "files.status.ready": "✓ sẵn sàng",
  "files.status.indexing": "⟳ đang index",
  "files.status.error": "✗ lỗi",
  "files.delete": "Xóa",
  "files.empty": "Chưa có file nào",
  "files.watch.title": "Codebase Watcher",
  "files.watch.path": "Đường dẫn:",
  "files.watch.btn": "Theo dõi",
  "files.watch.status": "● đang theo dõi"
```

**en.json:**
```json
  "files.header": "KNOWLEDGE BASE",
  "files.dropzone": "Drop files or click to upload",
  "files.filter": "Filter by name...",
  "files.status.ready": "✓ ready",
  "files.status.indexing": "⟳ indexing",
  "files.status.error": "✗ error",
  "files.delete": "Delete",
  "files.empty": "No files yet",
  "files.watch.title": "Codebase Watcher",
  "files.watch.path": "Directory:",
  "files.watch.btn": "Watch",
  "files.watch.status": "● watching"
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add knowledge base i18n keys"
```

---

## Task 8: FilesView Component

**Files:**
- Create: `frontend/src/components/FilesView.vue`

- [ ] **Step 1: Create FilesView.vue**

```vue
<!-- frontend/src/components/FilesView.vue -->
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-xs tracking-widest font-mono">
        <HiFolder class="w-3 h-3 inline" /> {{ t('files.header') }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-2xl mx-auto space-y-4">

        <!-- Upload zone -->
        <div
          class="border-2 border-dashed border-cyber-accent/20 rounded p-6 text-center cursor-pointer hover:border-cyber-accent/40 transition-colors duration-150"
          @click="triggerUpload"
          @dragover.prevent
          @drop.prevent="onDrop"
        >
          <input ref="fileInput" type="file" class="hidden" multiple @change="onFileChange" />
          <p class="text-[#888888] text-sm font-mono">{{ t('files.dropzone') }}</p>
          <p class="text-[#888888]/60 text-[10px] font-mono mt-1">.pdf .docx .txt .md .ts .js .py</p>
        </div>

        <!-- Filter -->
        <input
          v-model="filter"
          :placeholder="t('files.filter')"
          class="w-full bg-cyber-dark text-[#EEEEEE] text-sm px-2 py-1.5 font-mono outline-none"
        />

        <!-- File list -->
        <div v-if="files.length === 0" class="text-center text-[#888888] text-xs font-mono py-8">
          {{ t('files.empty') }}
        </div>
        <div v-for="f in filteredFiles" :key="f.id"
          class="flex items-center gap-3 bg-cyber-dark px-3 py-2 text-xs font-mono"
        >
          <span class="flex-1 text-[#EEEEEE] truncate">{{ f.filename }}</span>
          <span class="text-[#888888] shrink-0 w-16 text-right">{{ formatSize(f.size) }}</span>
          <span :class="statusClass(f.status)" class="shrink-0 w-20 text-center">{{ statusLabel(f.status) }}</span>
          <button @click="deleteFile(f.id)" class="text-[#888888] hover:text-red-400 shrink-0 transition-colors duration-150">{{ t('files.delete') }}</button>
        </div>

        <!-- Codebase watcher -->
        <div class="border-t border-cyber-accent/10 pt-4">
          <div class="text-[#888888] text-[10px] font-mono mb-2">{{ t('files.watch.title') }}</div>
          <div class="flex gap-2 items-center">
            <span class="text-[#888888] text-xs font-mono">{{ t('files.watch.path') }}</span>
            <input v-model="watchDir" placeholder="/workspace" class="flex-1 bg-cyber-dark text-[#EEEEEE] text-sm px-2 py-1.5 font-mono outline-none" />
            <button @click="toggleWatch" class="px-3 py-1.5 text-xs font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 transition-colors duration-150">{{ t('files.watch.btn') }}</button>
          </div>
          <div v-if="watching" class="text-cyber-green text-[10px] font-mono mt-1">{{ t('files.watch.status') }} ({{ indexedCount }} files)</div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiFolder } from 'vue-icons-plus/hi'

interface KnowledgeFile {
  id: number
  filename: string
  size: number
  mimeType: string
  status: string
  chunkCount: number
  createdAt: string
}

const { t } = useI18n()
const files = ref<KnowledgeFile[]>([])
const filter = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const watchDir = ref('')
const watching = ref(false)
const indexedCount = ref(0)

const filteredFiles = computed(() =>
  files.value.filter(f => f.filename.toLowerCase().includes(filter.value.toLowerCase()))
)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusClass(status: string): string {
  if (status === 'ready') return 'text-cyber-green'
  if (status === 'indexing') return 'text-[#FFA500]'
  return 'text-red-400'
}

function statusLabel(status: string): string {
  if (status === 'ready') return t('files.status.ready')
  if (status === 'indexing') return t('files.status.indexing')
  return t('files.status.error')
}

function triggerUpload() { fileInput.value?.click() }

function onDrop(e: DragEvent) {
  if (e.dataTransfer?.files) uploadFiles(e.dataTransfer.files)
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files) uploadFiles(target.files)
}

async function uploadFiles(fileList: FileList) {
  for (const file of Array.from(fileList)) {
    const form = new FormData()
    form.append('file', file)
    try {
      await fetch('/api/knowledge/upload', { method: 'POST', body: form })
      await loadFiles()
    } catch { /* ignore */ }
  }
}

async function deleteFile(id: number) {
  try {
    await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
    files.value = files.value.filter(f => f.id !== id)
  } catch { /* ignore */ }
}

async function loadFiles() {
  try {
    const res = await fetch('/api/knowledge')
    if (res.ok) files.value = await res.json() as KnowledgeFile[]
  } catch { /* ignore */ }
}

async function toggleWatch() {
  if (!watchDir.value.trim()) return
  try {
    await fetch('/api/knowledge/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory: watchDir.value }),
    })
    watching.value = true
  } catch { /* ignore */ }
}

onMounted(loadFiles)
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FilesView.vue
git commit -m "feat: add FilesView with upload, list, delete, codebase watcher"
```

---

## Task 9: Wire AppShell + SidebarNav

**Files:**
- Modify: `frontend/src/components/AppShell.vue`
- Modify: `frontend/src/components/SidebarNav.vue`

- [ ] **Step 1: Update AppShell**

Add `FilesView` import and conditional render (the `'files'` view type already exists):

```vue
<template>
  <div class="flex flex-col h-screen bg-cyber-bg font-mono overflow-hidden">
    <div class="flex flex-1 overflow-hidden">
      <SidebarNav :active-view="activeView" @navigate="activeView = $event" />
      <FilesView v-if="activeView === 'files'" class="flex-1 overflow-hidden" />
      <SettingsView v-else-if="activeView === 'settings'" class="flex-1 overflow-hidden" />
      <TasksView v-else-if="activeView === 'tasks'" class="flex-1 overflow-hidden" />
      <ChatPanel v-else class="flex-1 overflow-hidden" />
    </div>
    <StatusBar :model-name="modelName" :db-connected="dbConnected" :ws-connected="wsConnected" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SidebarNav from './SidebarNav.vue'
import ChatPanel from './ChatPanel.vue'
import TasksView from './TasksView.vue'
import SettingsView from './SettingsView.vue'
import FilesView from './FilesView.vue'
import StatusBar from './StatusBar.vue'
// ... rest unchanged
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AppShell.vue
git commit -m "feat: integrate FilesView into AppShell"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Full frontend build**

```bash
cd frontend && npm run build
```

- [ ] **Step 2: Full backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS (~12 suites, ~43 tests).

- [ ] **Step 3: Review commit log**

```bash
git log --oneline -10
```
