# Phase 1: Notes & Agent-to-Task — Design Spec

## Overview

Add a simple multi-line note-taking system with its own nav tab. The AI Agent can create, list, update, delete notes, and **convert a note into a Task** (Kanban) — turning quick thoughts into actionable work items.

## 1. Database — Prisma Schema

Add `Note` model:
```prisma
model Note {
  id        Int      @id @default(autoincrement())
  title     String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Migration: `npx prisma migrate dev --name add-notes`

## 2. Backend

### REST API — `NotesController`

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/api/notes` | `findAll()` | List all notes, ordered by `createdAt DESC` |
| `POST` | `/api/notes` | `create(dto)` | Create a note |
| `PATCH` | `/api/notes/:id` | `update(id, dto)` | Partial update |
| `DELETE` | `/api/notes/:id` | `remove(id)` | Delete a note |

DTOs:
- `CreateNoteDto`: `title` (string, required), `content` (string, required)
- `UpdateNoteDto`: `PartialType(CreateNoteDto)` — all optional

### WebSocket — `NotesGateway`

Namespace: `/notes`
Events: `note:created`, `note:updated`, `note:deleted` (emitted after each CRUD operation)

### Agent Tools (`backend/src/tools/executors/`)

5 new executor files, all implementing `ToolExecutor`:

| Tool | Method | Description |
|------|--------|-------------|
| `create_note` | `execute({ title, content })` | Create a note |
| `update_note` | `execute({ id, title?, content? })` | Update note fields |
| `list_notes` | `execute({})` | Return all notes as formatted text |
| `delete_note` | `execute({ id })` | Delete a note by ID |
| `convert_note_to_task` | `execute({ noteId })` | Read note → create Task (title=note.title, description=note.content) → delete note |

`convert_note_to_task` flow:
1. `notesService.findOne(noteId)` — get the note
2. `tasksService.create({ title: note.title, description: note.content })` — create task
3. `notesService.remove(noteId)` — delete the note (it's been converted)
4. Return success message with new task ID

### Registration

All 5 executors registered in:
- `backend/src/tools/executors/` (new files)
- `backend/src/tools/tools.module.ts` (providers array)
- `backend/src/agent/agent.module.ts` (providers array)
- `backend/src/agent/services/agent-loop.service.ts` (executorMap)

## 3. Frontend

### Nav

Add to `SidebarNav.vue` nav items array:
```ts
{ view: 'notes', labelKey: 'nav.notes', icon: HiDocumentText }
```

Import `HiDocumentText` from `vue-icons-plus/hi`.

### `NotesView.vue` — new component

Layout: list panel (left) + editor panel (right) or stacked (mobile).

- **List:** Each note shows `title` (bold), `content` preview (truncated 2 lines), `updatedAt`, delete button
- **Click note** → populate editor for editing
- **"+ Note" button** → clear editor for new note
- **Editor:** `title` input + `content` textarea + Save button
- **WebSocket:** listen to `/notes` namespace for real-time updates

### `AppShell.vue` — routing for notes view

Add `'notes'` to `activeView` union type and conditional rendering:
```html
<NotesView v-else-if="activeView === 'notes'" />
```

### i18n Keys

| Key | vi | en |
|-----|----|-----|
| `nav.notes` | `Ghi chú` | `Notes` |
| `notes.header` | `GHI CHÚ` | `NOTES` |
| `notes.empty` | `Chưa có ghi chú nào` | `No notes yet` |
| `notes.add` | `+ thêm ghi chú` | `+ add note` |
| `notes.delete.confirm` | `Xóa ghi chú này?` | `Delete this note?` |
| `notes.form.title` | `Tiêu đề` | `Title` |
| `notes.form.content` | `Nội dung` | `Content` |
| `notes.form.save` | `Lưu` | `Save` |
| `notes.form.cancel` | `Huỷ` | `Cancel` |
| `notes.converted` | `Đã chuyển thành task #{id}` | `Converted to task #{id}` |

## 4. Agent Conversation Flow

User: *"Ghi nhớ: mua sữa và bánh mì"*
Agent: `create_note({ title: "Mua sắm", content: "mua sữa và bánh mì" })` → "Đã ghi nhớ ✓"

User: *"Tạo task từ note mua sắm"*
Agent: `convert_note_to_task({ noteId: 1 })` → tạo task trong Kanban → "Đã tạo task #5 từ note 'Mua sắm' ✓"

## 5. Files Changed

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add `Note` model |
| `backend/src/notes/notes.module.ts` | New module |
| `backend/src/notes/notes.controller.ts` | New — REST CRUD |
| `backend/src/notes/notes.controller.spec.ts` | New — tests |
| `backend/src/notes/notes.service.ts` | New — business logic |
| `backend/src/notes/notes.service.spec.ts` | New — tests |
| `backend/src/notes/notes.gateway.ts` | New — WebSocket `/notes` |
| `backend/src/notes/notes.gateway.spec.ts` | New — tests |
| `backend/src/notes/dto/create-note.dto.ts` | New |
| `backend/src/notes/dto/update-note.dto.ts` | New |
| `backend/src/tools/executors/create-note.executor.ts` | New |
| `backend/src/tools/executors/update-note.executor.ts` | New |
| `backend/src/tools/executors/list-notes.executor.ts` | New |
| `backend/src/tools/executors/delete-note.executor.ts` | New |
| `backend/src/tools/executors/convert-note-to-task.executor.ts` | New |
| `backend/src/tools/tools.module.ts` | Register note executors |
| `backend/src/agent/agent.module.ts` | Register note executors |
| `backend/src/agent/services/agent-loop.service.ts` | Add to executorMap |
| `backend/prisma/seed.ts` | Add note tools to DEFAULT_TOOLS |
| `backend/src/app.module.ts` | Import NotesModule |
| `frontend/src/components/SidebarNav.vue` | Add Notes nav item |
| `frontend/src/components/NotesView.vue` | New — notes UI |
| `frontend/src/components/AppShell.vue` | Add notes view routing |
| `frontend/src/locales/vi.json` | Add notes i18n keys |
| `frontend/src/locales/en.json` | Add notes i18n keys |
