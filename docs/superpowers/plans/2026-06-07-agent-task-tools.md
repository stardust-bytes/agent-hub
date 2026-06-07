# Agent Task Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `get_task`, expanded `update_task`, and `delete_tasks` tools for the AI agent.

**Architecture:** Extend `TasksService` with two new methods. Add tool execution cases to `OllamaProvider.executeTool()`. Register tool definitions in `ContextBuilderService.getDefaultTools()`.

**Tech Stack:** NestJS, Prisma, Jest

---

### Task 1: Add findOne() and removeMany() to TasksService

**Files:**
- Modify: `backend/src/tasks/tasks.service.ts`
- Test: `backend/src/tasks/tasks.service.spec.ts`

- [ ] **Step 1: Add `deleteMany` to mockPrisma in test file**

In `backend/src/tasks/tasks.service.spec.ts`, add `deleteMany: jest.fn()` to the `mockPrisma.task` object (after line 24 `delete: jest.fn(),`):

```ts
    deleteMany: jest.fn(),
```

- [ ] **Step 2: Write tests for findOne()**

Add these tests after the existing `remove` tests (after line 110):

```ts
  it('findOne returns task when found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(mockTask);
    const result = await service.findOne(1);
    expect(mockPrisma.task.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual(mockTask);
  });

  it('findOne throws NotFoundException when task not found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });
```

- [ ] **Step 3: Write tests for removeMany()**

```ts
  it('removeMany deletes tasks by ids and returns count', async () => {
    mockPrisma.task.deleteMany.mockResolvedValue({ count: 2 });
    const result = await service.removeMany([1, 2]);
    expect(mockPrisma.task.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
    });
    expect(result).toBe(2);
  });

  it('removeMany returns 0 for empty array', async () => {
    mockPrisma.task.deleteMany.mockResolvedValue({ count: 0 });
    const result = await service.removeMany([]);
    expect(mockPrisma.task.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [] } },
    });
    expect(result).toBe(0);
  });
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npx jest src/tasks/tasks.service.spec.ts --verbose
```
Expected: 4 new tests FAIL (findOne, findOne not found, removeMany, removeMany empty)

- [ ] **Step 5: Add findOne() and removeMany() to TasksService**

Add to `backend/src/tasks/tasks.service.ts` after the `remove` method (after line 36):

```ts
  async findOne(id: number) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async removeMany(ids: number[]) {
    const result = await this.prisma.task.deleteMany({
      where: { id: { in: ids } },
    });
    return result.count;
  }
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest src/tasks/tasks.service.spec.ts --verbose
```
Expected: ALL tests PASS (including existing 8 + 4 new = 12 tests)

- [ ] **Step 7: Commit**

```bash
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.service.spec.ts
git commit -m "feat: add findOne() and removeMany() to TasksService"
```

---

### Task 2: Add tool execution cases to OllamaProvider

**Files:**
- Modify: `backend/src/agent/providers/ollama.provider.ts`
- Modify: `backend/src/agent/providers/ollama.provider.spec.ts`

- [ ] **Step 1: Add mock methods to test file**

In `backend/src/agent/providers/ollama.provider.spec.ts`, expand `mockTasksService` (around line 32-36) to include the new methods:

```ts
  const mockTasksService = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    removeMany: jest.fn(),
  };
```

- [ ] **Step 2: Add test for get_task tool execution**

Add after the `list_tasks` test (after line 177):

```ts
  it('get_task returns task details', async () => {
    mockTasksService.findOne.mockResolvedValue({
      id: 5, title: 'My Task', status: 'TODO', priority: 1, description: 'A test task', dueDate: null,
    });

    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      {
        type: 'tool_call',
        toolCall: { name: 'get_task', arguments: { id: 5 } },
      },
      { type: 'done' },
    ]));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'show task 5' }], 'llama3.2', mockRes as any, signal);

    expect(mockTasksService.findOne).toHaveBeenCalledWith(5);
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('"toolResult"'),
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('#5'),
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('My Task'),
    );
  });
```

- [ ] **Step 3: Add test for delete_tasks tool execution**

