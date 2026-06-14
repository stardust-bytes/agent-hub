# Tool Approval Args Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collapse/expand to `ToolApprovalBar` args when content exceeds 500 chars, cap expanded height to viewport minus status bar + chat input, and add Enter/Esc keyboard shortcuts.

**Architecture:** Two-file change. `ToolApprovalBar.vue` owns the collapse/expand UI and keyboard listeners; it receives `maxExpandHeight` as a prop. `CoworkView.vue` owns the height measurement via `ResizeObserver` on the `ChatInputBar` wrapper and passes `maxExpandHeight` down. i18n keys added to both locale files first.

**Tech Stack:** Vue 3 Composition API, `<script setup lang="ts">`, TailwindCSS, `vue-i18n`, native `ResizeObserver`, native `KeyboardEvent`.

**Spec:** `docs/superpowers/specs/2026-06-14-tool-approval-args-collapse-design.md`

---

## File Map

| File | Change |
|---|---|
| `frontend/src/locales/vi.json` | Add 3 keys to `approval` object |
| `frontend/src/locales/en.json` | Add 3 keys to `approval` object |
| `frontend/src/components/ToolApprovalBar.vue` | Full rewrite: collapse/expand, keyboard, hint, new prop |
| `frontend/src/components/CoworkView.vue` | Add ResizeObserver, `maxExpandHeight` computed, wrap ChatInputBar, pass prop |

---

### Task 1: Add i18n keys

**Files:**
- Modify: `frontend/src/locales/vi.json` (line ~311)
- Modify: `frontend/src/locales/en.json` (line ~311)

- [ ] **Step 1: Add keys to vi.json**

Find in `frontend/src/locales/vi.json`:

```json
    "allow": "Cho phép",
    "deny": "Từ chối"
  },
```

Replace with:

```json
    "allow": "Cho phép",
    "deny": "Từ chối",
    "show_more": "↓ Xem thêm",
    "show_less": "↑ Thu gọn",
    "keyboard_hint": "↵ · Esc"
  },
```

- [ ] **Step 2: Add keys to en.json**

Find in `frontend/src/locales/en.json`:

```json
    "allow": "Allow",
    "deny": "Deny"
  },
```

Replace with:

```json
    "allow": "Allow",
    "deny": "Deny",
    "show_more": "↓ Show more",
    "show_less": "↑ Collapse",
    "keyboard_hint": "↵ · Esc"
  },
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add approval collapse and keyboard hint i18n keys"
```

---

### Task 2: Rewrite ToolApprovalBar.vue

**Files:**
- Modify: `frontend/src/components/ToolApprovalBar.vue`

- [ ] **Step 1: Replace entire file content**

Replace the full content of `frontend/src/components/ToolApprovalBar.vue` with:

```vue
<template>
  <div class="max-w-60rem mx-auto w-full px-3 mb-2">
    <div class="border border-cyber-orange/60 bg-cyber-dark px-3 py-2">
      <div class="flex items-center gap-2 mb-1">
        <HiShieldExclamation class="w-3 h-3 text-cyber-orange shrink-0" />
        <span class="text-sm text-cyber-orange font-mono">
          Tool '{{ name }}' {{ t('approval.required') }}
        </span>
      </div>

      <div
        class="text-2xs text-cyber-muted font-mono break-all"
        :class="[
          isLong && !expanded ? 'line-clamp-2 overflow-hidden' : (isLong ? 'overflow-y-auto' : ''),
          isLong ? 'mb-1' : 'mb-2'
        ]"
        :style="isLong && expanded ? { maxHeight: maxExpandHeight + 'px' } : {}"
      >
        {{ t('approval.args') }}: {{ args }}
      </div>

      <button
        v-if="isLong"
        @click="expanded = !expanded"
        class="block text-2xs text-cyber-muted font-mono mb-2 hover:text-cyber-accent transition-colors duration-150"
      >
        {{ expanded ? t('approval.show_less') : t('approval.show_more') }}
      </button>

      <div class="w-full h-1 bg-cyber-code-border mb-2">
        <div
          class="h-full bg-cyber-orange transition-all duration-1000 linear"
          :style="{ width: (remaining / total * 100) + '%' }"
        ></div>
      </div>

      <div class="flex items-center justify-between">
        <div class="text-2xs text-cyber-muted font-mono">{{ remaining }}s / {{ total }}s</div>
        <div class="flex items-center gap-3">
          <span class="text-2xs text-cyber-muted font-mono">{{ t('approval.keyboard_hint') }}</span>
          <div class="flex gap-2">
            <button
              @click="emit('approve', id)"
              class="text-sm text-white font-mono px-2 py-1 bg-cyber-accent transition-colors duration-150 hover:bg-cyber-accent/80"
            >
              {{ t('approval.allow') }}
            </button>
            <button
              @click="emit('deny', id)"
              class="text-sm text-cyber-text font-mono px-2 py-1 border border-cyber-code-border transition-colors duration-150 hover:bg-cyber-dark"
            >
              {{ t('approval.deny') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiShieldExclamation } from 'vue-icons-plus/hi'

const props = defineProps<{
  id: string
  name: string
  args: string
  remaining: number
  total: number
  maxExpandHeight: number
}>()

const emit = defineEmits<{
  (e: 'approve', id: string): void
  (e: 'deny', id: string): void
}>()

const { t } = useI18n()

const expanded = ref(false)
const isLong = computed(() => props.args.length > 500)

watch(() => props.args, () => { expanded.value = false })

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('approve', props.id)
  if (e.key === 'Escape') emit('deny', props.id)
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
```

