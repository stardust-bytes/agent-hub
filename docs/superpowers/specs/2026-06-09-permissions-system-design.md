# Permissions System Design

## Summary

Thêm granular permission control cho tool execution trong AI Agent. Workspace operator có thể cấu hình tool nào được phép, tool nào bị cấm, hoặc dùng default policy. Rules lưu dưới dạng JSON trong `Setting` table với key `agent.permissions`.

## Problem

`AgentLoopService` hiện tại execute bất kỳ tool nào LLM yêu cầu mà không có filter. Workspace operator không thể restrict các tool nguy hiểm (web_fetch, delete_tasks) hay enforce deny-by-default.

## Architecture

```
GET/PATCH /api/agent/permissions
    └── AgentController
         └── AgentService.getPermissions() / updatePermissions()
              └── PermissionsService
                   └── SettingsService (key: "agent.permissions")

POST /api/agent/chat
    └── AgentLoopService.run()
         └── [EVALUATING phase — per tool call]
              └── PermissionsService.isAllowed(toolName)
                   ├── denied → emit toolResult(denial msg) → continue to next tool
                   └── allowed → execute tool normally
```

## Config Shape

```typescript
interface PermissionsConfig {
  defaultPolicy: 'allow' | 'deny';  // default: 'allow'
  allowedTools: string[];            // always allowed (overrides deny policy)
  deniedTools: string[];             // always denied (overrides allow policy)
}
```

Stored as JSON string in `Setting` table under key `agent.permissions`. Default: `{ defaultPolicy: 'allow', allowedTools: [], deniedTools: [] }`.

## Permission Resolution

Priority order: `deniedTools` > `allowedTools` > `defaultPolicy`

1. `toolName` in `deniedTools` → **DENIED**
2. `toolName` in `allowedTools` → **ALLOWED**
3. Otherwise → follow `defaultPolicy` ('allow' → ALLOWED, 'deny' → DENIED)

## Denied Tool Behavior (in AgentLoopService EVALUATING phase)

When a tool call is denied:
1. Emit `toolCall` SSE event (so frontend shows the attempted tool)
2. Emit `toolResult` SSE: `{ name, result: 'Tool "X" is not permitted by workspace policy.' }`
3. Push denial result as `{ role: 'tool', content: denyMsg }` into messages
4. Use `continue` — skip to next tool call (don't set `allGood = false`, don't trigger CORRECTING)

After processing all tool calls: if all were either allowed+evaluated or denied+skipped, the loop continues to EXECUTING. The LLM receives the denial message as a tool result and will respond explaining it cannot perform the requested action.

## API

**`GET /api/agent/permissions`**
- Returns current `PermissionsConfig`
- 200 OK with JSON body

**`PATCH /api/agent/permissions`**
- Partially updates config
- Body: `UpdatePermissionsDto` (all fields optional)
- Returns updated `PermissionsConfig`

## Files

| File | Action | Responsibility |
|---|---|---|
| `src/agent/dto/permissions-config.ts` | Create | `PermissionsConfig` interface + `DEFAULT_PERMISSIONS_CONFIG` constant |
| `src/agent/dto/update-permissions.dto.ts` | Create | DTO class with class-validator decorators for PATCH body |
| `src/agent/services/permissions.service.ts` | Create | `getConfig()`, `updateConfig()`, `isAllowed()` backed by SettingsService |
| `src/agent/services/permissions.service.spec.ts` | Create | TDD tests for all permission logic paths |
| `src/agent/agent.controller.ts` | Modify | Add `GET /api/agent/permissions` and `PATCH /api/agent/permissions` |
| `src/agent/agent.service.ts` | Modify | Inject `PermissionsService`, expose `getPermissions()` / `updatePermissions()` |
| `src/agent/services/agent-loop.service.ts` | Modify | Inject `PermissionsService`, check `isAllowed()` before each tool execution |
| `src/agent/services/agent-loop.service.spec.ts` | Modify | Add `PermissionsService` mock to test module |
| `src/agent/agent.module.ts` | Modify | Register `PermissionsService` in providers |
| `src/agent/AGENTS.md` | Modify | Document new service + endpoints |
