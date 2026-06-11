# Human-Only Task and Note Tools

## Overview

Prevent the LLM from autonomously using task (create_task, update_task, etc.) and note (create_note, update_note, etc.) tools during its work. These tools should only be used when the human explicitly requests them.

## Approach: System Prompt + Tool Descriptions

Rather than hard-blocking via `deniedTools` (which would prevent legitimate human requests), use two soft-guide mechanisms:

1. **Tool descriptions** — Tell the LLM in each tool's description that it's for human-initiated use only
2. **System prompt** — Add explicit instructions in agent/cowork mode system prompts

## Changes

### 1. Tool Descriptions (prisma/seed.ts)

| Tool | New Description |
|------|----------------|
| `create_task` | `Create a new task in the task board. Only use when the user explicitly asks you to create a task.` |
| `update_task` | `Update a task (title, description, status, priority, dueDate). Only use when the user explicitly asks to update a task.` |
| `list_tasks` | `List all tasks, optionally filter by status. Only use when the user explicitly asks to list or check tasks.` |
| `get_task` | `Get details of a specific task by ID. Only use when the user explicitly asks about a specific task.` |
| `delete_tasks` | `Delete one or more tasks by their IDs. Only use when the user explicitly asks to delete tasks.` |
| `create_note` | `Create a new note. Only use when the user explicitly asks to create a note.` |
| `update_note` | `Update a note (title, content). Only use when the user explicitly asks to update a note.` |
| `list_notes` | `List all notes. Only use when the user explicitly asks to list notes.` |
| `delete_note` | `Delete a note by ID. Only use when the user explicitly asks to delete a note.` |
| `convert_note_to_task` | `Convert a note to a task in the task board. Only use when the user explicitly asks to convert a note.` |

### 2. System Prompt (context-builder.service.ts)

Add after the knowledge base guidance section in `buildSystemPrompt()` for both `agent` and `cowork` modes:

```typescript
lines.push('',
  '',
  'Task and Note Management Policy:',
  '- Task tools (create_task, update_task, delete_tasks, convert_note_to_task) and',
  '  note tools (create_note, update_note, delete_note) must ONLY be used',
  '  when the user explicitly requests task or note management.',
  '- Do NOT create, modify, or delete tasks or notes autonomously.',
  '- These features are for human-initiated task assignment to you.',
  '- Read-only tools (list_tasks, get_task, list_notes) may be used to check',
  '  existing data when contextually relevant.',
);
```

### 3. Mode-Policy Cleanup

Remove `get_task`, `create_task`, `update_task`, `delete_tasks`, `convert_note_to_task` from cowork `deniedTools` — the soft-guide mechanism replaces the hard block.

## Files Modified

- `backend/prisma/seed.ts` — update 10 tool descriptions
- `backend/src/agent/services/context-builder.service.ts` — add policy to system prompt
- `backend/src/mode-policy/mode-policy.config.ts` — clean up deniedTools

## Testing

```bash
npx prisma db seed    # update tool descriptions in DB
npx jest src/agent    # system prompt tests
npx jest src/mode-policy  # mode-policy tests
```
