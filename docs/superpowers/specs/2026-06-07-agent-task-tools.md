# Agent Task Tools Expansion

## Overview

Add three new tools for the AI agent to manage tasks: `get_task(id)`, expanded `update_task(id)`, and `delete_tasks([id,id])`.

## Motivation

The agent currently has `create_task`, `update_task`, and `list_tasks` but cannot fetch a single task's details, update all task fields, or delete tasks. These gaps limit the agent's ability to manage the task board autonomously.

## Design

### New Tools

#### 1. `get_task(id)`

Fetch a single task by ID and return its full details.

Tool definition (OpenAPI schema):
```
name: get_task
description: Get details of a specific task by ID
parameters:
  id: number (required) — Task ID
```

Implementation in `executeTool`:
```ts
case 'get_task': {
  const task = await this.tasksService.findOne(args.id as number);
  return `Task #${task.id}: "${task.title}" [${task.status}] priority=${task.priority} description="${task.description}" due=${task.dueDate}`;
}
```

Service method added to `TasksService`:
```ts
async findOne(id: number): Promise<Task> {
  const task = await this.prisma.task.findUnique({ where: { id } });
  if (!task) throw new NotFoundException(`Task ${id} not found`);
  return task;
}
```

#### 2. `update_task(id)` — expanded fields

Current fields: `status`, `priority`
New fields: `title`, `description`, `dueDate`

Tool definition:
```
name: update_task
description: Update a task (title, description, status, priority, dueDate)
parameters:
  id: number (required) — Task ID
  title: string (optional)
  description: string (optional)
  status: string (optional, enum: TODO|PROCESSING|DONE|FAILED)
  priority: number (optional, enum: 0|1|2)
  dueDate: string (optional) — ISO 8601 date
```

Implementation in `executeTool`:
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

#### 3. `delete_tasks([id,id])`

Delete multiple tasks by their IDs.

Tool definition:
```
name: delete_tasks
description: Delete one or more tasks by their IDs
parameters:
  ids: array of number (required) — Task IDs to delete
```

Service method added to `TasksService`:
```ts
async removeMany(ids: number[]): Promise<number> {
  const result = await this.prisma.task.deleteMany({
    where: { id: { in: ids } },
  });
  return result.count;
}
```

Implementation in `executeTool`:
```ts
case 'delete_tasks': {
  const ids = args.ids as number[];
  const count = await this.tasksService.removeMany(ids);
  return `Deleted ${count} task(s)`;
}
```

### Files Changed

| File | Change |
|---|---|
| `backend/src/tasks/tasks.service.ts` | Add `findOne()`, `removeMany()` methods |
| `backend/src/tasks/tasks.service.spec.ts` | Tests for new methods |
| `backend/src/agent/services/context-builder.service.ts` | Add tool defs for `get_task`, `delete_tasks`; expand `update_task` params |
| `backend/src/agent/providers/ollama.provider.ts` | Add cases `get_task`, `delete_tasks`; expand `update_task` fields |

### Error Handling

- `get_task` with non-existent ID → returns error message (caught by existing try/catch in `executeTool`)
- `delete_tasks` with non-existent IDs → silently ignores (Prisma `deleteMany` only deletes matching rows)
- `update_task` with non-existent ID → `NotFoundException` caught by existing try/catch

### Test Plan

- `TasksService.findOne()` — returns task when found, throws when not found
- `TasksService.removeMany()` — returns count of deleted tasks, handles empty array
- Integration test in `ollama.provider.spec.ts` for tool execution
