# Font Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify every text element in the frontend to JetBrains Mono at 14px (`text-sm`) — no size hierarchy, no arbitrary rem/px values, no exceptions.

**Architecture:** Three-layer fix: (1) Tailwind config registers the real JetBrains Mono stack so `font-mono` renders the correct typeface; (2) `main.css` sets `14px` and the font stack on `html/body` as the single source of truth; (3) each `.vue` component has its individual arbitrary/xs/lg size classes replaced with `text-sm`.

**Tech Stack:** Vue 3, TailwindCSS, `frontend/src/assets/main.css`, `frontend/tailwind.config.ts`

---

## File Map

| File | Change |
|---|---|
| `frontend/tailwind.config.ts` | Fix `fontFamily.mono` stack |
| `frontend/src/assets/main.css` | Base `font-size` 16→14px, add `font-family`, remove markdown-body size overrides |
| `frontend/src/components/StatusBar.vue` | 5× `text-[0.625rem]` → `text-sm` |
| `frontend/src/components/SidebarNav.vue` | 3× `text-xs` → `text-sm`, add `font-mono` to 3 spans |
| `frontend/src/components/BottomTabBar.vue` | `text-[0.5rem]` → `text-sm` |
| `frontend/src/components/BaseSelect.vue` | `text-xs` → `text-sm` |
| `frontend/src/components/BaseModal.vue` | `text-xs` → `text-sm` |
| `frontend/src/components/TasksView.vue` | `text-xs`, `text-[0.625rem]`, `text-[10px]` → `text-sm` |
| `frontend/src/components/KanbanBoard.vue` | `text-[10px]`, `text-[9px]`, `text-[0.6875rem]`, `text-[0.625rem]` → `text-sm` |
| `frontend/src/components/TaskCard.vue` | `text-xs`, `text-[0.5625rem]` → `text-sm` |
| `frontend/src/components/TaskCardMenu.vue` | `text-[0.625rem]`, `text-[9px]`, `text-xs` → `text-sm` |
| `frontend/src/components/FilesView.vue` | `text-xs`, `text-[0.625rem]`, `text-[10px]` → `text-sm` |
| `frontend/src/components/SettingsView.vue` | `text-xs`, `text-[0.625rem]` → `text-sm` |
| `frontend/src/components/ProvidersView.vue` | multiple size classes → `text-sm`, add `font-mono` to 5 elements |
| `frontend/src/components/ProviderFormModal.vue` | `text-xs`, `text-[0.625rem]` → `text-sm` |
| `frontend/src/components/ChatPanel.vue` | `text-[0.6875rem]`, `text-xs`, `text-[10px]` → `text-sm` |
| `frontend/src/components/SessionModal.vue` | `text-xs`, `text-[10px]` → `text-sm` |
| `frontend/src/components/AppShell.vue` | No changes (already `font-mono` on root) |
| `frontend/src/components/ModelSelector.vue` | No changes (delegates to BaseSelect) |

---

### Task 1: Fix `tailwind.config.ts`

**Files:**
- Modify: `frontend/tailwind.config.ts`

- [ ] **Step 1: Update `fontFamily.mono`**

Replace:
```ts
fontFamily: {
  mono: ['monospace'],
},
```
With:
```ts
fontFamily: {
  mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
},
```

- [ ] **Step 2: Commit**

```bash
git add frontend/tailwind.config.ts
git commit -m "chore: fix font-mono stack to use JetBrains Mono"
```

---

### Task 2: Fix `main.css` — base font and markdown-body overrides

**Files:**
- Modify: `frontend/src/assets/main.css`

- [ ] **Step 1: Update `html, body, #app` rule**

Replace:
```css
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  background-color: var(--cyber-bg);
  color: var(--cyber-text);
  font-size: 16px;
}
```
With:
```css
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  background-color: var(--cyber-bg);
  color: var(--cyber-text);
  font-size: 14px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
}
```

- [ ] **Step 2: Remove heading font-size overrides in `.markdown-body`**

