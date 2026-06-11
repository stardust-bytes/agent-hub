# Seed Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `spawn_subagent` and `delegate_parallel` tools to the DB seed so they appear in the tool registry, and remove corresponding hardcoded blocks from ContextBuilderService.

**Architecture:** Two-file change: add entries to `seed.ts` `DEFAULT_TOOLS` array (upserted into `Tool` table on setup), then remove the hardcoded `getEnabledTools()` blocks that were duplicating these definitions. Tools will now flow through the normal DB → ModePolicyService path.

**Tech Stack:** NestJS, Prisma, TypeScript

---

### Task 1: Add tools to seed.ts

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Add `spawn_subagent` to DEFAULT_TOOLS**

Add after `create_plan` entry (line 27), before the closing `]`:
```typescript
  { name: 'spawn_subagent', description: 'Spawn a sub-agent to complete a specific subtask. Use for complex, multi-step, or parallel tasks. Do NOT use for simple questions or single-tool operations — handle those directly.', parameters: '{"type":"object","properties":{"task":{"type":"string","description":"The task for the sub-agent to complete. Be specific and include all context needed."}},"required":["task"]}' },
  { name: 'delegate_parallel', description: 'Decompose a complex task into independent parallel subtasks. Use ONLY when the user request involves multiple pieces of independent work that can run concurrently.', parameters: '{"type":"object","properties":{"task":{"type":"string","description":"The original user request or overall task description."},"subtasks":{"type":"array","items":{"type":"string"},"description":"List of independent subtasks that can run in parallel. Each should be self-contained."}},"required":["task","subtasks"]}' },
```

- [ ] **Step 2: Verify seed compiles**

Run: `npx tsc --noEmit prisma/seed.ts --skipLibCheck`
Or: `npx prisma db seed` (dry run)

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: add spawn_subagent and delegate_parallel to seed"
```

---

### Task 2: Remove hardcoded blocks from ContextBuilderService

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`

- [ ] **Step 1: Remove `spawn_subagent` hardcode block**

Delete lines 161-185 (the first hardcoded block that adds `spawn_subagent` for agent/cowork).

Before (lines 161-185):
```typescript
    if (mode === 'agent' || mode === 'cowork') {
      tools.push({
        type: 'function' as const,
        function: {
          name: 'spawn_subagent',
          description: 'ONLY use for complex, multi-step, or parallel tasks. ' +
            'Spawn a sub-agent to complete a specific subtask. ' +
            'Do NOT use for simple questions or single-tool operations — ' +
            'handle those directly. ' +
            'Use when delegating independent work that can run in parallel ' +
            'or when a task requires focused attention.',
          parameters: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'The task for the sub-agent to complete. ' +
                  'Be specific and include all context needed.',
              },
            },
            required: ['task'],
          },
        },
      });
    }
```

After — nothing (the block is removed).

- [ ] **Step 2: Remove `delegate_parallel` hardcode block**

Delete lines 187-213 (the second hardcoded block that adds `delegate_parallel` for agent/cowork).

Before (lines 187-213):
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

After — nothing (the block is removed).

- [ ] **Step 3: Run existing tests**

Run: `cd backend && npx jest src/agent/services/context-builder.service.spec.ts`
Expected: All 8 tests PASS (no tests check for specific tool names)

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts
git commit -m "refactor: remove hardcoded tool definitions now seeded in DB"
```
