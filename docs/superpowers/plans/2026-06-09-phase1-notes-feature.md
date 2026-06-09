# Phase 1: Notes & Agent-to-Task — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simple multi-line note system with its own nav tab, and 5 Agent tools including `convert_note_to_task`.

**Architecture:** New Prisma model `Note`, new `NotesModule` following existing `TasksModule` pattern, 5 tool executors following existing tool pattern, new `NotesView.vue` component.

**Tech Stack:** NestJS, Prisma, SQLite, Vue 3, Socket.io

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/` (auto-generated)

- [ ] **Step 1: Add Note model to schema.prisma**

Add after `model Task { }` block:
```prisma
model Note {
  id        Int      @id @default(autoincrement())
  title     String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Run migration + generate**

```bash
cd backend
npx prisma migrate dev --name add-notes
npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add Note model to schema"
```

---

### Task 2: Backend NotesModule — CRUD + WebSocket + DTOs + tests

**Files:**
- Create: `backend/src/notes/notes.module.ts`
- Create: `backend/src/notes/notes.controller.ts`
- Create: `backend/src/notes/notes.controller.spec.ts`
- Create: `backend/src/notes/notes.service.ts`
- Create: `backend/src/notes/notes.service.spec.ts`
- Create: `backend/src/notes/notes.gateway.ts`
- Create: `backend/src/notes/notes.gateway.spec.ts`
- Create: `backend/src/notes/dto/create-note.dto.ts`
- Create: `backend/src/notes/dto/update-note.dto.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

`backend/src/notes/dto/create-note.dto.ts`:
```ts
import { IsString, IsNotEmpty } from 'class-validator'

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  title: string

  @IsString()
  @IsNotEmpty()
  content: string
}
```

`backend/src/notes/dto/update-note.dto.ts`:
```ts
import { PartialType } from '@nestjs/mapped-types'
import { CreateNoteDto } from './create-note.dto'

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}
```

- [ ] **Step 2: Create notes.service.ts**

```ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotesGateway } from './notes.gateway'
import { CreateNoteDto } from './dto/create-note.dto'
import { UpdateNoteDto } from './dto/update-note.dto'

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotesGateway,
  ) {}

  findAll() {
    return this.prisma.note.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async create(dto: CreateNoteDto) {
    const note = await this.prisma.note.create({ data: dto })
    this.gateway.emitCreated(note)
    return note
  }

  async update(id: number, dto: UpdateNoteDto) {
    await this.findOneOrFail(id)
    const note = await this.prisma.note.update({ where: { id }, data: dto })
    this.gateway.emitUpdated(note)
    return note
  }

  async remove(id: number) {
    await this.findOneOrFail(id)
    const note = await this.prisma.note.delete({ where: { id } })
    this.gateway.emitDeleted(note.id)
    return note
  }

  async findOne(id: number) {
    const note = await this.prisma.note.findUnique({ where: { id } })
    if (!note) throw new NotFoundException(`Note ${id} not found`)
    return note
  }

  private async findOneOrFail(id: number) {
    return this.findOne(id)
  }
}
```

- [ ] **Step 3: Write notes.service.spec.ts tests**

Create `backend/src/notes/notes.service.spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing'
import { NotesService } from './notes.service'
import { NotesGateway } from './notes.gateway'

const mockPrisma = {
  note: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}

const mockGateway = {
  emitCreated: jest.fn(),
  emitUpdated: jest.fn(),
  emitDeleted: jest.fn(),
}

