# Chat Panel Layout Redesign

## Overview

Center the chat panel content (messages + input) like the Files view, hide the chat header, and move the session button below the input area.

## Motivation

The current chat panel has a full-width header bar ("AGENT CHAT" + session + stop + mode) that takes vertical space. The user wants a cleaner, more focused layout where the chat content is centered like `max-w-2xl mx-auto space-y-4` (matching FilesView.vue pattern), the header is removed entirely, and secondary controls live below the input.

## Design

### Layout

```
┌────────────────────────────────────────────────────┐
│                     ┌──────────────┐               │
│                     │  Messages    │               │
│                     │  (max-w-2xl) │               │
│                     │              │               │
│                     │              │               │
│                     │              │               │
│                     └──────────────┘               │
│                     ┌──────────────┐               │
│                     │ $ [input  ■] │ ← stop button │
│                     │ [model ▾] [SESSIONS] │       │
│                     └──────────────┘               │
└────────────────────────────────────────────────────┘
```

### Changes

#### 1. ChatPanel.vue — Remove header

- Delete the entire header `<div>` (AGENT CHAT title, sessions link in header, stop button, mode indicator).
- Delete `chat.header` i18n key (no longer used). Remove from both `vi.json` and `en.json`.

#### 2. ChatPanel.vue — Center messages

Wrap the messages container with `max-w-2xl mx-auto space-y-4`.

- Current: `<div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">`
- New: `<div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 min-h-0"><div class="max-w-2xl mx-auto space-y-4">`

#### 3. ChatPanel.vue — Input area layout

Restructure the bottom section:

```
Original:
[ModelSelector]  [streaming text]

New:
[Row 1] $ [input_field] [stop_button ▲ when streaming]
[Row 2] [ModelSelector]              [SESSIONS button ►]
```

- Session button moves from header to bottom-right of input area.
- Stop button moves from header to same row as input, right-aligned.
- Mode indicator moves to StatusBar.vue.

#### 4. StatusBar.vue — Add mode indicator

Add "ollama mode" / "stub mode" display to the status bar, sourced from ChatPanel's `ollamaOnline` state. This requires either:
- A prop passed from AppShell, or
- A shared reactive state

Use a prop approach: ChatPanel emits mode info up to AppShell, which passes it down to StatusBar.

#### 5. i18n — Cleanup

- Remove `chat.header` key from `vi.json` and `en.json` (header no longer exists).
- No new i18n keys needed.

### Files Changed

| File | Change |
|---|---|
| `frontend/src/components/ChatPanel.vue` | Remove header, center messages, rearrange input area |
| `frontend/src/components/StatusBar.vue` | Add mode indicator display |
| `frontend/src/components/AppShell.vue` | Wire ollamaOnline state from ChatPanel to StatusBar |
| `frontend/src/locales/vi.json` | Remove `chat.header` |
| `frontend/src/locales/en.json` | Remove `chat.header` |

### Data Flow

```
ChatPanel
  → emits 'ollama-online' (boolean) to AppShell
AppShell
  → passes :ollama-online to StatusBar
StatusBar
  → displays "ollama mode" or "stub mode" based on prop
```

### Implementation Notes

- Keep the same `flex-col` structure in ChatPanel — only the content inside changes.
- SessionModal binding stays the same, just the trigger button moves.
- Stop button behavior (AbortController) stays the same; only position changes.
