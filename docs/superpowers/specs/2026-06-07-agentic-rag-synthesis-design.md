# Agentic RAG Synthesis Design

**Date:** 2026-06-07  
**Status:** Approved

## Problem

When a user queries the knowledge base (KB), the agent executes `search_knowledge` and shows raw text chunks in the green tool-result block, but the final agent answer is empty. Root cause: local Ollama models do not reliably handle `role: 'tool'` messages on the synthesis pass — the second LLM call (after tool execution) fails silently, sending `[DONE]` without streaming any tokens.

## Goal

- Agent answer synthesizes KB results into a coherent, cited response
- Raw chunks still visible in the green tool-result block (user wants both)
- Citations format: `[Source: "filename.pdf", §N]`
- Works reliably with weak local models (llama3.2, qwen2.5, etc.)

## Scope

Backend only. Frontend requires no changes — `toolCall`, `toolResult`, and `token` SSE events are already handled correctly.

## Architecture

### 1. `KnowledgeService.search()` — Richer return type

```typescript
// Before
{ filename: string; text: string }[]

// After
{ filename: string; chunkIndex: number; text: string }[]
```

`chunkIndex` from the existing `ChunkRecord` is already stored in LanceDB — just needs to be included in the return value.

### 2. `OllamaProvider` — Four targeted changes

#### a) System prompt

Replace the minimal one-liner with explicit synthesis and citation instructions:

```
You are a helpful AI assistant with access to tools including a knowledge base search.
When using search_knowledge:
- ALWAYS synthesize the results into a coherent, comprehensive answer — never copy-paste raw chunks.
- Cite each fact inline using the format [Source: "filename.pdf", §N] where N is the section number.
- If multiple sources agree, cite all of them.
Respond in the same language the user writes in. For tool calls, use the provided tools.
```

#### b) Search result format in `executeTool`

Change from flat `[filename]: text` to numbered, citation-ready format:

```
Before:
[doc.pdf]: raw text
---
[doc.pdf]: more text

After:
[1] Source: "doc.pdf", §0
raw text

[2] Source: "doc.pdf", §1
more text
```

#### c) Synthesis injection

After the `for (const tc of currentToolCalls)` loop, if any call was `search_knowledge`, push a `role: 'user'` synthesis prompt into `msgs` before the next LLM iteration:

```typescript
if (hadSearchCall) {
  msgs.push({
    role: 'user',
    content: 'Based on the search results above, write a comprehensive answer with inline citations [Source: "filename", §N].',
  });
}
```

`msgs` is a local variable scoped to the request — this message is never saved to session history.

Using `role: 'user'` (not `role: 'tool'`) is intentional: it is universally handled by all Ollama models regardless of native tool support.

#### d) Silent failure fix

Replace the silent `[DONE]` on synthesis-pass failure with a user-visible error token:

```typescript
// Before
if (toolCallCount > 0) {
  res.write('data: [DONE]\n\n');
  return { finalText };
}

// After
if (toolCallCount > 0) {
  res.write(`data: ${JSON.stringify({ token: '\n\n_(synthesis unavailable — see results above)_' })}\n\n`);
  res.write('data: [DONE]\n\n');
  return { finalText };
}
```

## Files Changed

| File | Change |
|---|---|
| `backend/src/knowledge/knowledge.service.ts` | Add `chunkIndex` to `search()` return type and mapping |
| `backend/src/agent/providers/ollama.provider.ts` | System prompt, search result format, synthesis injection, silent failure fix |

## Files Not Changed

| File | Reason |
|---|---|
| `frontend/src/components/ChatPanel.vue` | Already handles all SSE events correctly |
| `backend/src/agent/agent.service.ts` | No change needed |
| `backend/src/knowledge/knowledge.controller.ts` | Public search endpoint is separate concern |

## Testing

- Upload a document to KB, then ask the agent a question whose answer is in the document
- Expect: green tool-result block shows numbered chunks, agent answer synthesizes with `[Source: ...]` citations
- Expect: if Ollama is unreachable on synthesis pass, agent shows `_(synthesis unavailable)_` rather than empty answer
