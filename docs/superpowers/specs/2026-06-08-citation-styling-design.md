# Citation Line Styling — Design Spec

## Overview

Customize the styling of citation lines like `[Source: "AGENTS.md", §7]` in markdown-rendered agent messages to use `cyber-orange` (`#FFA500`) color.

## Approach

Regex post-processing in the existing `renderMarkdown()` function transforms citation paragraphs into a styled element with a dedicated CSS class.

## Changes

### 1. `ChatPanel.vue` — renderMarkdown function

Replace:
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

The regex matches `[Source: "filename", §N]` or `[Source: 'filename', §N]` as a standalone paragraph.

### 2. `main.css` — citation style

Add to the `.markdown-body` section:
```css
.markdown-body p.citation {
  color: var(--cyber-orange, #FFA500);
  font-size: 0.75rem;
  opacity: 0.8;
  margin: 0.25rem 0;
}
```

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/ChatPanel.vue` | Regex replacement in `renderMarkdown()` |
| `frontend/src/assets/main.css` | `.markdown-body p.citation` class |

### Verification

- `npm run build` — vue-tsc + vite build pass
- Backend tests still pass: `npx jest`
