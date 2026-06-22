# Mintlify-style UI Redesign — Design Spec

**Date:** 2026-06-21
**Status:** Approved (brainstorming)
**Scope:** Frontend (`frontend/`) — full visual + layout redesign of the agent-hub SPA to match the Mintlify docs aesthetic, with working light **and** dark themes.

---

## 1. Goals

- Restructure the app shell into Mintlify's docs layout: sticky **top bar** (brand + global search + theme/lang/health), **grouped left sidebar**, roomy **content column**, and a **route-driven right context panel**.
- Add a Mintlify-style **⌘K command palette** for global navigation + quick actions.
- Ship a real **light + dark** theme system via semantic CSS-variable tokens.
- Keep the **blue** primary accent.
- Re-theme all existing screens/components to the new token system without changing their business logic.

Non-goals: backend changes; new product features; changes to routing targets (the same routes exist, only their presentation/grouping changes); i18n key restructuring (reuse existing keys, add new ones only for new UI).

---

## 2. Theming architecture (semantic tokens + `darkMode: 'class'`)

**Decision:** semantic design tokens as CSS variables, exposed to Tailwind. Toggling a `dark` class on `<html>` reskins the whole app. No per-element `dark:` duplication.

### tailwind.config.ts
- `darkMode: 'class'`.
- `theme.extend.colors` maps semantic names to `rgb(var(--token) / <alpha-value>)` so opacity utilities still work:
  - `background`, `surface` (cards/panels), `elevated` (popovers/menus), `border`, `input`, `ring`, `muted` (muted surface), `muted-foreground`, `foreground`, `primary`, `primary-foreground`, `success`, `warning`, `danger`, and `*-foreground` where needed.
- Keep `fontFamily.sans` = Inter stack, `fontFamily.mono` = JetBrains Mono.
- Radius scale via `borderRadius` (lg = 8px default for controls).
- Retain existing keyframes (`blink`, `dot-pulse`) and width extensions.
- Legacy `cyber-*`/`gh-*` tokens: **removed** (we are doing a full re-theme; no safety net needed since every component is swept).

### main.css
- `:root { … }` light token values; `.dark { … }` dark token values. Tokens stored as space-separated RGB channels (e.g. `--foreground: 17 24 39;`) for the `rgb(var() / alpha)` pattern.
- `html`/`body` use `bg-background text-foreground`.
- Inter + JetBrains Mono `@import` from Google Fonts.
- `.markdown-body` rewritten against tokens (works in both themes); code blocks use `surface`/`border`/mono.
- Scrollbars themed via tokens.

### Token values

