# Chat Input Progress Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a scrolling dots progress bar to the chat input when SSE streaming is active.

**Architecture:** Add an 8-dot CSS animation to the `bg-cyber-dark` container in `ChatPanel.vue`, gated by the existing `streaming` ref. Register the `dot-pulse` keyframe in `tailwind.config.ts`.

**Tech Stack:** Vue 3, TailwindCSS

---

### Task 1: Add dot-pulse keyframe to Tailwind config

**Files:**
- Modify: `frontend/tailwind.config.ts:30-38`

- [ ] **Step 1: Add keyframe and animation config**

Edit `frontend/tailwind.config.ts` to add `dot-pulse` keyframe inside `theme.extend.keyframes` and `dot-pulse` entry inside `theme.extend.animation`:

```ts
// keyframes block — add dot-pulse after blink
keyframes: {
  blink: {
    '0%, 100%': { opacity: '1' },
    '50%': { opacity: '0' },
  },
  'dot-pulse': {
    '0%, 100%': { opacity: '0.2' },
    '50%': { opacity: '1' },
  },
},

// animation block — add dot-pulse after blink
animation: {
  blink: 'blink 1s step-end infinite',
  'dot-pulse': 'dot-pulse 1.2s ease-in-out infinite',
},
```

- [ ] **Step 2: Verify Tailwind config compiles**

Run: `cd frontend && npx tailwindcss --help`
Expected: No errors (this just verifies the config file is valid JSON/TS).

---

### Task 2: Add dots template to ChatPanel.vue

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Add dots template block**

In `ChatPanel.vue`, locate the `bg-cyber-dark` div that wraps the `<form>` (around line 76):

```html
<div class="bg-cyber-dark px-3 py-2">
  <form @submit.prevent="submit" class="flex items-center gap-2">
    ...
  </form>
</div>
```

Change it to add the dots block after `</form>`, inside the same container:

```html
<div class="bg-cyber-dark px-3 py-2">
  <form @submit.prevent="submit" class="flex items-center gap-2">
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
      class="text-cyber-accent/80 text-sm font-mono px-2 py-0.5 transition-colors duration-150 hover:text-cyber-accent shrink-0"
    >{{ t('chat.stop') }}</button>
  </form>
  <div v-if="streaming" class="flex items-center gap-1 pt-2">
    <div
      v-for="i in 8" :key="i"
      class="w-1 h-1 bg-cyber-accent rounded-full animate-dot-pulse"
      :style="{ animationDelay: `${(i - 1) * 0.15}s` }"
    />
  </div>
</div>
```

Note: `pt-2` adds 8px top padding to separate dots from the input row (8px = 0.5rem at 14px base font).

- [ ] **Step 2: Run type-check to verify**

Run: `cd frontend && npm run type-check`
Expected: No type errors (the animation class name is now valid in Tailwind).

- [ ] **Step 3: Run build to verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds, no errors.
