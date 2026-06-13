# Tool Approval Policy System — Design Spec

**Date:** 2026-06-13
**Status:** Draft

---

## Problem

The system has a `PermissionsConfig` with `allowedTools`/`deniedTools`/`defaultPolicy` and a `decide()` method that returns `{ action: 'ask' }`, but:

1. The `ask` action is never consumed at runtime — `agent-loop.service.ts` calls `isAllowed()` (binary) instead of `decide()`
2. The `PermissionsConfig` DTO lacks a `permissionMode` field, so the mode selector in `PermissionView.vue` is local-only and never persisted
3. No infrastructure exists to pause tool execution, ask the user for approval, and resume based on their response
4. No extensible mechanism to mark specific tools (e.g. `run_command`, delete operations) as always-require-approval

**Goal:** Make the `action: 'ask'` pathway real. Fix permission mode persistence. Add a configurable tool approval policy so destructive operations (especially delete and run_command) require user confirmation before executing.

---

## Architecture

Three independent subsystems:

1. **PermissionsConfig** — extend the DTO, persist to DB, wire the frontend to save/load
2. **ApprovalManager** — new service that manages pending approval requests between tool execution and user response via SSE + HTTP endpoint
3. **AgentLoop integration** — replace `isAllowed()` with `decide()` in the runtime path; handle `ask`, `allow`, `deny` branches

The system is designed so adding a new approval-required tool in the future only requires adding its name to `requireApprovalTools` in the config — no code changes.

---

## Section 1: PermissionsConfig + Mode Persistence

### Backend: Extend `PermissionsConfig` DTO

**File:** `backend/src/agent/dto/permissions-config.ts`

```typescript
export interface PermissionsConfig {
  defaultPolicy: 'allow' | 'deny';
  allowedTools: string[];
  deniedTools: string[];
  permissionMode: string;               // NEW: 'default'|'acceptEdits'|'auto'|'plan'|'bypassPermissions'|'dontAsk'
  requireApprovalTools: string[];       // NEW: tools that always need user approval
}

export const DEFAULT_PERMISSIONS_CONFIG: PermissionsConfig = {
  defaultPolicy: 'allow',
  allowedTools: [],
  deniedTools: [],
  permissionMode: 'default',
  requireApprovalTools: ['run_command'],  // run_command needs approval by default
};
```

### Backend: Wire `decide()` to read from config

**File:** `backend/src/agent/services/permissions.service.ts`

Change `getPermissionMode()` to read from stored config instead of `MODE_POLICY`:

```typescript
private async getPermissionMode(toolName: string, toolInput: string): Promise<string> {
  const config = await this.getConfig();
  // First check if tool is in requireApprovalTools
  if (config.requireApprovalTools.includes(toolName)) return 'requireApproval';
  // If tool args contain destructive patterns, also require approval
  if (this.hasDestructivePatterns(toolName, toolInput)) return 'requireApproval';
  return config.permissionMode;
}

private hasDestructivePatterns(name: string, input: string): boolean {
  const destructiveArgs = ['delete', 'remove', 'drop', 'truncate', 'rm ', 'rmdir', 'del '];
  return destructiveArgs.some(p => input.toLowerCase().includes(p));
}
```

Add `'requireApproval'` as a new mode that always returns `{ action: 'ask' }`.

### Frontend: Fix PermissionView.vue

**File:** `frontend/src/components/PermissionView.vue`

1. Replace local `const permissionMode = ref('default')` with data loaded from backend config
2. Add API call to load full permissions config on mount
3. On dropdown change, call `PATCH /api/agent/permissions` with `{ permissionMode: newValue }`
4. Add a section to manage `requireApprovalTools`: checkbox list of available tools + custom input

### Frontend API

**File:** `frontend/src/api/agent.ts`

Add:
```typescript
export function getPermissions() {
  return request<PermissionsConfig>('/agent/permissions')
}
export function setPermissions(body: Partial<PermissionsConfig>) {
  return request<PermissionsConfig>('/agent/permissions', { method: 'PATCH', body })
}
```

The existing `GET /api/agent/permissions` and `PATCH /api/agent/permissions` endpoints already exist in `agent.controller.ts` — they just need the new fields in the DTO.

---

## Section 2: ApprovalManager Service

**File:** `backend/src/agent/services/approval-manager.service.ts`

New standalone service that manages pending approval requests.

```typescript
@Injectable()
export class ApprovalManagerService {
  private pending = new Map<string, PendingApproval>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async requestApproval(
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
    sessionId: number,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(toolCallId);
        resolve(false); // timeout = auto-deny
      }, 30_000);

      this.pending.set(toolCallId, { resolve, timer });
      this.eventEmitter.emit('tool.approval.requested', {
        toolCallId, toolName, args, sessionId,
      });
    });
  }

  handleResponse(toolCallId: string, approved: boolean): boolean {
    const entry = this.pending.get(toolCallId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    entry.resolve(approved);
    this.pending.delete(toolCallId);
    return true;
  }
}
```

### SSE Event: `toolApprovalRequired`

Emitted by the agent loop when `decide()` returns `ask`. The event is written directly to the SSE stream:

```typescript
res.write(`data: ${JSON.stringify({
  toolApprovalRequired: {
    id: toolCallId,
    name: toolName,
    args: args,
  }
})}\n\n`);
```

### Approval Response Endpoint

