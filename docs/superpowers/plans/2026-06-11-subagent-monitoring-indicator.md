# Sub-agent Monitoring Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal indicator to StatusBar showing the count of currently active sub-agents.

**Architecture:** Frontend-only change. ChatPanel and CoworkView track sub-agent lifecycle from existing SSE events (toolCall `spawn_subagent`, `subagent.done`, delegate_parallel confirmation). Count is emitted to AppShell → passed as prop to StatusBar for display.

**Tech Stack:** Vue 3 Composition API, TailwindCSS, vue-i18n

---

### Task 1: Add i18n keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add `status.subagents` to vi.json**

Add before `"settings.header"`:
```json
  "status.subagents": "sub-agents",
```

- [ ] **Step 2: Add `status.subagents` to en.json**

Add before `"settings.header"`:
```json
  "status.subagents": "sub-agents",
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add status.subagents i18n key"
```

---

### Task 2: Add subagent counter to ChatPanel

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Add `activeSubagentCount` ref and `emit`**

After line 226 (`const activeDelegations = ref<DelegateData[]>([])`), add:
```typescript
const emit = defineEmits<{
  'active-subagents-change': [count: number]
}>()
const activeSubagentCount = ref(0)
```

- [ ] **Step 2: Increment on `spawn_subagent` tool call**

In the SSE handler, in the `parsed.toolCall` branch (line 687 area), after the existing tool call display code, add increment logic. Find the branch where `parsed.toolCall` is handled (non-subagent tool calls). After `messages.value.push(...)` and before `await scrollToBottom()`, add:

Inside the `parsed.toolCall` handler (around line 694), after the argsStr line, before the message push:
```typescript
if (tc.name === 'spawn_subagent') {
  activeSubagentCount.value++
  emit('active-subagents-change', activeSubagentCount.value)
}
```

The exact location — after line 698 (`messages.value.push({...})`) and before line 699 (`await scrollToBottom()`) — but in the `parsed.toolCall` branch at line 694.

- [ ] **Step 3: Increment on delegate_parallel confirmation**

In `onDelegateChoose` function (line 510), add pre-count increment before clearing delegations:
```typescript
function onDelegateChoose(payload: { requestId: string; mode: string }) {
  if (payload.mode === 'parallel') {
    const del = activeDelegations.value.find(d => d.requestId === payload.requestId)
    if (del) {
      activeSubagentCount.value += del.subtasks.length
      emit('active-subagents-change', activeSubagentCount.value)
    }
  }
  input.value = `/delegate ${payload.mode} ${payload.requestId}`
  submit()
  activeDelegations.value = []
}
```

- [ ] **Step 4: Decrement on `subagent.done`**

In the SSE handler, in `parsed.subagent` branch, in the `parsed.done` sub-branch (line 649), add:
```typescript
} else if (parsed.subagent) {
  clearThinking()
  if (parsed.done) {
    if (activeSubagentCount.value > 0) {
      activeSubagentCount.value--
      emit('active-subagents-change', activeSubagentCount.value)
    }
  }
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: add subagent count tracking to ChatPanel"
```

---

### Task 3: Add subagent counter to CoworkView

**Files:**
- Modify: `frontend/src/components/CoworkView.vue`

- [ ] **Step 1: Add `activeSubagentCount` ref and `emit`**

After line 196 (`const activeDelegations = ref<DelegateData[]>([])`), add:
```typescript
const emit = defineEmits<{
  'active-subagents-change': [count: number]
}>()
const activeSubagentCount = ref(0)
```

- [ ] **Step 2: Increment on `spawn_subagent` tool call**

Same logic as ChatPanel. In the SSE handler's `parsed.toolCall` branch (around line 594-606 for CoworkView), add:
```typescript
if (tc.name === 'spawn_subagent') {
  activeSubagentCount.value++
  emit('active-subagents-change', activeSubagentCount.value)
}
```

- [ ] **Step 3: Increment on delegate_parallel confirmation**

In `onDelegateChoose` (line 342):
```typescript
function onDelegateChoose(payload: { requestId: string; mode: string }) {
  if (payload.mode === 'parallel') {
    const del = activeDelegations.value.find(d => d.requestId === payload.requestId)
    if (del) {
      activeSubagentCount.value += del.subtasks.length
      emit('active-subagents-change', activeSubagentCount.value)
    }
  }
  input.value = `/delegate ${payload.mode} ${payload.requestId}`
  submit()
  activeDelegations.value = []
}
```

- [ ] **Step 4: Decrement on `subagent.done`**

Same as ChatPanel, in the `parsed.done` branch:
```typescript
if (parsed.done) {
  if (activeSubagentCount.value > 0) {
    activeSubagentCount.value--
    emit('active-subagents-change', activeSubagentCount.value)
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CoworkView.vue
git commit -m "feat: add subagent count tracking to CoworkView"
```

---

### Task 4: Wire AppShell

**Files:**
- Modify: `frontend/src/components/AppShell.vue`

- [ ] **Step 1: Add `activeSubagents` ref and event handler**

Add after line 38 (`const wsConnected = ref(false)`):
```typescript
const activeSubagents = ref(0)
```

- [ ] **Step 2: Wire to ChatPanel and CoworkView**

Update the ChatPanel line (line 12) and add the event handler:
```html
<CoworkView    v-if="activeView === 'cowork'"   class="flex-1 overflow-hidden" @active-subagents-change="activeSubagents = $event" />
<ChatPanel     v-else                                  class="flex-1 overflow-hidden" @active-subagents-change="activeSubagents = $event" />
```

- [ ] **Step 3: Pass prop to StatusBar**

Add the prop to StatusBar at line 17:
```html
<StatusBar
  :db-connected="dbConnected"
  :ws-connected="wsConnected"
  :active-subagents="activeSubagents"
/>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AppShell.vue
git commit -m "feat: wire subagent count from panels to StatusBar"
```

---

### Task 5: Add indicator to StatusBar

**Files:**
- Modify: `frontend/src/components/StatusBar.vue`

- [ ] **Step 1: Add prop**

Add to `defineProps` (line 31-34):
```typescript
defineProps<{
  dbConnected?: boolean
  wsConnected?: boolean
  activeSubagents?: number
}>()
```

- [ ] **Step 2: Add display in template**

Add after the DB status span (after line 9), before the WS status group:
```html
<span v-if="activeSubagents && activeSubagents > 0" class="text-sm font-mono text-cyber-cyan">
  ● {{ activeSubagents }} {{ t('status.subagents') }}
</span>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StatusBar.vue
git commit -m "feat: show active sub-agent count in StatusBar"
```
