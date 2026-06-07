# Agentic RAG Synthesis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the agent synthesize knowledge-base search results into a cited, coherent answer instead of leaving the agent reply empty.

**Architecture:** After `search_knowledge` tool calls complete, inject an explicit `role: 'user'` synthesis-instruction message into the local `msgs` array before the next Ollama pass. This forces all model types (native and text-based tool calling) to generate a synthesis response. The search result format is upgraded to numbered citations (`[1] Source: "file", §N`) so the model has citable handles.

**Tech Stack:** NestJS / TypeScript, Jest (unit tests), Ollama NDJSON streaming.

---

## File Map

| File | Change |
|---|---|
| `backend/src/knowledge/knowledge.service.ts` | Add `chunkIndex` to `search()` return type and mapping |
| `backend/src/knowledge/knowledge.service.spec.ts` | No new tests needed — `search()` is not unit-tested (requires LanceDB); contract covered via OllamaProvider spec |
| `backend/src/agent/providers/ollama.provider.spec.ts` | Update `search_knowledge` mock to include `chunkIndex`; update expected result format; add synthesis-injection test |
| `backend/src/agent/providers/ollama.provider.ts` | System prompt, search result format, synthesis injection, silent failure fix |

---

## Task 1: Update KnowledgeService.search() return type

**Files:**
- Modify: `backend/src/knowledge/knowledge.service.ts` (line 151)
- Modify: `backend/src/agent/providers/ollama.provider.spec.ts` (line 198)

- [ ] **Step 1: Update the mock in ollama.provider.spec.ts to include `chunkIndex`**

In `backend/src/agent/providers/ollama.provider.spec.ts`, find the test `'handles search_knowledge results'` (line 197). Change the chunks array and the expected toolResult:

```typescript
// line 198 — add chunkIndex to mock data
const chunks = [{ filename: 'doc.md', chunkIndex: 0, text: 'relevant content' }];
mockKnowledgeService.search.mockResolvedValue(chunks);
```

Also update the `expect` at lines 225-228 to match the new format:

```typescript
expect(mockRes.write).toHaveBeenCalledWith(
  'data: {"toolResult":{"name":"search_knowledge","result":"[1] Source: \\"doc.md\\", §0\\nrelevant content"}}\n\n',
);
```

- [ ] **Step 2: Run the test to confirm it fails (format mismatch)**

```bash
cd backend && npx jest src/agent/providers/ollama.provider.spec.ts --testNamePattern="handles search_knowledge" --no-coverage
```

Expected: FAIL — `received "[doc.md]: relevant content"` does not match expected.

- [ ] **Step 3: Update `KnowledgeService.search()` to include `chunkIndex`**

In `backend/src/knowledge/knowledge.service.ts`, replace lines 151–160:

```typescript
async search(query: string): Promise<Array<{ filename: string; chunkIndex: number; text: string }>> {
  try {
    const vector = await this.embed(query);
    await this.ensureTable();
    const results = await this.table.search(vector).limit(5).toArray() as ChunkRecord[];
    return results.filter(r => r.fileId > 0).map(r => ({
      filename: r.filename,
      chunkIndex: r.chunkIndex,
      text: r.text,
    }));
  } catch {
    return [];
  }
}
```

---

## Task 2: Update OllamaProvider — system prompt, search format, synthesis injection, silent failure fix

**Files:**
- Modify: `backend/src/agent/providers/ollama.provider.ts`
- Modify: `backend/src/agent/providers/ollama.provider.spec.ts`

- [ ] **Step 1: Add synthesis-injection test to ollama.provider.spec.ts**

Append this test after the `'handles search_knowledge results'` test (after line 229 in `backend/src/agent/providers/ollama.provider.spec.ts`):

```typescript
it('injects synthesis prompt after search_knowledge and streams synthesis tokens', async () => {
  const chunks = [{ filename: 'guide.pdf', chunkIndex: 2, text: 'important info' }];
  mockKnowledgeService.search.mockResolvedValue(chunks);

  const reader1 = makeReader([
    JSON.stringify({
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [{ function: { name: 'search_knowledge', arguments: '{"query":"guide"}' } }],
      },
      done: false,
    }) + '\n',
  ]);
  const reader2 = makeReader([
    '{"message":{"role":"assistant","content":"According to [Source: \\"guide.pdf\\", §2], important info."},"done":false}\n',
    '{"done":true}\n',
  ]);

  const fetchSpy = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader1 } } as unknown as Response)
    .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader2 } } as unknown as Response);

  const mockRes = { write: jest.fn() };
  const signal = new AbortController().signal;

  const result = await provider.streamChat(
    [{ role: 'user', content: 'tell me about guide' }],
    'llama3.2',
    mockRes as any,
    signal,
  );

  expect(fetchSpy).toHaveBeenCalledTimes(2);
  expect(mockRes.write).toHaveBeenCalledWith(
    'data: {"token":"According to [Source: \\"guide.pdf\\", §2], important info."}\n\n',
  );
  expect(result.finalText).toBe('According to [Source: "guide.pdf", §2], important info.');
  expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
});
```

