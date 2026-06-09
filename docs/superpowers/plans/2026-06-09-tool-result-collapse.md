# Tool Result Collapse/Expand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse long tool results (>5 lines) in chat messages with expand/collapse toggle.

**Architecture:** Pure frontend change — each tool result message tracks local `expanded` state. On render, split content by `\n`, show 5 lines if collapsed and content exceeds threshold, add toggle button.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, TailwindCSS, vue-i18n

**Files modified:**
- `frontend/src/components/ChatPanel.vue` — tool result block
- `frontend/src/locales/vi.json` — 2 new keys
- `frontend/src/locales/en.json` — 2 new keys

---

### Task 1: Add i18n keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add Vietnamese keys**

In `frontend/src/locales/vi.json`, add after the last `chat.` key:
```json
  "chat.tool.expand": "[+ mở rộng]",
  "chat.tool.collapse": "[- thu gọn]",
```

- [ ] **Step 2: Add English keys**

In `frontend/src/locales/en.json`, add after the last `chat.` key:
```json
  "chat.tool.expand": "[+ expand]",
  "chat.tool.collapse": "[- collapse]",
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add i18n keys for tool result expand/collapse"
```

---

### Task 2: Modify tool result block in ChatPanel.vue

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Replace the tool result block template**

Current (lines 19-23):
```html
        <!-- Tool result block -->
        <div v-else-if="msg.role === 'tool' && msg.isResult"
          class="border-l-2 border-cyber-green/50 pl-3 py-1.5">
          <div class="text-sm text-cyber-green font-mono">{{ msg.content }}</div>
        </div>
```

Replace with:
```html
        <!-- Tool result block -->
        <div v-else-if="msg.role === 'tool' && msg.isResult"
          class="border-l-2 border-cyber-green/50 pl-3 py-1.5">
          <template v-if="isToolLong(msg.content)">
            <div class="text-sm text-cyber-green font-mono whitespace-pre-wrap">{{ toolPreview(msg.content) }}</div>
            <div v-if="!isToolExpanded(msg)" class="text-sm text-cyber-muted font-mono mt-0.5">...</div>
            <div v-if="isToolExpanded(msg)" class="text-sm text-cyber-green font-mono whitespace-pre-wrap">{{ msg.content }}</div>
            <button
              @click="toggleToolExpand(msg)"
              class="text-sm font-mono mt-0.5 transition-colors duration-150 text-cyber-accent/60 hover:text-cyber-accent"
            >{{ isToolExpanded(msg) ? t('chat.tool.collapse') : t('chat.tool.expand') }}</button>
          </template>
          <div v-else class="text-sm text-cyber-green font-mono whitespace-pre-wrap">{{ msg.content }}</div>
        </div>
```

- [ ] **Step 2: Add helper functions in script section**

In `<script setup lang="ts">`, before `onMounted`, add:

```ts
const toolExpanded = ref<Set<Message>>(new Set())

function isToolLong(content: string): boolean {
  return content.split('\n').length > 5
}

function toolPreview(content: string): string {
  return content.split('\n').slice(0, 5).join('\n')
}

function isToolExpanded(msg: Message): boolean {
  return toolExpanded.value.has(msg)
}

function toggleToolExpand(msg: Message): void {
  const s = toolExpanded.value
  if (s.has(msg)) {
    s.delete(msg)
  } else {
    s.add(msg)
  }
  toolExpanded.value = new Set(s)
}
```

- [ ] **Step 3: Verify the build passes**

```bash
cd frontend && npm run type-check
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: collapse long tool results in chat messages"
```
