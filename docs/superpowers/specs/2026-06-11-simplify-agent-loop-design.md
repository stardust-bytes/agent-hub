# Simplify Agent Loop to Claude Code Style

## Overview

Remove hard-coded limits (MAX_ITERATIONS, MAX_RETRIES, fallback map) and the EVALUATING/CORRECTING state machine phases from the agent loop. Let the LLM fully self-evaluate and self-correct, matching Claude Code's approach.

## Motivation

The current loop has a rigid state machine that interferes with the LLM's natural reasoning:

| Current Limitation | Problem |
|---|---|
| `MAX_ITERATIONS = 100` | Hard cap on LLM reasoning depth |
| `MAX_RETRIES = 2` | LLM can't decide to retry on its own |
| `evaluateResult()` | Hardcoded "starts with Error:" heuristic blocks valid tool results |
| `findFallbackTool()` | Static map can't adapt to context |
| `generateCloseMessage()` | Synthetic close message interrupts natural flow |

## Architecture

```
New loop (Claude Code style):

while (!signal.aborted) {
  LLM processes messages → decides: 
    a) Call tool(s) → execute → add result to messages → continue
    b) Respond with final answer → done
  
  No artificial limits. No evaluation/correction phases.
  LLM naturally decides when to retry, fall back, or conclude.
}
```

## Changes

### Removed Constants and Fields

```typescript
// REMOVED:
const MAX_RETRIES = 2;
const MAX_ITERATIONS = 100;

// REMOVED from AgentLoopService:
private currentPlan: string[] = [];
private retryCount = 0;
private failedTool: string | null = null;

// REMOVED methods:
evaluateResult(toolName, result)    → LLM self-evaluates
findFallbackTool(failedTool)        → LLM chooses alternative
generateCloseMessage(...)           → No synthetic close
```

### Simplified AgentState

```typescript
// Before
enum AgentState { PLANNING, EXECUTING, EVALUATING, CORRECTING, RESPONDING, DONE }

// After  
enum AgentState { PLANNING, EXECUTING, RESPONDING, DONE }
```

### New `run()` Method

```typescript
async run(...): Promise<string> {
  this.state = AgentState.PLANNING;
  let messages = this.llmController.buildMessages(systemPrompt, history, userMessage);
  let finalText = '';

  while (!signal.aborted) {
    this.state = AgentState.EXECUTING;

    const { text, toolCalls } = await this.executeStep(
      model, messages, activeTools, signal, providerConfig, res, sessionId, providerType,
    );

    if (text && sessionId) {
      await this.sessionsService.saveMessage(sessionId, 'assistant', text);
    }
    finalText += text;

    if (toolCalls.length === 0) break;  // LLM decided done

    messages = this.addToolCallsToMessages(messages, text, toolCalls, reasoningContent);

    for (const tc of toolCalls) {
      if (signal.aborted) break;

      const name = tc.name;
      const toolCallId = `call_${idx}_${name}`;
      const args = this.normalizeArgs(tc.arguments);

      res.write(`data: ${JSON.stringify({ toolCall: { name, args } })}\n\n`);
      if (sessionId) {
        await this.sessionsService.saveMessage(sessionId, 'tool', `${name}(${JSON.stringify(args)})`, name, false);
      }

      const allowed = await this.permissionsService.isAllowed(name);
      if (!allowed) {
        const denyMsg = `Tool "${name}" is not permitted by workspace policy.`;
        res.write(`data: ${JSON.stringify({ toolResult: { name, result: denyMsg } })}\n\n`);
        if (sessionId) {
          await this.sessionsService.saveMessage(sessionId, 'tool', denyMsg, name, true);
        }
        messages.push({ role: 'tool', content: denyMsg, toolCallId });
        continue;
      }

      let result: string;
      if (name === 'spawn_subagent') {
        const task = typeof args === 'object' && args !== null ? String((args as any).task ?? '') : '';
        if (!task) {
          result = 'Error: spawn_subagent requires a "task" parameter';
        } else {
          try {
            result = await this.subagentService.spawn(
              task, providerType, model, providerConfig,
              activeTools, signal, res, sessionId,
              mode as 'chat' | 'agent' | 'cowork',
            );
          } catch (e) {
            result = `Error: Subagent failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
          }
        }
      } else if (name === 'delegate') {
        const argsObj = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {};
        const tasks = argsObj.tasks;
        const taskList = Array.isArray(tasks) ? tasks.map(String) : [];

        if (taskList.length === 0) {
          result = 'Error: delegate requires a non-empty "tasks" array';
        } else {
          try {
            result = await this.subagentService.delegate(
              taskList, providerType, model, providerConfig,
              activeTools, signal, res, sessionId,
              mode as 'chat' | 'agent' | 'cowork',
            );
          } catch (e) {
            result = `Error: Delegate failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
          }
        }
      } else {
        try {
          result = await this.executeTool(name, args, { mode: mode as 'chat' | 'agent' | 'cowork', sessionId: sessionId ?? 0 });
        } catch (e) {
          result = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
        }
      }

      if (result.startsWith('[PLAN_CREATED]')) {
        // ... existing plan creation logic (unchanged) ...
      }

      res.write(`data: ${JSON.stringify({ toolResult: { name, result } })}\n\n`);
      if (sessionId) {
        await this.sessionsService.saveMessage(sessionId, 'tool', result, name, true);
      }

      messages.push({ role: 'tool', content: result, toolCallId });

      if (name === 'search_knowledge') {
        messages = await this.handleKnowledgeResult(messages, result, res, sessionId);
      }
    }
  }

  this.state = AgentState.RESPONDING;
  res.write('data: [DONE]\n\n');
  return finalText;
}
```

### Safety Nets (kept)

| Safety | How |
|--------|-----|
| Stop button | `AbortSignal` — checked at every iteration |
| Permission control | `PermissionsService.isAllowed()` blocks denied tools |
| LLM self-regulation | LLM stops calling tools when task is done (natural behavior) |

### What Stays Unchanged

- `executeStep()` — LLM call wrapper
- `executeTool()` — tool dispatch
- `addToolCallsToMessages()` — message builder
- `runPlanMode()` — separate plan creation flow
- `executePlan()` — separate plan execution flow
- `runForStep()` — step execution within plans
- `handleKnowledgeResult()` — KB result synthesis
- All permission and security logic
- All SSE event handling

## Testing

The existing tests for `agent-loop.service.spec.ts` will need updates:
- Remove tests for `evaluateResult()`, `findFallbackTool()`, `generateCloseMessage()`
- Simplify tests that depended on EVALUATING/CORRECTING state transitions
- Keep tests for tool execution, plan creation, abort handling

```bash
npx jest src/agent/services/agent-loop.service.spec.ts
```
