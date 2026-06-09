# Slash Command Suggestions & Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/`-triggered suggestion dropdown and syntax highlight slash commands in both input and sent messages.

**Architecture:** Pure frontend feature. New `SlashMenu.vue` component for dropdown. `ChatPanel.vue` input changes from `<input>` to `div[contenteditable]` for partial-text styling. Highlighting via regex detection of `/command` pattern, rendered with `<span class="text-cyber-cyan">` and sanitized via `DOMPurify`.

**Tech Stack:** Vue 3 + TypeScript + TailwindCSS (frontend only)

---

## File Map

| File | Action |
|---|---|
| `frontend/src/components/SlashMenu.vue` | New — terminal-style dropdown |
| `frontend/src/components/ChatPanel.vue` | Modify — contenteditable input, SlashMenu integration, user bubble highlight |
| `frontend/src/locales/vi.json` | Add `slash.*` keys |
| `frontend/src/locales/en.json` | Add `slash.*` keys |

---

## Task 1: SlashMenu.vue Component

**Files:**
- Create: `frontend/src/components/SlashMenu.vue`

- [ ] **Step 1: Create SlashMenu.vue**

Create `frontend/src/components/SlashMenu.vue`:

```vue
<template>
  <div
    v-if="visible"
    class="absolute bottom-full left-0 right-0 mb-1 border border-cyber-accent/30 bg-cyber-dark overflow-hidden"
  >
    <div
      v-for="(cmd, i) in filteredCommands"
      :key="cmd.command"
      :class="i === selectedIndex ? 'bg-cyber-accent/20 text-cyber-text' : 'text-cyber-muted'"
      class="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm font-mono transition-colors duration-150 hover:bg-cyber-accent/10"
      @click="select(cmd.command)"
      @mouseenter="$emit('highlight', i)"
    >
      <span class="text-cyber-cyan shrink-0">{{ cmd.command }}</span>
      <span class="text-cyber-muted/60 truncate">{{ cmd.description }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  visible: boolean
  filter: string
  selectedIndex: number
}>()

const emit = defineEmits<{
  select: [command: string]
  highlight: [index: number]
  close: []
}>()

const { t } = useI18n()

const commands = computed(() => [
  { command: '/plan', description: t('slash.plan') },
  { command: '/help', description: t('slash.help') },
  { command: '/clear', description: t('slash.clear') },
])

const filteredCommands = computed(() =>
  commands.value.filter(c => c.command.startsWith(props.filter))
)

function select(command: string) {
  emit('select', command)
}
</script>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SlashMenu.vue
git commit -m "feat: add SlashMenu component for slash command suggestions"
```

---

## Task 2: i18n Keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add slash keys to vi.json**

In `frontend/src/locales/vi.json`, add before the closing `}`:

```json
,
  "slash.plan": "/plan <công việc>",
  "slash.help": "Hiển thị danh sách lệnh",
  "slash.clear": "Xoá toàn bộ tin nhắn"
```

- [ ] **Step 2: Add slash keys to en.json**

In `frontend/src/locales/en.json`, add before the closing `}`:

```json
,
  "slash.plan": "/plan <task>",
  "slash.help": "Show available commands",
  "slash.clear": "Clear all messages"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add slash command i18n keys"
```

---

## Task 3: ChatPanel.vue — Contenteditable Input + SlashMenu + Highlighting

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Update imports and add interfaces**

Add `SlashMenu` import after existing imports:
```typescript
import SlashMenu from './SlashMenu.vue'
```

Add `SlashCommand` interface after the existing `Message` interface:
```typescript
interface SlashCommand {
  command: string
  description: string
}
```

- [ ] **Step 2: Add reactive state for slash menu**

Add these refs after existing `const agentMode = ref(true)`:
```typescript
const showSlashMenu = ref(false)
const slashFilter = ref('')
const slashSelectedIndex = ref(0)
```

- [ ] **Step 3: Replace `<input>` with `<div contenteditable>`**

In the template, replace the `<input>` element (lines ~100-108) with:

