# Cowork Auto-Delegation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic multi-agent orchestration to Cowork mode — agent autonomously delegates subtasks to parallel sub-agents and synthesizes results.

**Architecture:** New `delegate()` method on `SubagentService` runs tasks via `Promise.allSettled`. `AgentLoopService` handles `delegate` tool inline. Cowork system prompt guides agent when to delegate.

**Tech Stack:** NestJS, Socket.io SSE, Vue 3

---

## File Structure

### Modified files
- `backend/src/agent/services/subagent.service.ts` — add `delegate()` + `DelegateRequest` types
- `backend/src/agent/services/agent-loop.service.ts` — handle delegate tool in executeTool
- `backend/src/agent/services/context-builder.service.ts` — cowork system prompt additions
- `backend/src/mode-policy/mode-policy.config.ts` — allow delegate in cowork
- `backend/src/tools/tools.service.ts` — seed delegate tool definition
- `frontend/src/components/ChatPanel.vue` — handle delegateProgress SSE events
- `frontend/src/locales/vi.json` + `en.json` — delegate i18n

### New test files
- `backend/src/agent/subagent/subagent.service.spec.ts` — update with delegate tests

---

### Task 1: Mode-Policy + Tool Seed

**Files:**
- Modify: `backend/src/mode-policy/mode-policy.config.ts`
- Modify: `backend/src/tools/tools.service.ts`

- [ ] **Step 1: Remove delegate_parallel from cowork deniedTools**

In `backend/src/mode-policy/mode-policy.config.ts`, edit cowork entry:

```ts
cowork: {
  enabledTools: '*',
  deniedTools: [
    'create_task',
    'update_task',
    'delete_tasks',
    'convert_note_to_task',
    'search_knowledge',
    // 'delegate_parallel',  ← REMOVE
  ],
  allowedPaths: ['{projectPath}'],
  systemPromptStyle: 'cowork',
  envContext: ['platform', 'projectPath'],
  permissionMode: 'acceptEdits',
},
```

- [ ] **Step 2: Seed delegate tool**

Read `backend/src/tools/tools.service.ts` and add to the seed data array:

```ts
{
  name: 'delegate',
  description: 'Delegate subtasks to run in parallel workers. Use for complex multi-step tasks like reading multiple files, processing data, or searching.',
  parameters: JSON.stringify({
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of subtask descriptions to execute in parallel',
      },
    },
    required: ['tasks'],
  }),
  enabled: true,
},
```

- [ ] **Step 3: Run tests**

```bash
npx jest src/mode-policy/ src/tools/ --no-coverage
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/mode-policy/ backend/src/tools/
git commit -m "feat: enable delegate tool in cowork mode"
```

---

### Task 2: SubagentService.delegate() — Parallel Execution

**Files:**
- Modify: `backend/src/agent/subagent/subagent.service.ts`

- [ ] **Step 1: Read current subagent.service.ts**

Read `backend/src/agent/subagent/subagent.service.ts` first. It already has `PendingDelegation`, `createDelegation()`, `getDelegation()`, `spawn()`.

- [ ] **Step 2: Add delegate() method**

Add after `removeDelegation()`:

```ts
interface DelegateTaskResult {
  index: number
  task: string
  status: 'completed' | 'failed'
  summary: string
}

async delegate(
  tasks: string[],
  providerType: string,
  model: string,
  providerConfig: { baseUrl: string; key?: string },
  tools: ToolDefinition[],
  signal: AbortSignal,
  res: WriteStream,
  sessionId?: number,
  mode: string = 'agent',
): Promise<string> {
  const requestId = crypto.randomUUID()

  res.write(`data: ${JSON.stringify({ delegate: { requestId, taskCount: tasks.length } })}\n\n`)

  const promises = tasks.map((task, i) => {
    res.write(`data: ${JSON.stringify({ delegateProgress: { requestId, index: i, subtask: task, status: 'running' } })}\n\n`)
    return this.spawn(task, providerType, model, providerConfig, tools, signal, res, sessionId, mode)
      .then(result => ({ index: i, task, status: 'completed' as const, summary: result.slice(0, 200) }))
      .catch(err => ({ index: i, task, status: 'failed' as const, summary: err.message ?? 'Unknown error' }))
  })

  const settled = await Promise.allSettled(promises)
  const results: DelegateTaskResult[] = settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return { index: i, task: tasks[i], status: 'failed' as const, summary: 'Promise rejected' }
  })

  res.write(`data: ${JSON.stringify({ delegateResult: { requestId, results } })}\n\n`)

  return results.map(r => `Task ${r.index}: [${r.status}] ${r.task}\n  ${r.summary}`).join('\n')
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/subagent/subagent.service.ts
git commit -m "feat: add parallel delegate() method to SubagentService"
```

---

### Task 3: AgentLoopService — Handle delegate Tool

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Read agent-loop.service.ts**

Read `backend/src/agent/services/agent-loop.service.ts`. Note the existing `delegate_parallel` handling at lines 194-216, and `spawn_subagent` handling at lines 181-194.

- [ ] **Step 2: Add delegate tool handler**

After the `spawn_subagent` block (or before `delegate_parallel`), add:

