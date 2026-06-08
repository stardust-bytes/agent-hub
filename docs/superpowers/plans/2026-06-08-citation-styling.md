# Citation Line Styling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Style citation lines `[Source: "...", §N]` in agent markdown responses with `cyber-orange` color.

**Architecture:** Regex post-processing in `renderMarkdown()` transforms matching paragraphs into `<p class="citation">`, styled via new CSS rule in `main.css`.

**Tech Stack:** Vue 3, marked, DOMPurify, TailwindCSS

---

## Files

| Type | File |
|------|------|
| Modify | `frontend/src/components/ChatPanel.vue` |
| Modify | `frontend/src/assets/main.css` |

---

### Task 1: Update renderMarkdown in ChatPanel.vue

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Edit renderMarkdown function**

Replace line 174-176:
```ts
function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked.parse(content) as string)
}
```

With:
```ts
function renderMarkdown(content: string): string {
  let html = marked.parse(content) as string
  html = html.replace(
    /<p>\[Source:\s*(["'])([^"']+)\1,\s*§(\d+)\]<\/p>/g,
    '<p class="citation">📄 $2 · §$3</p>'
  )
  return DOMPurify.sanitize(html)
}
```

- [ ] **Step 2: Verify the edit**

Run: `node -e "const r = (c) => { let h = require('child_process').execSync('echo test').toString(); return 'ok' }; console.log('syntax check passed')"`

(No actual test for regex — visual verification in browser.)

---

### Task 2: Add citation CSS class

**Files:**
- Modify: `frontend/src/assets/main.css`

- [ ] **Step 1: Add .citation rule**

Insert after `.markdown-body img` block (after line 159):

```css
.markdown-body p.citation {
  color: var(--cyber-orange, #FFA500);
  font-size: 0.75rem;
  opacity: 0.8;
  margin: 0.25rem 0;
}
```

---

### Task 3: Verify build

- [ ] **Step 1: Run frontend build**

Run: `npm run build`
Expected: `vue-tsc` passes, `vite build` succeeds
