# Mintlify-style UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the agent-hub frontend into Mintlify's docs layout (top bar + ⌘K command palette, grouped sidebar, content column, route-driven right panel) with a semantic CSS-variable token system supporting working light and dark themes.

**Architecture:** Tailwind `darkMode: 'class'` + semantic color tokens defined as CSS variables in `:root`/`.dark`, exposed to Tailwind via `rgb(var(--token) / <alpha-value>)`. Components use semantic utility classes (`bg-surface`, `text-foreground`, `border-border`, `text-primary`…). A new `AppShell` hosts `TopBar`, grouped `SidebarNav`, the routed content column, and a route-driven right region. `CommandPalette` (Headless UI `Dialog` + `Combobox`) provides ⌘K navigation. Theme state lives in the `ui` Pinia store and toggles a `dark` class on `<html>`.

**Tech Stack:** Vue 3 (`<script setup>`), Vite, TailwindCSS 3 (`darkMode: 'class'`), `@headlessui/vue`, Pinia, vue-router, vue-i18n v9, `vue-icons-plus/hi`, Vitest + `@vue/test-utils` (jsdom).

## Global Constraints

- **Fonts:** UI chrome uses `font-sans` = Inter stack; `font-mono` = JetBrains Mono only for code, terminal/chat input, logs, file paths, model names.
- **Radius:** `rounded-lg` (8px) for controls/cards/inputs; `rounded-md` for chips/badges; `rounded-xl` for modals.
- **Shadows:** `shadow-sm` cards, `shadow-lg` popovers/menus, `shadow-xl` modals. No gradients.
- **Accent:** blue primary (`#2563eb` light / `#3b82f6` dark) via the `primary` token.
- **No raw hex in components** — only semantic token utilities (`bg-*`, `text-*`, `border-*`, `ring-*`).
- **No `cyber-*` / `gh-*` tokens** anywhere in components (removed entirely).
- **i18n:** all user-facing strings via `t('key')`; add new keys to both `vi.json` and `en.json`.
- **TypeScript strict:** no `any`. `<script setup lang="ts">` only.
- **Security:** every `v-html` stays wrapped in `DOMPurify.sanitize()` (unchanged).
- **Commits:** Conventional Commits, English, no `Co-Authored-By` trailer (per project AGENTS.md).
- **Verification per task:** `npm --prefix frontend run type-check` and `npm --prefix frontend run build` must pass; Vitest where specified.

## Token Mapping (canonical — apply in every re-theme task)

When re-theming an existing component, replace the literal Tailwind classes with semantic tokens per this table. Opacity suffixes are preserved (e.g. `bg-primary/10`).

| Old literal | New semantic | Notes |
|---|---|---|
| `bg-white` | `bg-surface` | panels, cards, headers, sidebar, top bar, modals |
| `bg-gray-50` (page root) | `bg-background` | a view's outermost wrapper |
| `bg-gray-50` / `bg-gray-100` (hover/inset/code) | `bg-muted` | hover rows, code/terminal panes, inset fills |
| `border-gray-200` | `border-border` | dividers |
| `border-gray-300` | `border-input` | inputs, selects, secondary buttons |
| `text-gray-900` / `text-gray-800` | `text-foreground` | primary/code text |
| `text-gray-600` / `text-gray-500` / `text-gray-400` | `text-muted-foreground` | secondary/muted/meta |
| `text-blue-600` | `text-primary` | links, active, accent |
| `bg-blue-600` | `bg-primary` | (pair with `text-primary-foreground`) |
| `text-white` (on blue) | `text-primary-foreground` | primary button label |
| `hover:bg-blue-700` | `hover:bg-primary/90` | primary button hover |
| `bg-blue-50` / `bg-blue-600/10` | `bg-primary/10` | active/hover tint |
| `border-blue-600/30` / `border-blue-200` | `border-primary/30` | accent outline |
| `hover:bg-blue-50` | `hover:bg-primary/10` | accent ghost hover |
| `text-green-600` / `text-green-700` / `bg-green-500` | `text-success` / `bg-success` | success/connected |
| `text-amber-600` / `text-amber-700` | `text-warning` | processing/pending |
| `text-red-600` | `text-danger` | error/delete |
| `border-red-300` / `hover:bg-red-50` | `border-danger/40` / `hover:bg-danger/10` | delete button |
| `bg-red-600` / `hover:bg-red-700` | `bg-danger` / `hover:bg-danger/90` | solid danger |
| `focus:border-blue-500 focus:ring-blue-500` | `focus:border-primary focus:ring-ring` | input focus |
| `rounded-md` (control/card/input) | `rounded-lg` | bump radius |
| `bg-gray-900/40` (overlay) | `bg-foreground/40` | modal/drawer backdrops |
| `placeholder-gray-400` | `placeholder-muted-foreground` | input placeholders |

Standard control recipes (use verbatim):
- **Primary button:** `inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 disabled:opacity-50`
- **Secondary button:** `inline-flex items-center gap-1.5 rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-foreground transition-colors duration-150 hover:bg-muted`
- **Ghost/accent button:** `rounded-lg border border-primary/30 px-2.5 py-1 text-sm text-primary transition-colors duration-150 hover:bg-primary/10`
- **Delete button:** `rounded-lg border border-danger/40 px-2.5 py-1 text-sm text-danger transition-colors duration-150 hover:bg-danger/10`
- **Input/select/textarea:** `w-full rounded-lg border border-input bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring`
- **Card:** `flex flex-col rounded-lg border border-border bg-surface p-3 transition-shadow hover:shadow-sm`

---

## Task 1: Token foundation — Tailwind config + global CSS

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/assets/main.css`

**Interfaces:**
- Produces: semantic Tailwind color utilities `background, surface, muted, elevated, border, input, foreground, muted-foreground, primary, primary-foreground, success, warning, danger, ring`; `darkMode: 'class'`; `font-sans` = Inter, `font-mono` = JetBrains Mono. Consumed by all later tasks.

- [ ] **Step 1: Rewrite `frontend/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

