# Sidebar Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `SidebarNav.vue` from a 52px icon-only strip to a 128px fixed-width panel that permanently shows icon + label for every nav item.

**Architecture:** Single-file change to `frontend/src/components/SidebarNav.vue`. The nav container width changes from `w-[3.25rem]` to `w-32` and button layout changes from square icon-only to horizontal icon+label rows. Content panels (`ChatPanel`, `TasksView`, etc.) use `flex-1` and need no changes.

**Tech Stack:** Vue 3 `<script setup>`, TailwindCSS, vue-i18n v9

---

### Task 1: Rewrite `SidebarNav.vue` template

**Files:**
- Modify: `frontend/src/components/SidebarNav.vue`

- [ ] **Step 1: Replace the entire `<template>` block**

Open `frontend/src/components/SidebarNav.vue` and replace the `<template>` block with:

```vue
<template>
  <nav class="w-32 bg-cyber-dark hidden sm:flex flex-col items-stretch py-3 gap-1 shrink-0">
    <div class="flex items-center gap-2 px-3 py-1 mb-1">
      <HiTerminal class="text-cyber-accent w-5 h-5 shrink-0" />
      <span class="text-xs text-cyber-accent/50 truncate">workspace</span>
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
      <span class="text-xs truncate">{{ t(item.labelKey) }}</span>
    </button>

    <div class="flex-1" />

    <button
      @click="$emit('navigate', 'settings')"
      class="w-full px-3 py-2 rounded flex items-center gap-2 text-cyber-muted hover:text-cyber-accent transition-colors duration-150"
    >
      <HiCog class="w-4 h-4 shrink-0" />
      <span class="text-xs truncate">{{ t('nav.settings') }}</span>
    </button>

    <button
      :title="locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'"
      @click="toggleLang"
      class="w-9 h-6 rounded flex items-center justify-center text-xs font-mono text-cyber-muted hover:text-cyber-accent transition-colors duration-150 self-center"
    >
      {{ t('nav.lang') }}
    </button>

    <div
      :title="healthStatus"
      :class="['w-2 h-2 rounded-full mt-1 transition-colors duration-500 self-center', isHealthy ? 'bg-cyber-green' : 'bg-red-500']"
    />
  </nav>
</template>
```

Key changes from the original:
- `w-[3.25rem]` → `w-32` (52px → 128px)
- `items-center` → `items-stretch` (buttons fill full width)
- `gap-2` → `gap-1` (buttons now have their own padding)
- Logo `HiTerminal` wrapped in `<div>` with "workspace" label
- Nav buttons: removed `w-9 h-9 justify-center title`, added `w-full px-3 py-2 gap-2` + `<span>` label
- Settings button: same horizontal layout with `t('nav.settings')` label, removed `title`
- Lang toggle: added `self-center` so it stays horizontally centered
- Health dot: added `self-center`

The `<script setup>` block is **unchanged** — do not modify it.

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors. If you see `Property 'labelKey' does not exist` — you've accidentally modified the script block. Revert it.

- [ ] **Step 3: Start dev server and verify visually**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173` and verify:
1. Sidebar is visibly wider (~128px)
2. Each nav item shows icon + Vietnamese label ("Trò chuyện", "Nhiệm vụ", "Tệp tin")
3. Active item has blue tint background (`bg-cyber-accent/10`)
4. Hover on inactive items turns them blue
5. Settings button at bottom shows "Cài đặt" label
6. Lang toggle (`VI`/`EN`) is still visible and centered
7. Green/red health dot still visible at very bottom
8. Switch to English (`VI` toggle) → labels change to "Chat", "Tasks", "Files", "Settings"
9. No label text is clipped (truncate handles overflow)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SidebarNav.vue
git commit -m "feat: expand sidebar to 128px with icon + label nav items"
```
