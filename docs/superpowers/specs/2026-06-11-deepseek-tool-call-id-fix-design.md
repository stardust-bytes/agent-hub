# DeepSeek tool_call_id Fix

**Date:** 2026-06-11
**Status:** Draft

## Problem

DeepSeek (OpenAI-compatible API) fails with `missing field tool_call_id` when the agent sends messages containing `role: 'tool'` history entries that lack `tool_call_id`. Ollama works fine because it doesn't validate this field.

## Root Cause

`SessionsService.getHistory()` returns `{ role, content }` objects (no `toolCallId` field). The DB schema `ChatMessage` has no `toolCallId` column, so tool results saved during agent execution lose their `tool_call_id` when retrieved as history.

On the next iteration or request, `buildMessages()` reconstructs the message array from history. Tool messages with `role: 'tool'` but without `tool_call_id` are sent to DeepSeek, which rejects them.

## Solution

Filter `role: 'tool'` messages from history in `LLMControllerService.buildMessages()`:

```typescript
const messages: OllamaMessage[] = [
  { role: 'system', content: systemPrompt },
  ...history.filter(m => m.role !== 'tool'),
  { role: 'user', content: userMessage },
];
```

This is safe because:
- Past tool results are already summarized in the assistant's final text response
- The current in-memory `messages` array (within the same request) preserves correct tool_call formatting
- Ollama doesn't need tool messages in history
- DeepSeek avoids the validation error

## Note on "Tool names must be unique"

This error was caused by duplicate tool definitions (DB seed + hardcoded in ContextBuilderService). Fixed by previous commit `4e202b1` which removed hardcoded blocks. No additional changes needed.

## Files Changed

| File | Change |
|---|---|
| `backend/src/agent/services/llm-controller.service.ts` | Add `.filter(m => m.role !== 'tool')` to history spread |
