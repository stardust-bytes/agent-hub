# Frontend Refactor — Design Spec

**Date:** 2026-06-07
**Status:** Approved

---

## Problem

The frontend has three compounding issues:
1. ~30 hardcoded hex values scattered across `main.css` and components — no single source of truth for colors.
2. All spacing, font sizes, and dimensions in `main.css` use `px`; Tailwind arbitrary values in components mix `px` and rem — inconsistent scale.
3. The 3-panel desktop layout (`SidebarNav 52px + ChatPanel 45% + ArtifactsPanel flex-1`) breaks on mobile — no responsive behavior.

---

## Approach

Big-bang refactor in a single pass covering all three concerns simultaneously:
- **Color tokens** — extend `tailwind.config.ts`, eliminate all hardcoded hex
- **rem system** — convert all `px` to `rem` (base: 16px browser default)
- **Responsive layout** — `sm` breakpoint (640px) triggers mobile layout: bottom tab bar, chat full-width, artifacts hidden

---

## Section 1: Color Token System

### New tokens added to `tailwind.config.ts`

| Token | Value | Usage |
|---|---|---|
| `cyber-muted` | `#888888` | Dimmed/system text in components |
| `cyber-text` | `#EEEEEE` | Primary body text |
| `cyber-orange` | `#FFA500` | Tool call message color |
| `cyber-cyan` | `#00d4ff` | Markdown headers, blockquote borders |
| `cyber-link` | `#58a6ff` | Markdown hyperlinks |
| `cyber-code-red` | `#f08383` | Inline code text |
| `cyber-code-bg` | `#0d1117` | Code block background |
| `cyber-code-border` | `#30363d` | Code block and table borders |
| `cyber-code-text` | `#e6edf3` | Code block text |
| `cyber-row` | `#161b22` | Table header background |
| `cyber-blockquote` | `#8b949e` | Blockquote text color |

### Existing tokens (unchanged)

`cyber-bg` `#000000`, `cyber-dark` `#111111`, `cyber-status` `#161616`, `cyber-accent` `#3B82F6`, `cyber-green` `#22C55E`, `cyber-blue` `#3B82F6`

### Rule

After this refactor, **zero hardcoded hex values** are permitted in any `.vue` file or `main.css`. All colors reference a `cyber-*` Tailwind token or Tailwind opacity modifier (e.g. `cyber-accent/20`).

---

## Section 2: Typography & Spacing (rem)

Base: `html` default = 16px (no override). All values: `px ÷ 16`.

### `main.css` — `.markdown-body` font sizes

| Before | After |
|---|---|
| `font-size: 18px` (h1) | `font-size: 1.125rem` |
| `font-size: 16px` (h2) | `font-size: 1rem` |
| `font-size: 14px` (h3) | `font-size: 0.875rem` |
| `font-size: 13px` (h4–h6) | `font-size: 0.8125rem` |
| `font-size: 12px` (code, table) | `font-size: 0.75rem` |

### `main.css` — spacing

| Before | After |
|---|---|
| `margin: 16px 0 8px` | `margin: 1rem 0 0.5rem` |
| `padding-bottom: 6px` | `padding-bottom: 0.375rem` |
| `margin: 0 0 10px` | `margin: 0 0 0.625rem` |
| `padding: 12px` | `padding: 0.75rem` |
| `margin: 12px 0` | `margin: 0.75rem 0` |
| `padding: 1px 6px` | `padding: 0.0625rem 0.375rem` |
| `padding: 7px 10px` | `padding: 0.4375rem 0.625rem` |
| `padding: 8px 14px` | `padding: 0.5rem 0.875rem` |
| `padding-left: 20px` | `padding-left: 1.25rem` |
| `margin: 8px 0` | `margin: 0.5rem 0` |
| `margin: 3px 0` | `margin: 0.1875rem 0` |
| `margin: 16px 0` | `margin: 1rem 0` |
| `width: 4px` (scrollbar) | `width: 0.25rem` |
| `border-radius: 2px` | `border-radius: 0.125rem` |
| `border-radius: 4px` | `border-radius: 0.25rem` |

### Tailwind arbitrary values in components

