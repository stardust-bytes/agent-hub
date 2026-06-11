# Remove delegate_parallel Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `delegate_parallel` tool and all associated code (PendingDelegation, DelegateBubble, `/delegate` command handler) while keeping `delegate` tool for auto-parallel execution.

**Architecture:** Delete `delegate_parallel` from seed data, remove its handler from agent loop, delete `PendingDelegation` infrastructure from SubagentService, remove `/delegate` command from AgentService, delete DelegateBubble.vue, clean up frontend SSE handling and i18n.

**Tech Stack:** NestJS, Vue 3, Prisma

---

## File Structure

### Modified files
- `backend/prisma/seed.ts` — remove delegate_parallel
- `backend/src/agent/services/agent-loop.service.ts` — remove delegate_parallel handler
- `backend/src/mode-policy/mode-policy.config.ts` — remove delegate_parallel from deniedTools
- `backend/src/agent/agent.service.ts` — remove /delegate command handler
- `backend/src/agent/subagent/subagent.service.ts` — remove PendingDelegation infra
- `backend/src/agent/subagent/subagent.service.spec.ts` — remove delegation CRUD tests
- `frontend/src/components/ChatPanel.vue` — remove delegate_parallel SSE handling
- `frontend/src/components/CoworkView.vue` — remove delegate_parallel SSE handling
- `frontend/src/locales/vi.json` — remove delegate_parallel i18n keys
- `frontend/src/locales/en.json` — remove delegate_parallel i18n keys
- `backend/src/agent/AGENTS.md` — remove delegate_parallel references
- `backend/src/mode-policy/AGENTS.md` — remove delegate_parallel from denied list

### Deleted files
- `frontend/src/components/DelegateBubble.vue`

---

### Task 1: Remove delegate_parallel from Seed + Mode-Policy

**Files:**
- Modify: `backend/prisma/seed.ts:29`
- Modify: `backend/src/mode-policy/mode-policy.config.ts:44`

- [ ] **Step 1: Remove delegate_parallel from seed.ts**

In `backend/prisma/seed.ts`, delete line 29 (the `delegate_parallel` entry):

```ts
  { name: 'delegate_parallel', description: 'Decompose a complex task into independent parallel subtasks. Use ONLY when the user request involves multiple pieces of independent work that can run concurrently.', parameters: '{"type":"object","properties":{"task":{"type":"string","description":"The original user request or overall task description."},"subtasks":{"type":"array","items":{"type":"string"},"description":"List of independent subtasks that can run in parallel. Each should be self-contained."}},"required":["task","subtasks"]}' },
```

- [ ] **Step 2: Remove delegate_parallel from agent deniedTools**

In `backend/src/mode-policy/mode-policy.config.ts`, delete line 44 (`'delegate_parallel',`):

Before:
```ts
      'spawn_subagent',
      'delegate_parallel',
      'delegate',
```

After:
```ts
      'spawn_subagent',
      'delegate',
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts backend/src/mode-policy/mode-policy.config.ts
git commit -m "refactor: remove delegate_parallel from seed and mode-policy"
```

---

