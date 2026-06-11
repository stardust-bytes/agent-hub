# mode-policy/ — Agent Context

Mode-aware permission gate. Centralized policy config that defines which tools, paths, and environment context each mode (chat/agent/cowork) can access.

## Responsibility

- `ModePolicyConfig` — static `MODE_POLICY` record with tool allow/deny lists, allowed paths (with `{workspaceRoot}`/`{projectPath}` placeholders), system prompt style selection, and env context injection per mode
- `ModePolicyService` — resolves placeholders to absolute paths, filters `ToolDefinition[]` per mode policy, provides `isToolAllowed()` quick checks

## Files

```
mode-policy/
├── mode-policy.config.ts       — MODE_POLICY + ToolDefinition + ModePolicyEntry types
├── mode-policy.service.ts      — getEnabledTools, isToolAllowed, resolveAllowedPaths, getSystemPromptStyle, getEnvContext
├── mode-policy.service.spec.ts — 10 tests
└── mode-policy.module.ts       — exports ModePolicyService
```

## Status

**IMPLEMENTED** — Static policy is complete and tested. Future: allow DB-level overrides.

## Dependencies

- ConfigService (WORKSPACE_ROOT resolution)
- ContextBuilderService (imports ToolDefinition type)

## Agent Mode Policy

| Aspect | Setting |
|---|---|
| Enabled tools | `*` (all) |
| Denied tools | `run_command`, `read_file`, `list_directory`, `grep`, `glob`, `resume_plan` |
| Allowed paths | `{workspaceRoot}/agent-output` |
| System prompt | Full agent prompt with KB guidance |
| Env context | `platform` |

## Cowork Mode Policy

| Aspect | Setting |
|---|---|
| Enabled tools | `*` (all) |
| Denied tools | `create_task`, `update_task`, `delete_tasks`, `convert_note_to_task`, `search_knowledge` |
| Allowed paths | `{projectPath}`, `{workspaceRoot}` |
| System prompt | Full agent prompt + project path |
| Env context | `platform`, `projectPath` |

## Testing

```bash
npx jest src/mode-policy
```