- [ ] **Step 2: Run both new/updated tests to confirm they fail**

```bash
cd backend && npx jest src/agent/providers/ollama.provider.spec.ts --testNamePattern="search_knowledge|synthesis" --no-coverage
```

Expected: FAIL — `handles search_knowledge results` fails on format; `injects synthesis prompt` fails because synthesis fetch call never happens with current code.

- [ ] **Step 3: Upgrade the system prompt in ollama.provider.ts**

In `backend/src/agent/providers/ollama.provider.ts`, replace line 89:

```typescript
// Before
{ role: 'system', content: 'You are a helpful assistant. Always respond in the same language the user writes in. For tool calls, use the provided tools.' },

// After
{
  role: 'system',
  content: [
    'You are a helpful AI assistant with access to tools including a knowledge base search.',
    'When using search_knowledge:',
    '- ALWAYS synthesize the results into a coherent, comprehensive answer — never copy-paste raw chunks.',
    '- Cite each fact inline using the format [Source: "filename.pdf", §N] where N is the section number.',
    '- If multiple sources agree, cite all of them.',
    'Respond in the same language the user writes in. For tool calls, use the provided tools.',
  ].join('\n'),
},
```

- [ ] **Step 4: Fix the search result format in `executeTool`**

In `backend/src/agent/providers/ollama.provider.ts`, replace the `search_knowledge` case (lines 261–267):

```typescript
case 'search_knowledge': {
  const chunks = await this.knowledgeService.search(args.query as string);
  if (chunks.length === 0) return 'No relevant information found in knowledge base.';
  return chunks.map((c: { filename: string; chunkIndex: number; text: string }, i: number) =>
    `[${i + 1}] Source: "${c.filename}", §${c.chunkIndex}\n${c.text}`
  ).join('\n\n---\n\n');
}
```

- [ ] **Step 5: Add synthesis injection and `hadSearchCall` tracking**

In `backend/src/agent/providers/ollama.provider.ts`, replace the tool-execution loop section (lines 195–224). The full replacement:

```typescript
let hadSearchCall = false;

for (const tc of currentToolCalls) {
  if (signal.aborted) return { finalText: '' };
  toolCallCount++;

  const name = tc.function.name;
  if (name === 'search_knowledge') hadSearchCall = true;

  let args: Record<string, unknown> = {};
  if (typeof tc.function.arguments === 'string') {
    try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
  } else if (typeof tc.function.arguments === 'object' && tc.function.arguments !== null) {
    args = tc.function.arguments as Record<string, unknown>;
  }

  res.write(`data: ${JSON.stringify({ toolCall: { name, args } })}\n\n`);

  let result = '';
  try {
    result = await this.executeTool(name, args);
  } catch (e) {
    result = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }

  res.write(`data: ${JSON.stringify({ toolResult: { name, result } })}\n\n`);

  msgs.push({
    role: 'tool',
    content: result,
  });
}

if (hadSearchCall) {
  msgs.push({
    role: 'user',
    content: 'Based on the search results above, write a comprehensive answer with inline citations [Source: "filename", §N].',
  });
}

currentToolCalls = null;
responseContent = '';
```

- [ ] **Step 6: Fix silent failure on synthesis pass**

In `backend/src/agent/providers/ollama.provider.ts`, find the block (lines 122–135):

```typescript
if (!ollamaRes.ok) {
  // If this is a follow-up iteration (after tool calls), end gracefully
  if (toolCallCount > 0) {
    res.write('data: [DONE]\n\n');
    return { finalText };
  }
```

Replace with:

```typescript
if (!ollamaRes.ok) {
  if (toolCallCount > 0) {
    res.write(`data: ${JSON.stringify({ token: '\n\n_(synthesis unavailable — see results above)_' })}\n\n`);
    res.write('data: [DONE]\n\n');
    return { finalText };
  }
```

- [ ] **Step 7: Run all provider tests**

```bash
cd backend && npx jest src/agent/providers/ollama.provider.spec.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 8: Run full backend test suite**

```bash
cd backend && npx jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
cd backend
git add src/knowledge/knowledge.service.ts src/agent/providers/ollama.provider.ts src/agent/providers/ollama.provider.spec.ts
git commit -m "feat: agentic RAG synthesis — inject synthesis prompt after KB search, add citations"
```
