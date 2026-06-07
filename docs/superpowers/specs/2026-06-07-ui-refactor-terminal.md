# UI Refactor: Cyber High-Contrast Terminal Style

**Date:** 2026-06-07
**Status:** Draft
**Goal:** Refactor the entire frontend UI to a terminal-inspired, high-contrast design with VSCode/Claude Code aesthetic.

---

## 1. Color Tokens (tailwind.config.ts)

Replace existing `cyber-*` tokens:

| Current Token | Current Value | New Token | New Value | Usage |
|---|---|---|---|---|
| `cyber-bg` | `#0a0e1a` | `cyber-bg` | `#000000` | Main page background |
| `cyber-dark` | `#060911` | `cyber-dark` | `#111111` | Sidebar, input area, component containers |
| *(new)* | — | `cyber-status` | `#161616` | Bottom status bar |
| `cyber-accent` | `#00d4ff` (cyan) | `cyber-accent` | `#FFA500` | Primary accent, active states, cursor |
| `cyber-orange` | `#FFA500` | *(removed)* | — | Merged into `cyber-accent` |
| `cyber-green` | `#22C55E` | `cyber-green` | `#22C55E` | Success, completed indicators |
| `cyber-blue` | `#3B82F6` | `cyber-blue` | `#3B82F6` | System info, links, model names |
| `cyber-border` | `rgba(0,212,255,0.13)` | *(removed)* | — | No borders by default |
| `cyber-dim` | `rgba(0,212,255,0.33)` | *(removed)* | — | No borders by default |

**New text color tokens:**

| Token | Value | Usage |
|---|---|---|
| `text-primary` | `#EEEEEE` | Primary text |
| `text-secondary` | `#888888` | Muted text, metadata, shortcuts |
| `text-accent` | `#FFA500` | Active items, cursor |

**Font:** Unchanged — `font-mono` (JetBrains Mono → Fira Code → Courier New).

**Border radius:** Unchanged — max `rounded` (4px).

---

## 2. Layout Architecture

### Current Layout
```
SidebarNav(52px) | ChatPanel(45%) | (no ArtifactsPanel)
```

### New Layout
```
┌──────┬──────────────────────────────────────────────┐
│ Icons│  #000000 (full height)                       │
│ 52px │  ┌ Messages ────────────────────────────┐    │
│ #111 │  │ [#111111] system messages            │    │
│ 111  │  │ [#111111] user/agent messages        │    │
│      │  │                                       │    │
│      │  ├───────────────────────────────────────┤    │
│      │  │ [#111111] Input area $ _█             │    │
│      │  └───────────────────────────────────────┘    │
├──────┴──────────────────────────────────────────────┤
│  StatusBar [#161616] ◼ model · ● ws · [✓] db        │
└─────────────────────────────────────────────────────┘
```

### Key Layout Rules
- **No borders** between major sections — use `#000000` vs `#111111` contrast
- Sidebar: `bg-cyber-dark` (`#111111`), 52px fixed width
- Content area: `bg-cyber-bg` (`#000000`), fills remaining space
- Status bar: `bg-[#161616]`, full width at bottom, fixed height (28px)
- Input area: container with `bg-cyber-dark` (`#111111`), floating at bottom
- Message blocks: optional `bg-cyber-dark` per message for contrast

---

## 3. Component Changes

### AppShell.vue
- Remove `border-r` from ChatPanel
- Remove `style="width:45%; max-width:48rem"` — full width
- ChatPanel becomes flex-1
- Add StatusBar component at bottom
- Layout: `flex flex-col h-screen`

### ChatPanel.vue
- Full width (flex-1), no border
- Messages area: `bg-cyber-bg` (`#000000`)
- Input area container: `bg-cyber-dark` (`#111111`)
- Update color references: replace `text-cyber-orange` with `text-cyber-accent`
- Replace all `text-slate-100` with `text-[#EEEEEE]`
- Replace all `text-cyber-orange/xx` with appropriate `text-cyber-accent/xx` or `text-[#888888]`
- Remove all `border-cyber-*` classes from the input container

### TasksView.vue
- Full width, no border
- Same color token updates
- Header uses `#111111` background

### KanbanBoard.vue
- Full width columns
- Remove border classes, use bg contrast
- Update color tokens

### TaskCard.vue / TaskCardMenu.vue
- Update color tokens
- Remove border classes where possible

### New: StatusBar.vue
- Fixed height (28px), `bg-[#161616]`
- Left: model name in `text-cyber-blue`, health status
- Right: connection status, time

### SidebarNav.vue
- Change bg to `cyber-dark` (`#111111`)
- Update icon colors to use `text-[#888888]` (inactive) / `text-cyber-accent` (active)

---

## 4. Design Token Migration

| Old Class | New Class |
|---|---|
| `bg-cyber-bg` | `bg-cyber-bg` (value changes from `#0a0e1a` to `#000000`) |
| `bg-cyber-dark` | `bg-cyber-dark` (value changes from `#060911` to `#111111`) |
| `text-slate-100` | `text-[#EEEEEE]` or add as token |
| `text-cyber-orange` | `text-cyber-accent` |
| `text-cyber-orange/50` | `text-[#888888]` |
| `text-cyber-orange/40` | `text-[#888888]/80` |
| `text-cyber-orange/60` | `text-cyber-accent/80` |
| `border-cyber-border` | *(remove)* — use `gap` or `bg` contrast instead |
| `border-cyber-dim` | *(remove)* |
| `border-r border-cyber-border` | *(remove)* |
| `placeholder-cyber-orange/30` | `placeholder-[#888888]/40` |

---

## 5. i18n Changes

- Remove `chat.mode.stub`, `chat.mode.ollama` keys (replaced by model name in status bar)
- Remove `chat.thinking`, `chat.loading` (replaced by cursor `█`)
- Add `status.model: "model:"`, `status.db: "db"` keys for StatusBar

---

## 6. Implementation Order

1. Update `tailwind.config.ts` — change token values, add new ones
2. Create `StatusBar.vue`
3. Update `AppShell.vue` — new layout, StatusBar
4. Update `ChatPanel.vue` — full width, color migration
5. Update `SidebarNav.vue` — bg + color updates
6. Update `TasksView.vue` + `KanbanBoard.vue` — color migration
7. Update `TaskCard.vue` + `TaskCardMenu.vue` — color migration
8. Update locale files
9. Verify build + run tests

---

## 7. Files to Create

- `frontend/src/components/StatusBar.vue`

## 8. Files to Modify

- `frontend/tailwind.config.ts`
- `frontend/src/components/AppShell.vue`
- `frontend/src/components/ChatPanel.vue`
- `frontend/src/components/SidebarNav.vue`
- `frontend/src/components/TasksView.vue`
- `frontend/src/components/KanbanBoard.vue`
- `frontend/src/components/TaskCard.vue`
- `frontend/src/components/TaskCardMenu.vue`
- `frontend/src/locales/vi.json`
- `frontend/src/locales/en.json`
