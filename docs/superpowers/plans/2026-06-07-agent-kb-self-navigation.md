# Agent KB Self-Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `search_knowledge` returns no results, the agent acknowledges the gap and self-navigates — asking clarifying questions if the query is vague, suggesting available KB files if clear, or answering from general LLM knowledge (with disclaimer) for non-internal questions.

**Architecture:** Two prompt-only changes: (1) replace the existing `search_knowledge` guidance in `buildSystemPrompt()` with a comprehensive KB-handling section covering both found and empty cases; (2) add a `KB_NO_RESULTS` sentinel constant and conditional injection logic in `OllamaProvider.streamChat()` that fetches `KnowledgeService.findAll()` when KB is empty and injects a different prompt.

**Tech Stack:** NestJS 10, TypeScript strict, Jest, Ollama SSE streaming

---

## File Map

| File | Change |
|---|---|
| `backend/src/agent/services/context-builder.service.ts` | Replace `search_knowledge` prompt block with comprehensive KB guidance |
| `backend/src/agent/services/context-builder.service.spec.ts` | **Create** — 1 test for KB guidance presence in system prompt |
| `backend/src/agent/providers/ollama.provider.ts` | Add `KB_NO_RESULTS` constant; update `executeTool`; add conditional injection in `streamChat` |
| `backend/src/agent/providers/ollama.provider.spec.ts` | Add `findAll` to mock; add 4 new test cases |

---

## Task 1: Create context-builder spec and add KB guidance to system prompt

**Files:**
- Create: `backend/src/agent/services/context-builder.service.spec.ts`
- Modify: `backend/src/agent/services/context-builder.service.ts`

- [ ] **Step 1: Create the failing test file**

Create `backend/src/agent/services/context-builder.service.spec.ts` with this content:

```ts
import { Test } from '@nestjs/testing';
import { ContextBuilderService } from './context-builder.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentRunState } from '../dto/agent-run-state';

describe('ContextBuilderService', () => {
  let service: ContextBuilderService;

  const mockPrisma = {
    chatMessage: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ContextBuilderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(ContextBuilderService);
  });

  it('system prompt contains KB guidance for empty results', async () => {
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0);
    expect(context.systemPrompt).toContain(
      'If no results AND the question is about internal documents',
    );
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npx jest src/agent/services/context-builder.service.spec.ts --no-coverage
```

Expected: FAIL — `expect(received).toContain(...)` — the string is not in the current prompt.

- [ ] **Step 3: Replace the search_knowledge guidance block in buildSystemPrompt**

In `backend/src/agent/services/context-builder.service.ts`, find and replace the existing `When using search_knowledge:` section.

Current (lines ~68-77):
```ts
    lines.push('',
      'When using search_knowledge:',
      '- ALWAYS synthesize the results into a coherent, comprehensive answer.',
      '- Cite each fact inline using the format [Source: "filename.pdf", §N] where N is the section number.',
      '- If multiple sources agree, cite all of them.',
      '',
      'Respond in the same language the user writes in.',
```

Replace with:
```ts
    lines.push('',
      'When handling knowledge base searches (search_knowledge tool):',
      '- If results are found: synthesize into a coherent answer. Cite each fact inline with [Source: "filename", §N]. Cite all sources that agree.',
      '- If no results AND the question is about internal documents (reports, contracts, procedures, company-specific data): DO NOT use general knowledge. Acknowledge the gap, then either ask 1-2 clarifying questions (if the query is vague) or suggest uploading relevant documents.',
      '- If no results AND the question is general knowledge (concepts, how-to, definitions): answer from your own knowledge with a clear disclaimer such as "Based on general knowledge (not from your documents):..."',
      '',
      'Respond in the same language the user writes in.',
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd backend && npx jest src/agent/services/context-builder.service.spec.ts --no-coverage
```

Expected: PASS — 1 test passes.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
cd backend && npx jest --no-coverage
```

Expected: All existing tests pass. The change to the system prompt string doesn't break any existing spec because no test asserts the exact prompt content.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/agent/services/context-builder.service.ts src/agent/services/context-builder.service.spec.ts
git commit -m "feat: add KB self-navigation guidance to agent system prompt"
```

---

## Task 2: Extract KB_NO_RESULTS constant and update executeTool

**Files:**
- Modify: `backend/src/agent/providers/ollama.provider.ts`

- [ ] **Step 1: Add KB_NO_RESULTS constant and update executeTool**

In `backend/src/agent/providers/ollama.provider.ts`, add a module-level constant after the imports and update the `search_knowledge` case in `executeTool`.