Replace:
```css
.markdown-body h1 { font-size: 1.125rem; }
.markdown-body h2 { font-size: 1rem; }
.markdown-body h3 { font-size: 0.875rem; }
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 { font-size: 0.8125rem; }
```
With (remove those lines entirely — headings inherit 14px from body):
```css
```
*(Delete all five lines)*

- [ ] **Step 3: Remove `font-size` from `.markdown-body code`**

Replace:
```css
.markdown-body code {
  background: var(--cyber-inline-code-bg);
  color: var(--cyber-code-red);
  padding: 0.0625rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.9em;
}
```
With:
```css
.markdown-body code {
  background: var(--cyber-inline-code-bg);
  color: var(--cyber-code-red);
  padding: 0.0625rem 0.375rem;
  border-radius: 0.25rem;
}
```

- [ ] **Step 4: Remove `font-size` from `.markdown-body pre code`**

Replace:
```css
.markdown-body pre code {
  background: none;
  color: var(--cyber-code-text);
  padding: 0;
  font-size: 0.75rem;
  line-height: 1.6;
}
```
With:
```css
.markdown-body pre code {
  background: none;
  color: var(--cyber-code-text);
  padding: 0;
  line-height: 1.6;
}
```

- [ ] **Step 5: Remove `font-size` from `.markdown-body table`**

Replace:
```css
.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
  font-size: 0.75rem;
  border: 1px solid var(--cyber-code-border);
}
```
With:
```css
.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
  border: 1px solid var(--cyber-code-border);
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/assets/main.css
git commit -m "chore: set base font to JetBrains Mono 14px; remove markdown-body size overrides"
```

---

### Task 3: Fix shell and navigation components

**Files:**
- Modify: `frontend/src/components/StatusBar.vue`
- Modify: `frontend/src/components/SidebarNav.vue`
- Modify: `frontend/src/components/BottomTabBar.vue`
- Modify: `frontend/src/components/BaseSelect.vue`
- Modify: `frontend/src/components/BaseModal.vue`

- [ ] **Step 1: Fix `StatusBar.vue` — replace 5× `text-[0.625rem]` with `text-sm`**

In `StatusBar.vue`, there are 5 spans/buttons all using `text-[0.625rem] font-mono`. Replace all occurrences:

```html
<!-- Before (appears 5 times with different content): -->
class="text-[0.625rem] font-mono"
class="text-[0.625rem] font-mono" :class="dbConnected ? 'text-cyber-green' : 'text-cyber-muted'"
class="text-[0.625rem] font-mono" :class="wsConnected ? 'text-cyber-green' : 'text-cyber-muted'"
class="text-[0.625rem] font-mono text-cyber-muted hover:text-cyber-accent transition-colors duration-150"
class="text-[0.625rem] font-mono text-cyber-muted"

<!-- After — replace text-[0.625rem] with text-sm on each -->
class="text-sm font-mono"
class="text-sm font-mono" :class="dbConnected ? 'text-cyber-green' : 'text-cyber-muted'"
class="text-sm font-mono" :class="wsConnected ? 'text-cyber-green' : 'text-cyber-muted'"
class="text-sm font-mono text-cyber-muted hover:text-cyber-accent transition-colors duration-150"
class="text-sm font-mono text-cyber-muted"
```

