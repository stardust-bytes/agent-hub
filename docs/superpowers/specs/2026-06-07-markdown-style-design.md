# Markdown Preview Styling

**Date:** 2026-06-07
**Status:** Approved for implementation

## Problem

Agent messages rendered via `renderMarkdown()` (marked + DOMPurify) currently have no CSS styling. Code blocks, tables, links, headings, lists, and inline code all render unstyled — indistinguishable from plain text, making messages hard to scan.

## Scope

CSS-only change. Add styles for `.markdown-body` class in `frontend/src/assets/main.css`. No component logic changes.

## Design

Terminal/IDE aesthetic matching the existing cyber theme. References GitHub Dark mode color palette adapted to the local `cyber-*` token system.

### Color Palette (all within `.markdown-body`)

| Element | CSS |
|---|---|
| Background surface | `#0d1117` |
| Border | `#30363d` |
| Accent (headings, link color) | `#00d4ff` (light cyan) |
| Link color | `#58a6ff` (GitHub blue) |
| Code inline bg | `rgba(110,118,129,0.4)` |
| Code inline text | `#f08383` |
| Table header bg | `#161b22` |
| Table stripe | `rgba(0,212,255,0.03)` |

### Elements styled

| Element | Style |
|---|---|
| `h1`–`h6` | Accent color, bottom border (subtle), increased weight |
| `a` | `#58a6ff`, no underline by default, underline on hover |
| `code` (inline) | Dark bg, red-ish text, small border-radius |
| `pre > code` (block) | Full-width block with `#0d1117` bg, `1px solid #30363d` border, padding |
| `pre` wrapper | Optional lang label via `::before` (parsed from code class) |
| `table` | Full-width collapse border, 1px `#30363d` grid |
| `th` | `#161b22` background, accent color text |
| `tr:nth-child(even)` | Subtle tint row |
| `blockquote` | `3px solid #00d4ff` left border, tinted bg, muted text |
| `ul`/`ol` | Accent-colored bullets/numbers, proper indent |
| `hr` | `1px solid #30363d` |
| `p > img` | Max-width 100%, rounded corners |

### Code block language label

The `marked` parser adds language as a class on `<code>` (e.g. `<code class="language-typescript">`). Use CSS `::before` pseudo-element to extract and display:

```css
.markdown-body pre::before {
  content: attr(data-lang);
  display: block;
  /* styled as a small header bar */
}
```

**Alternative:** Use a `::before` on `pre` itself, reading from its child `<code>` class. Implementation: iterate `pre code[class*="language-"]` via CSS-only using `::before` with `content: attr(class)` — but CSS `attr()` on class is limited. Instead, apply a data attribute via a small mutation or keep it simple without language labels if DOM manipulation is too invasive.

**Decision:** Skip language labels for now. The `pre` block with dark bg + border is sufficient visual distinction.

## Files Changed

- `frontend/src/assets/main.css` — add `.markdown-body { ... }` block (~80 lines)

## Non-Goals

- No changes to `ChatPanel.vue` logic
- No syntax highlighting library (no `highlight.js`/`prism.js`)
- No changes to markdown parser (`marked`)
- No changes to i18n
- No backend changes
