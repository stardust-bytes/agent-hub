# Sidebar Labels Design

**Date:** 2026-06-07  
**Status:** Approved  
**Scope:** `frontend/src/components/SidebarNav.vue` only

---

## Goal

Expand the sidebar from icon-only (52px) to a fixed-width panel (128px) that permanently displays both icon and label for each nav item. No toggle state, no hover behavior — always visible.

---

## Layout & Dimensions

| Property | Before | After |
|---|---|---|
| Width | `w-[3.25rem]` (52px) | `w-32` (128px) |
| Button shape | `w-9 h-9` square | `w-full px-3 py-2` horizontal row |
| Label | `title` tooltip only | Visible `<span>` next to icon |

Content panels (`ChatPanel`, `TasksView`, `FilesView`, `SettingsView`, `ArtifactsPanel`) use `flex-1 overflow-hidden` in `AppShell.vue` and require no changes — they shrink naturally.

---

## Component Changes — `SidebarNav.vue`

### Nav width
```
w-[3.25rem] → w-32
```

### Nav buttons (v-for loop)
Replace fixed-square layout with horizontal icon + label row:
- Remove `w-9 h-9`
- Use `w-full px-3 py-2 flex items-center gap-2 rounded`
- Add `<span class="text-xs truncate">{{ t(item.labelKey) }}</span>` after the icon component
- Remove `title` attribute (label is now visible)

### Logo area
Add `<span class="text-xs text-cyber-accent/50 truncate">workspace</span>` next to the `HiTerminal` icon.

### Settings button (bottom)
Same treatment as nav buttons: `w-full px-3 py-2 flex items-center gap-2 rounded` with label `{{ t('nav.settings') }}`.

### Lang toggle
Keep as-is — `w-9 h-6` with `VI`/`EN` text is appropriate for a compact footer control. No label change needed.

### Health dot
Keep as-is — positioned at the very bottom, centered.

---

## Design Rules Compliance

- Font: `text-xs font-mono` on all labels (inherits from `font-mono` on `AppShell`)
- Border radius: `rounded` (4px max) — no `rounded-lg`
- No shadows, no gradients
- Colors: `text-cyber-accent`, `text-cyber-muted`, `bg-cyber-accent/10` — no raw hex
- Responsive: `hidden sm:flex` preserved
- i18n: labels via `t(item.labelKey)` — no hardcoded strings

---

## Out of Scope

- Mobile `BottomTabBar.vue` — not touched
- Hover/expand behavior — Option A is always-expanded, no animation needed
- Collapsible toggle — not part of this design
- Any changes to `AppShell.vue` or other panels