Add after the last import line (before `@Injectable()`):
```ts
const KB_NO_RESULTS = 'No relevant information found in knowledge base.';
```

Update the `search_knowledge` case in `executeTool` (currently returns the string literal inline):

Current:
```ts
      case 'search_knowledge': {
        const chunks = await this.knowledgeService.search(args.query as string);
        if (chunks.length === 0) return 'No relevant information found in knowledge base.';
        return chunks.map((c, i) =>
          `[${i + 1}] Source: "${c.filename}", §${c.chunkIndex}\n${c.text}`
        ).join('\n\n---\n\n');
      }
```

Replace with:
```ts
      case 'search_knowledge': {
        const chunks = await this.knowledgeService.search(args.query as string);
        if (chunks.length === 0) return KB_NO_RESULTS;
        return chunks.map((c, i) =>
          `[${i + 1}] Source: "${c.filename}", §${c.chunkIndex}\n${c.text}`
        ).join('\n\n---\n\n');
      }
```

- [ ] **Step 2: Run existing tests to confirm no regression**

```bash
cd backend && npx jest src/agent/providers/ollama.provider.spec.ts --no-coverage
```

Expected: All 8 existing tests pass. This is a pure refactor — behavior is identical.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/agent/providers/ollama.provider.ts
git commit -m "refactor: extract KB_NO_RESULTS sentinel constant in OllamaProvider"
```

---

## Task 3: Implement conditional injection + add test cases

**Files:**
- Modify: `backend/src/agent/providers/ollama.provider.spec.ts`
- Modify: `backend/src/agent/providers/ollama.provider.ts`

- [ ] **Step 1: Add findAll to the mock and write 4 failing tests**

In `backend/src/agent/providers/ollama.provider.spec.ts`:

1. Add `findAll` to `mockKnowledgeService` (line ~39):

Current:
```ts
  const mockKnowledgeService = {
    search: jest.fn().mockResolvedValue([]),
  };
```

Replace with:
```ts
  const mockKnowledgeService = {
    search: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
  };
