# Tool Approval Floating Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline message-based tool approval UI with a floating bar above the input area, featuring a countdown progress bar and Allow/Deny buttons.

**Architecture:** Create `ToolApprovalBar.vue` → wire into `CoworkView.vue` with `pendingApproval` state + countdown timer → remove approval code from `MessageItem`, `MessageList`, `types.ts`.

**Tech Stack:** Vue 3 (`<script setup>`), TypeScript strict, TailwindCSS (`cyber-*` tokens), `vue-icons-plus/hi`.

---

### Task 1: Create ToolApprovalBar.vue

**Files:**
- Create: `frontend/src/components/ToolApprovalBar.vue`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/ToolApprovalBar.vue`:

```vue
<template>
  <div class="border border-cyber-orange/60 bg-cyber-dark px-3 py-2 mx-3 mb-2 rounded">
    <div class="flex items-center gap-2 mb-1">
      <HiShieldExclamation class="w-3 h-3 text-cyber-orange shrink-0" />
      <span class="text-xs text-cyber-orange font-mono">
        Tool '{{ name }}' {{ t('approval.required') }}
      </span>
    </div>
    <div class="text-2xs text-cyber-muted font-mono mb-2 break-all">
      {{ t('approval.args') }}: {{ args }}
    </div>
    <div class="w-full h-1 bg-cyber-code-border mb-2 rounded">
      <div class="h-full bg-cyber-orange rounded transition-all duration-1000 linear"
        :style="{ width: (remaining / total * 100) + '%' }"></div>
    </div>
    <div class="flex items-center justify-between">
      <div class="text-2xs text-cyber-muted font-mono">{{ remaining }}s / {{ total }}s</div>
      <div class="flex gap-2">
        <button @click="emit('approve', id)"
          class="text-xs text-white font-mono px-2 py-1 bg-cyber-accent rounded transition-colors duration-150 hover:bg-cyber-accent/80">
          {{ t('approval.allow') }}
        </button>
        <button @click="emit('deny', id)"
          class="text-xs text-cyber-text font-mono px-2 py-1 border border-cyber-code-border rounded transition-colors duration-150 hover:bg-cyber-dark">
          {{ t('approval.deny') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { HiShieldExclamation } from 'vue-icons-plus/hi'

defineProps<{
  id: string
  name: string
  args: string
  remaining: number
  total: number
}>()

const emit = defineEmits<{
  (e: 'approve', id: string): void
  (e: 'deny', id: string): void
}>()

const { t } = useI18n()
</script>
```

- [ ] **Step 2: Commit**

```
git add frontend/src/components/ToolApprovalBar.vue
git commit -m "feat: add ToolApprovalBar component with countdown progress bar"
```

---

### Task 2: Update CoworkView.vue — floating bar + pendingApproval state

**Files:**
- Modify: `frontend/src/components/CoworkView.vue`

- [ ] **Step 1: Read current CoworkView.vue**

Read `frontend/src/components/CoworkView.vue` to understand the current template and script structure.

- [ ] **Step 2: Add pendingApproval state and timer logic**

In the `<script setup>` section, add after existing refs:

```typescript
import { ref, onMounted, onUnmounted, nextTick, triggerRef } from 'vue'

const pendingApproval = ref<{ id: string; name: string; args: string; expiresAt: number } | null>(null)
const remainingSeconds = ref(0)
let approvalTimer: ReturnType<typeof setInterval> | null = null

function clearPendingApproval() {
  if (approvalTimer) {
    clearInterval(approvalTimer)
    approvalTimer = null
  }
  pendingApproval.value = null
}

onUnmounted(() => {
  ui.activeSubagents = 0
  clearPendingApproval()
})
```

- [ ] **Step 3: Update onToolApprovalRequired SSE callback**

Find the `onToolApprovalRequired` callback inside the `SseCallbacks` object. Replace its current body (which pushes a message with `approvalRequest`) with:

```typescript
onToolApprovalRequired(id, name, args) {
  const argsStr = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(', ')
  pendingApproval.value = { id, name: name, args: argsStr, expiresAt: Date.now() + 30000 }
  remainingSeconds.value = 30
  if (approvalTimer) clearInterval(approvalTimer)
  approvalTimer = setInterval(() => {
    if (pendingApproval.value) {
      remainingSeconds.value = Math.max(0, Math.ceil((pendingApproval.value.expiresAt - Date.now()) / 1000))
      if (remainingSeconds.value <= 0) {
        clearPendingApproval()
      }
    }
  }, 200)
},
```

- [ ] **Step 4: Update approveTool and denyTool functions**

Update both functions to call `clearPendingApproval()` after the API call:

```typescript
async function approveTool(id: string) {
  try {
    await fetch('/api/agent/approve-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: true }),
    })
  } catch { /* ignore */ }
  clearPendingApproval()
}

async function denyTool(id: string) {
  try {
    await fetch('/api/agent/approve-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: false }),
    })
  } catch { /* ignore */ }
  clearPendingApproval()
}
```

- [ ] **Step 5: Update template — add ToolApprovalBar, remove message approval events**

In the template:

1. Remove `@tool-approve="approveTool"` and `@tool-deny="denyTool"` from `<MessageList>`.
2. Insert `<ToolApprovalBar>` between `</MessageList>` and `<ChatInputBar>`:

```html
        <ToolApprovalBar
          v-if="pendingApproval"
          :id="pendingApproval.id"
          :name="pendingApproval.name"
          :args="pendingApproval.args"
          :remaining="remainingSeconds"
          :total="30"
          @approve="approveTool"
          @deny="denyTool"
        />

        <ChatInputBar
```

3. Add import:
```typescript
import ToolApprovalBar from './ToolApprovalBar.vue'
```

- [ ] **Step 6: Type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS

- [ ] **Step 7: Commit**

```
git add frontend/src/components/CoworkView.vue
git commit -m "feat: replace inline approval messages with floating ToolApprovalBar in CoworkView"
```

---

### Task 3: Clean up MessageItem, MessageList, types

**Files:**
- Modify: `frontend/src/components/cowork/MessageItem.vue`
- Modify: `frontend/src/components/cowork/MessageList.vue`
- Modify: `frontend/src/components/cowork/types.ts`

- [ ] **Step 1: Remove approvalRequest from types.ts**

Read `frontend/src/components/cowork/types.ts`. Remove from the `Message` interface:

```typescript
// Delete this line:
approvalRequest?: {
  id: string
  name: string
  args: string
}
```

- [ ] **Step 2: Remove approval block and emits from MessageItem.vue**

Read `frontend/src/components/cowork/MessageItem.vue`.

1. Remove the `v-else-if="msg.approvalRequest"` template block (the whole div with `HiShieldExclamation`, Allow/Deny buttons).
2. Remove from `defineEmits`:
```typescript
// Remove these two lines:
(e: 'toolApprove', id: string): void
(e: 'toolDeny', id: string): void
```

- [ ] **Step 3: Remove approval events from MessageList.vue**

Read `frontend/src/components/cowork/MessageList.vue`.

1. Remove from the template:
```html
@tool-approve="(id: string) => emit('toolApprove', id)"
@tool-deny="(id: string) => emit('toolDeny', id)"
```

2. Remove from `defineEmits`:
```typescript
// Remove these two lines:
(e: 'toolApprove', id: string): void
(e: 'toolDeny', id: string): void
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npm run type-check && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add frontend/src/components/cowork
git commit -m "refactor: remove approval request from MessageItem, MessageList, and types"
```

---

## Verification

After all tasks:

```bash
cd frontend && npm run type-check && npm run build && npm test
```

Expected: all PASS.
