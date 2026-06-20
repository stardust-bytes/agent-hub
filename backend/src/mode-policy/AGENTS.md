# mode-policy/ — Agent Context

Mode-aware permission gate. Centralized policy config that defines which tools, paths, environment context, and permission mode each agent mode can access. Currently a single `cowork` mode is defined in `MODE_POLICY`.

## Responsibility

- `ModePolicyConfig` — static `MODE_POLICY` record with tool allow/deny lists, allowed paths (with `{workspaceRoot}`/`{projectPath}` placeholders), system prompt style, env context, and `permissionMode` per mode. Also exports `PERMISSION_MODES` (`default`, `acceptEdits`, `bypassPermissions`, `dontAsk`, `auto`, `plan`).
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

## Cowork Mode Policy (current `MODE_POLICY.cowork`)

| Aspect | Setting |
|---|---|
| Enabled tools | `*` (all) |
| Denied tools | `search_knowledge` |
| Allowed paths | `{projectPath}` |
| System prompt | `cowork` style (project path) |
| Env context | `platform`, `projectPath` |
| Permission mode | `acceptEdits` |

## Testing

```bash
npx jest src/mode-policy
```
