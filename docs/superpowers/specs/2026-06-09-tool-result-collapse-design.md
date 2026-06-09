# Tool Result Collapse/Expand

## Problem

Tool results in chat messages can be very long (file contents, search results, JSON blobs), taking up excessive vertical space in the message history.

## Solution

Truncate tool result display to 5 lines when collapsed, with a toggle button to expand/collapse.

## Design

### Affected files
- `frontend/src/components/ChatPanel.vue` — modify tool result block (lines 20-23)
- `frontend/src/locales/vi.json` — add `chat.tool.expand` and `chat.tool.collapse`
- `frontend/src/locales/en.json` — add `chat.tool.expand` and `chat.tool.collapse`

### Behavior

Each tool result message tracks local `expanded` state for expand/collapse.

1. Split `msg.content` by `\n` → `lines`
2. If `lines.length <= 5`: render full content (no change from current)
3. If `lines.length > 5`:
   - **Collapsed (default):** render `lines.slice(0, 5).join('\n')` followed by a `...` line (text-cyber-muted) and an expand button
   - **Expanded:** render full `msg.content` with a collapse button

### Collapsed state rendering:
```
<first 5 lines of tool result>
...
[+ expand]     ← clickable, text-cyber-accent/60
```

### Expanded state rendering:
```
<full tool result content>
[- collapse]   ← clickable, text-cyber-accent/60
```

### i18n keys

| Key | vi | en |
|---|---|---|
| `chat.tool.expand` | `[+ mở rộng]` | `[+ expand]` |
| `chat.tool.collapse` | `[- thu gọn]` | `[- collapse]` |

### Styling rules applied

- `font-mono` on all text
- `text-cyber-muted` on `...` line
- `text-cyber-accent/60 hover:text-cyber-accent transition-colors duration-150` on toggle button
- No rounded, no shadows, no gradients (per design system)
- Toggle button aligned to same padding as content

### No new components needed

The expand/collapse logic is local to ChatPanel.vue tool result block. No component extraction required.
