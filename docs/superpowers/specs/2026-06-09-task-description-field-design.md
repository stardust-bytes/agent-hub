# Task Description Field in Modal — Design Spec

## Overview

Add the missing `description` textarea to TaskFormModal, and display description in TaskCard. Backend DTOs and tool executors already support `description`.

## 1. i18n

Add `tasks.form.description` key:
| Key | vi | en |
|-----|-----|-----|
| `tasks.form.description` | `Mô tả` | `Description` |

## 2. TaskFormModal

Add after the title input block:
```html
      <div>
        <label class="text-sm text-cyber-muted font-mono block mb-1">{{ t('tasks.form.description') }}</label>
        <textarea
          v-model="form.description"
          class="w-full bg-cyber-dark px-2 py-1.5 text-sm font-mono text-cyber-text placeholder-cyber-muted/40 outline-none resize-none"
          rows="3"
          placeholder="..."
        />
      </div>
```

Update form reactive: `const form = reactive({ title: '', description: '', priority: 0, status: 'TODO' })`

Update watch to reset `description` on open.

Update payload to include `description`.

## 3. TaskCard

Show description line if present (after title, before priority/dueDate).

## 4. Files Changed

| File | Change |
|------|--------|
| `frontend/src/locales/vi.json` | Add `tasks.form.description` |
| `frontend/src/locales/en.json` | Add `tasks.form.description` |
| `frontend/src/components/TaskFormModal.vue` | Add description textarea + form state |
| `frontend/src/components/TaskCard.vue` | Show description snippet |
