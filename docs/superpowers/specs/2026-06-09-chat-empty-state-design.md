# Chat Empty State — Design Spec

## Overview

Add an empty state placeholder in the ChatPanel when no messages from user/agent exist yet. Shows the project codename "171305" in pixel font with a terminal-style subtitle.

## 1. Font

Add Google Font "Press Start 2P" to `frontend/src/assets/main.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
```

Used only for the "171305" title via Tailwind's arbitrary font utility: `font-['Press_Start_2P']`.

## 2. Empty State Logic

In `ChatPanel.vue`, conditionally render the empty state when there are no user/agent messages:

```ts
const hasChatMessages = computed(() =>
  messages.value.some(m => m.role === 'user' || m.role === 'agent')
)
```

- `hasChatMessages === false` → show empty state centered in the messages area
- `hasChatMessages === true` → show normal message list (existing behavior)

## 3. Empty State Layout

```html
<div v-if="!hasChatMessages" class="flex-1 flex items-center justify-center">
  <div class="text-center">
    <div class="font-['Press_Start_2P'] text-3xl text-cyber-accent mb-4">171305</div>
    <div class="text-sm font-mono text-cyber-muted">// {{ t('chat.empty.subtitle') }}</div>
  </div>
</div>
```

- Title: pixel font, ~30px, accent blue
- Subtitle: monospace, ~14px, muted gray, with `// ` prefix

## 4. i18n Keys

| Key | vi | en |
|-----|----|-----|
| `chat.empty.subtitle` | `đang chờ lệnh...` | `awaiting command...` |

Add to `frontend/src/locales/vi.json` and `frontend/src/locales/en.json`.

## 5. Files Changed

| File | Change |
|------|--------|
| `frontend/src/assets/main.css` | Add Press Start 2P Google Font import |
| `frontend/src/components/ChatPanel.vue` | Add computed `hasChatMessages`, conditional empty state template |
| `frontend/src/locales/vi.json` | Add `chat.empty.subtitle` key |
| `frontend/src/locales/en.json` | Add `chat.empty.subtitle` key |