```

2. Add the 4 new test cases at the end of the `describe` block, before the closing `});`:

```ts
  it('injects no-results prompt with file list when KB search is empty and files exist', async () => {
    mockKnowledgeService.search.mockResolvedValue([]);
    mockKnowledgeService.findAll.mockResolvedValue([
      { id: 1, filename: 'report.pdf' },
      { id: 2, filename: 'handbook.docx' },
    ]);

    const stream1 = makeStream([
      { type: 'tool_call', toolCall: { name: 'search_knowledge', arguments: { query: 'annual report' } } },
      { type: 'done' },
    ]);
    const stream2 = makeStream([
      { type: 'token', token: 'I could not find that in your KB.' },
      { type: 'done' },
    ]);
    mockLLMCaller.streamChat.mockReturnValueOnce(stream1).mockReturnValueOnce(stream2);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;
    await provider.streamChat(
      [{ role: 'user', content: 'annual report?' }],
      'llama3.2',
      mockRes as any,
      signal,
    );

    expect(mockLLMCaller.streamChat).toHaveBeenCalledTimes(2);
    const secondCallMessages = mockLLMCaller.streamChat.mock.calls[1][1] as Array<{ role: string; content: string }>;
    const injected = secondCallMessages.find(m => m.content.includes('no results'));
    expect(injected).toBeDefined();
    expect(injected!.content).toContain('"report.pdf"');
    expect(injected!.content).toContain('"handbook.docx"');
  });

  it('injects "none indexed yet" when KB is empty and no files are indexed', async () => {
    mockKnowledgeService.search.mockResolvedValue([]);
    mockKnowledgeService.findAll.mockResolvedValue([]);

    const stream1 = makeStream([
      { type: 'tool_call', toolCall: { name: 'search_knowledge', arguments: { query: 'anything' } } },
      { type: 'done' },
    ]);
    const stream2 = makeStream([
      { type: 'token', token: 'No documents found.' },
      { type: 'done' },
    ]);
    mockLLMCaller.streamChat.mockReturnValueOnce(stream1).mockReturnValueOnce(stream2);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;
    await provider.streamChat(
      [{ role: 'user', content: 'test' }],
      'llama3.2',
      mockRes as any,
      signal,
    );

    const secondCallMessages = mockLLMCaller.streamChat.mock.calls[1][1] as Array<{ role: string; content: string }>;
    const injected = secondCallMessages.find(m => m.content.includes('no results'));
    expect(injected).toBeDefined();
    expect(injected!.content).toContain('none indexed yet');
  });

  it('uses synthesis prompt when KB search returns results (no regression)', async () => {
    mockKnowledgeService.search.mockResolvedValue([
      { filename: 'guide.pdf', chunkIndex: 1, text: 'some content' },
    ]);

    const stream1 = makeStream([
      { type: 'tool_call', toolCall: { name: 'search_knowledge', arguments: { query: 'guide' } } },
      { type: 'done' },
    ]);
    const stream2 = makeStream([
      { type: 'token', token: 'Based on guide.pdf...' },
      { type: 'done' },
    ]);
    mockLLMCaller.streamChat.mockReturnValueOnce(stream1).mockReturnValueOnce(stream2);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;
    await provider.streamChat(
      [{ role: 'user', content: 'guide?' }],
      'llama3.2',
      mockRes as any,
      signal,
    );

    const secondCallMessages = mockLLMCaller.streamChat.mock.calls[1][1] as Array<{ role: string; content: string }>;
    const injected = secondCallMessages.find(m => m.content.includes('inline citations'));
    expect(injected).toBeDefined();
    expect(mockKnowledgeService.findAll).not.toHaveBeenCalled();
  });

  it('falls back gracefully when findAll throws during KB empty handling', async () => {
    mockKnowledgeService.search.mockResolvedValue([]);
    mockKnowledgeService.findAll.mockRejectedValue(new Error('DB error'));

    const stream1 = makeStream([
      { type: 'tool_call', toolCall: { name: 'search_knowledge', arguments: { query: 'x' } } },
      { type: 'done' },
    ]);
    const stream2 = makeStream([
      { type: 'token', token: 'Sorry, I cannot find that.' },
      { type: 'done' },
    ]);
    mockLLMCaller.streamChat.mockReturnValueOnce(stream1).mockReturnValueOnce(stream2);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await expect(
      provider.streamChat([{ role: 'user', content: 'x' }], 'llama3.2', mockRes as any, signal),
    ).resolves.not.toThrow();

    const secondCallMessages = mockLLMCaller.streamChat.mock.calls[1][1] as Array<{ role: string; content: string }>;
    const injected = secondCallMessages.find(m => m.content.includes('no results'));
    expect(injected).toBeDefined();
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest src/agent/providers/ollama.provider.spec.ts --no-coverage
```

Expected: The 4 new tests FAIL. The 8 existing tests PASS. Failures should say things like `Cannot read properties of undefined` (because `findAll` isn't called yet) or assertion mismatches.

- [ ] **Step 3: Implement conditional injection in OllamaProvider.streamChat**

In `backend/src/agent/providers/ollama.provider.ts`, find the `search_knowledge` injection block inside the `for (const tc of toolCalls)` loop.

Current:
```ts
          if (stepName === 'search_knowledge') {
            res.write(`data: ${JSON.stringify({ thinking: 'Synthesizing search results...' })}\n\n`);
            contextMessages.push({
              role: 'user',
              content: `I searched the knowledge base and found:\n\n${String(matchingStep?.result ?? '')}\n\nBased on these results, provide a comprehensive answer with inline citations [Source: "filename", §N].`,
            });
          } else {
```

Replace with:
```ts
          if (stepName === 'search_knowledge') {
            res.write(`data: ${JSON.stringify({ thinking: 'Synthesizing search results...' })}\n\n`);
            const kbResult = String(matchingStep?.result ?? '');
            if (kbResult === KB_NO_RESULTS) {
              let fileList = 'none indexed yet';
              try {
                const files = await this.knowledgeService.findAll();
                if (files.length > 0) {
                  fileList = files.slice(0, 10).map(f => `"${f.filename}"`).join(', ');
                }
              } catch { /* fallback: leave fileList as 'none indexed yet' */ }
              contextMessages.push({
                role: 'user',
                content: `The knowledge base returned no results for the query.\nAvailable KB files: ${fileList}.\nFollow the KB guidance in your system prompt to decide whether to use general knowledge (with disclaimer), ask clarifying questions, or suggest relevant files to the user.`,
              });
            } else {
              contextMessages.push({
                role: 'user',
                content: `I searched the knowledge base and found:\n\n${kbResult}\n\nBased on these results, provide a comprehensive answer with inline citations [Source: "filename", §N].`,
              });
            }
          } else {
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
cd backend && npx jest src/agent/providers/ollama.provider.spec.ts --no-coverage
```

Expected: All 12 tests PASS (8 existing + 4 new).

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
cd backend && npx jest --no-coverage
```

Expected: All tests pass. Note the total count — it should be higher than before by 5 tests (4 provider + 1 context-builder).

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/agent/providers/ollama.provider.ts src/agent/providers/ollama.provider.spec.ts
git commit -m "feat: self-navigate when KB search returns no results"
```