function token(name: string) {
  return `rgb(var(--${name}) / <alpha-value>)`
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        surface: token('surface'),
        muted: token('muted'),
        elevated: token('elevated'),
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        foreground: token('foreground'),
        'muted-foreground': token('muted-foreground'),
        primary: token('primary'),
        'primary-foreground': token('primary-foreground'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular', '"Courier New"', 'monospace'],
      },
      keyframes: {
        blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        'dot-pulse': { '0%, 100%': { opacity: '0.2' }, '50%': { opacity: '1' } },
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        'dot-pulse': 'dot-pulse 1.2s ease-in-out infinite',
      },
      width: { '100': '25rem', '120': '30rem' },
      maxWidth: { '60rem': '60rem' },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 2: Rewrite `frontend/src/assets/main.css`** — token blocks + Inter import + tokenized markdown

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 255 255 255;
  --surface: 255 255 255;
  --muted: 249 250 251;
  --elevated: 255 255 255;
  --border: 229 231 235;
  --input: 209 213 219;
  --ring: 59 130 246;
  --foreground: 17 24 39;
  --muted-foreground: 107 114 128;
  --primary: 37 99 235;
  --primary-foreground: 255 255 255;
  --success: 22 163 74;
  --warning: 217 119 6;
  --danger: 220 38 38;
}

.dark {
  --background: 15 17 23;
  --surface: 22 27 34;
  --muted: 26 32 40;
  --elevated: 30 37 46;
  --border: 34 43 54;
  --input: 48 58 70;
  --ring: 59 130 246;
  --foreground: 230 237 243;
  --muted-foreground: 139 148 158;
  --primary: 59 130 246;
  --primary-foreground: 255 255 255;
  --success: 34 197 94;
  --warning: 245 158 11;
  --danger: 248 113 113;
}

* { box-sizing: border-box; }

html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  background-color: rgb(var(--background));
  color: rgb(var(--foreground));
  font-size: 16px;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 0.625rem; height: 0.625rem; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgb(var(--border));
  border: 2px solid rgb(var(--background));
  border-radius: 0.375rem;
}
::-webkit-scrollbar-thumb:hover { background: rgb(var(--muted-foreground)); }

