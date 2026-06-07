# Markdown Preview Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSS styling to `.markdown-body` class for rendered agent messages (code blocks, tables, links, headings, inline code).

**Architecture:** Single CSS file change in `frontend/src/assets/main.css`. All styles scoped under `.markdown-body` selector. No component logic, no JS, no build changes.

**Tech Stack:** TailwindCSS custom CSS, existing `cyber-*` color tokens referenced where applicable.

---

### Task 1: Add markdown-body CSS styles

**Files:**
- Modify: `frontend/src/assets/main.css` — append `.markdown-body` block

- [ ] **Step 1: Open and read current main.css**

Read `frontend/src/assets/main.css` to confirm current content.

- [ ] **Step 2: Append markdown-body styles**

Append to `frontend/src/assets/main.css`:

```css
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  color: #00d4ff;
  font-weight: 600;
  margin: 16px 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.15);
}

.markdown-body h1 { font-size: 18px; }
.markdown-body h2 { font-size: 16px; }
.markdown-body h3 { font-size: 14px; }
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 { font-size: 13px; }

.markdown-body a {
  color: #58a6ff;
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body p {
  margin: 0 0 10px;
  line-height: 1.7;
}

.markdown-body code {
  background: rgba(110, 118, 129, 0.4);
  color: #f08383;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.9em;
}

.markdown-body pre {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 12px;
  margin: 12px 0;
  overflow-x: auto;
}

.markdown-body pre code {
  background: none;
  color: #e6edf3;
  padding: 0;
  font-size: 12px;
  line-height: 1.6;
}

.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 12px;
  border: 1px solid #30363d;
}

.markdown-body th,
.markdown-body td {
  border: 1px solid #30363d;
  padding: 7px 10px;
  text-align: left;
}

.markdown-body th {
  background: #161b22;
  color: #00d4ff;
  font-weight: 500;
}

.markdown-body tr:nth-child(even) {
  background: rgba(0, 212, 255, 0.03);
}

.markdown-body blockquote {
  border-left: 3px solid #00d4ff;
  margin: 12px 0;
  padding: 8px 14px;
  background: rgba(0, 212, 255, 0.05);
  color: #8b949e;
  border-radius: 0 4px 4px 0;
}

.markdown-body ul,
.markdown-body ol {
  margin: 8px 0;
  padding-left: 20px;
  color: #e6edf3;
}

.markdown-body li {
  margin: 3px 0;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid #30363d;
  margin: 16px 0;
}

.markdown-body img {
  max-width: 100%;
  border-radius: 4px;
}
```

- [ ] **Step 3: Verify frontend compiles**

Run: `npx vue-tsc --noEmit` from `frontend/`
Expected: no output (clean compilation)

- [ ] **Step 4: Verify frontend build**

Run: `npm run build` from `frontend/`
Expected: Build succeeds, no errors

- [ ] **Step 5: Run full backend test suite**

Run: `npx jest --no-coverage` from `backend/`
Expected: All 61 tests pass

- [ ] **Step 6: Commit**

```bash
git add frontend/src/assets/main.css docs/superpowers/specs/2026-06-07-markdown-style-design.md docs/superpowers/plans/2026-06-07-markdown-style.md
git commit -m "feat: add markdown-body CSS styling for agent messages

- Style code blocks, tables, links, headings, lists, blockquotes
- Terminal/IDE aesthetic with #00d4ff accent, #0d1117 surfaces
- All styles scoped under .markdown-body selector"
```
