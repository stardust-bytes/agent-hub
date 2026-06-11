# Delegate Parallel Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `delegate_parallel` tool that lets the LLM ask users whether to run complex multi-part tasks via sub-agents or step-by-step.

**Architecture:** New tool `delegate_parallel(task, subtasks)` emits `subagent:delegate` SSE event with subtask list. Backend stores the delegation in memory. User picks via buttons → command triggers parallel sub-agent execution or sequential agent loop. Simple tasks continue using `spawn_subagent` (auto-run, no prompt).

**Tech Stack:** NestJS, SSE streaming, Vue 3

---

### Task 1: Add `delegate_parallel` tool definition to ContextBuilderService

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`

- [ ] **Step 1: Add tool definition in `getEnabledTools()`**

In `D:\Git\GitHub\960513\backend\src\agent\services\context-builder.service.ts`, after the `spawn_subagent` block, add:

```typescript
if (mode === 'agent' || mode === 'cowork') {
  tools.push({
    type: 'function' as const,
    function: {
      name: 'delegate_parallel',
      description: 'Decompose a complex task into independent parallel subtasks. ' +
        'Use ONLY when the user request involves multiple pieces of independent work ' +
        'that can run concurrently. ' +
        'This will ask the user whether to use sub-agents or step-by-step execution.',
      parameters: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'The original user request or overall task description.',
          },
          subtasks: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of independent subtasks that can run in parallel. ' +
              'Each should be self-contained and not depend on others.',
          },
        },
        required: ['task', 'subtasks'],
      },
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd D:\Git\GitHub\960513\backend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts
git commit -m "feat: add delegate_parallel tool definition"
```

---

### Task 2: Add delegation storage to SubagentService

**Files:**
- Modify: `backend/src/agent/subagent/subagent.service.ts`
- Modify: `backend/src/agent/subagent/subagent.service.spec.ts`

- [ ] **Step 1: Add PendingDelegation interface and Map**

In `D:\Git\GitHub\960513\backend\src\agent\subagent\subagent.service.ts`, add:

```typescript
export interface PendingDelegation {
  requestId: string;
  task: string;
  subtasks: string[];
  providerType: string;
  model: string;
  providerConfig: { baseUrl: string; key?: string };
  tools: ToolDefinition[];
  sessionId?: number;
  mode: string;
  createdAt: Date;
}
```

Add to the class:
```typescript
private readonly pendingDelegations = new Map<string, PendingDelegation>();

createDelegation(data: Omit<PendingDelegation, 'requestId' | 'createdAt'>): string {
  const requestId = crypto.randomUUID();
  this.pendingDelegations.set(requestId, { ...data, requestId, createdAt: new Date() });
  // Auto-cleanup after 5 minutes
  setTimeout(() => this.pendingDelegations.delete(requestId), 5 * 60 * 1000);
  return requestId;
}

getDelegation(requestId: string): PendingDelegation | undefined {
  return this.pendingDelegations.get(requestId);
}

removeDelegation(requestId: string): void {
  this.pendingDelegations.delete(requestId);
}
```

- [ ] **Step 2: Write the failing test**

In `D:\Git\GitHub\960513\backend\src\agent\subagent\subagent.service.spec.ts`, add:

```typescript
it('should store and retrieve pending delegations', () => {
  const requestId = service.createDelegation({
    task: 'analyze code',
    subtasks: ['read package.json', 'list directory'],
    providerType: 'ollama',
    model: 'llama3.2',
    providerConfig: { baseUrl: 'http://localhost:11434' },
    tools: [],
    sessionId: 1,
    mode: 'agent',
  });

  const delegation = service.getDelegation(requestId);
  expect(delegation).toBeDefined();
  expect(delegation!.task).toBe('analyze code');
  expect(delegation!.subtasks).toEqual(['read package.json', 'list directory']);

  service.removeDelegation(requestId);
  expect(service.getDelegation(requestId)).toBeUndefined();
});
```

- [ ] **Step 3: Run test to verify it fails initially**

Run: `cd D:\Git\GitHub\960513\backend && npx jest src/agent/subagent/subagent.service -v`
Expected: Tests pass but new test not yet added (or fails if added)

- [ ] **Step 4: Implement the changes in SubagentService**

Add the interface, Map, and methods to `subagent.service.ts` as described in Step 1.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd D:\Git\GitHub\960513\backend && npx jest src/agent/subagent/subagent.service -v`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/src/agent/subagent/subagent.service.ts backend/src/agent/subagent/subagent.service.spec.ts
git commit -m "feat: add delegation storage to SubagentService"
```

---

### Task 3: Handle `delegate_parallel` in AgentLoopService

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Add inline handler for `delegate_parallel` in the EVALUATING phase**

In `D:\Git\GitHub\960513\backend\src\agent\services\agent-loop.service.ts`, find the inline `spawn_subagent` handler block. Add a handler for `delegate_parallel` next to it:

```typescript
if (name === 'delegate_parallel') {
  const args_ = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {};
  const task = String(args_.task ?? '');
  const subtasksArr = args_.subtasks;
  const subtasks = Array.isArray(subtasksArr) ? subtasksArr.map(String) : [];

  if (!task || subtasks.length === 0) {
    result = 'Error: delegate_parallel requires "task" (string) and "subtasks" (non-empty array)';
  } else {
    const requestId = this.subagentService.createDelegation({
      task, subtasks,
      providerType, model, providerConfig,
      activeTools, sessionId,
      mode: mode as 'chat' | 'agent' | 'cowork',
    });

    res.write(`data: ${JSON.stringify({
      subagent: true,
      delegate: { requestId, task, subtasks },
    })}\n\n`);

    result = `[DELEGATION_CREATED: ${requestId}] Awaiting user decision.`;
  }
}
```

Make sure this is BEFORE the regular `executeTool()` call, in the same if-else chain as `spawn_subagent`.

- [ ] **Step 2: Verify TypeScript**

Run: `cd D:\Git\GitHub\960513\backend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run tests**