### Task 2: Remove delegate_parallel Handler from AgentLoopService

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts:214-236`

- [ ] **Step 1: Remove delegate_parallel handler block**

In `backend/src/agent/services/agent-loop.service.ts`, delete the `delegate_parallel` block (22 lines, lines 214-236):

```ts
            } else if (name === 'delegate_parallel') {
              const argsObj = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {};
              const task = String(argsObj.task ?? '');
              const subtasksArr = argsObj.subtasks;
              const subtasks = Array.isArray(subtasksArr) ? subtasksArr.map(String) : [];

              if (!task || subtasks.length === 0) {
                result = 'Error: delegate_parallel requires "task" (string) and "subtasks" (non-empty array)';
              } else {
                const requestId = this.subagentService.createDelegation({
                  task, subtasks,
                  providerType, model, providerConfig,
                  tools: activeTools, sessionId,
                  mode: mode as 'chat' | 'agent' | 'cowork',
                });

                res.write(`data: ${JSON.stringify({
                  subagent: true,
                  delegate: { requestId, task, subtasks },
                })}\n\n`);

                result = `[DELEGATION_CREATED: ${requestId}] Awaiting user decision.`;
              }
```

The `} else if (name === 'delegate') {` block above it stays. The `} else {` block below it stays.

- [ ] **Step 2: Run agent tests**

Run: `npx jest src/agent/ --no-coverage`

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts
git commit -m "refactor: remove delegate_parallel handler from agent loop"
```

---

### Task 3: Remove PendingDelegation Infrastructure from SubagentService

**Files:**
- Modify: `backend/src/agent/subagent/subagent.service.ts`

- [ ] **Step 1: Remove PendingDelegation infra and unused imports**

In `backend/src/agent/subagent/subagent.service.ts`, delete:

1. The `PendingDelegation` interface (lines 6-17)
2. The `pendingDelegations` Map (line 23)
3. `createDelegation()` method (lines 25-30)
4. `getDelegation()` method (lines 32-34)
5. `removeDelegation()` method (lines 36-38)

Also remove `@Inject(forwardRef(() => AgentLoopService))` decorator if it was only used for pending delegation (check if `agentLoop` is used elsewhere — it is used in `spawn()` so keep the injection).

The final file should keep: constructor, `delegate()`, `spawn()`, `createPrefixedResponse()`.

- [ ] **Step 2: Run subagent tests**

Run: `npx jest src/agent/subagent/subagent.service.spec.ts --no-coverage`

Expected: tests that call `createDelegation`, `getDelegation`, `removeDelegation` will fail. That's OK — we fix them in the next step.

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/subagent/subagent.service.ts
git commit -m "refactor: remove PendingDelegation infra from SubagentService"
```

---

### Task 4: Update SubagentService Tests

**Files:**
- Modify: `backend/src/agent/subagent/subagent.service.spec.ts`

- [ ] **Step 1: Remove delegation CRUD test**

In `backend/src/agent/subagent/subagent.service.spec.ts`, delete the last test block `'should store and retrieve pending delegations'` (lines 78-97).

- [ ] **Step 2: Run tests**

Run: `npx jest src/agent/subagent/subagent.service.spec.ts --no-coverage`

Expected: all pass (3 tests: spawn, result, SSE marker).

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/subagent/subagent.service.spec.ts
git commit -m "test: remove delegation CRUD tests from subagent spec"
```

---

### Task 5: Remove /delegate Command Handler from AgentService

**Files:**
- Modify: `backend/src/agent/agent.service.ts:113-191`

- [ ] **Step 1: Remove the entire /delegate command block**

In `backend/src/agent/agent.service.ts`, delete lines 113-191 (from `if (message.startsWith('/delegate ')) {` through the closing `}` before `const runState = {`).

This removes:
- `/delegate` parsing
- `getDelegation` call
- Parallel mode (loop spawning subtasks)
- Sequential mode (rerouting through agent loop)

The `const runState = {` block at line 193 becomes the new entry point after message processing.

- [ ] **Step 2: Run agent tests**

Run: `npx jest src/agent/ --no-coverage`

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/agent.service.ts
git commit -m "refactor: remove /delegate command handler from AgentService"
```

---

### Task 6: Delete DelegateBubble and Clean Up Frontend SSE Handling

**Files:**
- Delete: `frontend/src/components/DelegateBubble.vue`
- Modify: `frontend/src/components/ChatPanel.vue`
- Modify: `frontend/src/components/CoworkView.vue`
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Delete DelegateBubble.vue**

Run: `Remove-Item -LiteralPath "frontend/src/components/DelegateBubble.vue"`

- [ ] **Step 2: Remove delegate_parallel handling from ChatPanel.vue**

In `frontend/src/components/ChatPanel.vue`:

1. Remove `import DelegateBubble from './DelegateBubble.vue'` from script section
2. Remove `import type DelegateData from './DelegateBubble.vue'` or any DelegateData type import
3. Remove `activeDelegations` ref declaration
4. Remove `subagent.delegate` SSE handling block (lines 658-661):
```ts
          } else if (parsed.subagent && parsed.delegate) {
            clearThinking()
            currentAgentIdx = -1
            activeDelegations.value.push(parsed.delegate as DelegateData)
```
5. Remove any template rendering of DelegateBubble component

- [ ] **Step 3: Remove delegate_parallel handling from CoworkView.vue**

In `frontend/src/components/CoworkView.vue`, remove lines 565-568:
```ts
          } else if (parsed.subagent && parsed.delegate) {
            clearThinking()
            currentAgentIdx = -1
            activeDelegations.value.push(parsed.delegate as DelegateData)
```

- [ ] **Step 4: Remove delegate_parallel i18n keys**

In `frontend/src/locales/vi.json`, update the `delegate` block:
```json
  "delegate": {
    "running": "▶ Tác vụ phụ {index}: {task}",
    "completed": "✓ Tác vụ phụ {index}: hoàn thành",
    "failed": "✗ Tác vụ phụ {index}: thất bại",
    "complete": "└ Hoàn thành delegation ({count} tác vụ)"
  }
```

Remove `task`, `subtasks`, `parallel`, `sequential` keys.

In `frontend/src/locales/en.json`, same change:
```json
  "delegate": {
    "running": "▶ Sub-task {index}: {task}",
    "completed": "✓ Sub-task {index}: completed",
    "failed": "✗ Sub-task {index}: failed",
    "complete": "└ Delegate complete ({count} tasks)"
  }
```

- [ ] **Step 5: Run frontend type check**

Run: `cd frontend && npx vue-tsc --noEmit`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ frontend/src/locales/
git commit -m "refactor: remove DelegateBubble and delegate_parallel frontend handling"
```

---

### Task 7: Update AGENTS.md Files

**Files:**
- Modify: `backend/src/agent/AGENTS.md`
- Modify: `backend/src/mode-policy/AGENTS.md`

- [ ] **Step 1: Remove delegate_parallel from agent AGENTS.md**

In `backend/src/agent/AGENTS.md`:

1. Remove from SSE events table (line 102): the entire `subagent:delegate` row
2. Remove from tool list (line 118): `delegate_parallel`
3. Remove the `delegate_parallel` reference from SSE Events section (lines 103-104): 
   ```
   | `[DONE]` followed by user command | `/delegate parallel <requestId>` | User chose parallel execution |
   | `[DONE]` followed by user command | `/delegate sequential <requestId>` | User chose step-by-step |
   ```

- [ ] **Step 2: Remove delegate_parallel from mode-policy AGENTS.md**

In `backend/src/mode-policy/AGENTS.md`, remove `delegate_parallel` from the Cowork denied tools list (line 44).

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/AGENTS.md backend/src/mode-policy/AGENTS.md
git commit -m "docs: remove delegate_parallel from AGENTS.md files"
```

---

### Task 8: Final Test Suite

- [ ] **Step 1: Run full backend tests**

Run: `cd backend && npx jest --no-coverage`

Expected: all tests pass.

- [ ] **Step 2: Run frontend type check**

Run: `cd frontend && npx vue-tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Quick smoke test**

Start backend: `cd backend && npm run start:dev` (or the project's dev command)

Verify:
1. `npx prisma studio` shows no `delegate_parallel` in Tool table
2. `curl http://localhost:13596/api/tools` doesn't include `delegate_parallel`
3. The `delegate` tool still appears and works

- [ ] **Step 4: Final commit if any fixes**

If any issues found during smoke test, fix and commit.