.markdown-body { color: rgb(var(--foreground)); font-size: 0.9375rem; }
.markdown-body h1, .markdown-body h2, .markdown-body h3,
.markdown-body h4, .markdown-body h5, .markdown-body h6 {
  color: rgb(var(--foreground)); font-weight: 600; margin: 1.25rem 0 0.75rem; line-height: 1.25;
}
.markdown-body h1 { font-size: 1.5rem; padding-bottom: 0.3em; border-bottom: 1px solid rgb(var(--border)); }
.markdown-body h2 { font-size: 1.25rem; padding-bottom: 0.3em; border-bottom: 1px solid rgb(var(--border)); }
.markdown-body a { color: rgb(var(--primary)); text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.markdown-body p { margin: 0 0 0.75rem; line-height: 1.6; }
.markdown-body code {
  background: rgb(var(--muted)); color: rgb(var(--foreground));
  padding: 0.2em 0.4em; font-size: 0.85em;
  font-family: 'JetBrains Mono', ui-monospace, monospace; border-radius: 0.375rem;
}
.markdown-body pre {
  background: rgb(var(--muted)); border: 1px solid rgb(var(--border));
  border-radius: 0.5rem; padding: 1rem; margin: 0.75rem 0; overflow-x: auto;
}
.markdown-body pre code { background: none; padding: 0; font-size: 0.85em; line-height: 1.6; }
.markdown-body table { display: block; width: max-content; max-width: 100%; border-collapse: collapse; margin: 0.75rem 0; overflow: auto; }
.markdown-body th, .markdown-body td { border: 1px solid rgb(var(--border)); padding: 0.375rem 0.8125rem; text-align: left; }
.markdown-body th { background: rgb(var(--muted)); font-weight: 600; }
.markdown-body tr:nth-child(even) { background: rgb(var(--muted)); }
.markdown-body blockquote { border-left: 0.25rem solid rgb(var(--border)); margin: 0.75rem 0; padding: 0 1rem; color: rgb(var(--muted-foreground)); }
.markdown-body ul, .markdown-body ol { margin: 0.5rem 0; padding-left: 1.5rem; }
.markdown-body ul { list-style: disc; }
.markdown-body ol { list-style: decimal; }
.markdown-body li { margin: 0.1875rem 0; line-height: 1.6; }
.markdown-body hr { border: none; border-top: 1px solid rgb(var(--border)); margin: 1.25rem 0; }
.markdown-body img { max-width: 100%; border-radius: 0.5rem; }
.markdown-body .citation { color: rgb(var(--primary)); font-size: 0.75rem; opacity: 0.85; white-space: nowrap; }
```

- [ ] **Step 3: Verify build compiles**

Run: `npm --prefix frontend run build`
Expected: exits 0 (existing components still reference old literals — that's fine for now; this task only proves the token config + CSS compile).

- [ ] **Step 4: Commit**

```bash
git add frontend/tailwind.config.ts frontend/src/assets/main.css
git commit -m "feat(ui): add semantic light/dark token system and Inter font"
```

---

## Task 2: Theme state + ThemeToggle

**Files:**
- Modify: `frontend/src/stores/ui.ts`
- Create: `frontend/src/components/ThemeToggle.vue`
- Create: `frontend/src/components/ThemeToggle.spec.ts`
- Modify: `frontend/src/main.ts`

**Interfaces:**
- Produces: `useUiStore().theme: Ref<'light'|'dark'>`, `useUiStore().toggleTheme()`, `useUiStore().initTheme()`. `ThemeToggle.vue` (no props/emits) — a button calling `toggleTheme()`.

- [ ] **Step 1: Write failing store test** — `frontend/src/stores/ui.spec.ts`

```ts
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { useUiStore } from './ui'

describe('ui store theme', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('toggleTheme flips theme and toggles dark class + persists', () => {
    const ui = useUiStore()
    expect(ui.theme).toBe('light')
    ui.toggleTheme()
    expect(ui.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('workspace.theme')).toBe('dark')
    ui.toggleTheme()
    expect(ui.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('initTheme reads persisted value', () => {
    localStorage.setItem('workspace.theme', 'dark')
    const ui = useUiStore()
    ui.initTheme()
    expect(ui.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test -- ui.spec`
Expected: FAIL (`toggleTheme`/`initTheme`/`theme` undefined).

- [ ] **Step 3: Extend `frontend/src/stores/ui.ts`**

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getHealth } from '../api/health'

type Theme = 'light' | 'dark'

export const useUiStore = defineStore('ui', () => {
  const dbConnected = ref(true)
  const activeSubagents = ref(0)
  const sidebarOpen = ref(false)
  const theme = ref<Theme>('light')

  function applyTheme(value: Theme) {
    theme.value = value
    document.documentElement.classList.toggle('dark', value === 'dark')
    localStorage.setItem('workspace.theme', value)
  }

  function toggleTheme() {
    applyTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function initTheme() {
    const stored = localStorage.getItem('workspace.theme') as Theme | null
    const prefersDark = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    applyTheme(stored ?? (prefersDark ? 'dark' : 'light'))
  }

  async function refreshHealth() {
    try {
      const h = await getHealth()
      dbConnected.value = h.db === 'connected'
    } catch {
      dbConnected.value = false
    }
  }

  return { dbConnected, activeSubagents, sidebarOpen, theme, toggleTheme, initTheme, refreshHealth }
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test -- ui.spec`
Expected: PASS (2 tests).

- [ ] **Step 5: Create `frontend/src/components/ThemeToggle.vue`**

```vue
<template>
  <button
    type="button"
    @click="ui.toggleTheme()"
    :title="ui.theme === 'dark' ? t('topbar.theme.light') : t('topbar.theme.dark')"
    class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
  >
    <HiSun v-if="ui.theme === 'dark'" class="h-4 w-4" />
    <HiMoon v-else class="h-4 w-4" />
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { HiSun, HiMoon } from 'vue-icons-plus/hi'
import { useUiStore } from '../stores/ui'

const { t } = useI18n()
const ui = useUiStore()
</script>
```

- [ ] **Step 6: Write `frontend/src/components/ThemeToggle.spec.ts`**

```ts
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
import ThemeToggle from './ThemeToggle.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

describe('ThemeToggle', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); document.documentElement.classList.remove('dark') })

  it('toggles theme on click', async () => {
    const wrapper = mount(ThemeToggle, { global: { plugins: [i18n] } })
    await wrapper.get('button').trigger('click')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
```

- [ ] **Step 7: Initialize theme at startup — `frontend/src/main.ts`**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/main.css'
import App from './App.vue'
import { i18n } from './i18n'
import { router } from './router'
import { useUiStore } from './stores/ui'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(i18n)
useUiStore(pinia).initTheme()
app.mount('#app')
```

- [ ] **Step 8: Run tests + type-check**

Run: `npm --prefix frontend run test -- ui.spec ThemeToggle.spec` then `npm --prefix frontend run type-check`
Expected: PASS; type-check exits 0.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/stores/ui.ts frontend/src/stores/ui.spec.ts frontend/src/components/ThemeToggle.vue frontend/src/components/ThemeToggle.spec.ts frontend/src/main.ts
git commit -m "feat(ui): add theme store state, init, and ThemeToggle"
```

---

## Task 3: Grouped navigation config + i18n keys

**Files:**
- Modify: `frontend/src/config/navigation.ts`
- Create: `frontend/src/config/navigation.spec.ts`
- Modify: `frontend/src/locales/vi.json`, `frontend/src/locales/en.json`

**Interfaces:**
- Produces: `navGroups: NavGroup[]` where `NavGroup = { labelKey: string; items: NavItem[] }`. Settings tabs become `NavItem`s pointing at `/settings/<tab>`. Consumed by `SidebarNav` (Task 4) and `CommandPalette` (Task 6). `sidebarItems`/`bottomItems` retained for back-compat but no longer used by the shell.

- [ ] **Step 1: Write failing config test** — `frontend/src/config/navigation.spec.ts`

```ts
import { describe, it, expect } from 'vitest'
import { navGroups } from './navigation'

describe('navGroups', () => {
  it('exposes three groups with items', () => {
    expect(navGroups.map(g => g.labelKey)).toEqual(['nav.group.workspace', 'nav.group.knowledge', 'nav.group.config'])
    const all = navGroups.flatMap(g => g.items.map(i => i.name))
    expect(all).toContain('cowork')
    expect(all).toContain('providers')
    expect(navGroups[2].items.every(i => i.path.startsWith('/settings/'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test -- navigation.spec`
Expected: FAIL (`navGroups` not exported).

- [ ] **Step 3: Extend `frontend/src/config/navigation.ts`**

```ts
import type { Component } from 'vue'
import {
  HiCode, HiClipboardList, HiDocumentText, HiCog, HiDownload,
  HiClipboardCheck, HiFolder, HiDatabase, HiServer, HiUserGroup,
  HiAdjustments, HiShieldCheck, HiChartBar,
} from 'vue-icons-plus/hi'

export interface NavItem {
  name: string
  path: string
  labelKey: string
  icon: Component | string
}

export interface NavGroup {
  labelKey: string
  items: NavItem[]
}

export const NAV: Record<string, NavItem> = {
  cowork:          { name: 'cowork',        path: '/cowork',        labelKey: 'nav.cowork',      icon: HiCode },
  tasks:           { name: 'tasks',         path: '/tasks',         labelKey: 'nav.tasks',       icon: HiClipboardList },
  plans:           { name: 'plans',         path: '/plans',         labelKey: 'nav.plans',       icon: HiClipboardCheck },
  'agent-output':  { name: 'agent-output',  path: '/agent-output',  labelKey: 'nav.agentOutput', icon: HiDownload },
  notes:           { name: 'notes',         path: '/notes',         labelKey: 'nav.notes',       icon: HiDocumentText },
  files:           { name: 'files',         path: '/settings/general', labelKey: 'nav.files',    icon: HiFolder },
  settings:        { name: 'settings',      path: '/settings',      labelKey: 'nav.settings',    icon: HiCog },
}

export interface NavGroupDef { labelKey: string; items: NavItem[] }

export const navGroups: NavGroup[] = [
  {
    labelKey: 'nav.group.workspace',
    items: [
      { name: 'cowork',       path: '/cowork',       labelKey: 'nav.cowork',      icon: HiCode },
      { name: 'tasks',        path: '/tasks',        labelKey: 'nav.tasks',       icon: HiClipboardList },
      { name: 'plans',        path: '/plans',        labelKey: 'nav.plans',       icon: HiClipboardCheck },
      { name: 'agent-output', path: '/agent-output', labelKey: 'nav.agentOutput', icon: HiDownload },
    ],
  },
  {
    labelKey: 'nav.group.knowledge',
    items: [
      { name: 'notes',    path: '/notes',             labelKey: 'nav.notes',    icon: HiDocumentText },
      { name: 'memories', path: '/settings/memories', labelKey: 'memory.title', icon: HiDatabase },
    ],
  },
  {
    labelKey: 'nav.group.config',
    items: [
      { name: 'providers',   path: '/settings/providers',   labelKey: 'providers.header',   icon: HiServer },
      { name: 'agents',      path: '/settings/agents',      labelKey: 'agents.header',      icon: HiUserGroup },
      { name: 'tools',       path: '/settings/tools',       labelKey: 'tools.header',       icon: HiAdjustments },
      { name: 'connectors',  path: '/connectors',           labelKey: 'nav.connectors',     icon: HiCog },
      { name: 'permissions', path: '/settings/permissions', labelKey: 'permissions.header', icon: HiShieldCheck },
      { name: 'usage',       path: '/settings/usage',       labelKey: 'usage.header',       icon: HiChartBar },
      { name: 'general',     path: '/settings/general',     labelKey: 'nav.settings',       icon: HiCog },
    ],
  },
]

export function pickNav(names: string[]): NavItem[] {
  return names.map(n => NAV[n])
}

export const sidebarItems = pickNav(['cowork', 'tasks', 'notes', 'agent-output'])
export const settingsNav = NAV.settings
export const bottomItems = pickNav(['cowork', 'tasks', 'agent-output', 'plans', 'notes', 'settings'])
```

> Note: verify each imported icon name exists in `vue-icons-plus/hi`; if any is missing, substitute the closest available Hi icon (the set is large; `HiClipboardCheck`, `HiDatabase`, `HiServer`, `HiUserGroup`, `HiAdjustments`, `HiShieldCheck`, `HiChartBar`, `HiFolder` are all standard Heroicons v1 outline names). Build (Step 6) will catch a bad import.

- [ ] **Step 4: Add i18n keys to `frontend/src/locales/vi.json`** (insert under the existing `nav` object; add a `topbar` block)

```json
"nav": {
  "group": { "workspace": "Không gian", "knowledge": "Kiến thức", "config": "Cấu hình" }
},
"topbar": {
  "search": "Tìm kiếm…",
  "theme": { "dark": "Chế độ tối", "light": "Chế độ sáng" },
  "menu": "Menu"
},
"palette": {
  "placeholder": "Đi tới hoặc tìm lệnh…",
  "empty": "Không có kết quả",
  "section": { "navigate": "Điều hướng", "actions": "Hành động" },
  "action": { "newSession": "Phiên mới", "toggleTheme": "Đổi giao diện", "toggleLang": "Đổi ngôn ngữ" }
}
```

> Merge the `nav.group` keys into the existing `nav` object rather than duplicating the `nav` key. Keep existing `nav.*` entries intact.

- [ ] **Step 5: Add the same keys (English) to `frontend/src/locales/en.json`**

```json
"nav": {
  "group": { "workspace": "Workspace", "knowledge": "Knowledge", "config": "Config" }
},
"topbar": {
  "search": "Search…",
  "theme": { "dark": "Dark mode", "light": "Light mode" },
  "menu": "Menu"
},
"palette": {
  "placeholder": "Go to or search a command…",
  "empty": "No results",
  "section": { "navigate": "Navigate", "actions": "Actions" },
  "action": { "newSession": "New session", "toggleTheme": "Toggle theme", "toggleLang": "Toggle language" }
}
```

- [ ] **Step 6: Run test, type-check, build**

Run: `npm --prefix frontend run test -- navigation.spec` then `npm --prefix frontend run type-check` then `npm --prefix frontend run build`
Expected: PASS; type-check 0; build 0 (confirms all icon imports resolve).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/config/navigation.ts frontend/src/config/navigation.spec.ts frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat(ui): add grouped nav config and topbar/palette i18n keys"
```

---

## Task 4: Grouped SidebarNav

**Files:**
- Modify: `frontend/src/components/SidebarNav.vue`

**Interfaces:**
- Consumes: `navGroups` from `config/navigation.ts`; `useRoute()`.
- Produces: `<SidebarNav>` (no props) rendering grouped nav with active highlighting; active item determined by matching `route.path` against the item's `path` (settings items use `/settings/<tab>` match).

- [ ] **Step 1: Rewrite `frontend/src/components/SidebarNav.vue`**

```vue
<template>
  <nav class="flex w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface px-2 py-3">
    <div v-for="group in navGroups" :key="group.labelKey" class="mb-1">
      <div class="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {{ t(group.labelKey) }}
      </div>
      <RouterLink
        v-for="item in group.items"
        :key="item.name"
        :to="item.path"
        :class="[
          'relative flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 transition-colors duration-150',
          isActive(item)
            ? 'bg-muted font-medium text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        ]"
      >
        <span v-if="isActive(item)" class="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary"></span>
        <span v-if="typeof item.icon === 'string'" class="flex h-4 w-4 shrink-0 items-center justify-center text-sm">{{ item.icon }}</span>
        <component v-else :is="item.icon" class="h-4 w-4 shrink-0" :class="isActive(item) ? 'text-primary' : 'text-muted-foreground'" />
        <span class="truncate text-sm">{{ t(item.labelKey) }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { navGroups, type NavItem } from '../config/navigation'

const { t } = useI18n()
const route = useRoute()

function isActive(item: NavItem): boolean {
  if (item.path.startsWith('/settings/')) return route.path === item.path
  return route.path === item.path || route.path.startsWith(item.path + '/')
}
</script>
```

- [ ] **Step 2: Type-check + build**

Run: `npm --prefix frontend run type-check` then `npm --prefix frontend run build`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SidebarNav.vue
git commit -m "feat(ui): restructure sidebar into grouped Mintlify-style nav"
```

---

## Task 5: TopBar + StatusBar restyle

**Files:**
- Create: `frontend/src/components/TopBar.vue`
- Modify: `frontend/src/components/StatusBar.vue`

**Interfaces:**
- Produces: `<TopBar>` with props `none`, emits `open-search`, `toggle-sidebar`. Hosts brand, a search-trigger button, `ThemeToggle`, VI/EN toggle, settings link. Consumed by `AppShell` (Task 7).
- `StatusBar` keeps props `dbConnected?`, `activeSubagents?`; VI/EN button removed (moved to TopBar); re-themed to tokens.

- [ ] **Step 1: Create `frontend/src/components/TopBar.vue`**

```vue
<template>
  <header class="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
    <button
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground xl:hidden"
      :title="t('topbar.menu')"
      @click="emit('toggle-sidebar')"
    >
      <HiMenu class="h-5 w-5" />
    </button>

    <RouterLink to="/cowork" class="flex items-center gap-2 shrink-0">
      <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">A</span>
      <span class="hidden text-sm font-semibold text-foreground sm:block">Agent Hub</span>
    </RouterLink>

    <button
      type="button"
      class="ml-2 flex h-9 max-w-md flex-1 items-center gap-2 rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40"
      @click="emit('open-search')"
    >
      <HiSearch class="h-4 w-4 shrink-0" />
      <span class="truncate">{{ t('topbar.search') }}</span>
      <kbd class="ml-auto hidden rounded border border-border px-1.5 py-0.5 font-mono text-xs sm:block">⌘K</kbd>
    </button>

    <div class="ml-auto flex items-center gap-1">
      <ThemeToggle />
      <button
        type="button"
        class="flex h-8 items-center rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        @click="toggleLang"
      >{{ t('nav.lang') }}</button>
      <RouterLink
        to="/settings/general"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :title="t('nav.settings')"
      >
        <HiCog class="h-4 w-4" />
      </RouterLink>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { HiMenu, HiSearch, HiCog } from 'vue-icons-plus/hi'
import ThemeToggle from './ThemeToggle.vue'
import type { Locale } from '../i18n'

const { t, locale } = useI18n()

const emit = defineEmits<{ 'open-search': []; 'toggle-sidebar': [] }>()

function toggleLang() {
  const next: Locale = locale.value === 'vi' ? 'en' : 'vi'
  locale.value = next
  localStorage.setItem('workspace.lang', next)
}
</script>
```

- [ ] **Step 2: Re-theme `frontend/src/components/StatusBar.vue`** — replace the template block; remove the VI/EN button; keep script except drop the `toggleLang`/`locale` usage

Template:
```vue
<template>
  <div class="flex h-[1.75rem] shrink-0 items-center justify-between border-t border-border bg-surface px-3">
    <div class="flex items-center gap-3">
      <span class="flex items-center gap-1 text-xs" :class="backendOnline ? 'text-success' : 'text-muted-foreground'">
        {{ backendOnline ? '●' : '○' }} {{ t('status.backend') }}
      </span>
      <span class="flex items-center gap-1 text-xs" :class="dbConnected ? 'text-success' : 'text-muted-foreground'">
        [{{ dbConnected ? '✓' : '✗' }}] {{ t('status.db') }}
      </span>
      <span v-if="activeSubagents && activeSubagents > 0" class="flex items-center gap-1 text-xs text-primary">
        ● {{ activeSubagents }} {{ t('status.subagents') }}
      </span>
    </div>
    <span class="font-mono text-xs text-muted-foreground">{{ time }}</span>
  </div>
</template>
```

Script: remove `toggleLang` and `locale` from `useI18n()` (keep `t`), and delete the function. Keep `backendOnline`, `time`, timers, `getHealth`, and the `defineProps`.

- [ ] **Step 3: Type-check + build**

Run: `npm --prefix frontend run type-check` then `npm --prefix frontend run build`
Expected: both 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TopBar.vue frontend/src/components/StatusBar.vue
git commit -m "feat(ui): add Mintlify-style TopBar and restyle StatusBar"
```

---

## Task 6: CommandPalette (⌘K)

**Files:**
- Create: `frontend/src/components/CommandPalette.vue`
- Create: `frontend/src/components/CommandPalette.spec.ts`

**Interfaces:**
- Consumes: `navGroups`; `useRouter()`; `useUiStore()`.
- Produces: `<CommandPalette v-model:open="…">` (`open: boolean`, emit `update:open`). On selecting a destination, `router.push(path)` then closes; actions run callbacks. Filtering: case-insensitive substring over translated labels.

- [ ] **Step 1: Create `frontend/src/components/CommandPalette.vue`**

```vue
<template>
  <TransitionRoot :show="open" as="template" @after-leave="query = ''">
    <Dialog as="div" class="relative z-[60]" @close="close">
      <TransitionChild as="template"
        enter="duration-150 ease-out" enter-from="opacity-0" enter-to="opacity-100"
        leave="duration-100 ease-in" leave-from="opacity-100" leave-to="opacity-0">
        <div class="fixed inset-0 bg-foreground/40" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto p-4 pt-[15vh]">
        <TransitionChild as="template"
          enter="duration-150 ease-out" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100"
          leave="duration-100 ease-in" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95">
          <DialogPanel class="mx-auto max-w-xl overflow-hidden rounded-xl border border-border bg-elevated shadow-xl">
            <Combobox @update:model-value="onSelect">
              <div class="flex items-center gap-2 border-b border-border px-4">
                <HiSearch class="h-4 w-4 shrink-0 text-muted-foreground" />
                <ComboboxInput
                  class="w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder-muted-foreground"
                  :placeholder="t('palette.placeholder')"
                  autocomplete="off"
                  @change="query = $event.target.value"
                />
              </div>
              <ComboboxOptions static class="max-h-80 overflow-y-auto py-2">
                <div v-if="filteredNav.length === 0 && filteredActions.length === 0" class="px-4 py-6 text-center text-sm text-muted-foreground">
                  {{ t('palette.empty') }}
                </div>
                <template v-if="filteredNav.length">
                  <div class="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ t('palette.section.navigate') }}</div>
                  <ComboboxOption v-for="item in filteredNav" :key="item.key" :value="item" v-slot="{ active }" as="template">
                    <li :class="['mx-2 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm', active ? 'bg-primary/10 text-primary' : 'text-foreground']">
                      <component :is="item.icon" v-if="item.icon && typeof item.icon !== 'string'" class="h-4 w-4 shrink-0" />
                      <span class="truncate">{{ item.label }}</span>
                    </li>
                  </ComboboxOption>
                </template>
                <template v-if="filteredActions.length">
                  <div class="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ t('palette.section.actions') }}</div>
                  <ComboboxOption v-for="item in filteredActions" :key="item.key" :value="item" v-slot="{ active }" as="template">
                    <li :class="['mx-2 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm', active ? 'bg-primary/10 text-primary' : 'text-foreground']">
                      <span class="truncate">{{ item.label }}</span>
                    </li>
                  </ComboboxOption>
                </template>
              </ComboboxOptions>
            </Combobox>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Dialog, DialogPanel, TransitionRoot, TransitionChild,
  Combobox, ComboboxInput, ComboboxOptions, ComboboxOption,
} from '@headlessui/vue'
import { HiSearch } from 'vue-icons-plus/hi'
import type { Component } from 'vue'
import { navGroups } from '../config/navigation'
import { useUiStore } from '../stores/ui'

interface PaletteEntry {
  key: string
  label: string
  icon?: Component | string
  run: () => void
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t, locale } = useI18n()
const router = useRouter()
const ui = useUiStore()
const query = ref('')

function close() { emit('update:open', false) }

const navEntries = computed<PaletteEntry[]>(() =>
  navGroups.flatMap(g => g.items).map(item => ({
    key: 'nav:' + item.name,
    label: t(item.labelKey),
    icon: item.icon,
    run: () => router.push(item.path),
  })),
)

const actionEntries = computed<PaletteEntry[]>(() => [
  { key: 'act:theme', label: t('palette.action.toggleTheme'), run: () => ui.toggleTheme() },
  { key: 'act:lang', label: t('palette.action.toggleLang'), run: () => {
      const next = locale.value === 'vi' ? 'en' : 'vi'
      locale.value = next
      localStorage.setItem('workspace.lang', next)
    } },
])

function match(label: string): boolean {
  return label.toLowerCase().includes(query.value.trim().toLowerCase())
}

const filteredNav = computed(() => navEntries.value.filter(e => match(e.label)))
const filteredActions = computed(() => actionEntries.value.filter(e => match(e.label)))

function onSelect(entry: PaletteEntry | null) {
  if (!entry) return
  entry.run()
  close()
}
</script>
```

- [ ] **Step 2: Write `frontend/src/components/CommandPalette.spec.ts`**

```ts
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import CommandPalette from './CommandPalette.vue'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const messages = { en: { nav: { cowork: 'Cowork', tasks: 'Tasks', notes: 'Notes', plans: 'Plans', agentOutput: 'Agent Output', connectors: 'Connectors', settings: 'Settings', lang: 'EN' },
  'memory': { title: 'Memories' }, providers: { header: 'Providers' }, agents: { header: 'Agents' }, tools: { header: 'Tools' },
  permissions: { header: 'Permissions' }, usage: { header: 'Usage' },
  palette: { placeholder: 'Go', empty: 'No results', section: { navigate: 'Navigate', actions: 'Actions' }, action: { toggleTheme: 'Toggle theme', toggleLang: 'Toggle language' } } } }
const i18n = createI18n({ legacy: false, locale: 'en', messages })

describe('CommandPalette', () => {
  beforeEach(() => { setActivePinia(createPinia()); push.mockClear() })

  it('filters navigation entries by query', async () => {
    const wrapper = mount(CommandPalette, { props: { open: true }, global: { plugins: [i18n] } })
    await wrapper.get('input').setValue('cowork')
    expect(wrapper.text()).toContain('Cowork')
    expect(wrapper.text()).not.toContain('Providers')
  })
})
```

- [ ] **Step 3: Run test, verify pass**

Run: `npm --prefix frontend run test -- CommandPalette.spec`
Expected: PASS (Combobox renders options with `static`; filter hides non-matches).
If the headless `Combobox` requires a selected context that breaks jsdom, fall back to asserting `filteredNav` via `wrapper.vm` — but prefer the DOM assertion.

- [ ] **Step 4: Type-check + build**

Run: `npm --prefix frontend run type-check` then `npm --prefix frontend run build`
Expected: both 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CommandPalette.vue frontend/src/components/CommandPalette.spec.ts
git commit -m "feat(ui): add Cmd-K command palette for navigation and actions"
```

---

## Task 7: AppShell rewrite (new shell + ⌘K wiring + mobile drawer)

**Files:**
- Modify: `frontend/src/components/AppShell.vue`
- Delete: `frontend/src/components/BottomTabBar.vue`

**Interfaces:**
- Consumes: `TopBar`, `SidebarNav`, `CommandPalette`, `StatusBar`, `useUiStore()`.
- Produces: the application shell. Holds `paletteOpen` ref; global `keydown` listener opens palette on `Ctrl/Cmd+K`. Mobile sidebar via `ui.sidebarOpen` overlay drawer.

- [ ] **Step 1: Rewrite `frontend/src/components/AppShell.vue`**

```vue
<template>
  <div class="flex h-screen flex-col overflow-hidden bg-background text-foreground">
    <TopBar @open-search="paletteOpen = true" @toggle-sidebar="ui.sidebarOpen = !ui.sidebarOpen" />

    <div class="flex flex-1 overflow-hidden">
      <SidebarNav class="hidden xl:flex" />

      <div v-if="ui.sidebarOpen" class="fixed inset-0 z-40 xl:hidden" @click="ui.sidebarOpen = false">
        <div class="absolute inset-0 bg-foreground/40"></div>
        <div class="relative h-full" @click.stop>
          <SidebarNav class="h-full" />
        </div>
      </div>

      <div class="flex flex-1 overflow-hidden">
        <router-view class="flex-1 overflow-hidden" />
      </div>
    </div>

    <StatusBar :db-connected="ui.dbConnected" :active-subagents="ui.activeSubagents" />
    <CommandPalette v-model:open="paletteOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import TopBar from './TopBar.vue'
import SidebarNav from './SidebarNav.vue'
import StatusBar from './StatusBar.vue'
import CommandPalette from './CommandPalette.vue'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
const route = useRoute()
const paletteOpen = ref(false)

watch(() => route.fullPath, () => { ui.sidebarOpen = false })

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteOpen.value = !paletteOpen.value
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>
```

- [ ] **Step 2: Delete `BottomTabBar.vue`**

```bash
git rm frontend/src/components/BottomTabBar.vue
```

- [ ] **Step 3: Confirm no remaining imports of BottomTabBar**

Run: `npm --prefix frontend run type-check`
Expected: 0 errors. (If any file imports `BottomTabBar`, remove that import — only `AppShell` referenced it.)

- [ ] **Step 4: Build**

Run: `npm --prefix frontend run build`
Expected: 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AppShell.vue
git commit -m "feat(ui): rewrite AppShell into Mintlify shell with Cmd-K and mobile drawer"
```

---

## Task 8: Re-theme shared primitives

**Files:**
- Modify: `frontend/src/components/BaseModal.vue`, `BaseConfirmModal.vue`, `BaseSelect.vue`, `ModelSelector.vue`, `FormBlock.vue`

**Interfaces:**
- No interface changes (props/emits/slots identical). Visual-only: apply the **Token Mapping** table; modals use `rounded-xl bg-elevated`, overlays `bg-foreground/40`.

- [ ] **Step 1: Apply Token Mapping to all five files**

For each file, replace literal classes per the Token Mapping table. Specifics:
- `BaseModal.vue`: panel → `bg-elevated rounded-xl border border-border shadow-xl`; backdrop → `bg-foreground/40`; header/footer borders → `border-border`; footer bg → `bg-muted`.
- `BaseConfirmModal.vue`: title `text-foreground`; message `text-muted-foreground`; cancel = Secondary button recipe; confirm = solid danger (`bg-danger text-primary-foreground rounded-lg hover:bg-danger/90`).
- `BaseSelect.vue`: button = `rounded-lg border border-input bg-surface … text-foreground hover:bg-muted`; options panel `bg-elevated border border-border rounded-lg shadow-lg`; active option `bg-primary/10 text-primary`; chevron `text-muted-foreground`.
- `ModelSelector.vue`: trigger = Secondary button recipe; modal overlay `bg-foreground/40`; panel `bg-elevated rounded-xl border border-border shadow-xl`; rows hover `bg-muted`, selected `bg-primary/10 text-primary`; filter input = Input recipe.
- `FormBlock.vue`: container `rounded-lg border border-border bg-muted`; labels `text-muted-foreground`; inputs = Input recipe; submit = Primary button recipe.

- [ ] **Step 2: Type-check + build**

Run: `npm --prefix frontend run type-check` then `npm --prefix frontend run build`
Expected: both 0.

- [ ] **Step 3: Run existing primitive specs (if any) + commit**

Run: `npm --prefix frontend run test`
Expected: existing tests still pass.

```bash
git add frontend/src/components/BaseModal.vue frontend/src/components/BaseConfirmModal.vue frontend/src/components/BaseSelect.vue frontend/src/components/ModelSelector.vue frontend/src/components/FormBlock.vue
git commit -m "refactor(ui): re-theme shared primitives to semantic tokens"
```

---

## Task 9: Re-theme cowork cluster

**Files:**
- Modify: `frontend/src/components/CoworkView.vue`, `cowork/ProjectBar.vue`, `cowork/ChatInputBar.vue`, `cowork/MessageList.vue`, `cowork/MessageItem.vue`, `cowork/markdown.ts`, `ArtifactsPanel.vue`, `SubagentMonitorPanel.vue`, `FileTree.vue`, `ToolApprovalBar.vue`, `SlashMenu.vue`, `PlanBubble.vue`, `SessionModal.vue`, `DirectoryBrowser.vue`, `FilesView.vue`

**Interfaces:**
- No interface changes. Apply **Token Mapping**. `MessageItem` role accents: thinking `border-primary/30`, tool-call `border-warning`, tool-result `border-success`, agent/user `border-primary`/`border-border`. `markdown.ts` `highlightSlash` spans → `text-primary`/`text-foreground`. Chat input keeps `font-mono`. Right-column panels (`ArtifactsPanel`, `SubagentMonitorPanel`) keep `bg-surface border-l border-border`.

- [ ] **Step 1: Apply Token Mapping across all listed files**

Replace literal classes per the table. In `cowork/markdown.ts`, set the slash spans to `text-primary font-mono` (command) and `text-foreground` (rest). Keep all `font-mono` on code/tool/log/timestamp/path/model text.

- [ ] **Step 2: Type-check + build**

Run: `npm --prefix frontend run type-check` then `npm --prefix frontend run build`
Expected: both 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CoworkView.vue frontend/src/components/cowork/ frontend/src/components/ArtifactsPanel.vue frontend/src/components/SubagentMonitorPanel.vue frontend/src/components/FileTree.vue frontend/src/components/ToolApprovalBar.vue frontend/src/components/SlashMenu.vue frontend/src/components/PlanBubble.vue frontend/src/components/SessionModal.vue frontend/src/components/DirectoryBrowser.vue frontend/src/components/FilesView.vue
git commit -m "refactor(ui): re-theme cowork workspace to semantic tokens"
```

---

## Task 10: Re-theme remaining views + drop Settings tab strip

**Files:**
- Modify: `frontend/src/components/SettingsView.vue` (remove internal tab strip), `ScheduleTasksView.vue`, `ScheduleTaskDetailView.vue`, `NotesView.vue`, `NoteModal.vue`, `ConnectorsView.vue`, `AgentOutputView.vue`, `PlansView.vue`, `OAuthCallbackPage.vue`, `ProvidersView.vue`, `ProviderFormModal.vue`, `AgentsView.vue`, `ToolsView.vue`, `ToolConfigModal.vue`, `ToolPickerModal.vue`, `UsageView.vue`, `MemoryView.vue`, `PermissionView.vue`

**Interfaces:**
- No interface changes except `SettingsView`: delete the `<div class="flex border-b …"> … tab buttons …</div>` block (the `TABS` strip) since nav now lives in the sidebar; keep the `activeSettingsTab` resolution and the conditional `<MemoryView/>`/`<ProvidersView/>`/etc. rendering. Each view wraps its body content in `<div class="mx-auto max-w-5xl px-6 py-6">` (except where a view is already a full-height interactive panel). Apply **Token Mapping** to all.

- [ ] **Step 1: Edit `SettingsView.vue`** — remove the tab-strip `<div>` block and the now-unused `TABS`/`router` pieces only if no longer referenced (keep `router`/`TABS` if still used elsewhere; otherwise delete to satisfy strict TS). Re-theme remaining markup per the table. Wrap the general-settings body in `mx-auto max-w-3xl px-6 py-6`.

- [ ] **Step 2: Apply Token Mapping to the remaining listed views/modals.** Wrap each non-interactive view's scroll body in `mx-auto max-w-5xl px-6 py-6` for the Mintlify reading width. Headers become in-column titles: `text-lg font-semibold text-foreground` + optional `text-sm text-muted-foreground` subtitle, replacing the old `h-[3rem] bg-surface border-b` header bar (the global TopBar now owns top chrome). Tables/cards use Card/Input recipes.

- [ ] **Step 3: Type-check + build**

Run: `npm --prefix frontend run type-check` then `npm --prefix frontend run build`
Expected: both 0. Fix any unused-import/var TS errors introduced by removing the tab strip.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SettingsView.vue frontend/src/components/ScheduleTasksView.vue frontend/src/components/ScheduleTaskDetailView.vue frontend/src/components/NotesView.vue frontend/src/components/NoteModal.vue frontend/src/components/ConnectorsView.vue frontend/src/components/AgentOutputView.vue frontend/src/components/PlansView.vue frontend/src/components/OAuthCallbackPage.vue frontend/src/components/ProvidersView.vue frontend/src/components/ProviderFormModal.vue frontend/src/components/AgentsView.vue frontend/src/components/ToolsView.vue frontend/src/components/ToolConfigModal.vue frontend/src/components/ToolPickerModal.vue frontend/src/components/UsageView.vue frontend/src/components/MemoryView.vue frontend/src/components/PermissionView.vue
git commit -m "refactor(ui): re-theme remaining views and move settings nav to sidebar"
```

---

## Task 11: Final sweep, light/dark verification, polish

**Files:**
- Any component with leftover literal classes.

- [ ] **Step 1: Scan for leftover non-token color literals**

Run (Bash): `cd frontend/src && grep -rnE 'bg-(white|black|gray-[0-9])|text-(gray|slate|blue|red|green|amber)-[0-9]|border-(gray|blue)-[0-9]' components || echo "clean"`
Expected: `clean` (or fix each remaining occurrence to its semantic token).

- [ ] **Step 2: Type-check, build, full test run**

Run: `npm --prefix frontend run type-check` then `npm --prefix frontend run build` then `npm --prefix frontend run test`
Expected: all 0 / pass.

- [ ] **Step 3: Manual light/dark verification**

Run: `npm --prefix frontend run dev` (port 17135). In the browser: toggle theme via TopBar; visit `/cowork`, `/tasks`, `/notes`, `/agent-output`, `/plans`, `/settings/providers`, `/settings/usage`, `/connectors`. Confirm: no white-on-white or black-on-black; borders visible in both modes; ⌘K opens and navigates; sidebar active state correct; mobile (<1280px) hamburger drawer works.
Record any fixes as additional edits in this task.

- [ ] **Step 4: Commit any polish**

```bash
git add -A frontend/src
git commit -m "fix(ui): resolve leftover color literals and light/dark polish"
```

---

## Task 12: Update AGENTS.md documentation

**Files:**
- Modify: `frontend/AGENTS.md`, `frontend/src/components/AGENTS.md`, root `AGENTS.md`

**Interfaces:** docs only.

- [ ] **Step 1: Update `frontend/AGENTS.md`** — replace the theme/token section with the semantic token table (background/surface/muted/elevated/border/input/foreground/muted-foreground/primary/success/warning/danger/ring), note `darkMode: 'class'` + light/dark, Inter sans + JetBrains mono, `rounded-lg`/`rounded-xl`, Headless UI primitives, and the new shell (TopBar + grouped sidebar + CommandPalette + route-driven right panel). Update the Component Hierarchy to add `TopBar`, `ThemeToggle`, `CommandPalette`, grouped `SidebarNav`, and remove `BottomTabBar`.

- [ ] **Step 2: Update `frontend/src/components/AGENTS.md`** — update the Design Rules table to semantic tokens + light/dark + `rounded-lg`, the Header Pattern (in-column page title; global TopBar owns chrome), and the component map (add TopBar/ThemeToggle/CommandPalette, grouped SidebarNav, drop BottomTabBar).

- [ ] **Step 3: Update root `AGENTS.md` Rule Set 1** — semantic token table, Inter typography, `rounded-lg`, subtle shadows allowed, `darkMode: 'class'`, Headless UI; layout rule notes the new Mintlify shell.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md frontend/AGENTS.md frontend/src/components/AGENTS.md
git commit -m "docs: update AGENTS design system to Mintlify tokens and shell"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** token system (T1), theme + toggle (T2), grouped nav (T3/T4), top bar (T5), command palette (T6), shell + mobile drawer + retire bottom bar (T7), primitives (T8), cowork (T9), remaining views + settings strip removal (T10), light/dark verify (T11), docs (T12). All spec sections mapped.
- **Placeholders:** new components have full code; re-theme tasks reference the canonical Token Mapping table + recipes (concrete, not "handle styling").
- **Type consistency:** `theme`/`toggleTheme`/`initTheme` (store) used consistently in T2/T5/T6/T7; `navGroups`/`NavGroup`/`NavItem` consistent T3→T4/T6; `CommandPalette` `open`/`update:open` consistent T6/T7.
- **Risk note:** verify `vue-icons-plus/hi` icon names in T3 (build catches misses); Combobox-in-jsdom fallback noted in T6.