Run: `cd D:\Git\GitHub\960513\backend && npx jest`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: handle delegate_parallel in agent loop"
```

---

### Task 4: Handle `/delegate` commands in AgentService

**Files:**
- Modify: `backend/src/agent/agent.service.ts`

- [ ] **Step 1: Add `/delegate` command handling in `streamChat()`**

In `D:\Git\GitHub\960513\backend\src\agent\agent.service.ts`, in `streamChat()` method, before the main agent loop logic, add:

```typescript
if (message.startsWith('/delegate ')) {
  const parts = message.slice(10).trim().split(' ');
  const action = parts[0];
  const requestId = parts[1];

  if (!requestId) {
    res.write(`data: ${JSON.stringify({ error: 'Missing delegation request ID' })}\n\n`);
    res.write('data: [DONE]\n\n');
    return;
  }

  const delegation = this.subagentService.getDelegation(requestId);
  if (!delegation) {
    res.write(`data: ${JSON.stringify({ error: 'Delegation request not found or expired' })}\n\n`);
    res.write('data: [DONE]\n\n');
    return;
  }

  this.subagentService.removeDelegation(requestId);

  if (action === 'parallel') {
    // Run subtasks sequentially via sub-agents
    await this.sessionsService.saveMessage(sessionId, 'system', `[Running ${delegation.subtasks.length} subtasks via sub-agents...]`);
    const results: string[] = [];
    for (const subtask of delegation.subtasks) {
      const subRes = { write: (data: string) => res.write(data) };
      const result = await this.subagentService.spawn(
        subtask, providerType, providerModel.name,
        providerConfig, context.tools, signal, subRes as any,
        sessionId, mode,
      );
      results.push(result);
    }
    const summary = results.map((r, i) => `[Subtask ${i + 1}] ${delegation.subtasks[i]}\n${r}`).join('\n\n');
    await this.sessionsService.saveMessage(sessionId, 'assistant', summary);
    res.write('data: [DONE]\n\n');
  } else if (action === 'sequential') {
    // Run the full task through normal agent loop
    const runState = {
      step: 0, maxIterations: 10, roomId: String(sessionId),
      steps: [], startTime: Date.now(), currentState: 'PLANNING',
    } as AgentRunState;
    const seqContext = await this.contextBuilder.build(runState, sessionId, mode);
    const history = await this.sessionsService.getHistory(sessionId);
    await this.sessionsService.saveMessage(sessionId, 'user', delegation.task);
    const finalText = await this.agentLoop.run(
      providerType, providerModel.name, seqContext.systemPrompt,
      history, delegation.task, seqContext.tools, res,
      signal, sessionId, mode, providerConfig,
    );
    if (finalText) {
      await this.sessionsService.saveMessage(sessionId, 'assistant', finalText);
    }
  } else {
    res.write(`data: ${JSON.stringify({ error: 'Unknown delegate action. Use "parallel" or "sequential"' })}\n\n`);
    res.write('data: [DONE]\n\n');
  }
  return;
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd D:\Git\GitHub\960513\backend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run tests**

Run: `cd D:\Git\GitHub\960513\backend && npx jest`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/agent.service.ts
git commit -m "feat: handle /delegate commands in AgentService"
```

---

### Task 5: DelegateBubble.vue component

**Files:**
- Create: `frontend/src/components/DelegateBubble.vue`

- [ ] **Step 1: Create the component**

Write `D:\Git\GitHub\960513\frontend\src\components\DelegateBubble.vue`:

```vue
<template>
  <div class="bg-cyber-modal-bg border border-cyber-accent/40 font-mono text-sm">
    <div class="flex items-center gap-2 px-3 py-2 border-b border-cyber-accent/20">
      <span class="text-cyber-cyan text-xs font-bold tracking-widest">PARALLEL</span>
      <span class="text-cyber-text flex-1 text-xs truncate">{{ t('delegate.task') }}</span>
    </div>

    <div class="px-3 py-2 space-y-1">
      <div class="text-cyber-text text-xs mb-2">{{ delegation.task }}</div>
      <div class="text-cyber-muted text-xs mb-1">{{ t('delegate.subtasks') }}:</div>
      <div v-for="(subtask, i) in delegation.subtasks" :key="i" class="flex gap-2 items-start">
        <span class="text-cyber-muted text-xs select-none shrink-0">{{ i + 1 }}.</span>
        <span class="text-cyber-text text-xs break-words leading-5">{{ subtask }}</span>
      </div>
    </div>

    <div class="flex gap-2 px-3 py-2 border-t border-cyber-accent/20">
      <button
        :disabled="disabled"
        @click="emit('choose', { requestId: delegation.requestId, mode: 'parallel' })"
        class="bg-cyber-accent text-black text-xs font-bold px-3 py-1 transition-colors duration-150 hover:bg-cyber-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
      >&#9654; {{ t('delegate.parallel') }}</button>
      <button
        :disabled="disabled"
        @click="emit('choose', { requestId: delegation.requestId, mode: 'sequential' })"
        class="bg-transparent border border-cyber-muted/40 text-cyber-muted text-xs px-3 py-1 transition-colors duration-150 hover:text-cyber-text hover:border-cyber-muted disabled:opacity-50 disabled:cursor-not-allowed"
      >&#8594; {{ t('delegate.sequential') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface DelegateData {
  requestId: string
  task: string
  subtasks: string[]
}

