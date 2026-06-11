# Simplify Agent Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove EVALUATING/CORRECTING phases, MAX_RETRIES, MAX_ITERATIONS, and fallback logic from the agent loop — letting the LLM fully self-evaluate like Claude Code.

**Architecture:** Remove state machine phases, hard limits, and error-handling methods. The loop becomes: call LLM → if tool_calls execute them → if no tool_calls break. The LLM naturally decides when done.

**Tech Stack:** NestJS, TypeScript, Jest

---

## File Structure

### Modified files
- `backend/src/agent/dto/agent-state.enum.ts` — remove EVALUATING, CORRECTING
- `backend/src/agent/services/agent-loop.service.ts` — simplify run(), remove unused methods/fields
- `backend/src/agent/services/agent-loop.service.spec.ts` — remove tests for removed functionality
- `backend/src/agent/AGENTS.md` — update state machine docs
- `backend/src/agent/services/AGENTS.md` — update AgentLoopService docs

---

### Task 1: Simplify AgentState Enum

**Files:**
- Modify: `backend/src/agent/dto/agent-state.enum.ts`

- [ ] **Step 1: Read current enum**

Read `backend/src/agent/dto/agent-state.enum.ts`.

- [ ] **Step 2: Remove EVALUATING and CORRECTING**

```typescript
export enum AgentState {
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
  RESPONDING = 'RESPONDING',
  DONE = 'DONE',
}
```

Remove `EVALUATING = 'EVALUATING'` and `CORRECTING = 'CORRECTING'`.

- [ ] **Step 3: Run tests to verify**

Run: `npx jest src/agent --no-coverage`