**File:** `backend/src/agent/agent.controller.ts`

```typescript
@Post('approve-tool')
async approveTool(@Body() dto: ApproveToolDto): Promise<{ success: boolean }> {
  const handled = this.approvalManager.handleResponse(dto.id, dto.approved);
  return { success: handled };
}
```

**DTO:** `backend/src/agent/dto/approve-tool.dto.ts`
```typescript
export class ApproveToolDto {
  @IsString()
  id: string;

  @IsBoolean()
  approved: boolean;
}
```

### Timeout

- 30-second timeout on pending approval
- On timeout: auto-deny (resolves `false`), agent continues with denial message
- Frontend removes the approval UI after timeout

---

## Section 3: Agent Loop Integration

### Replace `isAllowed()` with `decide()`

**File:** `backend/src/agent/services/agent-loop.service.ts`

In both `run()` and `runForStep()`, replace:

```typescript
const allowed = await this.permissionsService.isAllowed(name);
// ... simple allow/deny
```

With:

```typescript
const toolInput = JSON.stringify(args);
const transcript = this.buildTranscript(messages);
const decision = await this.permissionsService.decide('cowork', name, toolInput, transcript, sessionId);

if (decision.action === 'allow') {
  // execute tool as normal
  result = await this.executeTool(name, args, { sessionId, projectPath });
} else if (decision.action === 'deny') {
  // emit denial toolResult (same as current denial flow)
  res.write(`data: ${JSON.stringify({ toolResult: { name, result: decision.reason ?? 'Tool denied' } })}\n\n`);
  // continue loop
} else if (decision.action === 'ask') {
  // 1. Generate unique toolCallId
  const toolCallId = crypto.randomUUID();

  // 2. Emit SSE event
  res.write(`data: ${JSON.stringify({ toolApprovalRequired: { id: toolCallId, name, args } })}\n\n`);

  // 3. Await user response
  const approved = await this.approvalManager.requestApproval(toolCallId, name, args, sessionId ?? 0);

  // 4. Execute or deny based on response
  if (approved) {
    result = await this.executeTool(name, args, { sessionId, projectPath });
    // emit toolResult as normal
    res.write(`data: ${JSON.stringify({ toolResult: { name, result } })}\n\n`);
  } else {
    res.write(`data: ${JSON.stringify({ toolResult: { name, result: 'Tool execution denied by user' } })}\n\n`);
  }
}
```

### Update `SseCallbacks` interface (frontend)

**File:** `frontend/src/composables/useChatStream.ts`

Add to `SseCallbacks`:
```typescript
onToolApprovalRequired?: (id: string, name: string, args: Record<string, unknown>) => void;
```

Add to `parseSseStream()`:
```typescript
else if (p.toolApprovalRequired) {
  const { id, name, args } = p.toolApprovalRequired as { id: string; name: string; args: Record<string, unknown> };
  cb.onToolApprovalRequired?.(id, name, args);
}
```

### Frontend CoworkView: Handle Approval UI

**File:** `frontend/src/components/CoworkView.vue`

Add `onToolApprovalRequired` callback that:
1. Pushes a new message to the chat with `role: 'system'` and approval UI text
2. Adds Allow/Deny buttons (or renders a custom inline component)
3. On Allow: calls `POST /api/agent/approve-tool { id, approved: true }`
4. On Deny: calls `POST /api/agent/approve-tool { id, approved: false }`
5. On timeout (30s), the block auto-dismisses

---

## Changes by File

| File | Change |
|---|---|
| `backend/src/agent/dto/permissions-config.ts` | Add `permissionMode` + `requireApprovalTools` |
| `backend/src/agent/dto/approve-tool.dto.ts` | NEW: `{ id: string; approved: boolean }` |
| `backend/src/agent/services/permissions.service.ts` | `decide()` reads from config; add `requireApproval` mode; add `hasDestructivePatterns()` |
| `backend/src/agent/services/approval-manager.service.ts` | NEW: pending approval map, 30s timeout, EventEmitter2 |
| `backend/src/agent/services/agent-loop.service.ts` | Replace `isAllowed()` with `decide()`; handle `ask` branch with approval flow |
| `backend/src/agent/agent.controller.ts` | Add `POST /api/agent/approve-tool` endpoint |
| `backend/src/agent/agent.module.ts` | Wire `ApprovalManagerService` |
| `frontend/src/composables/useChatStream.ts` | Add `onToolApprovalRequired` to `SseCallbacks` and `parseSseStream` |
| `frontend/src/components/CoworkView.vue` | Add `onToolApprovalRequired` handler; render approval UI with Allow/Deny buttons |
| `frontend/src/components/PermissionView.vue` | Fix mode persistence; add `requireApprovalTools` management UI |
| `frontend/src/api/agent.ts` | Add `getPermissions()` and `setPermissions()` |
| `frontend/src/locales/*.json` | Add i18n keys: `permissions.mode.*`, `permissions.requireApproval.*` |
| `backend/src/agent/*.spec.ts` | Update test expectations for new flow |

---

## Out of Scope

- `decide()` is currently only used in the agent loop `run()` and `runForStep()` methods. The `permissions.service.ts` `isAllowed()` method is kept for backward compatibility but no longer called from the runtime path.
- Not building a full admin panel for permissions — just fixing the existing PermissionView.vue
- Not changing the YOLO classifier — it remains the same for `auto` mode