The full updated template for StatusBar.vue:
```html
<template>
  <div class="h-[1.75rem] bg-cyber-status flex items-center justify-between px-3 shrink-0">
    <div class="flex items-center gap-3">
      <span class="text-sm font-mono" :class="backendOnline ? 'text-cyber-green' : 'text-cyber-muted'">
        {{ backendOnline ? '●' : '○' }} {{ t('status.backend') }}
      </span>
      <span class="text-sm font-mono" :class="dbConnected ? 'text-cyber-green' : 'text-cyber-muted'">
        [{{ dbConnected ? '✓' : '✗' }}] {{ t('status.db') }}
      </span>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-sm font-mono" :class="wsConnected ? 'text-cyber-green' : 'text-cyber-muted'">
        {{ wsConnected ? '●' : '○' }} {{ wsConnected ? t('tasks.ws.connected') : t('tasks.ws.disconnected') }}
      </span>
      <button
        @click="toggleLang"
        class="text-sm font-mono text-cyber-muted hover:text-cyber-accent transition-colors duration-150"
      >{{ t('nav.lang') }}</button>
      <span class="text-sm font-mono text-cyber-muted">{{ time }}</span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Fix `SidebarNav.vue` — 3× `text-xs` → `text-sm`, add `font-mono`**

The updated template section (only `<template>` changes, `<script>` unchanged):

```html
<template>
  <nav class="w-32 bg-cyber-dark hidden sm:flex flex-col items-stretch py-3 gap-1 shrink-0">
    <div class="flex items-center justify-center gap-2 px-3 py-1 mb-1">
      <span class="text-sm text-cyber-accent font-bold font-mono truncate">960513-wp</span>
    </div>

    <button
      v-for="item in navItems"
      :key="item.view"
      @click="$emit('navigate', item.view)"
      :class="[
        'w-full px-3 py-2 rounded flex items-center gap-2 transition-colors duration-150',
        activeView === item.view
          ? 'bg-cyber-accent/10 text-cyber-accent'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <component :is="item.icon" class="w-4 h-4 shrink-0" />
      <span class="text-sm font-mono truncate">{{ t(item.labelKey) }}</span>
    </button>

    <div class="flex-1" />

    <button
      @click="$emit('navigate', 'settings')"
      :class="[
        'w-full px-3 py-2 rounded flex items-center gap-2 transition-colors duration-150',
        activeView === 'settings'
          ? 'bg-cyber-accent/10 text-cyber-accent'
          : 'text-cyber-muted hover:text-cyber-accent'
      ]"
    >
      <HiCog class="w-4 h-4 shrink-0" />
      <span class="text-sm font-mono truncate">{{ t('nav.settings') }}</span>
    </button>
  </nav>
</template>
```

- [ ] **Step 3: Fix `BottomTabBar.vue` — `text-[0.5rem]` → `text-sm`**

In the button's `:class` array, replace `text-[0.5rem]` with `text-sm`:

```html
<!-- Before -->
'flex flex-col items-center justify-center gap-0.5 flex-1 h-full font-mono text-[0.5rem] transition-colors duration-150',

<!-- After -->
'flex flex-col items-center justify-center gap-0.5 flex-1 h-full font-mono text-sm transition-colors duration-150',
```

- [ ] **Step 4: Fix `BaseSelect.vue` — `text-xs` → `text-sm`**

```html
<!-- Before -->
class="bg-cyber-dark text-xs font-mono text-slate-100 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 appearance-none pr-5 px-2 py-1"

<!-- After -->
class="bg-cyber-dark text-sm font-mono text-slate-100 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 appearance-none pr-5 px-2 py-1"
```

- [ ] **Step 5: Fix `BaseModal.vue` — `text-xs` → `text-sm`**

```html
<!-- Before -->
class="text-cyber-accent/50 text-xs font-mono transition-colors duration-150 hover:text-cyber-accent"

<!-- After -->
class="text-cyber-accent/50 text-sm font-mono transition-colors duration-150 hover:text-cyber-accent"
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/StatusBar.vue frontend/src/components/SidebarNav.vue frontend/src/components/BottomTabBar.vue frontend/src/components/BaseSelect.vue frontend/src/components/BaseModal.vue
git commit -m "chore: unify font size to text-sm in shell/nav components"
```

---

### Task 4: Fix task components

**Files:**
- Modify: `frontend/src/components/TasksView.vue`
- Modify: `frontend/src/components/KanbanBoard.vue`
- Modify: `frontend/src/components/TaskCard.vue`
- Modify: `frontend/src/components/TaskCardMenu.vue`

- [ ] **Step 1: Fix `TasksView.vue` — 3 size classes → `text-sm`**

Full updated template:
```html
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiClipboardList class="w-3 h-3 inline" /> {{ t('tasks.header') }}
      </span>
    </div>

    <div class="px-3 py-1.5 bg-cyber-dark/40 flex items-center gap-2 shrink-0">
      <span class="text-cyber-muted text-sm font-mono">{{ t('tasks.filter.label') }}</span>
      <button
        v-for="p in PRIORITY_FILTERS"
        :key="p.value"
        @click="toggleFilter(p.value)"
        :class="[
          'text-sm px-2 py-0.5 font-mono transition-colors duration-150',
          activeFilters.has(p.value) ? p.activeClass : p.inactiveClass,
        ]"
      >{{ t(p.labelKey) }}</button>
    </div>

    <KanbanBoard
      :active-filters="activeFilters"
      class="flex-1 overflow-hidden"
      @ws-status="emit('ws-status', $event)"
    />
  </div>
