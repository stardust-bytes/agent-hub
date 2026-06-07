# Lazy Session Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delay session creation from ChatPanel mount to first user message.

**Architecture:** Remove `POST /api/sessions` from `onMounted` in ChatPanel.vue. Add it to `submit()` — create session lazily when `currentSessionId` is null.

**Tech Stack:** Vue 3 Composition API

---

### Task 1: Move session creation to submit()

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Remove session creation from onMounted**

Delete lines 181-187 in `frontend/src/components/ChatPanel.vue`:
```ts
  try {
    const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (res.ok) {
      const session = await res.json() as { id: number }
      currentSessionId.value = session.id
    }
  } catch { /* ignore */ }
```

- [ ] **Step 2: Add session creation to submit()**

In the `submit()` function, at the very beginning (after `if (!text || streaming.value) return` on line 218, before `input.value = ''` on line 219), add:

```ts
  if (currentSessionId.value === null) {
    try {
      const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (res.ok) {
        const session = await res.json() as { id: number }
        currentSessionId.value = session.id
      }
    } catch { /* ignore */ }
  }
```

- [ ] **Step 3: Verify type-check**

Run: `npm run type-check` in `frontend/`
Expected: No errors.

- [ ] **Step 4: Verify build**

Run: `npm run build` in `frontend/`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: lazy session creation — only create session on first message"
```
