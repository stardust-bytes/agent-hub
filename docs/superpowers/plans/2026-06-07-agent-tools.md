# Phase 6 — Agent Tools & Agentic Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI agent can autonomously create/update/list tasks and search knowledge base during chat, with tool calls shown as separate cards.

**Architecture:** Define tool schemas in Ollama function-calling format. `OllamaProvider` sends tools with each chat request, parses `tool_calls` from NDJSON, emits SSE events for each call/result, executes via `TasksService`/`KnowledgeService`, and feeds results back to Ollama for final response.

**Tech Stack:** NestJS 10, Ollama function calling API, Vue 3, SSE streaming.

---

## File Map

**Backend — Modify:**
- `backend/src/agent/providers/ollama.provider.ts` — add tool schemas, tool_calls parsing, execution loop
- `backend/src/agent/providers/ollama.provider.spec.ts` — update tests
- `backend/src/agent/agent.service.ts` — inject TasksService, pass to OllamaProvider

**Frontend — Modify:**
- `frontend/src/components/ChatPanel.vue` — tool card rendering, SSE parser for toolCall/toolResult

---

## Task 1: Define Tool Schemas + Execution in OllamaProvider

**Files:**
- Modify: `backend/src/agent/providers/ollama.provider.ts`
- Modify: `backend/src/agent/providers/ollama.provider.spec.ts`

- [ ] **Step 1: Read current provider**

Read `backend/src/agent/providers/ollama.provider.ts` — it accepts `context` and sends a single request to Ollama, streaming tokens back.

- [ ] **Step 2: Understand the new flow**

The new flow for `streamChat`:
1. Build messages array: system context + user message
2. Send to Ollama with `tools` and `stream: true`
3. Read NDJSON stream, handling two types:
   - `message.content` → emit token SSE (existing)
   - `message.tool_calls` → emit toolCall SSE, execute, emit toolResult SSE, then send results back to Ollama
4. Loop: if Ollama returns tool_calls again, execute again. Keep going until Ollama returns text content.
5. Emit `[DONE]`

- [ ] **Step 3: Write the implementation**

The implementation is complex. Key changes to `ollama.provider.ts`:

1. Add `TasksService` and `KnowledgeService` injection
2. Define `TOOLS` array (tool schemas in Ollama format)
3. Replace the single `fetch` call with a loop that supports tool_calls

The loop pseudo-code:
```
messages = [system context, user message]
do {
  response = fetch POST /api/chat with { model, messages, stream: true, tools: TOOLS }
  for each NDJSON line:
    if message.content: emit token SSE
    if message.tool_calls:
      for each tool_call:
        emit toolCall SSE
        result = execute(tool_call)
        emit toolResult SSE
        push tool result as new message
      continue outer loop (send messages back to Ollama)
} while (tool_calls were received)
emit [DONE]
```

Tool execution mapping:
- `create_task` → `this.tasksService.create(dto)`
- `update_task` → `this.tasksService.update(id, dto)`
- `list_tasks` → `this.tasksService.findAll()`
- `search_knowledge` → `this.knowledgeService.search(query)`

- [ ] **Step 4: Update the spec tests**

Update `ollama.provider.spec.ts` to mock `TasksService` and `KnowledgeService`. The existing 4 tests should still pass with the new injection (just add mocks).

- [ ] **Step 5: Run tests to verify**

```bash
cd backend && npx jest src/agent/providers/ --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/agent/providers/ollama.provider.ts backend/src/agent/providers/ollama.provider.spec.ts
git commit -m "feat: add tool schemas and execution loop to OllamaProvider"
```

---

## Task 2: Wire AgentService with TasksService

**Files:**
- Modify: `backend/src/agent/agent.service.ts`
- Modify: `backend/src/agent/agent.service.spec.ts`

- [ ] **Step 1: Remove RAG search from AgentService (now handled by tool)**

Since `search_knowledge` is now a tool, remove the automatic RAG search from `AgentService.streamChat()`. The provider handles all tool logic internally.

