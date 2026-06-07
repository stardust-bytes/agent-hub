# Agent KB Self-Navigation — Design Spec

**Date:** 2026-06-07
**Status:** Approved

---

## Problem

When `search_knowledge` returns no results, `OllamaProvider` injects a synthesis prompt asking the LLM to "provide a comprehensive answer with inline citations" — even though there is nothing to synthesize. The LLM responds vaguely or incorrectly instead of clearly acknowledging the gap and guiding the conversation forward.

---

## Goal

The agent self-navigates when KB returns empty results:
- If the question is about **internal documents** and KB is empty → acknowledge the gap, then ask 1-2 clarifying questions (if query is vague) or suggest available KB files and offer to upload more.
- If the question is **general knowledge** → answer from LLM knowledge with a clear disclaimer.
- The LLM decides which path based on context (Approach A: prompt-only, no backend routing logic).

---

## Approach

Prompt-only changes to two existing files. No new files, no API contract changes, no SSE event format changes.

---

## Changes

### 1. `ContextBuilderService.buildSystemPrompt()` — add KB guidance section

Append the following block to the system prompt:

```
When handling knowledge base searches:
- If results are found: synthesize with inline citations [Source: "filename", §N].
- If no results AND the question is about internal documents (reports, contracts,
  procedures, company-specific data): DO NOT use general knowledge. Acknowledge
  the gap, then either ask 1-2 clarifying questions (if the query is vague) or
  suggest uploading relevant documents.
- If no results AND the question is general knowledge (concepts, how-to,
  definitions): answer from your own knowledge with a clear disclaimer such as
  "Based on general knowledge (not from your documents):..."
```

### 2. `OllamaProvider.streamChat()` — conditional injection after `search_knowledge`

Current behavior (unchanged when results exist):
```ts
contextMessages.push({
  role: 'user',
  content: `I searched the knowledge base and found:\n\n${result}\n\nBased on these results, provide a comprehensive answer with inline citations [Source: "filename", §N].`,
});
```

New behavior when KB is empty — detected by `chunks.length === 0` inside `executeTool` (not string comparison). Extract the detection into a shared constant `KB_NO_RESULTS` used by both `executeTool` (as the return value) and the injection logic (as the sentinel to branch on):

1. Call `KnowledgeService.findAll()` to get indexed file list.
2. If call fails, use empty list (graceful fallback).
3. Format file list: take up to 10 most recent filenames to avoid token bloat. If none, use `"none indexed yet"`.
4. Inject:

```ts
contextMessages.push({
  role: 'user',
  content: `The knowledge base returned no results for the query.\nAvailable KB files: ${fileList}.\nFollow the KB guidance in your system prompt to decide whether to use general knowledge (with disclaimer), ask clarifying questions, or suggest relevant files to the user.`,
});
```

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| KB has no indexed files | Inject `"Available KB files: none indexed yet."` — LLM suggests uploading |
| KB has files but query doesn't match | Inject file list — LLM suggests relevant files or rephrases |
| `findAll()` throws | Fallback: inject without file list — LLM still handles gracefully |
| KB has results | Unchanged — existing synthesis prompt applies |
| >10 files indexed | Only inject 10 most recent filenames |

---

## Testing

All new tests go into existing spec files. No new test files.

### `ollama.provider.spec.ts`

| # | Test | Assert |
|---|---|---|
| 1 | KB empty, `findAll` returns files | Injection contains `"no results"` + filename list |
| 2 | KB empty, `findAll` returns `[]` | Injection contains `"none indexed yet"` |
| 3 | KB has results | Existing synthesis prompt used — no regression |
| 4 | `findAll()` throws | Stream continues, fallback prompt injected without file list |

### `context-builder.service.spec.ts`

| # | Test | Assert |
|---|---|---|
| 5 | `buildSystemPrompt()` output | Contains `"If no results AND the question is about internal documents"` |

---

## Files Changed

| File | Change type |
|---|---|
| `backend/src/agent/services/context-builder.service.ts` | Add KB guidance block to `buildSystemPrompt()` |
| `backend/src/agent/providers/ollama.provider.ts` | Add conditional injection when `search_knowledge` returns empty |
| `backend/src/agent/providers/ollama.provider.spec.ts` | Add 4 new test cases |
| `backend/src/agent/services/context-builder.service.spec.ts` | Add 1 new test case |

---

## Out of Scope

- Secondary KB re-query with reformulated search terms (Approach 3 — deferred)
- Backend heuristics for classifying query type (user chose LLM-decides)
- Any changes to `LLMCallerService`, `AgentService`, `KnowledgeService`, or SSE event format
