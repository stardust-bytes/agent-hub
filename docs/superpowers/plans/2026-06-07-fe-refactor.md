# Frontend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all hardcoded hex colors and px values from the frontend, and add a responsive mobile layout with a bottom tab bar.

**Architecture:** Big-bang refactor in 12 tasks: extend Tailwind token config → rewrite `main.css` with CSS variables and rem → replace hardcoded values in all 10 components → create `BottomTabBar.vue` → wire responsive layout in `AppShell.vue`. No behavior changes, only styling and layout.

**Tech Stack:** Vue 3, TailwindCSS v3, TypeScript, Vite — all in `frontend/`

---

## File Map

| File | Change |
|---|---|
| `frontend/tailwind.config.ts` | Add 12 new `cyber-*` color tokens |
| `frontend/src/assets/main.css` | CSS variables in `:root`; all hex → vars; all `px` → `rem` |
| `frontend/src/components/AppShell.vue` | Import + wire BottomTabBar; no layout class changes needed |
| `frontend/src/components/SidebarNav.vue` | `w-[52px]` → `w-[3.25rem]`; add `hidden sm:flex` |
| `frontend/src/components/ChatPanel.vue` | Token replacements + px → rem |
| `frontend/src/components/StatusBar.vue` | Token replacements + px → rem |
| `frontend/src/components/TaskCard.vue` | Token replacements |
| `frontend/src/components/KanbanBoard.vue` | Token replacements + px → rem |
| `frontend/src/components/TasksView.vue` | Token replacements |
| `frontend/src/components/TaskCardMenu.vue` | Token replacements |
| `frontend/src/components/SettingsView.vue` | Token replacements |
| `frontend/src/components/FilesView.vue` | Token replacements |
| `frontend/src/components/BaseModal.vue` | Token replacements |
| `frontend/src/components/SessionModal.vue` | Token replacements |
| `frontend/src/components/BottomTabBar.vue` | **Create** — mobile bottom nav bar |

---

## Task 1: Extend tailwind.config.ts with 12 new tokens

**Files:**
- Modify: `frontend/tailwind.config.ts`

- [ ] **Step 1: Replace the colors block in tailwind.config.ts**

Replace the entire `colors` object inside `theme.extend`:

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        'cyber-bg':         '#000000',
        'cyber-dark':       '#111111',
        'cyber-status':     '#161616',
        'cyber-modal-bg':   '#0a0e1a',
        'cyber-accent':     '#3B82F6',
        'cyber-green':      '#22C55E',
        'cyber-blue':       '#3B82F6',
        'cyber-muted':      '#888888',
        'cyber-text':       '#EEEEEE',
        'cyber-orange':     '#FFA500',
        'cyber-cyan':       '#00d4ff',
        'cyber-link':       '#58a6ff',
        'cyber-code-red':   '#f08383',
        'cyber-code-bg':    '#0d1117',
        'cyber-code-border':'#30363d',
        'cyber-code-text':  '#e6edf3',
        'cyber-row':        '#161b22',
        'cyber-blockquote': '#8b949e',
      },
      fontFamily: {
        mono: ['monospace'],
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        blink: 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors (tailwind.config.ts changes don't affect TS types).

- [ ] **Step 3: Commit**

```bash
cd frontend && git add tailwind.config.ts
git commit -m "feat: add 12 cyber-* color tokens to Tailwind config"
```

---

## Task 2: Rewrite main.css — CSS variables + rem conversion

**Files:**
- Modify: `frontend/src/assets/main.css`

- [ ] **Step 1: Replace the entire file**

Write `frontend/src/assets/main.css` with this content:

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --cyber-bg: #000000;
  --cyber-text: #EEEEEE;
  --cyber-muted: #888888;
  --cyber-accent: #3B82F6;
  --cyber-cyan: #00d4ff;
  --cyber-link: #58a6ff;
  --cyber-code-red: #f08383;
  --cyber-code-bg: #0d1117;
  --cyber-code-border: #30363d;
  --cyber-code-text: #e6edf3;
  --cyber-row: #161b22;
  --cyber-blockquote: #8b949e;
  --cyber-scrollbar-track: #141414;
  --cyber-accent-20: rgba(59, 130, 246, 0.2);
  --cyber-cyan-15: rgba(0, 212, 255, 0.15);
  --cyber-cyan-05: rgba(0, 212, 255, 0.05);
  --cyber-cyan-03: rgba(0, 212, 255, 0.03);
  --cyber-inline-code-bg: rgba(110, 118, 129, 0.4);
}

* {
  box-sizing: border-box;
}

html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  background-color: var(--cyber-bg);
  color: var(--cyber-text);
}

