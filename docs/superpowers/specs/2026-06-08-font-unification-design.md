# Font Unification Design

**Date:** 2026-06-08  
**Status:** Approved

## Goal

Unify all text in the frontend to use a single monospace font (JetBrains Mono) at a single size (14px / `text-sm`) across all components and global CSS. No size hierarchy, no exceptions.

## Problem

1. `tailwind.config.ts` defines `fontFamily.mono` as `['monospace']` — the generic fallback only. JetBrains Mono is imported in `main.css` but never referenced by the Tailwind `font-mono` class.
2. 86 occurrences of mixed size classes (`text-xs`, `text-sm`, `text-[0.65rem]`, `text-[0.7rem]`, etc.) across 15 component files create inconsistent visual density.
3. Base `font-size` on `html, body` is `16px`; most UI text uses `text-xs` (12px) — the baseline is misleading.

## Approach

**Explicit per-file replacement (Approach C):** Audit and fix every file individually rather than relying on CSS cascade overrides. This produces a clean, reviewable diff with no hidden side effects.

## Changes

### `frontend/tailwind.config.ts`

Update `fontFamily.mono` to the full JetBrains Mono stack:

```ts
fontFamily: {
  mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
},
```

### `frontend/src/assets/main.css`

- Change `font-size` on `html, body, #app` from `16px` to `14px`.
- Remove per-element `font-size` overrides inside `.markdown-body` (headings, code, table, etc.) — let them inherit `14px` from body, or set explicitly to `0.875rem` where a reset is needed.
- Keep `.markdown-body { font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace }` in sync with the Tailwind stack.

### 15 component files in `frontend/src/components/`

Apply these replacements uniformly:

| Old class | New class |
|---|---|
| `text-xs` | `text-sm` |
| `text-[0.65rem]`, `text-[0.7rem]`, `text-[0.75rem]`, any `text-[...]` | `text-sm` |
| `text-base`, `text-lg`, `text-xl`, `text-2xl` | `text-sm` |
| missing `font-mono` | add `font-mono` |

Files in scope:
- AppShell.vue
- SidebarNav.vue
- BottomTabBar.vue
- ChatPanel.vue
- TasksView.vue
- KanbanBoard.vue
- TaskCard.vue
- TaskCardMenu.vue
- FilesView.vue
- SettingsView.vue
- ProvidersView.vue
- ProviderFormModal.vue
- SessionModal.vue
- ModelSelector.vue
- BaseSelect.vue
- BaseModal.vue
- StatusBar.vue

## Success Criteria

- `font-mono` class renders JetBrains Mono (verifiable in browser DevTools → Computed → font-family).
- No `text-xs`, `text-[...]`, `text-base`, `text-lg` or larger size classes remain in any component.
- All text in the UI visually appears at the same size.
- `npm run type-check` passes with no errors.

## Out of Scope

- Backend changes.
- i18n / locale content.
- Color token changes.
- Adding or removing components.
