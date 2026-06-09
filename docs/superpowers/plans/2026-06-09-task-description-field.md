# Task Description Field in Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missing `description` textarea to TaskFormModal and display description in TaskCard.

**Architecture:** Frontend-only changes. Backend DTOs and tool executors already support `description`.

**Tech Stack:** Vue 3, TailwindCSS

---

### Task 1: Add i18n key

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add to vi.json**

After `tasks.form.status`:
```json
  "tasks.form.description": "Mô tả",
```

- [ ] **Step 2: Add to en.json**

After `tasks.form.status`:
```json
  "tasks.form.description": "Description",
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx vue-tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add tasks.form.description i18n key"
```

---

### Task 2: Add description field to TaskFormModal

**Files:**
- Modify: `frontend/src/components/TaskFormModal.vue`

- [ ] **Step 1: Add description textarea to template**

After the title input block (after `</div>` closing the title section, before priority section):
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

- [ ] **Step 2: Update reactive form state (line 103)**

Current:
```ts
const form = reactive({ title: '', priority: 0, status: 'TODO' })
```

Replace with:
```ts
const form = reactive({ title: '', description: '', priority: 0, status: 'TODO' })
```

- [ ] **Step 3: Update watch to reset description (lines 107-114)**

Current `watch` block resets title, priority, status. Add description:
```ts
watch(() => props.modelValue, (open) => {
  if (open) {
    if (props.editing) {
      form.title = props.editing.title
      form.description = props.editing.description ?? ''
      form.priority = props.editing.priority
      form.status = props.editing.status
    } else {
      form.title = ''
      form.description = ''
      form.priority = 0
      form.status = 'TODO'
    }
  }
})
```

- [ ] **Step 4: Update payload to include description (line 122)**

Current:
```ts
const payload = { title, priority: form.priority, status: form.status }
```

Replace with:
```ts
const payload: Record<string, unknown> = { title, priority: form.priority, status: form.status }
if (form.description) payload.description = form.description
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npx vue-tsc --noEmit && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TaskFormModal.vue
git commit -m "feat: add description textarea to TaskFormModal"
```

---

### Task 3: Show description in TaskCard

**Files:**
- Modify: `frontend/src/components/TaskCard.vue`

- [ ] **Step 1: Add description display to TaskCard template**

After the title line and before the priority/dueDate line, add:
```html
      <div v-if="task.description" class="text-xs font-mono text-cyber-muted line-clamp-2">{{ task.description }}</div>
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npx vue-tsc --noEmit && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TaskCard.vue
git commit -m "feat: show description in TaskCard"
```