interface ChoosePayload {
  requestId: string
  mode: 'parallel' | 'sequential'
}

const props = defineProps<{
  delegation: DelegateData
  disabled: boolean
}>()

const emit = defineEmits<{
  choose: [payload: ChoosePayload]
}>()

const { t } = useI18n()
</script>
```

- [ ] **Step 2: Add i18n keys**

In `D:\Git\GitHub\960513\frontend\src\locales\vi.json`:
```json
"delegate": {
  "task": "Task phức tạp — chọn chế độ chạy",
  "subtasks": "Các phần có thể chạy song song",
  "parallel": "Sub-agent parallel",
  "sequential": "Step-by-step"
}
```

In `D:\Git\GitHub\960513\frontend\src\locales\en.json`:
```json
"delegate": {
  "task": "Complex task — choose execution mode",
  "subtasks": "Independent subtasks",
  "parallel": "Sub-agent parallel",
  "sequential": "Step-by-step"
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/DelegateBubble.vue frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add DelegateBubble component"
```

---

### Task 6: Handle `subagent:delegate` event in frontend

**Files:**
- Modify: `frontend/src/components/CoworkView.vue`
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Add delegate event handling in CoworkView.vue**

In `D:\Git\GitHub\960513\frontend\src\components\CoworkView.vue`, find the SSE handler. In the `parsed.subagent` block, add before `parsed.done`:

```typescript
} else if (parsed.subagent) {
  if (parsed.delegate) {
    clearThinking()
    currentAgentIdx = -1
    const delegateData = parsed.delegate as { requestId: string; task: string; subtasks: string[] }
    activeDelegations.value.push(delegateData)
  } else if (parsed.done) {
    // ...
```

Also add the ref:
```typescript
interface DelegateData {
  requestId: string
  task: string
  subtasks: string[]
}

const activeDelegations = ref<DelegateData[]>([])
```

And the handler for button clicks:
```typescript
async function onDelegateChoose(payload: { requestId: string; mode: string }) {
  input.value = `/delegate ${payload.mode} ${payload.requestId}`
  await submitForm()
}
```

Add the template to render DelegateBubble:
```html
<DelegateBubble
  v-for="del in activeDelegations"
  :key="del.requestId"
  :delegation="del"
  :disabled="streaming"
  @choose="onDelegateChoose"
/>
```

Import the component:
```typescript
import DelegateBubble from './DelegateBubble.vue'
```

And add to `components` object if using Options API, or just import it at the top.

- [ ] **Step 2: Add same handling in ChatPanel.vue**

Apply the same changes to `D:\Git\GitHub\960513\frontend\src\components\ChatPanel.vue`.

- [ ] **Step 3: Verify TypeScript**

Run: `cd D:\Git\GitHub\960513\frontend && npx vue-tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/CoworkView.vue frontend/src/components/ChatPanel.vue
git commit -m "feat: handle subagent:delegate events in frontend"
```

---

### Task 7: Update AGENTS.md

**Files:**
- Modify: `backend/src/agent/AGENTS.md`

- [ ] **Step 1: Document delegate_parallel in AGENTS.md**

- Add `delegate_parallel` to the tool list
- Add `delegate` to SSE events table
- Note delegate command handling in AgentService

- [ ] **Step 2: Commit**

```bash
git add backend/src/agent/AGENTS.md
git commit -m "docs: document delegate_parallel in AGENTS.md"
```
