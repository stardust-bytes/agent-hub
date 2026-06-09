# Sticky Plan Bubble Design

**Goal:** Keep the executing plan visible at the top of the chat during plan execution so users can track step progress without scrolling.

## Problem

During `/plan` execution, `handleApprove()` streams SSE events: `planStepUpdate` updates the PlanBubble, while `token` events create new agent messages at the bottom of the chat. The PlanBubble gets pushed upward and out of view.

## Solution

When a plan's status is `EXECUTING`, render it as a sticky element at the top of the message list. Other messages scroll beneath. When execution finishes (DONE/FAILED), the plan returns to its normal chronological position.

## Changes

**File:** `frontend/src/components/ChatPanel.vue`

### Computed properties

```typescript
const executingPlanMsg = computed(() =>
  messages.value.find(m => m.role === 'plan' && m.plan?.status === 'EXECUTING')
)

const displayedMessages = computed(() => {
  if (!executingPlanMsg.value) return messages.value
  return messages.value.filter(m => m !== executingPlanMsg.value)
})
```

### Template

Add sticky plan block BEFORE the `v-for`. Change `v-for="msg in messages"` to `v-for="msg in displayedMessages"`.

### Condition

Only plans with `status === 'EXECUTING'` get the sticky treatment. PENDING plans (awaiting approval) and DONE/FAILED plans render in their normal position.
