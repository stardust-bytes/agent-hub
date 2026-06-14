# Tool Approval Args Collapse Design

**Date:** 2026-06-14
**Scope:** `frontend/src/components/ToolApprovalBar.vue`, `frontend/src/components/CoworkView.vue`

---

## Problem

When an agent calls a tool with long arguments (e.g., a large JSON payload or file content), the `ToolApprovalBar` expands to fill the entire screen, pushing the approve/deny buttons out of view and making the UI unusable.

---

## Goal

- Args longer than 500 characters collapse to 2 lines with a toggle button
- When expanded, the args area is scrollable and capped so it never pushes the approve/deny buttons off screen
- Keyboard shortcuts: `Enter` to approve, `Esc` to reject

---

## Changes

### 1. `ToolApprovalBar.vue`

#### New prop

```ts
maxExpandHeight: number  // computed in CoworkView, passed down
```

#### Collapse/expand logic

- `isLong = computed(() => args.length > 500)`
- `expanded = ref(false)` — default collapsed
- `watch(() => props.args, () => { expanded.value = false })` — reset on new tool call
- When `isLong && !expanded`: args div uses `line-clamp-2 overflow-hidden cursor-pointer`
- When `isLong && expanded`: args div uses `overflow-y-auto break-all` + `:style="{ maxHeight: maxExpandHeight + 'px' }"`
- When `!isLong`: display as-is, no toggle button, no `maxExpandHeight` applied
- Toggle button appears below args when `isLong`:
  - Collapsed: label `t('approval.show_more')` — e.g. "↓ Xem thêm"
  - Expanded: label `t('approval.show_less')` — e.g. "↑ Thu gọn"
  - Style: `text-2xs text-cyber-muted font-mono hover:text-cyber-accent transition-colors duration-150`

#### Keyboard shortcuts

```ts
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('approve', props.id)
  if (e.key === 'Escape') emit('deny', props.id)
}
```

#### Keyboard hint

Displayed beside the approve/deny buttons:

```
↵ · Esc
```

Style: `text-2xs text-cyber-muted font-mono` — subtle, does not draw attention away from the buttons.

#### i18n keys

| Key | Vietnamese | English |
|---|---|---|
| `approval.show_more` | `↓ Xem thêm` | `↓ Show more` |
| `approval.show_less` | `↑ Thu gọn` | `↑ Show less` |
| `approval.keyboard_hint` | `↵ · Esc` | `↵ · Esc` (same both locales) |

---

### 2. `CoworkView.vue`

#### Measure ChatInputBar height

Wrap the existing `<ChatInputBar>` with a `<div ref="chatInputWrapperRef">` (no style, only for measurement).

```ts
const chatInputWrapperRef = ref<HTMLElement | null>(null)
const chatInputBarHeight = ref(0)
const statusBarHeight = 28  // 1.75rem × 16px — constant, never changes

const maxExpandHeight = computed(
  () => window.innerHeight - statusBarHeight - chatInputBarHeight.value
)
```

#### ResizeObserver

```ts
let ro: ResizeObserver | null = null

onMounted(() => {
  ro = new ResizeObserver(() => {
    chatInputBarHeight.value = chatInputWrapperRef.value?.offsetHeight ?? 0
  })
  if (chatInputWrapperRef.value) ro.observe(chatInputWrapperRef.value)
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  ro?.disconnect()
  window.removeEventListener('resize', onWindowResize)
})

function onWindowResize() {
  chatInputBarHeight.value = chatInputWrapperRef.value?.offsetHeight ?? 0
}
```

#### Pass to ToolApprovalBar

```html
<ToolApprovalBar
  v-if="pendingApproval"
  :id="pendingApproval.id"
  :name="pendingApproval.name"
  :args="pendingApproval.args"
  :remaining="pendingApproval.remaining"
  :total="pendingApproval.total"
  :max-expand-height="maxExpandHeight"
  @approve="onApprove"
  @deny="onDeny"
/>
```

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/ToolApprovalBar.vue` | Add collapse/expand, `maxExpandHeight` prop, keyboard shortcuts, keyboard hint |
| `frontend/src/components/CoworkView.vue` | Add `chatInputWrapperRef`, `ResizeObserver`, `maxExpandHeight` computed, pass prop |
| `frontend/src/locales/vi.json` | Add `approval.show_more`, `approval.show_less`, `approval.keyboard_hint` |
| `frontend/src/locales/en.json` | Same keys, English values |

---

## Success Criteria

- Args ≤ 500 chars: no visual change from current behavior
- Args > 500 chars: shows 2 lines, toggle button visible
- Expanded state never overflows viewport (capped by `maxExpandHeight`)
- `Enter` approves, `Esc` rejects from anywhere while approval bar is visible
- Keyboard hint is visible but not distracting