Expected: some tests will fail because they reference EVALUATING/CORRECTING states. That's OK — we fix them in Task 3.

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/dto/agent-state.enum.ts
git commit -m "refactor: remove EVALUATING and CORRECTING from AgentState"
```

---

### Task 2: Simplify run() Method + Remove Limits and Unused Code

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Remove constants**

Delete:
```typescript
const MAX_RETRIES = 2;
```

Keep `MAX_ITERATIONS = 100` for now (but it won't be used in the simplified loop — we remove it in the next step).

Actually, remove both:
```typescript
const MAX_RETRIES = 2;
const MAX_ITERATIONS = 100;
```

- [ ] **Step 2: Remove instance fields**

Delete from the class body:
```typescript
private currentPlan: string[] = [];
private retryCount = 0;
private failedTool: string | null = null;
```

- [ ] **Step 3: Remove imports that are no longer needed**

Check if `EventEmitter2` import is still used (it's used in `agent.idle` event at line 346). Keep it.

- [ ] **Step 4: Simplify the run() method**

Replace lines 105-358 (the entire `run()` method) with the simplified version:

```typescript
  async run(
    providerType: string,
    model: string,
    systemPrompt: string,
    history: OllamaMessage[],
    userMessage: string,
    tools: ToolDefinition[],
    res: WriteStream,
    signal: AbortSignal,
    sessionId?: number,
    mode: string = 'agent',
    providerConfig: { baseUrl: string; key?: string } = { baseUrl: 'http://localhost:11434' },
  ): Promise<string> {
    this.state = AgentState.PLANNING;

    let activeTools = tools;
    let finalText = '';
    let messages = this.llmController.buildMessages(systemPrompt, history, userMessage);

    while (!signal.aborted) {
      this.state = AgentState.EXECUTING;

      let text: string;
      let toolCalls: Array<{ name: string; arguments: unknown }>;
      try {
        ({ text, toolCalls } = await this.executeStep(
          model, messages, activeTools, signal, providerConfig, res, sessionId, providerType,
        ));
      } catch {
        break;
      }

      if (text && sessionId) {
        await this.sessionsService.saveMessage(sessionId, 'assistant', text);
      }
      finalText += text;

      if (toolCalls.length === 0) break;

      let reasoningContent: string | undefined;
      messages = this.addToolCallsToMessages(messages, text, toolCalls, reasoningContent);

      for (let ti = 0; ti < toolCalls.length; ti++) {
        if (signal.aborted) break;
        const tc = toolCalls[ti];
        const name = tc.name;
        const toolCallId = `call_${ti}_${name}`;
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
          const idMatch = result.match(/id=(\d+)/);
          const approvalMatch = result.match(/requireApproval=(\w+)/);
          const titleMatch = result.match(/title="([^"]*)"/);

          const planId = idMatch ? parseInt(idMatch[1], 10) : 0;
          const requireApproval = approvalMatch ? approvalMatch[1] === 'true' : true;

          if (planId > 0) {
            const plan = await this.plansService.findOne(planId);

            res.write(`data: ${JSON.stringify({
              plan: {
                id: plan.id,
                title: plan.title,
                status: plan.status,
                steps: plan.steps.map(s => ({ id: s.id, order: s.order, text: s.text, status: s.status })),
              },
            })}\n\n`);

            await this.savePlanExecutionMessage(sessionId, plan);

            if (requireApproval) {
              res.write('data: [DONE]\n\n');
              return finalText;
            } else {
              await this.executePlan(planId, providerType, model, systemPrompt, activeTools, providerConfig, signal, res, sessionId);
              return finalText;
            }
          }
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
    if (!signal.aborted) {
      if (sessionId) {
        this.eventEmitter.emit('agent.idle', {
          sessionId,
          providerType,
          model,
          providerConfig,
        });
      }
      res.write('data: [DONE]\n\n');
    }

    return finalText;
  }
```

- [ ] **Step 5: Remove unused private methods**

Remove these methods entirely from the class:

```typescript
private evaluateResult(toolName: string, result: string): boolean {
  if (!result || result.startsWith('Error:')) return false;
  if (result === KB_NO_RESULTS) return false;
  return true;
}

private findFallbackTool(failedTool: string | null): string | null {
  if (!failedTool) return null;
  const fallbackMap: Record<string, string> = {
    'web_fetch': 'web_search',
    'search_knowledge': 'web_search',
  };
  return fallbackMap[failedTool] ?? null;
}

private async generateCloseMessage(
  model: string,
  messages: OllamaMessage[],
  reason: string,
  signal: AbortSignal,
  providerConfig: { baseUrl: string; key?: string },
  res: WriteStream,
  sessionId?: number,
  providerType: string = 'ollama',
): Promise<string> {
  res.write(`data: ${JSON.stringify({ thinking: `Generating closing message: ${reason}` })}\n\n`);
  if (sessionId) {
    await this.sessionsService.saveMessage(sessionId, 'system', `Generating closing message: ${reason}`);
  }

  const closePrompt = `I was unable to complete the task after several attempts. Based on the conversation and tool results above, write a closing message to the user explaining what happened and suggesting alternative approaches.`;
  const closeMessages: OllamaMessage[] = [
    ...messages,
    { role: 'user', content: closePrompt },
  ];

  let closeText = '';
  try {
    ({ text: closeText } = await this.executeStep(
      model, closeMessages, [], signal, providerConfig, res, sessionId, providerType,
    ));
  } catch { }

  if (closeText && sessionId) {
    await this.sessionsService.saveMessage(sessionId, 'assistant', closeText);
  }
  return closeText ?? '';
}
```

- [ ] **Step 6: Remove KB_NO_RESULTS constant** if it's only used by `evaluateResult()` and `handleKnowledgeResult()`.

Check: `KB_NO_RESULTS` is used in both `evaluateResult()` and `handleKnowledgeResult()`. Since `evaluateResult()` is removed, check if `handleKnowledgeResult()` still uses it. If yes, keep the constant.

- [ ] **Step 7: Run tests**

Run: `npx jest src/agent --no-coverage`

Expected: some tests fail because they reference removed methods. Fixed in Task 3.

- [ ] **Step 8: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts
git commit -m "refactor: simplify agent loop to Claude Code style"
```

---

### Task 3: Update Tests

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.spec.ts`

- [ ] **Step 1: Read the test file**

Read the full test file. Identify tests that reference:
- `MAX_RETRIES`, `MAX_ITERATIONS`
- EVALUATING/CORRECTING states
- `evaluateResult()`, `findFallbackTool()`, `generateCloseMessage()`
- `retryCount`, `failedTool`, `currentPlan`

- [ ] **Step 2: Remove or update failing tests**

Tests to remove:
- Any test that checks EVALUATING state transition
- Any test that checks CORRECTING state behavior
- Any test that checks `evaluateResult()`
- Any test that checks `retryCount` or `failedTool`
- Any test that checks `generateCloseMessage()`

Tests to keep:
- Basic chat flow (send message → LLM responds)
- Tool execution (LLM calls tool → result)
- Plan creation (`[PLAN_CREATED]` handling)
- Permission denial
- Abort signal handling
- Knowledge result handling

- [ ] **Step 3: Run tests**

Run: `npx jest src/agent/services/agent-loop.service.spec.ts --no-coverage`

Expected: all pass.

- [ ] **Step 4: Run full agent tests**

Run: `npx jest src/agent --no-coverage`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.spec.ts
git commit -m "test: update agent loop tests for simplified loop"
```

---

### Task 4: Update AGENTS.md

**Files:**
- Modify: `backend/src/agent/AGENTS.md`
- Modify: `backend/src/agent/services/AGENTS.md` (if exists)

- [ ] **Step 1: Update agent/AGENTS.md**

Update the State Machine Loop section:
- Remove EVALUATING/CORRECTING phase descriptions
- Update to reflect the simplified loop
- Remove references to `retryCount`, `failedTool`, `evaluateResult()`, `findFallbackTool()`

- [ ] **Step 2: Commit**

```bash
git add backend/src/agent/AGENTS.md
git commit -m "docs: update AGENTS.md for simplified agent loop"
```

---

### Task 5: Final Test Run

- [ ] **Step 1: Run full test suite**

Run: `cd backend && npx jest --no-coverage`

Expected: all pass (pre-existing failures only).

- [ ] **Step 2: Verify build**

Run: `cd backend && npx nest build`

Expected: no errors.