describe('NotesService', () => {
  let service: NotesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: 'PrismaService', useValue: mockPrisma },
        { provide: NotesGateway, useValue: mockGateway },
      ],
    }).compile()

    service = module.get(NotesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('findAll returns all notes ordered by createdAt desc', async () => {
    mockPrisma.note.findMany.mockResolvedValue([])
    const result = await service.findAll()
    expect(result).toEqual([])
    expect(mockPrisma.note.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    })
  })

  it('create creates a note and emits event', async () => {
    const dto = { title: 'Test', content: 'Content' }
    const created = { id: 1, ...dto, createdAt: new Date(), updatedAt: new Date() }
    mockPrisma.note.create.mockResolvedValue(created)
    const result = await service.create(dto)
    expect(result).toEqual(created)
    expect(mockGateway.emitCreated).toHaveBeenCalledWith(created)
  })

  it('update updates a note and emits event', async () => {
    const existing = { id: 1, title: 'Old', content: 'Old', createdAt: new Date(), updatedAt: new Date() }
    const updated = { ...existing, title: 'New' }
    mockPrisma.note.findUnique.mockResolvedValue(existing)
    mockPrisma.note.update.mockResolvedValue(updated)
    const result = await service.update(1, { title: 'New' })
    expect(result.title).toBe('New')
    expect(mockGateway.emitUpdated).toHaveBeenCalledWith(updated)
  })

  it('remove deletes a note and emits event', async () => {
    const existing = { id: 1, title: 'Test', content: 'C', createdAt: new Date(), updatedAt: new Date() }
    mockPrisma.note.findUnique.mockResolvedValue(existing)
    mockPrisma.note.delete.mockResolvedValue(existing)
    const result = await service.remove(1)
    expect(result.id).toBe(1)
    expect(mockGateway.emitDeleted).toHaveBeenCalledWith(1)
  })

  it('findOne throws on missing note', async () => {
    mockPrisma.note.findUnique.mockResolvedValue(null)
    await expect(service.findOne(999)).rejects.toThrow('Note 999 not found')
  })
})
```

- [ ] **Step 4: Create notes.gateway.ts**

Follow the same pattern as `tasks.gateway.ts`:
```ts
import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server } from 'socket.io'
import { Note } from '@prisma/client'

@WebSocketGateway({ namespace: '/notes' })
export class NotesGateway {
  @WebSocketServer()
  server: Server

  emitCreated(note: Note) {
    this.server?.emit('note:created', note)
  }

  emitUpdated(note: Note) {
    this.server?.emit('note:updated', note)
  }

  emitDeleted(id: number) {
    this.server?.emit('note:deleted', { id })
  }
}
```

- [ ] **Step 5: Create notes.controller.ts**

```ts
import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe } from '@nestjs/common'
import { NotesService } from './notes.service'
import { CreateNoteDto } from './dto/create-note.dto'
import { UpdateNoteDto } from './dto/update-note.dto'

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  findAll() {
    return this.notesService.findAll()
  }

  @Post()
  create(@Body() dto: CreateNoteDto) {
    return this.notesService.create(dto)
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.notesService.remove(id)
  }
}
```

- [ ] **Step 6: Create notes.module.ts**

```ts
import { Module } from '@nestjs/common'
import { NotesController } from './notes.controller'
import { NotesService } from './notes.service'
import { NotesGateway } from './notes.gateway'

@Module({
  controllers: [NotesController],
  providers: [NotesService, NotesGateway],
  exports: [NotesService],
})
export class NotesModule {}
```

- [ ] **Step 7: Import NotesModule in app.module.ts**

Add `NotesModule` to the imports array.

- [ ] **Step 8: Run tests**

```bash
npx jest src/notes
```
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add backend/src/notes/ backend/src/app.module.ts
git commit -m "feat: add NotesModule with CRUD and WebSocket"
```

---

### Task 3: Create note tool executors

**Files:**
- Create: `backend/src/tools/executors/create-note.executor.ts`
- Create: `backend/src/tools/executors/update-note.executor.ts`
- Create: `backend/src/tools/executors/list-notes.executor.ts`
- Create: `backend/src/tools/executors/delete-note.executor.ts`
- Create: `backend/src/tools/executors/convert-note-to-task.executor.ts`
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Create create-note.executor.ts**

```ts
import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import { NotesService } from '../../notes/notes.service'

@Injectable()
export class CreateNoteExecutor implements ToolExecutor {
  readonly name = 'create_note'

  constructor(private readonly notesService: NotesService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const title = args.title as string
    const content = args.content as string
    if (!title || !content) return 'Error: title and content are required.'

    try {
      const note = await this.notesService.create({ title, content })
      return `Created note #${note.id}: "${note.title}"`
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown'}`
    }
  }
}
```

- [ ] **Step 2: Create update-note.executor.ts**

```ts
import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import { NotesService } from '../../notes/notes.service'

@Injectable()
export class UpdateNoteExecutor implements ToolExecutor {
  readonly name = 'update_note'

