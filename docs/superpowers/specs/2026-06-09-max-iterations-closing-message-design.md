# Max Iterations Closing Message

## Problem

When the ReAct loop reaches `MAX_ITERATIONS`, it silently sends a thinking event and `[DONE]`. The user receives no meaningful response — the LLM never generated a closing message because it was stuck in the tool-calling cycle.

## Solution

Instead of just ending the loop, make one final LLM call (with empty tools) to generate a closing message that summarizes the situation and suggests alternatives.

## Approach

**Approach 2** (user-approved): One final LLM call with accumulated context.

## Backend Changes

### `agent-loop.service.ts`

Replace the current max-iteration handler (lines 184-189):

```typescript
if (iterationCount >= MAX_ITERATIONS) {
  res.write(`data: ${JSON.stringify({ thinking: 'Reached max iterations. Generating closing message...' })}\n\n`);

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

### `agent-loop.service.spec.ts`

Add test: when loop hits max iterations, verify that a closing message is generated and streamed.