::-webkit-scrollbar {
  width: 0.25rem;
}
::-webkit-scrollbar-track {
  background: var(--cyber-scrollbar-track);
}
::-webkit-scrollbar-thumb {
  background: var(--cyber-accent-20);
  border-radius: 0.125rem;
}

.markdown-body {
  font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  color: var(--cyber-cyan);
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid var(--cyber-cyan-15);
}

.markdown-body h1 { font-size: 1.125rem; }
.markdown-body h2 { font-size: 1rem; }
.markdown-body h3 { font-size: 0.875rem; }
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 { font-size: 0.8125rem; }

.markdown-body a {
  color: var(--cyber-link);
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body p {
  margin: 0 0 0.625rem;
  line-height: 1.7;
}

.markdown-body code {
  background: var(--cyber-inline-code-bg);
  color: var(--cyber-code-red);
  padding: 0.0625rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.9em;
}

.markdown-body pre {
  background: var(--cyber-code-bg);
  border: 1px solid var(--cyber-code-border);
  border-radius: 0.25rem;
  padding: 0.75rem;
  margin: 0.75rem 0;
  overflow-x: auto;
}

.markdown-body pre code {
  background: none;
  color: var(--cyber-code-text);
  padding: 0;
  font-size: 0.75rem;
  line-height: 1.6;
}

.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
  font-size: 0.75rem;
  border: 1px solid var(--cyber-code-border);
}

.markdown-body th,
.markdown-body td {
  border: 1px solid var(--cyber-code-border);
  padding: 0.4375rem 0.625rem;
  text-align: left;
}

.markdown-body th {
  background: var(--cyber-row);
  color: var(--cyber-cyan);
  font-weight: 500;
}

.markdown-body tr:nth-child(even) {
  background: var(--cyber-cyan-03);
}

.markdown-body blockquote {
  border-left: 0.1875rem solid var(--cyber-cyan);
  margin: 0.75rem 0;
  padding: 0.5rem 0.875rem;
  background: var(--cyber-cyan-05);
  color: var(--cyber-blockquote);
  border-radius: 0 0.25rem 0.25rem 0;
}

.markdown-body ul,
.markdown-body ol {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
  color: var(--cyber-code-text);
}

.markdown-body li {
  margin: 0.1875rem 0;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid var(--cyber-code-border);
  margin: 1rem 0;
}