  constructor(private readonly notesService: NotesService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const id = Number(args.id)
    if (!id) return 'Error: id is required.'

    try {
      const dto: Record<string, string> = {}
      if (args.title) dto.title = args.title as string
      if (args.content) dto.content = args.content as string
      const note = await this.notesService.update(id, dto)
      return `Updated note #${note.id}: "${note.title}"`
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown'}`
    }
  }
}
```

- [ ] **Step 3: Create list-notes.executor.ts**

```ts
import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import { NotesService } from '../../notes/notes.service'

@Injectable()
export class ListNotesExecutor implements ToolExecutor {
  readonly name = 'list_notes'

  constructor(private readonly notesService: NotesService) {}

  async execute(_args: Record<string, unknown>): Promise<string> {
    try {
      const notes = await this.notesService.findAll()
      if (!notes.length) return 'No notes yet.'

      return notes.map((n, i) =>
        `${i + 1}. ${n.title}\n   ${n.content}`
      ).join('\n\n')
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown'}`
    }
  }
}
```

- [ ] **Step 4: Create delete-note.executor.ts**

```ts
import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import { NotesService } from '../../notes/notes.service'

@Injectable()
export class DeleteNoteExecutor implements ToolExecutor {
  readonly name = 'delete_note'

  constructor(private readonly notesService: NotesService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const id = Number(args.id)
    if (!id) return 'Error: id is required.'

    try {
      await this.notesService.remove(id)
      return `Deleted note #${id}`
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown'}`
    }
  }
}
```

- [ ] **Step 5: Create convert-note-to-task.executor.ts**

This uses both NotesService and TasksService (import TasksModule):
```ts
import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import { NotesService } from '../../notes/notes.service'
import { TasksService } from '../../tasks/tasks.service'

@Injectable()
export class ConvertNoteToTaskExecutor implements ToolExecutor {
  readonly name = 'convert_note_to_task'

  constructor(
    private readonly notesService: NotesService,
    private readonly tasksService: TasksService,
  ) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const noteId = Number(args.noteId)
    if (!noteId) return 'Error: noteId is required.'

    try {
      const note = await this.notesService.findOne(noteId)
      const task = await this.tasksService.create({
        title: note.title,
        description: note.content,
      })
      await this.notesService.remove(noteId)
      return `✅ Converted note "${note.title}" to task #${task.id}`
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown'}`
    }
  }
}
```

- [ ] **Step 6: Update seed.ts — add note tools to DEFAULT_TOOLS**

Add these to the `DEFAULT_TOOLS` array:
```ts
  { name: 'create_note', description: 'Create a new note', parameters: '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"}},"required":["title","content"]}' },
  { name: 'update_note', description: 'Update a note (title, content)', parameters: '{"type":"object","properties":{"id":{"type":"number"},"title":{"type":"string"},"content":{"type":"string"}},"required":["id"]}' },
  { name: 'list_notes', description: 'List all notes', parameters: '{"type":"object","properties":{}}' },
  { name: 'delete_note', description: 'Delete a note by ID', parameters: '{"type":"object","properties":{"id":{"type":"number"}},"required":["id"]}' },
  { name: 'convert_note_to_task', description: 'Convert a note to a task in the task board', parameters: '{"type":"object","properties":{"noteId":{"type":"number"}},"required":["noteId"]}' },
```

- [ ] **Step 7: Verify compilation**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/tools/executors/create-note.executor.ts \
       backend/src/tools/executors/update-note.executor.ts \
       backend/src/tools/executors/list-notes.executor.ts \
       backend/src/tools/executors/delete-note.executor.ts \
       backend/src/tools/executors/convert-note-to-task.executor.ts \
       backend/prisma/seed.ts
git commit -m "feat: add note tool executors and seed data"
```

---

### Task 4: Register note executors in modules

**Files:**
- Modify: `backend/src/tools/tools.module.ts`
- Modify: `backend/src/agent/agent.module.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Register in tools.module.ts**

Add to the `EXECUTORS` array:
```ts
import { CreateNoteExecutor } from './executors/create-note.executor'
import { UpdateNoteExecutor } from './executors/update-note.executor'
import { ListNotesExecutor } from './executors/list-notes.executor'
import { DeleteNoteExecutor } from './executors/delete-note.executor'
import { ConvertNoteToTaskExecutor } from './executors/convert-note-to-task.executor'

