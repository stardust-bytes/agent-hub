# Chat Empty State — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a centered empty state with "171305" in pixel font and a terminal-style subtitle when chat has no messages.

**Architecture:** Inline conditional in ChatPanel.vue — `v-if` on a computed that checks for user/agent messages. Add Press Start 2P Google Font to main.css. Add i18n keys for subtitle.

**Tech Stack:** Vue 3, Google Fonts, TailwindCSS

---

### Task 1: Add Press Start 2P font

**Files:**
- Modify: `frontend/src/assets/main.css:1`

- [ ] **Step 1: Add Google Font import**

Current (line 1):
```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
```

Replace with:
```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds, no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/assets/main.css
git commit -m "feat: add Press Start 2P font for empty state title"
```

---

### Task 2: Add i18n keys for empty state subtitle

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add to vi.json**

Add after `chat.tool.collapse` line:
```json
  "chat.empty.subtitle": "đang chờ lệnh...",
```

- [ ] **Step 2: Add to en.json**

Add after `chat.tool.collapse` line:
```json
  "chat.empty.subtitle": "awaiting command...",
```

- [ ] **Step 3: Verify JSON is valid**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add i18n keys for chat empty state subtitle"
```

---

### Task 3: Add empty state to ChatPanel

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue:3-4` (template) and script section

- [ ] **Step 1: Add empty state template + computed property**

In `<script>` section (after `const agentMode = ref(true)` line ~171):
```ts
const hasChatMessages = computed(() =>
  messages.value.some(m => m.role === 'user' || m.role === 'agent')
)
```

Add `computed` to the Vue import line:
```ts
import { ref, nextTick, onMounted, watch, computed } from 'vue'
```

In `<template>`, replace the messages container (line 3-4):
```html
    <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 min-h-0">
```

Replace with conditional rendering. When `hasChatMessages` is false, show empty state. When true, show normal messages:

```html
    <template v-if="hasChatMessages">
      <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        <div class="max-w-60rem mx-auto space-y-4 px-3">
          <div v-for="(msg, i) in messages" :key="i" class="font-mono">
          <!-- all existing message rendering blocks stay exactly as they are -->
          ...
          </div>
        </div>
      </div>
    </template>
    <div v-else class="flex-1 flex items-center justify-center min-h-0">
      <div class="text-center">
        <div class="font-['Press_Start_2P'] text-3xl text-cyber-accent mb-4">171305</div>
        <div class="text-sm font-mono text-cyber-muted">// {{ t('chat.empty.subtitle') }}</div>
      </div>
    </div>
```

Note: The existing template with all message blocks (lines 5-65) must remain inside the `v-if` block exactly as they are.

- [ ] **Step 2: Verify TypeScript and build**

Run: `cd frontend && npx vue-tsc --noEmit && npm run build`
Expected: No errors, build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: add empty state placeholder to chat panel"
```