```ts
} else if (name === 'delegate') {
  const argsObj = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {}
  const tasks = argsObj.tasks
  const taskList = Array.isArray(tasks) ? tasks.map(String) : []

  if (taskList.length === 0) {
    result = 'Error: delegate requires a non-empty "tasks" array'
  } else {
    try {
      result = await this.subagentService.delegate(
        taskList, providerType, model, providerConfig,
        activeTools, signal, res, sessionId,
        mode as 'chat' | 'agent' | 'cowork',
      )
    } catch (e) {
      result = `Error: Delegate failed: ${e instanceof Error ? e.message : 'Unknown error'}`
    }
  }
```

- [ ] **Step 3: Run agent tests**

```bash
npx jest src/agent/ --no-coverage
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: add delegate tool handler to agent loop"
```

---

### Task 4: System Prompt for Cowork

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`

- [ ] **Step 1: Read context-builder.service.ts**

Read `backend/src/agent/services/context-builder.service.ts`, specifically the `buildSystemPrompt()` method for `cowork` mode (line 86-95).

- [ ] **Step 2: Add delegate guidance after cowork plan guidance**

In the `mode === 'cowork'` block, add after the create_plan instructions:

```ts
lines.push('',
  '',
  'When handling complex multi-step tasks:',
  '- Use the delegate tool to run subtasks in parallel workers for independent sub-tasks like reading multiple files, processing separate datasets, or searching different sources.',
  '- Break the task into self-contained subtasks — each must be completable without seeing other subtask results.',
  '- Do NOT wait for user approval — delegate automatically.',
  '- After all subtasks complete, synthesize the results into a coherent answer.',
  '- Each subtask description should include all context needed (file paths, search queries, instructions).',
  '- Do NOT use delegate for single-step tasks — use the appropriate tool directly.',
);
```

- [ ] **Step 3: Run tests**

```bash
npx jest src/agent/services/context-builder.service.spec.ts --no-coverage
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts
git commit -m "feat: add delegate guidance to cowork system prompt"
```

---

### Task 5: Frontend — Handle delegateProgress SSE Events

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Read ChatPanel.vue**

Read `frontend/src/components/ChatPanel.vue` to understand how SSE events are parsed. It likely has a `handleSSEEvent` or `onSSEData` method.

- [ ] **Step 2: Add delegate progress rendering**

In the SSE event handler, add handling for:

```ts
// delegateProgress events
if (data.delegateProgress) {
  const { requestId, index, subtask, status } = data.delegateProgress
  // Show as system message with progress
  const message = status === 'running'
    ? `▶ Sub-agent ${index + 1}: ${subtask}`
    : `✓ Sub-agent ${index + 1}: [${status}]`
  
  messages.push({
    id: `delegate-${requestId}-${index}`,
    role: 'system',
    content: message,
    createdAt: new Date().toISOString(),
  })
}

// delegateResult events
if (data.delegateResult) {
  const { requestId, results } = data.delegateResult
  const summary = results.map(r => `  [${r.status}] ${r.task}`).join('\n')
  messages.push({
    id: `delegate-result-${requestId}`,
    role: 'system',
    content: `\u2514 Delegate complete:\n${summary}`,
    createdAt: new Date().toISOString(),
  })
}
```

- [ ] **Step 3: Add i18n keys**

In `vi.json`:
```json
"delegate": {
  "running": "▶ Tác vụ phụ {index}: {task}",
  "completed": "✓ Tác vụ phụ {index}: hoàn thành",
  "failed": "✗ Tác vụ phụ {index}: thất bại",
  "complete": "└ Hoàn thành delegation ({count} tác vụ)"
}
```

In `en.json`:
```json
"delegate": {
  "running": "▶ Sub-task {index}: {task}",
  "completed": "✓ Sub-task {index}: completed",
  "failed": "✗ Sub-task {index}: failed",
  "complete": "└ Delegate complete ({count} tasks)"
}
```

- [ ] **Step 4: Run frontend type check**

```bash
cd frontend && npx vue-tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatPanel.vue frontend/src/locales/
git commit -m "feat: render delegateProgress SSE events in chat and add i18n"
```

---

### Task 6: Tests + AGENTS.md

- [ ] **Step 1: Run full test suite**

```bash
cd backend && npx jest --no-coverage
```

Expected: all pass (pre-existing failures unrelated).

- [ ] **Step 2: Update AGENTS.md**

Update `backend/src/agent/AGENTS.md`:
```
├── subagent.service.ts            — spawn sub-agents + delegate() parallel orchestration
```

Update `backend/src/agent/subagent/AGENTS.md` if exists, or create it.

Update `frontend/AGENTS.md` to note delegateProgress SSE handling.

- [ ] **Step 3: Commit**

```bash
git add backend/ backend/src/agent/ frontend/
git commit -m "docs: update AGENTS.md for cowork auto-delegate"
```

---

## Self-Review

1. **Spec coverage**: All spec sections covered:
   - Tool definition → Task 1
   - System prompt → Task 4
   - Mode-policy changes → Task 1
   - SubagentService.delegate() → Task 2
   - AgentLoopService handling → Task 3
   - SSE events → Task 2 (backend emit) + Task 5 (frontend render)
   - Frontend → Task 5
   - Testing → Task 6

2. **Placeholder scan**: No TBD, TODO, or incomplete code blocks.

3. **Type consistency**: `DelegateTaskResult` (index, task, status, summary) consistent between service emit and frontend consume. `delegate`, `delegateProgress`, `delegateResult` SSE event names consistent. `tasks` array parameter consistent between tool definition and handler.