.markdown-body img {
  max-width: 100%;
  border-radius: 0.25rem;
}
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/assets/main.css
git commit -m "refactor: replace hardcoded hex and px with CSS variables and rem in main.css"
```

---

## Task 3: Fix ChatPanel.vue — token + rem replacements

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Apply all replacements in the template**

Make these exact string replacements in `frontend/src/components/ChatPanel.vue`:

| Find | Replace |
|---|---|
| `text-[#888888]` | `text-cyber-muted` |
| `text-[#EEEEEE]` | `text-cyber-text` |
| `border-[#FFA500]/50` | `border-cyber-orange/50` |
| `text-[#FFA500]` | `text-cyber-orange` |
| `text-[11px]` | `text-[0.6875rem]` |
| `text-[10px]` | `text-[0.625rem]` |
| `placeholder-[#888888]/40` | `placeholder-cyber-muted/40` |

After replacements, the affected lines look like:

```html
<!-- line ~19: -->
<span class="text-cyber-muted text-xs font-mono">

<!-- line ~36-37: -->
<div class="border-l-2 border-cyber-orange/50 pl-3 py-1.5">
  <div class="text-[0.6875rem] text-cyber-orange font-mono mb-0.5">[⚙] {{ msg.content }}</div>

<!-- line ~43: -->
<div class="text-[0.6875rem] text-cyber-green font-mono">{{ msg.content }}</div>

<!-- line ~54,58,67: -->
class="text-sm leading-relaxed break-words text-cyber-text"

<!-- line ~73: -->
<div class="text-xs text-cyber-muted font-mono">{{ msg.content }}</div>

<!-- line ~93-94 (input): -->
class="flex-1 bg-transparent text-cyber-text text-sm outline-none font-mono placeholder-cyber-muted/40 caret-white"

<!-- line ~107: -->
<span v-if="streaming" class="text-[0.625rem] text-cyber-accent/50 font-mono">
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/ChatPanel.vue
git commit -m "refactor: replace hardcoded colors and px in ChatPanel"
```

---

## Task 4: Fix StatusBar.vue — token + rem replacements

**Files:**
- Modify: `frontend/src/components/StatusBar.vue`

- [ ] **Step 1: Replace the template**

Replace the entire `<template>` block in `frontend/src/components/StatusBar.vue`:

```html
<template>
  <div class="h-[1.75rem] bg-cyber-status flex items-center justify-between px-3 shrink-0">
    <div class="flex items-center gap-3">
      <span class="text-[0.625rem] font-mono text-cyber-muted">
        <span class="text-cyber-blue">{{ modelName }}</span>
      </span>
      <span class="text-[0.625rem] font-mono" :class="dbConnected ? 'text-cyber-green' : 'text-cyber-muted'">
        [{{ dbConnected ? '✓' : '✗' }}] {{ t('status.db') }}
      </span>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-[0.625rem] font-mono" :class="wsConnected ? 'text-cyber-green' : 'text-cyber-muted'">
        {{ wsConnected ? '●' : '○' }} {{ wsConnected ? t('tasks.ws.connected') : t('tasks.ws.disconnected') }}
      </span>
      <span class="text-[0.625rem] font-mono text-cyber-muted">{{ time }}</span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/StatusBar.vue
git commit -m "refactor: replace hardcoded colors and px in StatusBar"
```

---

## Task 5: Fix SidebarNav.vue — tokens + rem + mobile hide

**Files:**
- Modify: `frontend/src/components/SidebarNav.vue`

- [ ] **Step 1: Update the nav element and hardcoded color**

In `frontend/src/components/SidebarNav.vue`, make these replacements:

Replace the opening `<nav>` tag:
```html
<!-- Before -->
<nav class="w-[52px] bg-cyber-dark flex flex-col items-center py-3 gap-2 shrink-0">

<!-- After -->
<nav class="w-[3.25rem] bg-cyber-dark hidden sm:flex flex-col items-center py-3 gap-2 shrink-0">
```

Replace `text-[#888888]` with `text-cyber-muted` (appears twice — in the nav button `:class` and lang toggle button):
```html
<!-- Before (nav button inactive) -->
: 'text-[#888888] hover:text-cyber-accent'

<!-- After -->
: 'text-cyber-muted hover:text-cyber-accent'
```

```html
<!-- Before (lang toggle + settings button) -->
class="w-9 h-9 rounded flex items-center justify-center text-base text-[#888888] hover:text-cyber-accent"

<!-- After -->
class="w-9 h-9 rounded flex items-center justify-center text-base text-cyber-muted hover:text-cyber-accent"
```

```html
<!-- Before (lang toggle) -->
class="w-9 h-6 rounded flex items-center justify-center text-xs font-mono text-[#888888] hover:text-cyber-accent transition-colors duration-150"

<!-- After -->
class="w-9 h-6 rounded flex items-center justify-center text-xs font-mono text-cyber-muted hover:text-cyber-accent transition-colors duration-150"
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/SidebarNav.vue
git commit -m "refactor: tokens + rem in SidebarNav; hide on mobile with sm:flex"
```

---

## Task 6: Fix TaskCard.vue — token replacements

**Files:**
- Modify: `frontend/src/components/TaskCard.vue`

- [ ] **Step 1: Update the template and script**

In `frontend/src/components/TaskCard.vue`, replace `text-[#EEEEEE]` → `text-cyber-text`, `text-[#888888]` → `text-cyber-muted`, and `text-[10px]` / `text-[9px]` → rem. Also fix the hardcoded hex in `cardBgClass` and `priorityClass` functions.

Replace the entire file content:

```vue
<!-- frontend/src/components/TaskCard.vue -->
<template>
  <div
    class="p-2 cursor-grab select-none relative group transition-colors duration-150"
    :class="cardBgClass(task.priority)"
  >
    <div class="flex items-start justify-between gap-1">
      <span class="text-cyber-text text-xs leading-snug flex-1 font-mono">{{ task.title }}</span>
      <button
        @click.stop="menuOpen = !menuOpen"
        class="opacity-0 group-hover:opacity-100 text-cyber-accent/40 text-sm font-mono hover:text-cyber-accent/70 shrink-0 leading-none transition-colors duration-150"
      >···</button>
    </div>

    <p v-if="task.description" class="text-cyber-muted/60 text-[0.5625rem] mt-1 truncate font-mono">
      {{ task.description }}
    </p>

    <div class="flex items-center gap-1.5 mt-1.5">
      <span :class="['text-[0.5625rem] px-1.5 py-0.5 font-mono', priorityClass(task.priority)]">
        {{ priorityLabel(task.priority) }}
      </span>
      <span v-if="task.dueDate" class="text-[0.5625rem] text-cyber-muted/60 font-mono">
        {{ formatDate(task.dueDate) }}
      </span>
    </div>

    <TaskCardMenu
      v-if="menuOpen"
      :task-id="task.id"
      :current-priority="task.priority"
      @delete="emit('delete', task.id); menuOpen = false"
      @update-priority="(id, p) => { emit('update-priority', id, p); menuOpen = false }"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TaskCardMenu from './TaskCardMenu.vue'

interface Task {
  id: number
  title: string
  description?: string | null
  status: string
  priority: number
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  delete: [id: number]
  'update-priority': [id: number, priority: number]
}>()

const { t } = useI18n()
const menuOpen = ref(false)

function priorityLabel(p: number): string {
  if (p >= 2) return t('tasks.priority.high')
  if (p === 1) return t('tasks.priority.medium')
  return t('tasks.priority.low')
}

function cardBgClass(p: number): string {
  if (p >= 2) return 'bg-red-400/5 border-l-2 border-red-400'
  if (p === 1) return 'bg-cyber-orange/5 border-l-2 border-cyber-orange'
  return 'bg-cyber-dark border-l-2 border-transparent'
}

function priorityClass(p: number): string {
  if (p >= 2) return 'text-red-400 bg-red-400/20'
  if (p === 1) return 'text-cyber-orange bg-cyber-orange/20'
  return 'text-cyber-muted bg-cyber-muted/20'
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('vi-VN')
}
</script>
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/TaskCard.vue
git commit -m "refactor: replace hardcoded colors and px in TaskCard"
```

---

## Task 7: Fix KanbanBoard.vue, TasksView.vue, TaskCardMenu.vue

**Files:**
- Modify: `frontend/src/components/KanbanBoard.vue`
- Modify: `frontend/src/components/TasksView.vue`
- Modify: `frontend/src/components/TaskCardMenu.vue`

- [ ] **Step 1: Fix KanbanBoard.vue**

In `frontend/src/components/KanbanBoard.vue`, make these replacements:

Replace the `COLUMNS` array (lines ~88–93):
```ts
const COLUMNS = [
  { key: 'TODO',       labelKey: 'tasks.col.todo',       headerClass: 'text-cyber-accent',  headerBgClass: 'bg-cyber-accent/8'  },
  { key: 'PROCESSING', labelKey: 'tasks.col.processing', headerClass: 'text-cyber-orange',  headerBgClass: 'bg-cyber-orange/8'  },
  { key: 'DONE',       labelKey: 'tasks.col.done',       headerClass: 'text-cyber-green',   headerBgClass: 'bg-cyber-green/8'   },
  { key: 'FAILED',     labelKey: 'tasks.col.failed',     headerClass: 'text-red-400',       headerBgClass: 'bg-red-400/8'       },
]
```

Replace the add-task input class (line ~44):
```html
<!-- Before -->
class="flex-1 bg-cyber-dark px-2 py-1 text-[11px] font-mono text-[#EEEEEE] placeholder-[#888888]/40 outline-none"

<!-- After -->
class="flex-1 bg-cyber-dark px-2 py-1 text-[0.6875rem] font-mono text-cyber-text placeholder-cyber-muted/40 outline-none"
```

Replace the add-task button class (line ~51):
```html
<!-- Before -->
class="w-full text-[10px] font-mono text-[#888888] bg-cyber-dark px-2 py-1.5 hover:text-cyber-accent transition-colors duration-150 text-left"

<!-- After -->
class="w-full text-[0.625rem] font-mono text-cyber-muted bg-cyber-dark px-2 py-1.5 hover:text-cyber-accent transition-colors duration-150 text-left"
```

- [ ] **Step 2: Fix TasksView.vue**

In `frontend/src/components/TasksView.vue`, replace the `PRIORITY_FILTERS` array (current lines ~43–60) to remove hardcoded hex:

```ts
const PRIORITY_FILTERS = [
  {
    value: 2,
    labelKey: 'tasks.priority.high',
    activeClass: 'text-red-400 bg-red-400/10',
    inactiveClass: 'text-red-400/40 hover:text-red-400',
  },
  {
    value: 1,
    labelKey: 'tasks.priority.medium',
    activeClass: 'text-cyber-orange bg-cyber-orange/10',
    inactiveClass: 'text-cyber-orange/40 hover:text-cyber-orange',
  },
  {
    value: 0,
    labelKey: 'tasks.priority.low',
    activeClass: 'text-cyber-muted bg-cyber-muted/10',
    inactiveClass: 'text-cyber-muted/40 hover:text-cyber-muted',
  },
]
```

Also replace in the template:
```html
<!-- Before (line ~7) -->
<span :class="['text-xs font-mono', wsConnected ? 'text-cyber-green' : 'text-[#888888]']">

<!-- After -->
<span :class="['text-xs font-mono', wsConnected ? 'text-cyber-green' : 'text-cyber-muted']">
```

```html
<!-- Before (line ~13) -->
<span class="text-[#888888] text-[10px] font-mono">

<!-- After -->
<span class="text-cyber-muted text-[0.625rem] font-mono">
```

- [ ] **Step 3: Fix TaskCardMenu.vue**

In `frontend/src/components/TaskCardMenu.vue`, replace the `PRIORITIES` array:

```ts
const PRIORITIES = [
  {
    value: 2,
    labelKey: 'tasks.priority.high',
    activeClass: 'text-red-400 bg-red-400/15',
    inactiveClass: 'text-red-400/50 hover:text-red-400',
  },
  {
    value: 1,
    labelKey: 'tasks.priority.medium',
    activeClass: 'text-cyber-orange bg-cyber-orange/15',
    inactiveClass: 'text-cyber-orange/50 hover:text-cyber-orange',
  },
  {
    value: 0,
    labelKey: 'tasks.priority.low',
    activeClass: 'text-cyber-muted bg-cyber-muted/15',
    inactiveClass: 'text-cyber-muted/50 hover:text-cyber-muted',
  },
] as const
```

Also in the template:
```html
<!-- Before (line ~5) -->
<div class="text-[10px] text-[#888888] font-mono mb-1">

<!-- After -->
<div class="text-[0.625rem] text-cyber-muted font-mono mb-1">
```

- [ ] **Step 4: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/KanbanBoard.vue src/components/TasksView.vue src/components/TaskCardMenu.vue
git commit -m "refactor: replace hardcoded colors and px in Kanban/Tasks components"
```

---

## Task 8: Fix SettingsView.vue and FilesView.vue

**Files:**
- Modify: `frontend/src/components/SettingsView.vue`
- Modify: `frontend/src/components/FilesView.vue`

- [ ] **Step 1: Fix SettingsView.vue**

In `frontend/src/components/SettingsView.vue`, apply these replacements throughout the template:

| Find | Replace |
|---|---|
| `text-[#888888]` | `text-cyber-muted` |
| `text-[#EEEEEE]` | `text-cyber-text` |
| `text-[10px]` | `text-[0.625rem]` |

The affected lines become:
```html
<label class="text-cyber-muted text-[0.625rem] font-mono block mb-1">{{ t('settings.ollamaUrl') }}</label>
<input ... class="flex-1 bg-cyber-dark text-cyber-text text-sm px-2 py-1.5 font-mono outline-none" ... />

<label class="text-cyber-muted text-[0.625rem] font-mono block mb-1">{{ t('settings.defaultModel') }}</label>
<input ... class="flex-1 bg-cyber-dark text-cyber-text text-sm px-2 py-1.5 font-mono outline-none" ... />

<div class="text-cyber-muted text-[0.625rem] font-mono mb-2">{{ t('settings.info') }}</div>
<div class="text-xs font-mono text-cyber-muted space-y-1">
```

- [ ] **Step 2: Fix FilesView.vue**

In `frontend/src/components/FilesView.vue`, apply replacements:

| Find | Replace |
|---|---|
| `text-[#888888]` | `text-cyber-muted` |
| `text-[#EEEEEE]` | `text-cyber-text` |
| `text-[#FFA500]` | `text-cyber-orange` |
| `text-[10px]` | `text-[0.625rem]` |

Also fix the `statusClass` function in `<script setup>`:
```ts
function statusClass(status: string): string {
  if (status === 'ready') return 'text-cyber-green'
  if (status === 'indexing') return 'text-cyber-orange'
  return 'text-red-400'
}
```

- [ ] **Step 3: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/components/SettingsView.vue src/components/FilesView.vue
git commit -m "refactor: replace hardcoded colors and px in Settings/Files views"
```

---

## Task 9: Fix BaseModal.vue and SessionModal.vue

**Files:**
- Modify: `frontend/src/components/BaseModal.vue`
- Modify: `frontend/src/components/SessionModal.vue`

- [ ] **Step 1: Fix BaseModal.vue**

In `frontend/src/components/BaseModal.vue`, replace the modal content div class:

```html
<!-- Before -->
<div class="w-80 bg-[#0a0e1a] border-t border-orange-500 flex flex-col" :style="{ maxHeight }">

<!-- After -->
<div class="w-80 bg-cyber-modal-bg border-t border-cyber-orange flex flex-col" :style="{ maxHeight }">
```

- [ ] **Step 2: Fix SessionModal.vue**

In `frontend/src/components/SessionModal.vue`, replace the `hover:bg-[#1a1a2e]` class:

```html
<!-- Before (line ~22) -->
: 'hover:bg-[#1a1a2e]'"

<!-- After -->
: 'hover:bg-cyber-accent/5'"
```

- [ ] **Step 3: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/components/BaseModal.vue src/components/SessionModal.vue
git commit -m "refactor: replace hardcoded colors in BaseModal and SessionModal"
```

---

## Task 10: Create BottomTabBar.vue

**Files:**
- Create: `frontend/src/components/BottomTabBar.vue`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/BottomTabBar.vue`:

```vue
<template>
  <nav class="flex sm:hidden items-center bg-cyber-dark border-t border-cyber-code-border h-[3rem] shrink-0">
    <button
      v-for="item in navItems"
      :key="item.view"
      :title="t(item.labelKey)"
      @click="$emit('navigate', item.view)"
      :class="[
        'flex flex-col items-center justify-center gap-0.5 flex-1 h-full font-mono text-[0.5rem] transition-colors duration-150',
        activeView === item.view
          ? 'text-cyber-accent bg-cyber-accent/10'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <component :is="item.icon" class="w-[1.125rem] h-[1.125rem]" />
      <span>{{ t(item.labelKey) }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiChatAlt2, HiClipboardList, HiFolder, HiCog } from 'vue-icons-plus/hi'

defineProps<{ activeView: 'chat' | 'tasks' | 'files' | 'settings' }>()
defineEmits<{ navigate: [view: 'chat' | 'tasks' | 'files' | 'settings'] }>()

const { t } = useI18n()

interface NavItem {
  view: 'chat' | 'tasks' | 'files' | 'settings'
  labelKey: string
  icon: Component
}

const navItems: NavItem[] = [
  { view: 'chat',     labelKey: 'nav.chat',     icon: HiChatAlt2 },
  { view: 'tasks',    labelKey: 'nav.tasks',     icon: HiClipboardList },
  { view: 'files',    labelKey: 'nav.files',     icon: HiFolder },
  { view: 'settings', labelKey: 'nav.settings',  icon: HiCog },
]
</script>
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/BottomTabBar.vue
git commit -m "feat: add BottomTabBar component for mobile navigation"
```

---

## Task 11: Wire BottomTabBar into AppShell.vue

**Files:**
- Modify: `frontend/src/components/AppShell.vue`

- [ ] **Step 1: Replace AppShell.vue**

Replace the entire content of `frontend/src/components/AppShell.vue`:

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
    <BottomTabBar :active-view="activeView" @navigate="activeView = $event" />
    <StatusBar
      :model-name="modelName"
      :db-connected="dbConnected"
      :ws-connected="wsConnected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SidebarNav from './SidebarNav.vue'
import BottomTabBar from './BottomTabBar.vue'
import ChatPanel from './ChatPanel.vue'
import TasksView from './TasksView.vue'
import SettingsView from './SettingsView.vue'
import FilesView from './FilesView.vue'
import StatusBar from './StatusBar.vue'

const activeView = ref<'chat' | 'tasks' | 'files' | 'settings'>('chat')
const modelName = ref('llama3.2')
const dbConnected = ref(true)
const wsConnected = ref(false)
</script>
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/AppShell.vue
git commit -m "feat: wire responsive layout with BottomTabBar in AppShell"
```

---

## Task 12: Visual verification

- [ ] **Step 1: Start the dev server**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173` in a browser.

- [ ] **Step 2: Verify desktop layout (window width ≥ 640px)**

Check:
- [ ] SidebarNav visible on the left (3.25rem wide)
- [ ] BottomTabBar NOT visible
- [ ] Chat, Tasks, Files, Settings navigation works
- [ ] Markdown renders with correct colors (headings cyan, code blocks dark, links blue)
- [ ] No visible hardcoded color differences from before

- [ ] **Step 3: Verify mobile layout (browser DevTools → set width < 640px)**

Check:
- [ ] SidebarNav hidden
- [ ] BottomTabBar visible at bottom with 4 icons (Chat, Tasks, Files, Settings)
- [ ] Active tab highlighted with `cyber-accent` color
- [ ] Content area takes full width
- [ ] StatusBar still visible below BottomTabBar
- [ ] All 4 views navigable via bottom tabs

- [ ] **Step 4: Run final type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors. Zero TypeScript issues.