| Token | Light (RGB) | Dark (RGB) | Use |
|---|---|---|---|
| `background` | `255 255 255` | `15 17 23` (#0f1117) | page |
| `surface` | `255 255 255` | `22 27 34` (#161b22) | cards, panels, sidebar, top bar |
| `muted` | `249 250 251` (#f9fafb) | `26 32 40` | subtle fills, hover rows, inset |
| `elevated` | `255 255 255` | `30 37 46` | popovers, menus, modals |
| `border` | `229 231 235` (#e5e7eb) | `34 43 54` (#222b36) | dividers |
| `input` | `209 213 219` (#d1d5db) | `48 58 70` | input borders |
| `foreground` | `17 24 39` (#111827) | `230 237 243` (#e6edf3) | primary text |
| `muted-foreground` | `107 114 128` (#6b7280) | `139 148 158` (#8b949e) | secondary/dim text |
| `primary` | `37 99 235` (#2563eb) | `59 130 246` (#3b82f6) | accent, active, primary buttons |
| `primary-foreground` | `255 255 255` | `255 255 255` | text on primary |
| `success` | `22 163 74` | `34 197 94` | connected/success |
| `warning` | `217 119 6` | `245 158 11` | processing/pending |
| `danger` | `220 38 38` | `248 113 113` | errors/delete |
| `ring` | `59 130 246` | `59 130 246` | focus ring |

### Class vocabulary (replaces today's literals)
- Page `bg-background`; cards/panels/headers/sidebar/top bar `bg-surface`; hover/inset `bg-muted`.
- Dividers `border-border`; inputs `border-input`.
- Text `text-foreground` / `text-muted-foreground`.
- Accent `text-primary`, `bg-primary text-primary-foreground`.
- Status `text-success` / `text-warning` / `text-danger`.
- Focus `focus:ring-2 focus:ring-ring focus:border-primary`.
- Radius `rounded-lg` (controls/cards), `rounded-md` (chips/badges), `rounded-xl` (modals).
- Shadows: `shadow-sm` (cards), `shadow-lg` (popovers/menus), `shadow-xl` (modals).

---

## 3. Layout shell

```
┌───────────────────────────────────────────────────────────────────┐
│ TopBar (h-14 sticky):  ⬢ Agent Hub   [ Search… ⌘K ]   ◐  VI/EN  ⚙ │
├──────────────┬───────────────────────────────┬────────────────────┤
│ Sidebar w-64 │ Content column (router-view)  │ Right panel w-72    │
│  WORKSPACE   │  centered, roomy padding       │ route-driven        │
│   Cowork     │                                │  Cowork → Artifacts │
│   Tasks      │                                │   + Sub-agents      │
│   Plans      │                                │  else → hidden      │
│   Agent Out  │                                │                     │
│  KNOWLEDGE   │                                │                     │
│   Notes      │                                │                     │
│   Files      │                                │                     │
│   Memories   │                                │                     │
│  CONFIG      │                                │                     │
│   Providers  │                                │                     │
│   Agents     │                                │                     │
│   Tools      │                                │                     │
│   Connectors │                                │                     │
│   Permissions│                                │                     │
│   Usage      │                                │                     │
├──────────────┴───────────────────────────────┴────────────────────┤
│ StatusBar (h-7): backend ● · DB ● · subagents · clock              │
└───────────────────────────────────────────────────────────────────┘
```

### Components
- **`TopBar.vue` (new):** sticky `h-14`, `bg-surface border-b border-border`. Left: brand mark + "Agent Hub". Center-left: search trigger button (looks like an input, shows `⌘K`) opening the command palette. Right: `ThemeToggle`, VI/EN toggle (moved from StatusBar), settings/health affordance. On mobile: hamburger (toggles sidebar drawer) + compact search icon.
- **`SidebarNav.vue` (restructured):** `w-64 bg-surface border-r border-border`, vertical scroll. Renders **groups** from a new `navGroups` config:
  - `WORKSPACE`: Cowork, Tasks (Schedule), Plans, Agent Output
  - `KNOWLEDGE`: Notes, Files, Memories
  - `CONFIG`: Providers, Agents, Tools, Connectors, Permissions, Usage
  - Group label: `text-xs uppercase tracking-wide text-muted-foreground px-3 pt-4 pb-1`.
  - Item: `rounded-lg px-3 py-1.5 text-sm`; active = `bg-muted text-foreground font-medium` with a `text-primary` left accent bar; idle = `text-muted-foreground hover:bg-muted hover:text-foreground`.
  - The CONFIG items route to `/settings/<tab>` (existing tab routes); `SettingsView` keeps rendering the tab component but **its internal tab strip is removed** (nav now lives in the sidebar). The general settings page becomes the `Settings` entry (or a CONFIG "General" item).
- **`ThemeToggle.vue` (new):** light/dark switch; persists to `localStorage('workspace.theme')`; applies/removes `dark` on `<html>`; respects `prefers-color-scheme` on first load.
- **`CommandPalette.vue` (new):** Headless UI `Dialog` + `Combobox`. Centered, `bg-elevated rounded-xl shadow-xl`. Fuzzy-filter list of: all nav destinations, settings tabs, and quick actions (New session, Toggle theme, Switch language). `⌘K`/`Ctrl+K` opens (global keydown listener in `AppShell`), arrow keys navigate, Enter activates, Esc closes.
- **Right context panel:** `AppShell` renders a route-aware slot. For `cowork`, it hosts the existing `ArtifactsPanel` + `SubagentMonitorPanel`. To avoid a large refactor of Cowork's internal state, **Cowork keeps owning `ArtifactsPanel`/`SubagentMonitorPanel`** and renders them in the right-column region itself; the shell simply reserves no extra width for routes that don't use it. Width `w-72`, collapsible via the existing toggles.
- **`AppShell.vue` (rewritten):** `flex flex-col h-screen`: `TopBar` → `flex flex-1` (`SidebarNav` + `<router-view>` content + optional right region) → `StatusBar`. Mobile: sidebar becomes an overlay drawer toggled from TopBar; `BottomTabBar` retired.
- **`StatusBar.vue`:** kept (system status + clock); VI/EN toggle moves to TopBar; restyled to tokens.
- **`BottomTabBar.vue`:** removed from the shell (replaced by mobile drawer). File kept but unused, or deleted — deletion preferred to avoid dead code.

### Content column
- Each top-level view wraps its body in a centered container (`mx-auto max-w-5xl px-6 py-6`) for the Mintlify reading feel. View headers become section headers inside the column (the fixed `h-[3rem]` per-view header bars are replaced by in-column page titles, since the global TopBar now owns the chrome). Cowork is the exception: it remains a full-height chat workspace (no max-width clamp) because it's an interactive console, not a document.

---

## 4. Typography

- UI: **Inter** (`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`). Headings `font-semibold tracking-tight`.
- Code/terminal/chat input/logs/file paths/model names: **JetBrains Mono**.
- Body `text-sm`/`text-[15px]`, meta `text-xs`.

---

## 5. Responsive

- `≥ xl`: full three-region shell.
- `md–lg`: sidebar collapsible; right panel hidden unless toggled.
- `< md`: TopBar + hamburger → sidebar drawer (overlay, `bg-surface`, backdrop `bg-foreground/40`); content full width; right panel content (artifacts) reachable via the existing toggle as an overlay; command palette via search icon.

---

## 6. Component inventory (re-theme to tokens)

All under `frontend/src/components/` — swap literal `bg-white`/`gray-*`/`blue-*`/etc. to semantic tokens, add dark correctness, bump radius to `rounded-lg` where appropriate:

Shell/nav: `AppShell` (rewrite), `SidebarNav` (restructure), `TopBar` (new), `StatusBar`, `ThemeToggle` (new), `CommandPalette` (new). Retire `BottomTabBar`.

Shared: `BaseModal`, `BaseConfirmModal`, `BaseSelect`, `ModelSelector`, `FormBlock`.

Cowork: `CoworkView`, `cowork/ProjectBar`, `cowork/ChatInputBar`, `cowork/MessageList`, `cowork/MessageItem`, `cowork/markdown.ts`, `ArtifactsPanel`, `SubagentMonitorPanel`, `FileTree`, `ToolApprovalBar`, `SlashMenu`, `PlanBubble`, `SessionModal`, `DirectoryBrowser`, `FilesView`.

Views/settings: `ScheduleTasksView`, `ScheduleTaskDetailView`, `NotesView`, `NoteModal`, `ConnectorsView`, `AgentOutputView`, `PlansView`, `OAuthCallbackPage`, `SettingsView` (drop internal tab strip), `ProvidersView`, `ProviderFormModal`, `AgentsView`, `ToolsView`, `ToolConfigModal`, `ToolPickerModal`, `UsageView`, `MemoryView`, `PermissionView`.

Config/store: `config/navigation.ts` → add `navGroups`; `stores/ui.ts` → add `theme` state + persistence; `i18n` → add keys for search/theme/group labels.

---

## 7. Data flow / state

- **Theme:** `useUiStore` holds `theme: 'light' | 'dark'`. An `applyTheme()` toggles `document.documentElement.classList`. Initialized in `main.ts` (or `App.vue` `onMounted`) from `localStorage` → fallback `matchMedia('(prefers-color-scheme: dark)')`. `ThemeToggle` and the palette mutate it.
- **Command palette open state:** local to `AppShell` (ref) + global keydown; `CommandPalette` receives `v-model:open`; on activate it `router.push(...)` or runs an action callback.
- **Sidebar drawer (mobile):** existing `ui.sidebarOpen` reused.
- No new API calls.

---

## 8. Error handling

- Theme init guards against SSR/no-`matchMedia` (none here, but guard `window`).
- Command palette: empty query shows all destinations; no-match shows a muted "No results" row.
- All existing try/catch + `[error]` chat behavior preserved.

---

## 9. Testing

- `ThemeToggle`: toggles class + persists (Vitest, jsdom).
- `CommandPalette`: filters destinations, Enter navigates (mount + stub router).
- `SidebarNav`: renders groups, marks active item.
- Existing component specs continue to pass after token swap (class-only changes).
- Manual: `vue-tsc` + `vite build`; visually verify light/dark on each route.

---

## 10. Rollout / sequencing (for the plan)

1. Token foundation: `tailwind.config.ts` (`darkMode:'class'` + semantic colors), `main.css` (`:root`/`.dark` tokens, Inter, markdown), `ui` store theme + init.
2. Shell: `AppShell` rewrite, `TopBar`, `ThemeToggle`, grouped `SidebarNav` + `navGroups`, retire `BottomTabBar`, `StatusBar` restyle.
3. `CommandPalette` + ⌘K wiring.
4. Shared primitives → tokens (`BaseModal`/`BaseSelect`/etc.).
5. Cowork cluster → tokens + right-column placement.
6. Remaining views + settings (drop tab strip) → tokens.
7. Markdown dark pass, polish (radius/shadow/spacing), verify light+dark, `type-check` + `build`.
8. Update `AGENTS.md` docs (root, frontend, components) to the new token system + layout.

---

## 11. Open assumptions (made explicit)

- Settings tabs are promoted to a CONFIG sidebar group; `SettingsView` keeps rendering the tab component for the active route but no longer shows its own tab strip. (Approved.)
- Right context panel is route-driven, visible on Cowork only. (Approved.)
- `BottomTabBar` is retired in favor of a mobile sidebar drawer.
- Inter is loaded from Google Fonts (consistent with current JetBrains Mono loading); offline/self-host is out of scope.