Update `backend/src/agent/agent.service.ts` to remove `KnowledgeService` injection and the RAG search call:

```typescript
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { OllamaProvider } from './providers/ollama.provider';

@Injectable()
export class AgentService {
  constructor(private readonly provider: OllamaProvider) {}

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<void> {
    await this.provider.streamChat(message, model, res, signal);
  }
}
```

- [ ] **Step 2: Update spec**

Strip the KnowledgeService mock. Tests should verify delegation to provider (same as before Phase 5).

```typescript
import { Test } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';

describe('AgentService', () => {
  let service: AgentService;
  const mockProvider = { streamChat: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: OllamaProvider, useValue: mockProvider },
      ],
    }).compile();
    service = module.get(AgentService);
    jest.clearAllMocks();
  });

  it('streamChat delegates to provider', async () => {
    const mockRes = {} as any;
    const signal = new AbortController().signal;
    await service.streamChat('hello', 'llama3.2', mockRes, signal);
    expect(mockProvider.streamChat).toHaveBeenCalledWith('hello', 'llama3.2', mockRes, signal);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd backend && npx jest src/agent/ --no-coverage
```

Expected: PASS (7 tests — 5 controller + 2 service)

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/agent.service.ts backend/src/agent/agent.service.spec.ts
git commit -m "refactor: remove automatic RAG from AgentService, tools handle it now"
```

---

## Task 3: Frontend — Tool Card Rendering in ChatPanel

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Add 'tool' role to Message interface**

```typescript
interface Message {
  role: 'user' | 'agent' | 'system' | 'tool'
  content: string
  timestamp: string
  typing?: boolean
  toolName?: string
  isResult?: boolean
}
```

- [ ] **Step 2: Add SSE parsing for toolCall and toolResult events**

In the SSE parsing loop (in `submit()`), add handlers for `toolCall` and `toolResult`:

```typescript
if (parsed.toolCall) {
  const argsStr = Object.entries(parsed.toolCall.args)
    .map(([k, v]) => `${k}=${v}`).join(', ')
  messages.value.push({
    role: 'tool',
    content: `${parsed.toolCall.name}(${argsStr})`,
    timestamp: now(),
    toolName: parsed.toolCall.name,
    isResult: false,
  })
  await scrollToBottom()
} else if (parsed.toolResult) {
  messages.value.push({
    role: 'tool',
    content: parsed.toolResult.result,
    timestamp: now(),
    toolName: parsed.toolResult.name,
    isResult: true,
  })
  await scrollToBottom()
} else if (parsed.token) {
  // existing token handling
}
```

- [ ] **Step 3: Add tool card rendering in template**

Add a new template section for tool messages:

```html
<div v-else-if="msg.role === 'tool'" class="font-mono">
  <div class="text-xs mb-1 text-[#888888]">
    <span v-if="!msg.isResult" class="text-[#FFA500]">[⚙]</span>
    <span v-else class="text-cyber-green">[result]</span>
    · {{ msg.timestamp }}
  </div>
  <div class="text-xs bg-cyber-dark px-2 py-1.5 rounded" :class="msg.isResult ? 'text-cyber-green' : 'text-[#FFA500]'">
    {{ msg.content }}
  </div>
</div>
```

- [ ] **Step 4: Update roleColor and rolePrefix functions**

```typescript
function rolePrefix(role: string): string {
  if (role === 'user') return t('chat.user.prefix')
  if (role === 'agent') return t('chat.agent.prefix')
  if (role === 'system') return t('chat.system.prefix')
  return ''
}
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npm run build 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: add tool card rendering and SSE parsing for tool calls"
```

---

## Task 4: Final Verification

- [ ] **Step 1: Full frontend build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds.

- [ ] **Step 2: Full backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS (~13 suites, ~43 tests).

- [ ] **Step 3: Review commit log**

```bash
git log --oneline -6
```