```html
<div class="relative">
  <SlashMenu
    :visible="showSlashMenu"
    :filter="slashFilter"
    :selected-index="slashSelectedIndex"
    @select="onSlashSelect"
    @highlight="(i: number) => slashSelectedIndex = i"
    @close="showSlashMenu = false"
  />
  <div
    ref="inputEl"
    contenteditable
    role="textbox"
    class="flex-1 bg-transparent text-sm outline-none font-mono caret-white min-h-[1.2em] whitespace-pre-wrap break-words"
    :class="streaming ? 'pointer-events-none opacity-50' : ''"
    :placeholder="t('chat.placeholder')"
    @input="onInput"
    @keydown="onKeyDown"
    @keydown.tab.prevent="onTab"
  ></div>
</div>
```

Note: Remove the `v-model="input"` and `:disabled="streaming"` from the old `<input>`. The contenteditable div does not support `placeholder` attribute natively. Use CSS `:empty:before` pseudo-element or handle it differently.

Actually, `placeholder` doesn't work on contenteditable. Use a different approach — add a CSS class-based placeholder. Add this to the component's style or use a data attribute approach.

For the placeholder, use the `:empty:before` CSS pseudo-element approach. Add this to the refactored template. The contenteditable div should be wrapped with the relative container and SlashMenu.

Replace the old form section (from `<form @submit.prevent="submit" class="flex items-center gap-2">` to the closing `</form>`) with:

```html
<form @submit.prevent="submit" class="flex items-center gap-2">
  <div class="relative flex-1">
    <SlashMenu
      :visible="showSlashMenu"
      :filter="slashFilter"
      :selected-index="slashSelectedIndex"
      @select="onSlashSelect"
      @highlight="(i: number) => { slashSelectedIndex = i }"
      @close="showSlashMenu = false"
    />
    <div
      ref="inputEl"
      contenteditable
      role="textbox"
      class="flex-1 bg-transparent text-sm outline-none font-mono caret-white min-h-[1.2em] whitespace-pre-wrap break-words"
      :class="streaming ? 'pointer-events-none opacity-50' : ''"
      data-placeholder=""
      @input="onInput"
      @keydown="onKeyDown"
    ></div>
  </div>
  <button
    v-if="streaming"
    @click="stopStream"
    class="text-cyber-accent/80 text-sm font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent shrink-0"
  >{{ t('chat.stop') }}</button>
</form>
```

Remove the `v-if="streaming"` button from outside the form — it's now inside the form as before.

- [ ] **Step 4: Add slash menu handler functions**

Add these functions after the `stopStream()` function:

```typescript
function onInput(e: Event) {
  const el = e.target as HTMLElement
  const text = el.innerText || ''

  if (text.startsWith('/')) {
    const spaceIdx = text.indexOf(' ')
    if (spaceIdx === -1) {
      showSlashMenu.value = true
      slashFilter.value = text
      slashSelectedIndex.value = 0
    } else {
      showSlashMenu.value = false
    }
  } else {
    showSlashMenu.value = false
  }

  renderHighlightedInput(el, text)
}

function onKeyDown(e: KeyboardEvent) {
  if (!showSlashMenu.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    slashSelectedIndex.value = Math.min(slashSelectedIndex.value + 1, slashCommands().length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    slashSelectedIndex.value = Math.max(slashSelectedIndex.value - 1, 0)
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    if (showSlashMenu.value) {
      e.preventDefault()
      const filtered = slashCommands().filter(c => c.command.startsWith(slashFilter.value))
      if (filtered[slashSelectedIndex.value]) {
        insertSlash(filtered[slashSelectedIndex.value].command)
      }
    }
  } else if (e.key === 'Escape') {
    showSlashMenu.value = false
  }
}

function onSlashSelect(command: string) {
  insertSlash(command)
}

function insertSlash(command: string) {
  const el = inputEl.value
  if (!el) return
  el.innerText = command + ' '
  showSlashMenu.value = false
  renderHighlightedInput(el, command + ' ')
  placeCaretAtEnd(el)
  el.focus()
}

function slashCommands() {
  return [
    { command: '/plan', description: t('slash.plan') },
    { command: '/help', description: t('slash.help') },
    { command: '/clear', description: t('slash.clear') },
  ]
}

function renderHighlightedInput(el: HTMLElement, text: string) {
  const html = highlightSlash(text)
  if (el.innerHTML !== html) {
    el.innerHTML = html
  }
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange()
  const sel = window.getSelection()
  range.selectNodeContents(el)
  range.collapse(false)
  sel?.removeAllRanges()
  sel?.addRange(range)
}
```