// In the providers/EXECUTORS array:
  CreateNoteExecutor,
  UpdateNoteExecutor,
  ListNotesExecutor,
  DeleteNoteExecutor,
  ConvertNoteToTaskExecutor,
```

- [ ] **Step 2: Register in agent.module.ts**

Add same 5 imports + providers.

Also import `NotesModule` and `TasksModule` (if `TasksModule` isn't already imported) so `ConvertNoteToTaskExecutor` can access both services.

- [ ] **Step 3: Register in agent-loop.service.ts executorMap**

Add to the `executorMap`:
```ts
    [createNote.name, createNote],
    [updateNote.name, updateNote],
    [listNotes.name, listNotes],
    [deleteNote.name, deleteNote],
    [convertNoteToTask.name, convertNoteToTask],
```

And inject them in the constructor.

- [ ] **Step 4: Verify compilation + tests**

```bash
cd backend && npx tsc --noEmit && npx jest
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/tools.module.ts \
       backend/src/agent/agent.module.ts \
       backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: register note tool executors in modules"
```

---

### Task 5: Frontend — i18n keys for notes

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add to vi.json**

```json
  "nav.notes": "Ghi chú",
  "notes.header": "GHI CHÚ",
  "notes.empty": "Chưa có ghi chú nào",
  "notes.add": "+ thêm ghi chú",
  "notes.form.title": "Tiêu đề",
  "notes.form.content": "Nội dung",
  "notes.form.save": "Lưu",
  "notes.form.cancel": "Huỷ",
  "notes.delete.confirm": "Xóa ghi chú này?",
```

- [ ] **Step 2: Add to en.json**

```json
  "nav.notes": "Notes",
  "notes.header": "NOTES",
  "notes.empty": "No notes yet",
  "notes.add": "+ add note",
  "notes.form.title": "Title",
  "notes.form.content": "Content",
  "notes.form.save": "Save",
  "notes.form.cancel": "Cancel",
  "notes.delete.confirm": "Delete this note?",
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add notes i18n keys"
```

---

### Task 6: Frontend — SidebarNav + AppShell

**Files:**
- Modify: `frontend/src/components/SidebarNav.vue`
- Modify: `frontend/src/components/AppShell.vue`

- [ ] **Step 1: Add Notes nav item to SidebarNav.vue**

Import `HiDocumentText` from `vue-icons-plus/hi`:
```ts
import { HiChatAlt2, HiClipboardList, HiFolder, HiCog, HiLightningBolt, HiDocumentText } from 'vue-icons-plus/hi'
```

Add to `navItems` array:
```ts
  { view: 'notes', labelKey: 'nav.notes', icon: HiDocumentText },
```

- [ ] **Step 2: Add notes view to AppShell.vue**

Update the `activeView` type to include `'notes'`.

Add conditional rendering (before `SettingsView`):
```html
<NotesView v-else-if="activeView === 'notes'" />
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npx vue-tsc --noEmit && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SidebarNav.vue \
       frontend/src/components/AppShell.vue
