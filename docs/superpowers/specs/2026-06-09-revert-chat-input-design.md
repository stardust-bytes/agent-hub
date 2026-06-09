# Revert Chat Input to `<input>` Design

**Goal:** Replace the `contenteditable` div with a plain `<input>`, remove input highlighting, keep SlashMenu dropdown and user-bubble highlighting.

## Changes

### Template
- Replace `<div contenteditable>` with `<input v-model="input">`
- Restore `:placeholder`, `:disabled`, `autocomplete`, `spellcheck`
- Remove `@input`, `@keydown` from the input (use form submit + keyboard event on input directly)
- Keep SlashMenu wrapper with `relative` container

### Functions to remove
- `renderHighlightedInput` — no longer needed
- `placeCaretAtEnd` — no longer needed
- `escapeHtml` — no longer needed
- `highlightSlash` — still needed for user-bubble highlighting (`highlightUserMessage`)
- `onInput` — simplify to only toggle SlashMenu (no render call), rename if desired

### Functions to modify
- `onKeyDown` — remove arrow-key nav (input natively handles arrows), keep Enter/Tab/Escape for SlashMenu, add Enter→submit when menu hidden
- `insertSlash` — set `input.value` instead of `el.innerText`
- `submit()` — read from `input.value` instead of `el.innerText`
- `onFormSubmit` — set `input.value` instead of `el.innerText`
- `getSlashCommands` — keep as-is

### State
- Add back `const input = ref('')` for v-model binding
- Remove `inputEl` ref's contenteditable-specific logic

### No changes
- `highlightUserMessage` — stays, user-bubble highlighting still wanted
- `SlashMenu.vue` — no changes
- i18n keys — no changes