- [ ] **Step 5: Add the `highlightSlash` helper and `submit()` refactor**

Add this helper function before `submit()`:
```typescript
function highlightSlash(text: string): string {
  if (text.startsWith('/')) {
    const spaceIdx = text.indexOf(' ')
    if (spaceIdx !== -1) {
      const cmd = text.slice(0, spaceIdx)
      const rest = text.slice(spaceIdx)
      return `<span class="text-cyber-cyan">${escapeHtml(cmd)}</span><span class="text-cyber-text">${escapeHtml(rest)}</span>`
    }
    return `<span class="text-cyber-cyan">${escapeHtml(text)}</span>`
  }
  return `<span class="text-cyber-text">${escapeHtml(text)}</span>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
```

Update the `submit()` function to read from the contenteditable div instead of from `input.value`. At the start of `submit()`:

```typescript
async function submit() {
  const el = inputEl.value
  const text = el?.innerText?.trim() ?? ''
  if (!text || streaming.value || selectedModelId.value === null) return
  // Clear the contenteditable
  if (el) el.innerText = ''
  ...
```

Remove the old `input.value = ''` line (the old code had `input.value = ''` right after session creation). The `input` ref is no longer needed for the text content since we use `inputEl.value.innerText`. Keep the `const text = input.value.trim()` replacement as above.

For the case where FormBlock calls submit with `input.value = text` (line ~264), update that to set `inputEl.value.innerText = text` instead.

Actually, looking at the `onFormSubmit` function at line ~252-265:
```typescript
function onFormSubmit(data: Record<string, string>) {
  const json = JSON.stringify(data, null, 2)
  messages.value.push({...})
  scrollToBottom()
  if (currentSessionId.value !== null && selectedModelId.value !== null) {
    const text = JSON.stringify(data)
    input.value = text    // <-- change this
    submit()
  }
}
```

Change `input.value = text` to:
```typescript
    if (inputEl.value) inputEl.value.innerText = text
```

- [ ] **Step 6: Add slash highlighting in user message bubble**

In the template, find the user message block:
```html
<div v-else-if="msg.role === 'user'"
  class="border-l-2 border-cyber-accent/80 pl-3 py-1">
  <div class="text-sm text-cyber-accent/80 mb-0.5 font-mono">{{ rolePrefix(msg.role) }} · {{ msg.timestamp }}</div>
  <div class="text-sm leading-relaxed break-words text-cyber-text">{{ msg.content }}</div>
</div>
```

Replace the content div with:
```html
<div v-else-if="msg.role === 'user'"
  class="border-l-2 border-cyber-accent/80 pl-3 py-1">
  <div class="text-sm text-cyber-accent/80 mb-0.5 font-mono">{{ rolePrefix(msg.role) }} · {{ msg.timestamp }}</div>
  <div class="text-sm leading-relaxed break-words text-cyber-text" v-html="highlightUserMessage(msg.content)"></div>
</div>
```

Add this method before `submit()`:
```typescript
function highlightUserMessage(content: string): string {
  return DOMPurify.sanitize(highlightSlash(content))
}
```

- [ ] **Step 7: Clean up unused `input` ref and `watch`**

The old `const input = ref('')` should be kept for the `v-model` binding on input — but now we're using contenteditable which doesn't support v-model. Remove `v-model="input"` from the template (already done in Step 3). The `input` ref is still used by `onFormSubmit` to set text, so either keep it or remove all references.

Since `onFormSubmit` now sets `inputEl.value.innerText` directly, the `input` ref is no longer needed. Remove:
```typescript
const input = ref('')
```

- [ ] **Step 8: Run type-check**

```bash
cd frontend
npx vue-tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: add slash command suggestions dropdown and syntax highlighting"
```

---

## Self-Review Checklist

- Plan covers all spec requirements: SlashMenu dropdown, contenteditable input, slash highlight in input, slash highlight in user bubble, i18n keys
- No placeholders or TODOs in code blocks
- Type names consistent across tasks
- No backend changes needed (pure frontend)
