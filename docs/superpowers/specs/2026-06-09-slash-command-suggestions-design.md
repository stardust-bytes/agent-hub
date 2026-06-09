# Slash Command Suggestions & Highlighting Design

**Goal:** Add slash command suggestions dropdown when user types `/` in chat input, and highlight slash commands in a distinct color both in the input field and in sent user messages.

## Slash Commands (Fixed List)

| Command | Description (vi) | Description (en) |
|---|---|---|
| `/plan <task>` | Tạo plan và thực thi từng bước | Create a plan and execute step by step |
| `/help` | Hiển thị danh sách slash commands | Show available slash commands |
| `/clear` | Xoá toàn bộ tin nhắn | Clear all messages |

## Architecture

Pure frontend feature — no backend changes. Slash commands are client-side only. The `/plan` slash is already handled by backend routing in `AgentService.streamChat()`.

### Components

**New: `frontend/src/components/SlashMenu.vue`**
- Terminal-style dropdown positioned below the input
- Visible when input starts with `/` and no space after the slash command
- Each item: `▶ /plan` + description (i18n)
- Keyboard navigation: ArrowUp/ArrowDown/Tab to select, Enter to choose, Escape to close
- Click to select
- After selecting a command + space, hide menu

**Modified: `frontend/src/components/ChatPanel.vue`**
- Replace `<input>` with `<div contenteditable>` to support partial text styling
- Custom `v-model` implementation via `@input` event and `innerText` extraction
- On each input, detect slash command pattern and render colored `<span>` for the command portion
- Add `SlashMenu` mounted below the input
- In user message bubble (`v-else-if="msg.role === 'user'"`), render slash commands with highlight using `v-html` + `DOMPurify`

### Highlighting Rules

**In input (contenteditable):**
- Pattern: `/command` at start of input followed by optional text
- Render: `<span class="text-cyber-cyan">/plan</span><span class="text-cyber-text"> rest of message</span>`
- Only the first word starting with `/` gets highlighted; subsequent text is normal

**In user message bubble:**
- Detect if message starts with `/command`
- If yes, split into command + rest, render with highlight span
- Use `v-html` with `DOMPurify.sanitize()`

### Data Flow

```
User types "/" → SlashMenu detects, shows dropdown
User types "/p" → Filter to commands starting with "/p" → show "/plan"
User presses Enter/Tab on suggestion → insert " /plan " into contenteditable
User types rest of message → contenteditable renders /plan in cyan
User submits → /plan detected → slash styling in user bubble + backend routes to runPlanMode
```

### SlashMenu Component Props/Emits

```typescript
interface SlashCommand {
  command: string
  description: string
}

defineProps<{
  visible: boolean
  filter: string
  selectedIndex: number
}>()

defineEmits<{
  select: [command: string]
  close: []
}>()
```

### i18n Keys

```
slash.plan  → "/plan <task>" / "/plan <công việc>"
slash.help  → "Show available commands" / "Hiển thị danh sách lệnh"
slash.clear → "Clear all messages" / "Xoá toàn bộ tin nhắn"
```

### Files Changed

| File | Action |
|---|---|
| `frontend/src/components/SlashMenu.vue` | New |
| `frontend/src/components/ChatPanel.vue` | Modify |
| `frontend/src/locales/vi.json` | Add `slash.*` keys |
| `frontend/src/locales/en.json` | Add `slash.*` keys |

### No Backend Changes

This is a pure frontend feature. The existing `/plan` handling in `AgentService.streamChat()` already works. Slash commands are defined client-side for suggestions only. `/clear` is handled entirely in the frontend (clear messages array). `/help` pushes a system message listing commands. `/plan` is sent as a regular message (backend detects `/plan ` prefix and routes to `runPlanMode`).