```ts
  it('delete_tasks deletes multiple tasks', async () => {
    mockTasksService.removeMany.mockResolvedValue(3);

    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      {
        type: 'tool_call',
        toolCall: { name: 'delete_tasks', arguments: { ids: [1, 2, 3] } },
      },
      { type: 'done' },
    ]));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'delete tasks 1,2,3' }], 'llama3.2', mockRes as any, signal);

    expect(mockTasksService.removeMany).toHaveBeenCalledWith([1, 2, 3]);
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 3'),
    );
  });
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npx jest src/agent/providers/ollama.provider.spec.ts --verbose
```
Expected: 2 new tests FAIL with "Cannot read properties of undefined (reading 'mockResolvedValue')" or similar

- [ ] **Step 5: Add executeTool cases to OllamaProvider**

Open `backend/src/agent/providers/ollama.provider.ts`. In the `executeTool` method (starting line 189), replace the entire `update_task` case and add new cases:

Replace the existing `update_task` case (lines 199-205):
```ts
      case 'update_task': {
        const task = await this.tasksService.update(args.id as number, {
          title: args.title as string | undefined,
          description: args.description as string | undefined,
          status: args.status as string | undefined,
          priority: args.priority as number | undefined,
          dueDate: args.dueDate as string | undefined,
        });
        return `Task #${task.id} updated: "${task.title}" [${task.status}]`;
      }
```

Add after the `list_tasks` case (after line 215):
```ts
      case 'get_task': {
        const task = await this.tasksService.findOne(args.id as number);
        return `Task #${task.id}: "${task.title}" [${task.status}] priority=${task.priority} description="${task.description ?? ''}" due=${task.dueDate ?? ''}`;
      }
      case 'delete_tasks': {
        const ids = args.ids as number[];
        const count = await this.tasksService.removeMany(ids);
        return `Deleted ${count} task(s): #${ids.join(', #')}`;
      }
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest src/agent/providers/ollama.provider.spec.ts --verbose
```
Expected: ALL tests PASS (including existing + 2 new = 14+ tests)

- [ ] **Step 7: Commit**

```bash
git add backend/src/agent/providers/ollama.provider.ts backend/src/agent/providers/ollama.provider.spec.ts
git commit -m "feat: add get_task and delete_tasks tool execution, expand update_task"
```

---

### Task 3: Update tool definitions in ContextBuilderService

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`

- [ ] **Step 1: Replace update_task tool definition**

In `backend/src/agent/services/context-builder.service.ts`, in the `getDefaultTools()` method, replace the existing `update_task` definition (lines 102-117) with the expanded version:

```ts
      {
        type: 'function',
        function: {
          name: 'update_task',
          description: 'Update a task (title, description, status, priority, dueDate)',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Task ID' },
              title: { type: 'string', description: 'New title' },
              description: { type: 'string', description: 'New description' },
              status: { type: 'string', enum: ['TODO', 'PROCESSING', 'DONE', 'FAILED'] },
              priority: { type: 'number', enum: [0, 1, 2] },
              dueDate: { type: 'string', description: 'ISO 8601 due date' },
            },
            required: ['id'],
          },
        },
      },
```

- [ ] **Step 2: Add get_task tool definition**

Add after the `list_tasks` definition (after line 129):

```ts
      {
        type: 'function',
        function: {
          name: 'get_task',
          description: 'Get details of a specific task by ID',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Task ID' },
            },
            required: ['id'],
          },
        },
      },
```

- [ ] **Step 3: Add delete_tasks tool definition**

```ts
      {
        type: 'function',
        function: {
          name: 'delete_tasks',
          description: 'Delete one or more tasks by their IDs',
          parameters: {
            type: 'object',
            properties: {
              ids: {
                type: 'array',
                items: { type: 'number' },
                description: 'Task IDs to delete',
              },
            },
            required: ['ids'],
          },
        },
      },
```

- [ ] **Step 4: Run tests to verify**

```bash
npx jest src/agent --verbose
```
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts
git commit -m "feat: add get_task and delete_tasks tool defs, expand update_task params"
```

---

### Task 4: Run full test suite

**Files:**
- All modified files

- [ ] **Step 1: Run all tests**

```bash
npx jest --verbose
```
Expected: ALL tests PASS (all suites, all tests)

- [ ] **Step 2: Build verification**

```bash
npm run build
```
Expected: Compiles without errors