</template>
```

- [ ] **Step 2: Fix `KanbanBoard.vue` — 4 size classes → `text-sm`**

Change these 4 class strings in the template only (`<script>` unchanged):

```html
<!-- Line 10: text-[10px] → text-sm -->
<span :class="['text-sm tracking-widest font-mono uppercase', col.headerClass]">

<!-- Line 13: text-[9px] → text-sm -->
<span class="text-sm bg-cyber-accent/10 text-cyber-accent/50 px-1.5 rounded font-mono">

<!-- Line 44: text-[0.6875rem] → text-sm -->
class="flex-1 bg-cyber-dark px-2 py-1 text-sm font-mono text-cyber-text placeholder-cyber-muted/40 outline-none"

<!-- Line 51: text-[0.625rem] → text-sm -->
class="w-full text-sm font-mono text-cyber-muted bg-cyber-dark px-2 py-1.5 hover:text-cyber-accent transition-colors duration-150 text-left"
```

- [ ] **Step 3: Fix `TaskCard.vue` — 4 size classes → `text-sm`**

```html
<!-- Line 8: text-xs → text-sm -->
<span class="text-cyber-text text-sm leading-snug flex-1 font-mono">{{ task.title }}</span>

<!-- Line 11: text-sm already correct, no change needed -->

<!-- Line 15: text-[0.5625rem] → text-sm -->
<p v-if="task.description" class="text-cyber-muted/60 text-sm mt-1 truncate font-mono">

<!-- Line 20: text-[0.5625rem] → text-sm -->
<span :class="['text-sm px-1.5 py-0.5 font-mono', priorityClass(task.priority)]">

<!-- Line 23: text-[0.5625rem] → text-sm -->
<span v-if="task.dueDate" class="text-sm text-cyber-muted/60 font-mono">
```

- [ ] **Step 4: Fix `TaskCardMenu.vue` — 3 size classes → `text-sm`**

```html
<!-- Line 5: text-[0.625rem] → text-sm -->
<div class="text-sm text-cyber-muted font-mono mb-1">{{ t('tasks.filter.label') }}</div>

<!-- Line 12: text-[9px] → text-sm -->
'text-sm px-1.5 py-0.5 font-mono transition-colors duration-150',

<!-- Line 20: text-xs → text-sm -->
class="w-full text-left px-2 py-1.5 text-sm font-mono text-red-400/70 hover:text-red-400 hover:bg-red-400/5 transition-colors duration-150"
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TasksView.vue frontend/src/components/KanbanBoard.vue frontend/src/components/TaskCard.vue frontend/src/components/TaskCardMenu.vue
git commit -m "chore: unify font size to text-sm in task components"
```

---

### Task 5: Fix content view components

**Files:**
- Modify: `frontend/src/components/FilesView.vue`
- Modify: `frontend/src/components/SettingsView.vue`

- [ ] **Step 1: Fix `FilesView.vue` — 8 size class occurrences → `text-sm`**

Changes in template (script unchanged):

```html
<!-- Header span: text-xs → text-sm -->
<span class="text-cyber-accent text-sm tracking-widest font-mono">

<!-- Dropzone p: text-sm already correct, no change -->

<!-- Dropzone extensions p: text-[0.625rem] → text-sm -->
<p class="text-cyber-muted/60 text-sm font-mono mt-1">.pdf .docx .txt .md .ts .js .py</p>

<!-- Filter input: text-sm already correct, no change -->

<!-- Empty state: text-xs → text-sm -->
<div v-if="files.length === 0" class="text-center text-cyber-muted text-sm font-mono py-8">

