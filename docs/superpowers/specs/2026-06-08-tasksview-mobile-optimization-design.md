# TasksView Mobile Optimization — Design Spec

## Overview

Optimize `TasksView.vue` for screens <768px with tab-based status navigation, modal-based task CRUD, and unified task card design across desktop and mobile.

## Changes Summary

### 1. Task Card (Unified Desktop & Mobile)

`TaskCard.vue` is redesigned to show edit/delete buttons directly on the card, replacing the three-dot menu (`TaskCardMenu.vue`).

**Layout (bottom row):**
```
[Title]
[Priority Badge] [Due Date]              [SỬA] [XOÁ]
```

- Left border color by priority: red (high), orange (medium), transparent (low)
- Edit/Delete buttons always visible (no hover requirement)
- Priority badge + due date on the same row as buttons

**`TaskCardMenu.vue` is removed** — no longer needed.

### 2. Mobile (<768px) — Tab Layout

`TasksView.vue` conditionally renders tab bar + single-column task list on mobile:

- **4 tabs:** CẦN LÀM / ĐANG LÀM / HOÀN THÀNH / THẤT BẠI
- Active tab has underline + accent color
- Clicking a tab loads that status's tasks as a flat list
- No drag-and-drop on mobile

### 3. Desktop (≥768px) — Unchanged

- KanbanBoard renders 4-column layout with drag-and-drop
- Priority filter bar remains
- TaskCard uses the new unified design

### 4. "Add Task" Button in Header

- Always visible at the right of the header bar (both desktop & mobile)
- Opens `TaskFormModal`

### 5. TaskFormModal (Add / Edit)

**Shell:** `BaseModal` (existing component)

**Fields:**
| Field | Type | Required |
|-------|------|----------|
| Tên task | Text input | Yes |
| Ưu tiên | Select (Cao/TB/Thấp) | No (default Thấp) |
| Trạng thái | Select (TODO/PROCESSING/DONE/FAILED) | No (default TODO) |

**Add mode:** `POST /api/tasks` — empty form, submit creates
**Edit mode:** `PATCH /api/tasks/:id` — pre-populated with existing data

### 6. BaseConfirmModal (Delete)

**Shell:** `BaseModal` (existing component)

- Simple confirmation: "Xoá task này?" / "Delete this task?"
- Two buttons: [Huỷ] / [Xoá]
- Confirm calls `DELETE /api/tasks/:id`

## Component Changes

| Component | Change |
|-----------|--------|
| `TasksView.vue` | Add "THÊM" button in header; responsive tab layout; wire up TaskFormModal + BaseConfirmModal |
| `KanbanBoard.vue` | Accept `mobileStatus` prop — when set, render only that column (no drag); when null, render all 4 with drag |
| `TaskCard.vue` | Replace three-dot menu with inline edit/delete buttons; emit edit/delete events |
| `TaskCardMenu.vue` | **Remove** |
| `TaskFormModal.vue` | **New** — add/edit task form (extends BaseModal) |
| `BaseConfirmModal.vue` | **New** — delete confirmation (extends BaseModal) |

## Data Flow

```
TaskFormModal
  @saved → TasksView re-fetches /api/tasks
  @update:modelValue → close modal

BaseConfirmModal
  @confirm → DELETE /api/tasks/:id → re-fetch
  @update:modelValue → close modal

TaskCard
  @edit(id) → open TaskFormModal in edit mode
  @delete(id) → open BaseConfirmModal
```

## API Endpoints Used

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/tasks | Load all tasks |
| POST | /api/tasks | Create task `{ title, priority, status }` |
| PATCH | /api/tasks/:id | Update task `{ title, priority, status }` |
| DELETE | /api/tasks/:id | Delete task |

## i18n Keys Needed

```json
// vi.json
"tasks.add.modal.title": "Thêm task",
"tasks.edit.modal.title": "Sửa task",
"tasks.form.title": "Tên task",
"tasks.form.priority": "Ưu tiên",
"tasks.form.status": "Trạng thái",
"tasks.form.save": "Lưu",
"tasks.form.cancel": "Huỷ",
"tasks.delete.confirm": "Xoá task này?",
"tasks.delete.confirm.btn": "Xoá",
"tasks.delete.cancel.btn": "Huỷ"

// en.json
"tasks.add.modal.title": "Add task",
"tasks.edit.modal.title": "Edit task",
"tasks.form.title": "Title",
"tasks.form.priority": "Priority",
"tasks.form.status": "Status",
"tasks.form.save": "Save",
"tasks.form.cancel": "Cancel",
"tasks.delete.confirm": "Delete this task?",
"tasks.delete.confirm.btn": "Delete",
"tasks.delete.cancel.btn": "Cancel"
```

## Implementation Order

1. Add i18n keys to both locale files
2. Create `BaseConfirmModal.vue`
3. Create `TaskFormModal.vue`
4. Update `TaskCard.vue` (inline edit/delete buttons, remove three-dot menu)
5. Remove `TaskCardMenu.vue` references
6. Update `KanbanBoard.vue` (mobileStatus prop)
7. Update `TasksView.vue` (header button, responsive tabs, modals)
8. Verify: `npm run type-check`, `npm run build`
