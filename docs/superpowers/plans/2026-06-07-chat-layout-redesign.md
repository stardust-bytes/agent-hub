# Chat Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center chat content like FilesView (max-w-2xl mx-auto), remove header, move session button below input, move stop button to input row, move mode indicator to StatusBar.

**Architecture:** Single component change to ChatPanel.vue with prop wiring through AppShell to StatusBar. No new components. Two i18n key deletions.

**Tech Stack:** Vue 3 Composition API, TailwindCSS, vue-i18n

---

### Task 1: Remove header from ChatPanel.vue

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue:3-23`

- [ ] **Step 1: Delete the header div**

Delete lines 3-23 (the entire header `<div>` with class `px-3 py-2 bg-cyber-dark flex items-center justify-between shrink-0`).

After deletion, the template starts directly with the messages container.

- [ ] **Step 2: Verify**

Run: `npm run type-check` in `frontend/`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "refactor: remove chat header div"
```

---

### Task 2: Center messages with max-w-2xl mx-auto

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Wrap messages in centered container**

Change:
```html
<div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
```
To:
```html
<div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 min-h-0">
  <div class="max-w-2xl mx-auto space-y-4">
```

Close the new div before the `</div>` of messagesEl.

Add `</div>` before the closing `</div>` of messagesEl to close the inner wrapper.

- [ ] **Step 2: Verify**

Run: `npm run type-check` in `frontend/`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: center chat messages with max-w-2xl"
```

---

### Task 3: Rearrange input area

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Move stop button to input row**

The current bottom section is:
```html
<div class="shrink-0">
  <div class="px-3 py-2 bg-cyber-dark">
    <form @submit.prevent="submit" class="flex items-center gap-2 bg-cyber-dark px-3 py-2">
      <span class="text-cyber-accent text-sm font-mono">$</span>
      <span v-if="!streaming" class="animate-blink text-cyber-text text-sm">█</span>
      <input ... />
    </form>
  </div>
  <div class="px-3 pb-2 bg-cyber-dark flex items-center gap-2">
    <ModelSelector ... />
    <span v-if="streaming" class="text-[0.625rem] text-cyber-accent/50 font-mono">{{ t('chat.streaming') }}</span>
  </div>
</div>
```

Replace with:
```html
<div class="shrink-0">
  <div class="max-w-2xl mx-auto w-full px-3">
    <div class="bg-cyber-dark px-3 py-2">
      <form @submit.prevent="submit" class="flex items-center gap-2">
        <span class="text-cyber-accent text-sm font-mono shrink-0">$</span>
        <span v-if="!streaming" class="animate-blink text-cyber-text text-sm shrink-0">█</span>
        <input
          ref="inputEl"
          v-model="input"
          class="flex-1 bg-transparent text-cyber-text text-sm outline-none font-mono placeholder-cyber-muted/40 caret-white"
          :placeholder="t('chat.placeholder')"
          :disabled="streaming"
          autocomplete="off"
          spellcheck="false"
        />
        <button
          v-if="streaming"
          @click="stopStream"
          class="text-cyber-accent/80 text-xs font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent shrink-0"
        >{{ t('chat.stop') }}</button>
      </form>
    </div>
    <div class="pb-2 flex items-center justify-between">
      <ModelSelector
        v-model="selectedModel"
        :models="availableModels"
        :disabled="streaming"
      />
      <button
        @click="showSessionModal = true"
        class="text-cyber-accent/70 text-xs font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent"
      >{{ t('sessions.header') }}</button>
    </div>
  </div>
</div>
```

The stop button is now inside the form row (right side). The session button is in the row below the input, right-aligned. The ModelSelector is left-aligned.

- [ ] **Step 2: Remove unused import**

Search for `sessions.header` — it's still used (now in the new template). No import changes needed.

- [ ] **Step 3: Verify**

Run: `npm run type-check` in `frontend/`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: move stop button to input row, session button below input"
```

---

### Task 4: Wire ollamaOnline to StatusBar

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`
- Modify: `frontend/src/components/AppShell.vue`
- Modify: `frontend/src/components/StatusBar.vue`

- [ ] **Step 1: Add emit to ChatPanel**

After `const ollamaOnline = ref(true)`, add an emit:
```ts
const emit = defineEmits<{
  (e: 'update:ollamaOnline', value: boolean): void
}>()
```

In `onMounted`, after `ollamaOnline.value = false` (line 186), add:
```ts
emit('update:ollamaOnline', false)
```
And after the successful fetch (line 184), add:
```ts
emit('update:ollamaOnline', true)
```

- [ ] **Step 2: Wire in AppShell.vue**

Add a ref:
```ts
const ollamaOnline = ref(true)
```

Update ChatPanel usage:
```html
<ChatPanel
  v-else
  class="flex-1 overflow-hidden"
  @update:ollamaOnline="ollamaOnline = $event"
/>
```

Pass to StatusBar:
```html
<StatusBar
  :model-name="modelName"
  :db-connected="dbConnected"
  :ws-connected="wsConnected"
  :ollama-online="ollamaOnline"
/>
```

- [ ] **Step 3: Add mode display to StatusBar.vue**

Read StatusBar.vue first, then add a `ollamaOnline` prop and display it.

```ts
defineProps<{
  modelName?: string
  dbConnected?: boolean
  wsConnected?: boolean
  ollamaOnline?: boolean
}>()
```

In the template, add a span showing the mode:
```html
<span class="text-cyber-accent/50 text-[10px] font-mono">
  {{ ollamaOnline ? 'ollama' : 'stub' }}
</span>
```

Place it wherever makes sense in the StatusBar layout.

- [ ] **Step 4: Verify**

Run: `npm run type-check` in `frontend/`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatPanel.vue frontend/src/components/AppShell.vue frontend/src/components/StatusBar.vue
git commit -m "feat: wire ollamaOnline state to StatusBar for mode indicator"
```

---

### Task 5: Remove unused i18n key

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Remove chat.header from vi.json**

Delete the line `"chat.header": "AGENT CHAT",` (the one with Vietnamese value — check file).

- [ ] **Step 2: Remove chat.header from en.json**

Delete the line `"chat.header": "AGENT CHAT",` (the English one).

- [ ] **Step 3: Verify**

Run: `npm run type-check` in `frontend/`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "chore: remove unused chat.header i18n key"
```

---

### Task 6: Verify full build

**Files:**
- All modified files

- [ ] **Step 1: Type check**

```bash
npm run type-check
```
Expected: No errors.

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: Bundles without errors.