<!-- File row: text-xs → text-sm -->
<div v-for="f in filteredFiles" :key="f.id"
  class="flex items-center gap-3 bg-cyber-dark px-3 py-2 text-sm font-mono"
>

<!-- Watch title: text-[0.625rem] → text-sm -->
<div class="text-cyber-muted text-sm font-mono mb-2">{{ t('files.watch.title') }}</div>

<!-- Watch path label: text-xs → text-sm -->
<span class="text-cyber-muted text-sm font-mono">{{ t('files.watch.path') }}</span>

<!-- Watch dir input: text-sm already correct, no change -->

<!-- Watch button: text-xs → text-sm -->
<button @click="toggleWatch" class="px-3 py-1.5 text-sm font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 transition-colors duration-150">{{ t('files.watch.btn') }}</button>

<!-- Watch status: text-[10px] → text-sm -->
<div v-if="watching" class="text-cyber-green text-sm font-mono mt-1">{{ t('files.watch.status') }} ({{ indexedCount }} files)</div>
```

- [ ] **Step 2: Fix `SettingsView.vue` — 3 size class occurrences → `text-sm`**

Full updated template:
```html
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        <HiCog class="w-3 h-3 inline" /> {{ t('settings.header') }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="max-w-xl">
        <div class="border-t border-cyber-accent/10 pt-4">
          <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('settings.info') }}</div>
          <div class="text-sm font-mono text-cyber-muted space-y-1">
            <div>{{ t('settings.version') }}: 0.1.0</div>
            <div :class="healthy ? 'text-cyber-green' : 'text-red-400'">
              ● {{ healthy ? t('health.ok') : t('health.error') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FilesView.vue frontend/src/components/SettingsView.vue
git commit -m "chore: unify font size to text-sm in content view components"
```

---

### Task 6: Fix provider components

**Files:**
- Modify: `frontend/src/components/ProvidersView.vue`
- Modify: `frontend/src/components/ProviderFormModal.vue`

- [ ] **Step 1: Fix `ProvidersView.vue` — 13 size class occurrences, add `font-mono` to 5 elements**

Full updated template (script unchanged):
```html
<template>
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0">
      <span class="text-cyber-accent text-sm tracking-widest font-mono">⚡ {{ t('providers.header') }}</span>
      <button
        @click="openAddModal"
        class="text-cyber-accent text-sm font-mono hover:bg-cyber-accent/10 px-2 py-0.5 transition-colors duration-150"
      >{{ t('providers.add') }}</button>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3">
      <div v-if="providers.length === 0" class="text-cyber-muted text-sm font-mono py-4">
        {{ t('providers.empty') }}
      </div>

      <div
        v-for="provider in providers"
        :key="provider.id"
        class="mb-2 border border-cyber-accent/10"
      >
        <div
          @click="toggleExpand(provider.id)"
          class="flex items-center justify-between px-3 py-2 bg-cyber-dark cursor-pointer hover:bg-cyber-accent/5 transition-colors duration-150"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-cyber-accent/60 text-sm font-mono shrink-0">{{ expanded.has(provider.id) ? '▼' : '▶' }}</span>
            <span class="text-slate-100 text-sm font-mono truncate">{{ provider.name }}</span>
            <span class="text-sm font-mono text-cyber-accent/50 border border-cyber-accent/20 px-1 shrink-0">{{ provider.type }}</span>
            <span v-if="provider.baseUrl" class="text-sm text-cyber-muted font-mono truncate hidden sm:block">{{ provider.baseUrl }}</span>
          </div>
          <div class="flex items-center gap-3 shrink-0 ml-2">
            <button @click.stop="openEditModal(provider)" class="text-cyber-accent/40 text-sm font-mono hover:text-cyber-accent transition-colors duration-150">✎</button>
            <button @click.stop="confirmDeleteProvider(provider)" class="text-red-400/40 text-sm font-mono hover:text-red-400 transition-colors duration-150">✕</button>
          </div>
        </div>

        <div v-if="expanded.has(provider.id)" class="px-3 py-2 bg-cyber-bg border-t border-cyber-accent/5">
          <div class="text-sm text-cyber-accent/50 tracking-widest font-mono mb-2">MODELS</div>

          <div v-if="provider.models.length === 0" class="text-cyber-muted text-sm font-mono mb-1">—</div>
          <div
            v-for="model in provider.models"
            :key="model.id"
            class="flex items-center justify-between py-0.5"
          >
            <span class="text-sm text-slate-300 font-mono">{{ model.name }}</span>
            <button
              @click="deleteModel(provider.id, model.id)"
              class="text-red-400/40 text-sm font-mono hover:text-red-400 transition-colors duration-150 ml-2"
            >✕</button>
          </div>

          <div v-if="addingModelFor === provider.id" class="flex items-center gap-2 mt-2">
            <input
              ref="modelInputEl"
              v-model="newModelName"
              @keyup.enter="submitAddModel(provider.id)"
              @keyup.escape="addingModelFor = null"
              class="flex-1 bg-cyber-dark text-sm font-mono text-slate-100 px-2 py-0.5 outline-none border border-cyber-accent/30"
              :placeholder="t('providers.models.placeholder')"
              autocomplete="off"
            />
            <button @click="submitAddModel(provider.id)" class="text-cyber-accent text-sm font-mono hover:text-cyber-accent/70">✓</button>
            <button @click="addingModelFor = null" class="text-cyber-muted text-sm font-mono hover:text-slate-100">✕</button>
          </div>
          <button
            v-else
            @click="startAddModel(provider.id)"
            class="text-cyber-accent/60 text-sm font-mono hover:text-cyber-accent transition-colors duration-150 mt-1 block"
          >{{ t('providers.models.add') }}</button>
        </div>
      </div>
    </div>

    <ProviderFormModal
      v-model="showModal"
      :editing="editingProvider"
      @saved="loadProviders"
    />
  </div>
</template>
```

- [ ] **Step 2: Fix `ProviderFormModal.vue` — `text-xs` and `text-[0.625rem]` → `text-sm`**

Full updated template (script unchanged):
```html
<template>
  <BaseModal :model-value="modelValue" :closable="true" max-height="80vh" @update:model-value="$emit('update:modelValue', $event)">
    <template #header>
      <span class="text-cyber-accent text-sm tracking-widest font-mono">
        {{ editing ? t('providers.edit') : t('providers.add') }}
      </span>
    </template>

    <div class="px-3 py-3 space-y-3">
      <div>
        <label class="text-cyber-muted text-sm font-mono block mb-1">{{ t('providers.form.name') }}</label>
        <input
          v-model="form.name"
          class="w-full bg-cyber-dark text-slate-100 text-sm px-2 py-1.5 font-mono outline-none border border-cyber-accent/10 focus:border-cyber-accent/40"
          autocomplete="off"
        />
      </div>
      <div>
        <label class="text-cyber-muted text-sm font-mono block mb-1">{{ t('providers.form.baseUrl') }}</label>
        <input
          v-model="form.baseUrl"
          class="w-full bg-cyber-dark text-slate-100 text-sm px-2 py-1.5 font-mono outline-none border border-cyber-accent/10 focus:border-cyber-accent/40"
          placeholder="http://localhost:11434"
          autocomplete="off"
        />
      </div>
      <div>
        <label class="text-cyber-muted text-sm font-mono block mb-1">{{ t('providers.form.key') }}</label>
        <input
          v-model="form.key"
          type="password"
          class="w-full bg-cyber-dark text-slate-100 text-sm px-2 py-1.5 font-mono outline-none border border-cyber-accent/10 focus:border-cyber-accent/40"
          autocomplete="new-password"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          @click="$emit('update:modelValue', false)"
          class="px-3 py-1 text-sm font-mono text-cyber-muted hover:text-slate-100 transition-colors duration-150"
        >{{ t('providers.form.cancel') }}</button>
        <button
          @click="save"
          :disabled="!form.name.trim() || saving"
          class="px-3 py-1 text-sm font-mono text-cyber-accent bg-cyber-accent/10 hover:bg-cyber-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
        >{{ t('providers.form.save') }}</button>
      </div>
    </template>
  </BaseModal>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProvidersView.vue frontend/src/components/ProviderFormModal.vue
git commit -m "chore: unify font size to text-sm in provider components"
```

---

### Task 7: Fix chat components

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`
- Modify: `frontend/src/components/SessionModal.vue`

- [ ] **Step 1: Fix `ChatPanel.vue` — replace all size classes in template**

In the `<template>` block, make these replacements (script unchanged):

```
text-[0.6875rem]  →  text-sm    (appears on every message div: 8 occurrences)
text-xs           →  text-sm    (appears on input, stop button, session button: 3 occurrences)
text-[10px]       →  text-sm    (appears on mode toggle buttons: 2 occurrences)
```

Full updated template:
```html
<template>
  <div class="flex flex-col bg-cyber-bg min-w-0">
    <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 min-h-0">
      <div class="max-w-2xl mx-auto space-y-4 px-3">
        <div v-for="(msg, i) in messages" :key="i" class="font-mono">

        <!-- Thinking block -->
        <div v-if="msg.role === 'system' && msg.content === '⟳ thinking...' || msg.content === '⟳ đang nghĩ...'"
          class="border-l-2 border-cyber-accent/30 pl-3 py-1">
          <div class="text-sm text-cyber-accent/60 font-mono">⟳ {{ msg.content.replace('⟳ ', '') }}</div>
        </div>

        <!-- Tool call block -->
        <div v-else-if="msg.role === 'tool' && !msg.isResult"
          class="border-l-2 border-cyber-orange/50 pl-3 py-1.5">
          <div class="text-sm text-cyber-orange font-mono mb-0.5">[⚙] {{ msg.content }}</div>
        </div>

        <!-- Tool result block -->
        <div v-else-if="msg.role === 'tool' && msg.isResult"
          class="border-l-2 border-cyber-green/50 pl-3 py-1.5">
          <div class="text-sm text-cyber-green font-mono">{{ msg.content }}</div>
        </div>

        <!-- Agent answer block -->
        <div v-else-if="msg.role === 'agent'"
          class="border-l-2 border-cyber-accent/80 pl-3 py-1">
          <div class="text-sm text-cyber-accent/80 mb-0.5 font-mono">
            <HiChevronRight class="w-3 h-3 inline" /> {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
          </div>
          <div
            v-if="msg.typing"
            class="text-sm leading-relaxed break-words text-cyber-text"
          >{{ msg.content }}</div>
          <div
            v-else
            class="text-sm leading-relaxed break-words text-cyber-text markdown-body"
            v-html="renderMarkdown(msg.content)"
          />
        </div>

        <!-- User message block -->
        <div v-else-if="msg.role === 'user'"
          class="border-l-2 border-cyber-accent/80 pl-3 py-1">
          <div class="text-sm text-cyber-accent/80 mb-0.5 font-mono">{{ rolePrefix(msg.role) }} · {{ msg.timestamp }}</div>
          <div class="text-sm leading-relaxed break-words text-cyber-text">{{ msg.content }}</div>
        </div>

        <!-- System message (other) -->
        <div v-else-if="msg.role === 'system'"
          class="pl-3 py-0.5">
          <div class="text-sm text-cyber-muted font-mono">{{ msg.content }}</div>
        </div>

      </div>
      </div>
    </div>

    <SessionModal
      v-model="showSessionModal"
      :current-session-id="currentSessionId"
      @select="loadSession"
      @created="(id: number) => { currentSessionId = id; loadSession(id) }"
    />
    <div class="shrink-0">
      <div class="max-w-2xl mx-auto w-full px-3 pb-3">
        <div class="bg-cyber-dark px-3 py-2">
          <form @submit.prevent="submit" class="flex items-center gap-2">
            <input
              ref="inputEl"
              v-model="input"
              class="flex-1 bg-transparent text-cyber-text text-sm outline-none font-mono placeholder-cyber-muted/40 caret-white"
              :placeholder="t('chat.placeholder')"
              :disabled="streaming"
              autocomplete="off"
              spellcheck="false"
            />
            <button
              v-if="streaming"
              @click="stopStream"
              class="text-cyber-accent/80 text-sm font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent shrink-0"
            >{{ t('chat.stop') }}</button>
          </form>
        </div>
        <div class="flex items-center justify-between pt-2">
          <div class="flex items-center gap-2">
            <ModelSelector
              v-model="selectedModelId"
              :models="availableModels"
              :disabled="streaming"
            />
            <div class="flex border border-cyber-accent/20 rounded">
              <button
                @click="agentMode = true"
                :class="agentMode ? 'bg-cyber-accent/20 text-cyber-accent' : 'text-cyber-muted'"
                class="px-2 py-0.5 text-sm font-mono transition-colors duration-150"
              >{{ t('chat.mode.agent') }}</button>
              <button
                @click="agentMode = false"
                :class="!agentMode ? 'bg-cyber-accent/20 text-cyber-accent' : 'text-cyber-muted'"
                class="px-2 py-0.5 text-sm font-mono transition-colors duration-150"
              >{{ t('chat.mode.chat') }}</button>
            </div>
          </div>
          <button
            @click="showSessionModal = true"
            class="text-cyber-accent/70 text-sm font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent"
          >{{ t('sessions.header') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Fix `SessionModal.vue` — `text-xs` and `text-[10px]` → `text-sm`**

Full updated template (script unchanged):
```html
<template>
  <BaseModal v-model="show" closable max-height="480px" @update:model-value="onClose">
    <template #header>
      <div class="flex items-center gap-2">
        <span class="text-cyber-accent text-sm font-mono tracking-widest">{{ t('sessions.header') }}</span>
        <button
          @click="createSession"
          class="text-cyber-accent text-sm font-mono px-2 py-0.5 bg-cyber-accent/15 hover:bg-cyber-accent/25 transition-colors duration-150"
        >{{ t('sessions.new') }}</button>
      </div>
    </template>

    <div v-if="sessions.length === 0" class="px-3 py-4 text-sm text-cyber-accent/40 font-mono">
      {{ t('sessions.empty') }}
    </div>
    <div
      v-for="s in sessions"
      :key="s.id"
      class="px-3 py-2 flex items-center justify-between cursor-pointer transition-colors duration-150"
      :class="s.id === currentSessionId
        ? 'bg-cyber-accent/10'
        : 'hover:bg-cyber-accent/5'"
      @click="selectSession(s.id)"
    >
      <div class="min-w-0 flex-1">
        <div class="text-sm font-mono text-slate-100 truncate">{{ s.title }}</div>
        <div class="text-sm font-mono text-cyber-accent/40 mt-0.5">
          {{ formatDate(s.createdAt) }} · {{ t('sessions.messages', { n: s._count.messages }) }}
        </div>
      </div>
      <button
        @click.stop="deleteSession(s.id)"
        class="text-cyber-accent/30 text-sm font-mono ml-2 shrink-0 transition-colors duration-150 hover:text-red-400"
      >✕</button>
    </div>
  </BaseModal>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatPanel.vue frontend/src/components/SessionModal.vue
git commit -m "chore: unify font size to text-sm in chat components"
```

---

### Task 8: Type-check and verify

**Files:** None (verification only)

- [ ] **Step 1: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors (exit 0). If there are errors, they are unrelated to this change — the font class replacements don't affect TypeScript types.

- [ ] **Step 2: Run dev server**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173` in a browser.

- [ ] **Step 3: Visual verification checklist**

Open DevTools → Inspector and click any text element. In **Computed** → `font-family`, verify it shows `"JetBrains Mono"` (not just `monospace`).

Check each view:
- [ ] Chat panel — messages, input, mode toggle, session button all same size
- [ ] Tasks (kanban) — column headers, task cards, priority badges, filter buttons all same size
- [ ] Files view — dropzone text, file list, watcher section all same size
- [ ] Settings view — info labels all same size
- [ ] Providers view — provider rows, model list, form modal all same size
- [ ] Status bar — all status indicators same size
- [ ] Sidebar nav — nav labels same size as other text
- [ ] Bottom tab bar (narrow window < 640px) — tab labels same size

- [ ] **Step 4: Final commit if any minor fixes were needed**

```bash
git add -p
git commit -m "chore: fix any remaining font size stragglers"
```