- [ ] **Step 2: Verify TypeScript — no errors**

```bash
cd frontend && npx vue-tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `ToolApprovalBar.vue`. If you see `Property 'maxExpandHeight' is missing` on `CoworkView.vue`, that's expected — Task 3 fixes it.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ToolApprovalBar.vue
git commit -m "feat: add collapse/expand and keyboard shortcuts to ToolApprovalBar"
```

---

### Task 3: Update CoworkView.vue — ResizeObserver + maxExpandHeight

**Files:**
- Modify: `frontend/src/components/CoworkView.vue`

- [ ] **Step 1: Add `computed` to Vue imports**

Find in `frontend/src/components/CoworkView.vue`:

```ts
import { ref, triggerRef, onMounted, onUnmounted, nextTick } from 'vue'
```

Replace with:

```ts
import { ref, computed, triggerRef, onMounted, onUnmounted, nextTick } from 'vue'
```

- [ ] **Step 2: Add height measurement refs after existing refs**

Find this line (last ref in the existing block, ~line 129):

```ts
const messageListRef = ref<{ scrollToBottom: () => Promise<void> } | null>(null)
```

Add immediately after:

```ts
const chatInputWrapperRef = ref<HTMLElement | null>(null)
const chatInputBarHeight = ref(0)
const statusBarHeight = 28
const maxExpandHeight = computed(() => window.innerHeight - statusBarHeight - chatInputBarHeight.value)
```

- [ ] **Step 3: Add ResizeObserver lifecycle hooks**

Find the existing `onMounted` call:

```ts
onMounted(async () => {
  await loadProject()
  await loadModel()
})
```

Add a new `onMounted` and `onUnmounted` block immediately AFTER the existing `onUnmounted` (line ~151):

```ts
let chatInputRo: ResizeObserver | null = null

onMounted(() => {
  chatInputRo = new ResizeObserver(() => {
    chatInputBarHeight.value = chatInputWrapperRef.value?.offsetHeight ?? 0
  })
  if (chatInputWrapperRef.value) chatInputRo.observe(chatInputWrapperRef.value)
  window.addEventListener('resize', onViewportResize)
})

onUnmounted(() => {
  chatInputRo?.disconnect()
  window.removeEventListener('resize', onViewportResize)
})

function onViewportResize() {
  chatInputBarHeight.value = chatInputWrapperRef.value?.offsetHeight ?? 0
}
```

- [ ] **Step 4: Wrap `<ChatInputBar>` with a ref div**

Find in the template:

```html
        <ChatInputBar
          :streaming="streaming"
          :models="availableModels"
          :model-id="selectedModelId"
          @update:model-id="selectedModelId = $event"
          @submit="submitText"
          @stop="stopStream"
          @open-sessions="showSessionModal = true"
        />
```

Replace with:

```html
        <div ref="chatInputWrapperRef">
          <ChatInputBar
            :streaming="streaming"
            :models="availableModels"
            :model-id="selectedModelId"
            @update:model-id="selectedModelId = $event"
            @submit="submitText"
            @stop="stopStream"
            @open-sessions="showSessionModal = true"
          />
        </div>
```

- [ ] **Step 5: Pass `maxExpandHeight` to ToolApprovalBar**

Find:

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

Replace with:

```html
        <ToolApprovalBar
          v-if="pendingApproval"
          :id="pendingApproval.id"
          :name="pendingApproval.name"
          :args="pendingApproval.args"
          :remaining="remainingSeconds"
          :total="30"
          :max-expand-height="maxExpandHeight"
          @approve="approveTool"
          @deny="denyTool"
        />
```

- [ ] **Step 6: Verify TypeScript — no errors**

```bash
cd frontend && npx vue-tsc --noEmit 2>&1 | head -30
```

Expected: no output (clean build).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/CoworkView.vue
git commit -m "feat: measure ChatInputBar height for ToolApprovalBar expand cap"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start dev server**

```bash
cd frontend && npm run dev
```

Open `http://localhost:17135`.

- [ ] **Step 2: Test short args (≤ 500 chars)**

Trigger a tool call with short args (e.g., `list_tasks`). Verify:
- Args display looks identical to before — no toggle button visible

- [ ] **Step 3: Test long args collapse (> 500 chars)**

Trigger a tool call with long args (e.g., `write_file` with a large content string, or `web_fetch` with a long URL + options). Verify:
- Args show exactly 2 lines, truncated with `…`
- "↓ Xem thêm" / "↓ Show more" button visible below args

- [ ] **Step 4: Test expand**

Click "↓ Xem thêm". Verify:
- Full args content visible in a scrollable area
- The approval bar + args do NOT extend beyond the viewport bottom
- "↑ Thu gọn" / "↑ Collapse" button now shows

- [ ] **Step 5: Test keyboard shortcuts**

While approval bar is visible:
- Press `Enter` → tool is approved
- Trigger another approval → press `Esc` → tool is denied

- [ ] **Step 6: Test viewport resize**

With approval bar expanded, resize browser window to smaller height. Verify:
- Expanded area shrinks to stay within viewport

- [ ] **Step 7: Commit task completion**

No additional commit needed — verification only.
