# DeepSeek tool_call_id Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `missing field tool_call_id` error when using DeepSeek (OpenAI-compatible) provider by filtering tool messages from history.

**Architecture:** Single-line change in `LLMControllerService.buildMessages()` — add `.filter(m => m.role !== 'tool')` to the history spread to exclude tool messages that lack `tool_call_id`.

**Tech Stack:** NestJS, TypeScript

---

### Task 1: Filter tool messages from history

**Files:**
- Modify: `backend/src/agent/services/llm-controller.service.ts`

- [ ] **Step 1: Add filter to history spread**

Find the `buildMessages` method (line 38-57). Change line 46:
```typescript
      ...history,
```
to:
```typescript
      ...history.filter(m => m.role !== 'tool'),
```

The full method after change:
```typescript
  buildMessages(
    systemPrompt: string,
    history: OllamaMessage[],
    userMessage: string,
    toolResults?: Array<{ name: string; content: string }>,
  ): OllamaMessage[] {
    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.filter(m => m.role !== 'tool'),
      { role: 'user', content: userMessage },
    ];

    if (toolResults) {
      for (const tr of toolResults) {
        messages.push({ role: 'tool', content: tr.content, toolCalls: [{ function: { name: tr.name, arguments: {} } }] });
      }
    }

    return messages;
  }
```

- [ ] **Step 2: Run existing tests**

Run: `npx jest src/agent` — Expected: All passing (existing tests don't verify tool message inclusion in history)

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/services/llm-controller.service.ts
git commit -m "fix: filter tool messages from history to avoid missing tool_call_id on DeepSeek"
```
