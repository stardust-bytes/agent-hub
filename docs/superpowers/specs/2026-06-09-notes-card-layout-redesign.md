# Notes Card Layout Redesign — Design Spec

## Overview

Redesign NotesView from split-panel (list + editor) to a responsive card grid with modal-based editing.

## 1. Layout

- Full width (no split panel)
- Header: title + count + "+" button
- Grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3`
- Cards fill the available space, scrollable content area

## 2. Note Card

```html
<div class="bg-cyber-dark rounded p-3 flex flex-col gap-2">
  <div class="text-sm font-mono text-cyber-text font-semibold">{{ note.title }}</div>
  <div class="text-xs font-mono text-cyber-muted line-clamp-2">{{ note.content }}</div>
  <div class="text-xs font-mono text-cyber-muted/50">{{ formattedDate }}</div>
  <div class="flex items-center gap-2 mt-auto">
    <button @click="openEdit(note)" class="text-xs font-mono text-cyber-accent/70 hover:text-cyber-accent">{{ t('notes.edit') }}</button>
    <button @click="deleteNote(note.id)" class="text-xs font-mono text-cyber-muted/50 hover:text-red-400">{{ t('notes.delete') }}</button>
  </div>
</div>
```

- `line-clamp-2` on content preview
- Edit + Delete buttons at bottom of card (using flex, `mt-auto`)
- Delete has confirm dialog

## 3. NoteModal

New component `NoteModal.vue` wrapping `BaseModal`:

```html
<BaseModal v-model="modelValue" max-w="70rem">
  <template #header>
    <span class="text-sm font-mono text-cyber-accent">{{ editingId ? t('notes.edit') : t('notes.add') }}</span>
  </template>
  <div class="p-3 flex flex-col gap-3 min-h-[50vh]">
    <input v-model="title" :placeholder="t('notes.form.title')" class="..." />
    <textarea v-model="content" :placeholder="t('notes.form.content')" class="flex-1 min-h-[30vh]" />
  </div>
  <template #footer>
    <div class="flex items-center gap-2">
      <button @click="save">{{ t('notes.form.save') }}</button>
      <button @click="cancel">{{ t('notes.form.cancel') }}</button>
    </div>
  </template>
</BaseModal>
```

- `max-w-70rem` via `style="max-width:70rem"` on the modal content div (BaseModal)
- Title input + content textarea (large, `min-h-[30vh]`)
- Footer: Save + Cancel buttons

## 4. i18n Keys

Add:
| Key | vi | en |
|-----|-----|-----|
| `notes.edit` | `Sửa` | `Edit` |
| `notes.add.modal` | `Thêm ghi chú` | `Add note` |

## 5. Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/NotesView.vue` | Rewrite: card grid + modal integration |
| `frontend/src/components/NoteModal.vue` | New — modal with form |
| `frontend/src/locales/vi.json` | Add `notes.edit` key |
| `frontend/src/locales/en.json` | Add `notes.edit` key |
