# Tool Approval Floating Bar — Design Spec

**Date:** 2026-06-13
**Status:** Draft

---

## Problem

The current tool approval UI pushes a `Message` with `approvalRequest` into the chat message array and renders it inside `MessageItem` as an inline block with Allow/Deny buttons. This has two problems:

1. The approval request clutters the message history — once approved/denied, the block stays visible
2. The countdown timer is invisible — the user doesn't know they have 30 seconds to respond

**Goal:** Replace the inline message-based approval UI with a floating bar above the input area that shows the tool details, a countdown progress bar, and Allow/Deny buttons. The bar disappears entirely when the user responds or the timer expires.

---

## Architecture

- `ToolApprovalBar.vue` — new standalone component
- `CoworkView.vue` — owns `pendingApproval` state, renders `ToolApprovalBar`, handles SSE callback and approve/deny actions
- Remove `approvalRequest` from `Message` interface, `MessageItem` template, and `MessageList` events

### Data Flow

```
AgentLoop → SSE toolApprovalRequired → CoworkView.onToolApprovalRequired
                                              ↓
                                    set pendingApproval ref
                                              ↓
                                    ToolApprovalBar renders
                                    (tool name, args, countdown bar, buttons)
                                              ↓
                                    User clicks Allow/Deny → POST /api/agent/approve-tool
                                              ↓
                                    clear pendingApproval → bar disappears
                                              ↓
                                    (30s timeout) → auto-deny → bar disappears
```

---

## Component: `ToolApprovalBar.vue`

### Props

```typescript
defineProps<{
  id: string
  name: string
  args: string
  remaining: number  // seconds remaining (30 → 0)
  total: number      // total seconds (always 30)
}>()
```

### Emits

```typescript
defineEmits<{
  (e: 'approve', id: string): void
  (e: 'deny', id: string): void
}>()
```

### Template

```html
<div class="border border-cyber-orange/60 bg-cyber-dark px-3 py-2 mx-3 mb-2">
  <div class="flex items-center gap-2 mb-1">
    <HiShieldExclamation class="w-3 h-3 text-cyber-orange shrink-0" />
    <span class="text-xs text-cyber-orange font-mono">
      Tool '{{ name }}' {{ t('approval.required') }}
    </span>
  </div>
  <div class="text-xs text-cyber-muted font-mono mb-2">
    {{ t('approval.args') }}: {{ args }}
  </div>
  <!-- Progress bar -->
  <div class="w-full h-1 bg-cyber-code-border mb-2">
    <div class="h-full bg-cyber-orange transition-all duration-1000 linear"
      :style="{ width: (remaining / total * 100) + '%' }"></div>
  </div>
  <div class="flex items-center justify-between">
    <div class="text-xs text-cyber-muted font-mono">{{ remaining }}s / {{ total }}s</div>
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
```

### States

| State | Behavior |
|---|---|
| **Pending** (30s remaining) | Bar visible, progress bar full, countdown running |
| **Countdown** | Progress bar shrinks, seconds decrease every 1s |
| **Timeout** (0s) | Auto-deny, bar disappears |
| **User approved** | Bar disappears immediately |
| **User denied** | Bar disappears immediately |

---

## Changes to Existing Files

### `CoworkView.vue`

**Script changes:**
- Remove `approvalRequest` field from `Message` interface usage
- Add `pendingApproval` ref:
  ```typescript
  const pendingApproval = ref<{ id: string; name: string; args: string; expiresAt: number } | null>(null)
  const remainingSeconds = ref(0)
  let approvalTimer: ReturnType<typeof setInterval> | null = null
  ```
- Replace the `onToolApprovalRequired` SSE callback body (currently pushes a message) with:
  ```typescript
  onToolApprovalRequired(id, name, args) {
    const argsStr = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(', ')
    pendingApproval.value = { id, name, args: argsStr, expiresAt: Date.now() + 30000 }
    remainingSeconds.value = 30
    if (approvalTimer) clearInterval(approvalTimer)
    approvalTimer = setInterval(() => {
      remainingSeconds.value = Math.max(0, Math.ceil((pendingApproval.value!.expiresAt - Date.now()) / 1000))
      if (remainingSeconds.value <= 0) {
        clearPendingApproval()
      }
    }, 200)
  }
  ```
- Change `approveTool`/`denyTool` to also call `clearPendingApproval()`:
  ```typescript
  function clearPendingApproval() {
    if (approvalTimer) clearInterval(approvalTimer)
    approvalTimer = null
    pendingApproval.value = null
  }
  ```
- On component unmount, clean up timer

**Template changes:**
- Insert `<ToolApprovalBar>` between `</MessageList>` and `<ChatInputBar>`:
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
  ```
- Remove `@tool-approve` and `@tool-deny` from `<MessageList>`

### `cowork/MessageItem.vue`

- Remove the `v-else-if="msg.approvalRequest"` template block (currently lines 63-80)
- Remove `toolApprove` and `toolDeny` from `defineEmits`

### `cowork/MessageList.vue`

- Remove `@tool-approve` and `@tool-deny` event forwarding
- Remove `toolApprove` and `toolDeny` from `defineEmits`

### `cowork/types.ts`

- Remove `approvalRequest` field from `Message` interface

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/ToolApprovalBar.vue` | NEW — floating approval bar with countdown |
| `frontend/src/components/CoworkView.vue` | Add pendingApproval state, ToolApprovalBar in template, update SSE callback |
| `frontend/src/components/cowork/MessageItem.vue` | Remove approval request block and emits |
| `frontend/src/components/cowork/MessageList.vue` | Remove toolApprove/toolDeny forwarding |
| `frontend/src/components/cowork/types.ts` | Remove approvalRequest field |