| Before | After |
|---|---|
| `w-[52px]` | `w-[3.25rem]` |
| `text-[10px]` | `text-[0.625rem]` |
| `text-[11px]` | `text-[0.6875rem]` |
| `h-7` (1.75rem) | already rem — keep |
| `w-9 h-9` (2.25rem) | already rem — keep |
| `w-2 h-2` (0.5rem) | already rem — keep |
| `w-3 h-3`, `w-4 h-4`, `w-5 h-5` | already rem — keep |

### Rule

After this refactor, **zero `px` values** in `main.css` or Tailwind arbitrary value classes. Exception: `0px` (resets) and `1px` borders (which are semantic — "hairline" — acceptable as the only `px` exception).

---

## Section 3: Responsive Layout

**Breakpoint:** `sm` = 640px (Tailwind default).

### AppShell.vue

**Note:** `ArtifactsPanel.vue` does not exist in the current codebase. The actual layout is 2-panel: SidebarNav + a single content area (ChatPanel / TasksView / FilesView / SettingsView).

**Desktop (`≥ sm`):** `flex-row` — SidebarNav (3.25rem fixed) + content area (flex-1)

**Mobile (`< sm`):** `flex-col` — content area (flex-1) + BottomTabBar (3rem) + StatusBar (1.75rem)

```
Desktop:                              Mobile:
┌──────────┬──────────────────────┐   ┌───────────────────────┐
│SidebarNav│                      │   │                       │
│ 3.25rem  │  content (flex-1)    │   │  content (flex-1)     │
│          │  Chat/Tasks/Files/   │   │  Chat/Tasks/Files/    │
│          │  Settings            │   │  Settings             │
├──────────┴──────────────────────┤   ├───────────────────────┤
│         StatusBar 1.75rem       │   │  BottomTabBar 3rem    │
└─────────────────────────────────┘   ├───────────────────────┤
                                      │  StatusBar 1.75rem    │
                                      └───────────────────────┘
```

### SidebarNav.vue

- Add `hidden sm:flex` — visible only on desktop.
- No behavioral changes.

### BottomTabBar.vue — new component

- `flex sm:hidden` — visible only on mobile.
- Height: `h-[3rem]`, `bg-cyber-dark`, `border-t border-cyber-code-border`.
- Renders the same `navItems` as SidebarNav (Chat, Tasks, Files, Settings).
- Active: `text-cyber-accent bg-cyber-accent/10`; inactive: `text-cyber-muted hover:text-cyber-accent`.
- Props: `activeView: 'chat' | 'tasks' | 'files' | 'settings'`
- Emits: `navigate: [view: 'chat' | 'tasks' | 'files' | 'settings']`
- Language toggle and health dot are **not** shown in BottomTabBar — they remain in SidebarNav (desktop only).

### Non-breaking views

TasksView, FilesView, SettingsView are already full-width — they work on mobile without changes.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `frontend/tailwind.config.ts` | Modify | Add 11 new `cyber-*` tokens |
| `frontend/src/assets/main.css` | Modify | Replace all hex → token refs; all px → rem |
| `frontend/src/components/AppShell.vue` | Modify | Responsive layout: mobile stack (`flex-col` on mobile) |
| `frontend/src/components/SidebarNav.vue` | Modify | Add `hidden sm:flex` |
| `frontend/src/components/ChatPanel.vue` | Modify | Replace `text-[#888888]`, `text-[#FFA500]`, `text-[#EEEEEE]`, `text-[11px]` → tokens |
| `frontend/src/components/StatusBar.vue` | Modify | Replace `h-7 bg-[#161616] text-[10px] text-[#888888]` → tokens/rem |
| `frontend/src/components/BottomTabBar.vue` | **Create** | Mobile bottom nav bar |

Minor token fixes (replace remaining `text-[#888888]` → `text-cyber-muted`):
- `TaskCard.vue`, `KanbanBoard.vue`, `TasksView.vue`, `SettingsView.vue`, `FilesView.vue`, `BaseModal.vue`, `BaseSelect.vue`, `ModelSelector.vue`, `TaskCardMenu.vue`, `SessionModal.vue`

---

## Out of Scope

- Changing the color palette itself (only systematizing existing values)
- ArtifactsPanel behavior on desktop (no change)
- i18n keys for BottomTabBar (reuses existing `nav.*` keys)
- Animations, transitions, or visual redesign beyond layout
