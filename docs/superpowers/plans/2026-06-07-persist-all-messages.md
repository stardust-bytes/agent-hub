# Persist All Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save tool calls, tool results, and thinking indicators to the session database.

**Architecture:** Add `toolName` and `isResult` to ChatMessage schema. Inject SessionsService into OllamaProvider to save messages during the ReAct loop. Pass `sessionId` through from AgentService.

**Tech Stack:** Prisma, NestJS, Vue 3

---

### Task 1: Add toolName and isResult to ChatMessage schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Update schema**

Add `toolName` and `isResult` to ChatMessage in `backend/prisma/schema.prisma`:

```prisma
model ChatMessage {
  id        Int      @id @default(autoincrement())
  sessionId Int
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      String
  content   String
  toolName  String?
  isResult  Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-tool-fields-to-message
```
Expected: Migration applied, `npx prisma generate` runs automatically.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add toolName and isResult fields to ChatMessage"
```

---

### Task 2: Expand saveMessage signature + update tests

**Files:**
- Modify: `backend/src/sessions/sessions.service.ts`
- Modify: `backend/src/sessions/sessions.service.spec.ts`

- [ ] **Step 1: Add test for saveMessage with optional params**

In `backend/src/sessions/sessions.service.spec.ts`, replace the existing `saveMessage` test:

```ts
  describe('saveMessage', () => {
    it('creates a ChatMessage record with role and content', async () => {
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 1 });
      await service.saveMessage(1, 'user', 'test message');
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: { sessionId: 1, role: 'user', content: 'test message' },
      });
    });

    it('creates a ChatMessage record with toolName and isResult', async () => {
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 2 });
      await service.saveMessage(1, 'tool', 'create_task({"title":"x"})', 'create_task', false);
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: { sessionId: 1, role: 'tool', content: 'create_task({"title":"x"})', toolName: 'create_task', isResult: false },
      });
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/sessions/sessions.service.spec.ts --verbose
```
Expected: 1 new test FAIL — "saveMessage with tool params" (type mismatch)

- [ ] **Step 3: Expand saveMessage signature**

In `backend/src/sessions/sessions.service.ts`, change the `saveMessage` method:

```ts
  async saveMessage(sessionId: number, role: string, content: string, toolName?: string, isResult?: boolean) {
    return this.prisma.chatMessage.create({
      data: { sessionId, role, content, toolName, isResult },
    });
  }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/sessions/sessions.service.spec.ts --verbose
```
Expected: ALL tests PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/sessions/sessions.service.ts backend/src/sessions/sessions.service.spec.ts
git commit -m "feat: expand saveMessage to accept toolName and isResult"
```

---

### Task 3: Save messages in OllamaProvider during ReAct loop

**Files:**
- Modify: `backend/src/agent/providers/ollama.provider.ts`
- Modify: `backend/src/agent/providers/ollama.provider.spec.ts`

- [ ] **Step 1: Add SessionsService mock to test file**

In `backend/src/agent/providers/ollama.provider.spec.ts`, add a mock SessionsService after the KnowledgeService mock (around line 38-41):

```ts
  const mockSessionsService = {
    saveMessage: jest.fn().mockResolvedValue(undefined),
  };
```

Add it to the providers array in `beforeEach`:
```ts
        { provide: SessionsService, useValue: mockSessionsService },
```

Add the import at top:
```ts
import { SessionsService } from '../../sessions/sessions.service';
```

- [ ] **Step 2: Update existing tests that check `executeTool`**

The existing tests `get_task returns task details` and `delete_tasks deletes multiple tasks` verify `mockTasksService.findOne` and `mockTasksService.removeMany`. No changes needed — just make sure the SessionsService mock doesn't interfere.

The provider test doesn't directly test persistence from the provider (it mocks the provider). The saveMessage calls happen inside the provider, so we should add a test that verifies the provider saves tool messages.

Actually, this is complex because `streamChat()` doesn't currently take `sessionId`. The saveMessage calls happen in `OllamaProvider.streamChat()` but we first need to pass `sessionId` to it. That's Task 4.

For this task, let me add the mock and a basic test, then Task 4 handles passing sessionId.

- [ ] **Step 3: Update tests to verify saveMessage is called**

After the `delete_tasks deletes multiple tasks` test, add:

```ts
  it('saves tool call and result messages during execution', async () => {
    mockTasksService.findOne.mockResolvedValue({
      id: 10, title: 'Test', status: 'TODO', priority: 0, description: null, dueDate: null,
    });
    mockSessionsService.saveMessage.mockResolvedValue(undefined);

    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      {
        type: 'tool_call',
        toolCall: { name: 'get_task', arguments: { id: 10 } },
      },
      { type: 'done' },
    ]));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'show task 10' }], 'llama3.2', mockRes as any, signal);

    // Provider should have saved the user message
    expect(mockSessionsService.saveMessage).toHaveBeenCalled();
  });
```

- [ ] **Step 4: Inject SessionsService into OllamaProvider and save messages**

In `backend/src/agent/providers/ollama.provider.ts`:

Add `SessionsService` to imports:
```ts
import { SessionsService } from '../../sessions/sessions.service';
```

Add to constructor:
```ts
    private readonly sessionsService: SessionsService,
```

In the `executeTool` method, save tool call and result messages. Add these calls before `res.write` for tool calls (around line 117) and before `res.write` for tool results (around line 133). But we need `sessionId` first — that comes from Task 4.

For now, change the `streamChat` signature to accept an optional `sessionId`, and save messages at these points:

After emitting toolCall (after line 117), add:
```ts
          if (sessionId) {
            await this.sessionsService.saveMessage(
              sessionId, 'tool', `${name}(${JSON.stringify(args)})`, name, false,
            );
          }
```

After emitting toolResult (after line 133), add:
```ts
          if (sessionId) {
            await this.sessionsService.saveMessage(
              sessionId, 'tool', result, name, true,
            );
          }
```

After emitting thinking (line 68, and line 148), add:
```ts
          if (sessionId) {
            await this.sessionsService.saveMessage(sessionId, 'system', thinkingText);
          }
```

Update the `streamChat` signature to accept `sessionId?: number`:
```ts
  async streamChat(
    messages: OllamaMessage[],
    model: string,
    res: Response,
    signal: AbortSignal,
    sessionId?: number,
  ): Promise<{ finalText: string }> {
```

- [ ] **Step 5: Run tests to verify**

```bash
npx jest src/agent --verbose
```
Expected: ALL tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/agent/providers/ollama.provider.ts backend/src/agent/providers/ollama.provider.spec.ts
git commit -m "feat: save tool call and result messages in OllamaProvider"
```

---

### Task 4: Pass sessionId from AgentService to provider

**Files:**
- Modify: `backend/src/agent/agent.service.ts`
- Modify: `backend/src/agent/agent.service.spec.ts`

- [ ] **Step 1: Update AgentService to pass sessionId**

In `backend/src/agent/agent.service.ts`, change the `streamChat` call to pass `sessionId`:

```ts
    const { finalText } = await this.provider.streamChat(messages, model, res, signal, sessionId);
```

That's it — `sessionId` is already available as a parameter.

- [ ] **Step 2: Run tests to verify**

```bash
npx jest src/agent/agent.service.spec.ts --verbose
```
Expected: ALL tests PASS (3 tests). The mock provider ignores the extra argument.

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/agent.service.ts
git commit -m "feat: pass sessionId to provider.streamChat"
```

---

### Task 5: Update frontend loadSession

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Update loadSession to handle toolName and isResult**

In `frontend/src/components/ChatPanel.vue`, the `loadSession` function (around line 198-214). Currently it maps API messages to frontend Message type:

```ts
      const history = await res.json() as Array<{ role: string; content: string; createdAt: string }>
      for (const msg of history) {
        messages.value.push({
          role: msg.role as 'user' | 'agent',
          content: msg.content,
          timestamp: new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
        })
      }
```

Update the type assertion and mapping to handle tool/system messages:

```ts
      const history = await res.json() as Array<{ role: string; content: string; createdAt: string; toolName?: string; isResult?: boolean }>
      for (const msg of history) {
        if (msg.toolName !== undefined) {
          messages.value.push({
            role: 'tool',
            content: msg.content,
            timestamp: new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
            toolName: msg.toolName,
            isResult: msg.isResult ?? false,
          })
        } else if (msg.role === 'system') {
          messages.value.push({
            role: 'system',
            content: msg.content,
            timestamp: new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
          })
        } else {
          messages.value.push({
            role: msg.role as 'user' | 'agent',
            content: msg.content,
            timestamp: new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
          })
        }
      }
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: load tool and system messages from session history"
```