git commit -m "feat: add Notes nav item and routing"
```

---

### Task 7: Frontend — NotesView component

**Files:**
- Create: `frontend/src/components/NotesView.vue`

- [ ] **Step 1: Create NotesView.vue**

A component with:
- List panel showing all notes (title bold + content preview + delete button)
- Editor panel/form with title input + content textarea + save button
- Fetch notes from `GET /api/notes` on mount
- Create via `POST /api/notes`, update via `PATCH /api/notes/:id`, delete via `DELETE /api/notes/:id`
- Socket.io `/notes` namespace for real-time updates
- Follow existing component patterns (font-mono, cyber colors, no shadows, max rounded)
- Use i18n keys for all labels

```vue
<template>
  <div class="flex-1 flex min-h-0 bg-cyber-bg">
    <!-- List panel -->
    <div class="w-80 shrink-0 border-r border-cyber-code-border overflow-y-auto p-3 space-y-2">
      <div class="flex items-center justify-between mb-3">
        <div class="text-sm font-mono text-cyber-accent font-bold">{{ t('notes.header') }} ({{ notes.length }})</div>
        <button @click="startNew" class="text-sm font-mono text-cyber-accent/70 hover:text-cyber-accent transition-colors duration-150">{{ t('notes.add') }}</button>
      </div>
      <div v-if="notes.length === 0" class="text-sm font-mono text-cyber-muted text-center py-8">{{ t('notes.empty') }}</div>
      <button
        v-for="note in notes"
        :key="note.id"
        @click="selectNote(note)"
        :class="['w-full text-left px-3 py-2 rounded transition-colors duration-150', selectedId === note.id ? 'bg-cyber-accent/10 border border-cyber-accent/30' : 'bg-cyber-dark hover:bg-cyber-dark/80 border border-transparent']"
      >
        <div class="text-sm font-mono text-cyber-text font-semibold truncate">{{ note.title }}</div>
        <div class="text-xs font-mono text-cyber-muted mt-0.5 truncate">{{ note.content }}</div>
        <div class="text-xs font-mono text-cyber-muted/50 mt-0.5">{{ new Date(note.updatedAt).toLocaleTimeString('vi-VN', { hour12: false }) }}</div>
      </button>
    </div>

    <!-- Editor panel -->
    <div class="flex-1 flex flex-col p-3 min-w-0">
      <div v-if="!editing" class="flex-1 flex items-center justify-center text-sm font-mono text-cyber-muted">{{ t('notes.empty') }}</div>
      <template v-else>
        <input
          v-model="editTitle"
          class="w-full bg-transparent text-cyber-text text-lg font-mono font-semibold outline-none mb-3 placeholder-cyber-muted/40"
          :placeholder="t('notes.form.title')"
        />
        <textarea
          v-model="editContent"
          class="flex-1 w-full bg-cyber-dark text-cyber-text text-sm font-mono outline-none p-3 resize-none placeholder-cyber-muted/40"
          :placeholder="t('notes.form.content')"
        />
        <div class="flex items-center gap-2 mt-3">
          <button @click="saveNote" class="text-sm font-mono text-cyber-accent px-3 py-1 rounded border border-cyber-accent/30 hover:bg-cyber-accent/10 transition-colors duration-150">{{ t('notes.form.save') }}</button>
          <button @click="cancelEdit" class="text-sm font-mono text-cyber-muted px-3 py-1 rounded hover:text-cyber-text transition-colors duration-150">{{ t('notes.form.cancel') }}</button>
          <button v-if="selectedId" @click="deleteNote" class="text-sm font-mono text-red-400 px-3 py-1 rounded hover:bg-red-400/10 transition-colors duration-150 ml-auto">{{ t('tasks.menu.delete') }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { io, Socket } from 'socket.io-client'

const { t } = useI18n()

interface Note {
  id: number
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

const notes = ref<Note[]>([])
const selectedId = ref<number | null>(null)
const editTitle = ref('')
const editContent = ref('')
const editing = ref(false)
let socket: Socket | null = null

async function fetchNotes() {
  try {
    const res = await fetch('/api/notes')
    if (res.ok) notes.value = await res.json()
  } catch { /* ignore */ }
}

function selectNote(note: Note) {
  selectedId.value = note.id
  editTitle.value = note.title
  editContent.value = note.content
  editing.value = true
}

function startNew() {
  selectedId.value = null
  editTitle.value = ''
  editContent.value = ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  selectedId.value = null
  editTitle.value = ''
  editContent.value = ''
}

async function saveNote() {
  if (!editTitle.value.trim()) return
  const body = { title: editTitle.value.trim(), content: editContent.value.trim() }
  try {
    if (selectedId.value) {
      await fetch(`/api/notes/${selectedId.value}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    await fetchNotes()
    cancelEdit()
  } catch { /* ignore */ }
}

async function deleteNote() {
  if (!selectedId.value) return
  try {
    await fetch(`/api/notes/${selectedId.value}`, { method: 'DELETE' })
    await fetchNotes()
    cancelEdit()
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchNotes()
  socket = io('/notes')
  socket.on('note:created', () => fetchNotes())
  socket.on('note:updated', () => fetchNotes())
  socket.on('note:deleted', () => fetchNotes())
})
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npx vue-tsc --noEmit && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NotesView.vue
git commit -m "feat: add NotesView component with list and editor"
```
