# Logo Integration (SidebarNav + Favicon) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add logo.png as both the SidebarNav logo and browser favicon.

**Architecture:** Copy logo asset to Vite's `public/` dir (served at `/logo.png`), reference it via `<img>` tag in SidebarNav and `<link rel="icon">` in index.html.

**Tech Stack:** Vue 3 + Vite (static assets), vanilla HTML favicon

---

### Task 1: Copy logo asset to public directory

**Files:**
- Create: `frontend/public/logo.png` (copy from root `logo.png`)

- [ ] **Step 1: Copy logo.png into frontend/public/**

Run:
```bash
cp logo.png frontend/public/logo.png
```

Verify:
```bash
ls -la frontend/public/logo.png
```
Expected: file exists with same size as root logo.png (~783KB)

- [ ] **Step 2: Commit**

```bash
git add frontend/public/logo.png
git commit -m "feat: add logo asset to public directory"
```

---

### Task 2: Add logo image to SidebarNav

**Files:**
- Modify: `frontend/src/components/SidebarNav.vue:3-5`

- [ ] **Step 1: Replace text-only header with logo + text**

Current (lines 3-5):
```html
    <div class="flex items-center justify-center gap-2 px-3 py-1 mb-1">
      <span class="text-sm text-cyber-accent font-bold font-mono truncate">171305-wp</span>
    </div>
```

Replace with:
```html
    <div class="flex items-center justify-center gap-2 px-3 py-1 mb-1">
      <img src="/logo.png" class="w-6 h-6 shrink-0" alt="logo" />
      <span class="text-sm text-cyber-accent font-bold font-mono truncate">171305-wp</span>
    </div>
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SidebarNav.vue
git commit -m "feat: add logo image to SidebarNav"
```

---

### Task 3: Add favicon to index.html

**Files:**
- Modify: `frontend/index.html:6`

- [ ] **Step 1: Add favicon link tag**

Current (`frontend/index.html`):
```html
    <title>Workspace</title>
```

Add favicon link above the title:
```html
    <link rel="icon" type="image/png" href="/logo.png">
    <title>Workspace</title>
```

- [ ] **Step 2: Verify the HTML loads correctly**

Run: `npm run build`
Expected: build succeeds, `dist/index.html` contains the favicon `<link>` tag

- [ ] **Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "feat: add favicon from logo.png"
```
