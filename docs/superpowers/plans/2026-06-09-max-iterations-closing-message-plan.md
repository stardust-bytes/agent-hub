# Max Iterations Closing Message — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the ReAct loop hits `MAX_ITERATIONS`, generate a closing message from the LLM instead of silently ending.

**Architecture:** Replace the thinking-event-only handler with one final `executeStep()` call passing accumulated messages + a closing prompt. Append result to `finalText` and save to DB.

**Tech Stack:** NestJS, TypeScript, Jest

---

### Task 1: AgentLoopService — closing message on max iterations

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts:184-189`
- Modify: `backend/src/agent/services/agent-loop.service.spec.ts:233-255`

- [ ] **Step 1: Write the failing test**

Replace the existing "terminates when loop reaches MAX_ITERATIONS (10)" test to verify the closing message is generated and saved.

Edit `agent-loop.service.spec.ts`:

```typescript
describe('Max iterations', () => {
  it('generates a closing message via final LLM call when max iterations hit', async () => {
    const toolCall: StreamChunk = {
      type: 'tool_call',
      toolCall: { name: 'web_search', arguments: { q: 'test' } },
    };
    llmController.stream = jest.fn().mockImplementation(() => asyncGen([toolCall, DONE]));
    (webSearch.execute as jest.Mock).mockResolvedValue('Succeed');

    const res = mockRes();
    const signal = new AbortController().signal;
    const result = await service.run(
      'ollama', 'llama3', 'You are helpful', [], 'loop',
      defaultTools, res, signal, undefined, 'agent', defaultConfig,
    );

    // 10 loop iterations + 1 closing LLM call = 11
    expect(llmController.stream).toHaveBeenCalledTimes(11);
    // Should have the closing message appended
    expect(result).toContain('closing message');
    // Verify thinking event changed
    expect(res.write).toHaveBeenCalledWith(
      'data: ' + JSON.stringify({ thinking: 'Reached max iterations. Generating closing message...' }) + '\n\n',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/agent/services/agent-loop.service.spec.ts -t "generates a closing message" -v`
Expected: FAIL (thinking event mismatch, stream called 10 not 11 times)

- [ ] **Step 3: Implement the closing message in agent-loop.service.ts**

Replace the max-iteration handler at the end of the `run()` method (currently lines 184-189):

```typescript
if (iterationCount >= MAX_ITERATIONS) {
  res.write(`data: ${JSON.stringify({ thinking: 'Reached max iterations. Generating closing message...' })}\n\n`);
  if (sessionId) {
    await this.sessionsService.saveMessage(sessionId, 'system', 'Reached max iterations. Generating closing message...');
  }

  const closePrompt = `I have reached the maximum number of iterations. Based on the conversation and tool results above, write a closing message to the user explaining what happened and suggesting alternative approaches.`;

  const closeMessages: OllamaMessage[] = [
    ...messages,
    { role: 'user', content: closePrompt },
  ];

  const { text: closeText } = await this.executeStep(
    model, closeMessages, [], signal, providerConfig, res, sessionId,
  );

  if (closeText && sessionId) {
    await this.sessionsService.saveMessage(sessionId, 'assistant', closeText);
  }
  finalText += closeText;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/agent/services/agent-loop.service.spec.ts -t "generates a closing message" -v`
Expected: PASS

- [ ] **Step 5: Run all agent tests to verify no regressions**

Run: `npx jest src/agent -v`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts backend/src/agent/services/agent-loop.service.spec.ts
git commit -m "feat: generate LLM closing message when max iterations reached"
```
