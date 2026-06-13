# Tool Approval Policy System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `action: 'ask'` permission pathway real — fix mode persistence, add configurable `requireApprovalTools`, and wire the agent loop to pause for user approval before executing destructive tools.

**Architecture:** Extend `PermissionsConfig` DTO → update `permissions.service.ts` → create `ApprovalManagerService` → wire agent loop to call `decide()` and handle `ask` → add SSE event + frontend UI. Backend changes first, then frontend.

**Tech Stack:** NestJS, TypeScript, Prisma, Vue 3, vitest, jest

---

### Task 1: Extend PermissionsConfig DTO and update permissions.service.ts

**Files:**
- Modify: `backend/src/agent/dto/permissions-config.ts`
- Modify: `backend/src/agent/services/permissions.service.ts`

- [ ] **Step 1: Update `PermissionsConfig` DTO**

Edit `backend/src/agent/dto/permissions-config.ts`:

```typescript
export interface PermissionsConfig {
  defaultPolicy: 'allow' | 'deny';
  allowedTools: string[];
  deniedTools: string[];
  permissionMode: string;
  requireApprovalTools: string[];
}

export const DEFAULT_PERMISSIONS_CONFIG: PermissionsConfig = {
  defaultPolicy: 'allow',
  allowedTools: [],
  deniedTools: [],
  permissionMode: 'default',
  requireApprovalTools: ['run_command'],
};
```

- [ ] **Step 2: Update `permissions.service.ts` — add `requireApproval` mode handling**

Edit `backend/src/agent/services/permissions.service.ts`:

1. Replace `getPermissionMode(mode: string)` to read from config and check destructive patterns:

```typescript
private async decidePermissionMode(toolName: string, toolInput: string): Promise<string> {
  const config = await this.getConfig();

  if (config.requireApprovalTools.includes(toolName)) {
    return 'requireApproval';
  }

  if (this.hasDestructivePatterns(toolName, toolInput)) {
    return 'requireApproval';
  }

  return config.permissionMode;
}

private hasDestructivePatterns(name: string, input: string): boolean {
  const patterns = ['delete', 'remove', 'drop', 'truncate', 'rm ', 'rmdir', 'del '];
  return patterns.some(p => input.toLowerCase().includes(p));
}
```

2. Add `'requireApproval'` case to the `decide()` switch:

```typescript
case 'requireApproval':
  return { action: 'ask' };
```

3. Update `decide()` signature to not take `mode: string` since we now read mode from config. Simplified:

```typescript
async decide(
  toolName: string,
  toolInput: string,
  transcript: string,
  sessionId?: number,
): Promise<PermissionDecision> {
  const config = await this.getConfig();
  if (config.deniedTools.includes(toolName)) {
    return { action: 'deny', reason: 'Tool denied by configuration' };
  }

  const permissionMode = await this.decidePermissionMode(toolName, toolInput);
  // ... rest of switch using permissionMode directly
}
```

4. Remove the old `getPermissionMode(mode: string)` method that read from `MODE_POLICY`.

- [ ] **Step 3: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add backend/src/agent/dto/permissions-config.ts backend/src/agent/services/permissions.service.ts
git commit -m "feat: extend PermissionsConfig with permissionMode and requireApprovalTools"
```

---

### Task 2: Create ApprovalManagerService

**Files:**
- Create: `backend/src/agent/services/approval-manager.service.ts`

- [ ] **Step 1: Create the service**

Create `backend/src/agent/services/approval-manager.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface PendingApproval {
  resolve: (value: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

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
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(toolCallId);
        resolve(false);
      }, 30_000);

      this.pending.set(toolCallId, { resolve, timer });

      this.eventEmitter.emit('tool.approval.requested', {
        toolCallId,
        toolName,
        args,
        sessionId,
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

- [ ] **Step 2: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```
git add backend/src/agent/services/approval-manager.service.ts
git commit -m "feat: add ApprovalManagerService for tool approval request/response flow"
```

---

### Task 3: Create ApproveToolDto, update agent controller and module

**Files:**
- Create: `backend/src/agent/dto/approve-tool.dto.ts`
- Modify: `backend/src/agent/agent.controller.ts`
- Modify: `backend/src/agent/agent.module.ts`

- [ ] **Step 1: Create ApproveToolDto**

Create `backend/src/agent/dto/approve-tool.dto.ts`:

```typescript
import { IsString, IsBoolean } from 'class-validator';

export class ApproveToolDto {
  @IsString()
  id: string;

  @IsBoolean()
  approved: boolean;
}
```

- [ ] **Step 2: Add POST endpoint to agent controller**

Edit `backend/src/agent/agent.controller.ts`. Add imports and new endpoint:

```typescript
import { Body, Controller, Get, Patch, Post, Query, Req, Res, ParseIntPipe } from '@nestjs/common';
import { ApproveToolDto } from './dto/approve-tool.dto';
import { ApprovalManagerService } from './services/approval-manager.service';

// In constructor, add:
// private readonly approvalManager: ApprovalManagerService

@Post('approve-tool')
async approveTool(@Body() dto: ApproveToolDto): Promise<{ success: boolean }> {
  const handled = this.approvalManager.handleResponse(dto.id, dto.approved);
  return { success: handled };
}
```

- [ ] **Step 3: Wire ApprovalManagerService module**

Edit `backend/src/agent/agent.module.ts`. Add `ApprovalManagerService` to the `providers` array:

```typescript
import { ApprovalManagerService } from './services/approval-manager.service';

@Module({
  providers: [
    ApprovalManagerService,
    // ... existing providers
  ],
  exports: [
    ApprovalManagerService,
    // ... existing exports
  ],
})
export class AgentModule {}
```

- [ ] **Step 4: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add backend/src/agent/dto/approve-tool.dto.ts backend/src/agent/agent.controller.ts backend/src/agent/agent.module.ts
git commit -m "feat: add approve-tool endpoint and wire ApprovalManagerService"
```

---

### Task 4: Update agent loop to use decide() with approval flow

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Read the current agent-loop.service.ts**

Read `backend/src/agent/services/agent-loop.service.ts`. Focus on the `run()` method (the main agent loop around line 226-336) and `runForStep()` method (plan step execution around line 642-706). Identify the two locations where `isAllowed()` is called.

- [ ] **Step 2: Replace `isAllowed()` with `decide()` + approval flow in `run()`**

In `run()`, replace:

```typescript
const allowed = await this.permissionsService.isAllowed(name);
if (!allowed) {
  // ...deny flow
}
```

With:

```typescript
const toolInput = JSON.stringify(args);
const transcript = this.buildTranscript(context.messages);
const decision = await this.permissionsService.decide(name, toolInput, transcript, sessionId);

if (decision.action === 'allow') {
  // execute tool as normal
} else if (decision.action === 'deny') {
  const denialResult = `Tool '${name}' is not permitted by workspace policy.${decision.reason ? ' ' + decision.reason : ''}`;
  res.write(`data: ${JSON.stringify({ toolResult: { name, result: denialResult } })}\n\n`);
  continue;
} else if (decision.action === 'ask') {
  const toolCallId = crypto.randomUUID();
  res.write(`data: ${JSON.stringify({ toolApprovalRequired: { id: toolCallId, name, args } })}\n\n`);

  const approved = await this.approvalManager.requestApproval(toolCallId, name, args, sessionId ?? 0);

  if (approved) {
    // execute tool — fall through to executeTool call below
  } else {
    res.write(`data: ${JSON.stringify({ toolResult: { name, result: 'Tool execution denied by user' } })}\n\n`);
    continue;
  }
}
```

Add `buildTranscript` helper method:

```typescript
private buildTranscript(messages: OllamaMessage[]): string {
  return messages.map(m => `${m.role}: ${m.content}`).join('\n');
}
```

- [ ] **Step 3: Apply same change to `runForStep()`**

In `runForStep()`, around line 682, apply the same replacement of `isAllowed()` with `decide()` + approval flow. Be careful: the variable names may differ slightly.

- [ ] **Step 4: Add imports**

Ensure the file has:
```typescript
import * as crypto from 'crypto';
import { ApprovalManagerService } from './approval-manager.service';
```

Add `ApprovalManagerService` to the constructor.

- [ ] **Step 5: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```
git add backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: replace isAllowed with decide() in agent loop, wire approval flow"
```

---

### Task 5: Frontend — add onToolApprovalRequired to useChatStream

**Files:**
- Modify: `frontend/src/composables/useChatStream.ts`

- [ ] **Step 1: Add callback type and SSE parser branch**

Read `frontend/src/composables/useChatStream.ts`. Add to `SseCallbacks`:

```typescript
export interface SseCallbacks {
  // ... existing callbacks
  onToolApprovalRequired?: (id: string, name: string, args: Record<string, unknown>) => void;
}
```

In the `parseSseStream()` function, add a new branch after `p.planInterrupted`:

```typescript
else if (p.toolApprovalRequired) {
  const { id, name, args } = p.toolApprovalRequired as { id: string; name: string; args: Record<string, unknown> };
  cb.onToolApprovalRequired?.(id, name, args);
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```
git add frontend/src/composables/useChatStream.ts
git commit -m "feat: add onToolApprovalRequired callback to useChatStream"
```

---

### Task 6: Frontend — Add approval UI to CoworkView

**Files:**
- Modify: `frontend/src/components/CoworkView.vue`
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add approval message type in CoworkView**

Edit `frontend/src/components/CoworkView.vue`. In the `SseCallbacks` object (inside `submitText()`), add the `onToolApprovalRequired` callback:

```typescript
onToolApprovalRequired(id, name, args) {
  const argsStr = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(', ');
  const msg: Message = {
    role: 'system',
    content: '',
    timestamp: now(),
    approvalRequest: { id, name, args: argsStr },
  };
  messages.value.push(msg);
  scrollToBottom();
}
```

- [ ] **Step 2: Add approval request field to Message interface**

The `Message` type in `frontend/src/components/cowork/types.ts` needs a new optional field:

```typescript
export interface Message {
  // ... existing fields
  approvalRequest?: {
    id: string
    name: string
    args: string
  }
}
```

- [ ] **Step 3: Add approval action functions**

In CoworkView.vue's script, add two functions:

```typescript
async function approveTool(id: string) {
  try {
    await fetch('/api/agent/approve-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: true }),
    });
  } catch { /* ignore */ }
}

async function denyTool(id: string) {
  try {
    await fetch('/api/agent/approve-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: false }),
    });
  } catch { /* ignore */ }
}
```

- [ ] **Step 4: Add approval UI template in the message rendering area**

In the template, inside the `v-for` message loop, add a new block for approval requests (before or after the system message block):

```html
<div v-else-if="msg.approvalRequest"
  class="border-l-2 border-cyber-orange/80 pl-3 py-2">
  <div class="text-sm text-cyber-orange font-mono mb-1">
    <HiShieldExclamation class="w-3 h-3 inline" /> {{ t('approval.required') }}
  </div>
  <div class="text-xs text-cyber-text font-mono mb-2">
    <span class="text-cyber-muted">{{ t('approval.tool') }}:</span> {{ msg.approvalRequest.name }}
    <br>
    <span class="text-cyber-muted">{{ t('approval.args') }}:</span> {{ msg.approvalRequest.args }}
  </div>
  <div class="flex gap-2">
    <button @click="approveTool(msg.approvalRequest!.id)"
      class="text-xs text-white font-mono px-2 py-1 bg-cyber-accent rounded transition-colors duration-150 hover:bg-cyber-accent/80">
      {{ t('approval.allow') }}
    </button>
    <button @click="denyTool(msg.approvalRequest!.id)"
      class="text-xs text-cyber-text font-mono px-2 py-1 border border-cyber-code-border rounded transition-colors duration-150 hover:bg-cyber-dark">
      {{ t('approval.deny') }}
    </button>
  </div>
</div>
```

- [ ] **Step 5: Add i18n keys**

Add to `frontend/src/locales/vi.json`:
```json
"approval": {
  "required": "Cần phê duyệt",
  "tool": "Tool",
  "args": "Tham số",
  "allow": "Cho phép",
  "deny": "Từ chối"
}
```

Add to `frontend/src/locales/en.json`:
```json
"approval": {
  "required": "Approval required",
  "tool": "Tool",
  "args": "Args",
  "allow": "Allow",
  "deny": "Deny"
}
```

- [ ] **Step 6: Add HiShieldExclamation import**

In CoworkView.vue, add to the vue-icons-plus/hi import:
```typescript
import { HiChevronRight, HiShieldExclamation } from 'vue-icons-plus/hi'
```

- [ ] **Step 7: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: PASS

- [ ] **Step 8: Commit**

```
git add frontend/src/components/CoworkView.vue frontend/src/components/cowork/types.ts frontend/src/locales
git commit -m "feat: add tool approval UI to CoworkView with Allow/Deny buttons"
```

---

### Task 7: Frontend — Fix PermissionView.vue mode persistence

**Files:**
- Modify: `frontend/src/components/PermissionView.vue`
- Modify: `frontend/src/api/agent.ts`

- [ ] **Step 1: Add permissions API functions**

Read `frontend/src/api/agent.ts`. Add:

```typescript
export interface PermissionsConfig {
  defaultPolicy: 'allow' | 'deny'
  allowedTools: string[]
  deniedTools: string[]
  permissionMode: string
  requireApprovalTools: string[]
}

export function getPermissions() {
  return request<PermissionsConfig>('/agent/permissions')
}

export function updatePermissions(body: Partial<PermissionsConfig>) {
  return request<PermissionsConfig>('/agent/permissions', { method: 'PATCH', body })
}
```

- [ ] **Step 2: Rewrite PermissionView.vue script**

Edit `frontend/src/components/PermissionView.vue`:

Replace the `onMounted` and state:

```typescript
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiShieldCheck } from 'vue-icons-plus/hi'
import { getPermissions, updatePermissions } from '../api/agent'

const { t } = useI18n()

const PERMISSION_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'dontAsk', 'auto', 'plan']

const permissionMode = ref('default')
const requireApprovalTools = ref<string[]>([])

onMounted(async () => {
  try {
    const config = await getPermissions()
    permissionMode.value = config.permissionMode ?? 'default'
    requireApprovalTools.value = config.requireApprovalTools ?? []
  } catch { /* ignore */ }
})

watch(permissionMode, async (val) => {
  try {
    await updatePermissions({ permissionMode: val })
  } catch { /* ignore */ }
})
```

- [ ] **Step 3: Add requireApprovalTools UI**

In the template, add a section after the mode selector:

```html
<div class="mt-4">
  <div class="text-cyber-muted text-sm font-mono mb-2">{{ t('permissions.requireApproval.header') }}</div>
  <div class="text-xs text-cyber-muted font-mono mb-2">{{ t('permissions.requireApproval.hint') }}</div>
  <div class="space-y-1">
    <div v-for="tool in ALL_TOOLS" :key="tool" class="flex items-center gap-2 py-1">
      <input type="checkbox" :checked="requireApprovalTools.includes(tool)"
        @change="toggleApprovalTool(tool)" class="accent-cyber-accent" />
      <span class="text-cyber-text text-xs font-mono">{{ tool }}</span>
    </div>
  </div>
</div>
```

Add the ALL_TOOLS list:
```typescript
const ALL_TOOLS = [
  'run_command', 'write_file', 'delete_task', 'delete_note',
  'delete_tasks', 'delete_knowledge', 'grep', 'glob',
]
```

Add the toggle function:
```typescript
async function toggleApprovalTool(tool: string) {
  const idx = requireApprovalTools.value.indexOf(tool)
  if (idx >= 0) requireApprovalTools.value.splice(idx, 1)
  else requireApprovalTools.value.push(tool)
  try {
    await updatePermissions({ requireApprovalTools: [...requireApprovalTools.value] })
  } catch { /* ignore */ }
}
```

- [ ] **Step 4: Add i18n keys**

Add to `frontend/src/locales/vi.json`:
```json
"permissions": {
  "requireApproval": {
    "header": "Tool cần phê duyệt",
    "hint": "Các tool này sẽ yêu cầu bạn xác nhận trước khi thực thi"
  }
}
```

Add to `frontend/src/locales/en.json`:
```json
"permissions": {
  "requireApproval": {
    "header": "Tools Requiring Approval",
    "hint": "These tools will ask for your confirmation before executing"
  }
}
```

- [ ] **Step 5: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```
git add frontend/src/components/PermissionView.vue frontend/src/api/agent.ts frontend/src/locales
git commit -m "feat: fix permission mode persistence, add requireApprovalTools UI"
```

---

### Task 8: Backend tests

**Files:**
- Modify: `backend/src/agent/services/permissions.service.spec.ts`
- Create: `backend/src/agent/services/approval-manager.service.spec.ts`
- Modify: `backend/src/agent/agent.controller.spec.ts`

- [ ] **Step 1: Update permissions.service.spec.ts**

Read the current file. Add test cases for:
- `requireApprovalTools` config is loaded and applied
- `hasDestructivePatterns` catches delete/remove patterns
- `decide()` returns `ask` for tools in `requireApprovalTools`
- `decide()` returns `ask` when args contain delete patterns

- [ ] **Step 2: Create approval-manager.service.spec.ts**

Create `backend/src/agent/services/approval-manager.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalManagerService } from './approval-manager.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ApprovalManagerService', () => {
  let service: ApprovalManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalManagerService,
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get<ApprovalManagerService>(ApprovalManagerService);
  });

  it('approves a pending request', async () => {
    const promise = service.requestApproval('id1', 'run_command', { cmd: 'rm -rf' }, 1);
    const handled = service.handleResponse('id1', true);
    expect(handled).toBe(true);
    const result = await promise;
    expect(result).toBe(true);
  });

  it('denies a pending request', async () => {
    const promise = service.requestApproval('id2', 'run_command', { cmd: 'rm -rf' }, 1);
    service.handleResponse('id2', false);
    const result = await promise;
    expect(result).toBe(false);
  });

  it('returns false for unknown id', () => {
    const handled = service.handleResponse('unknown', true);
    expect(handled).toBe(false);
  });

  it('auto-denies after timeout', async () => {
    const promise = service.requestApproval('id3', 'run_command', { cmd: 'rm -rf' }, 1);
    // Wait slightly longer than the 30s timeout... use vi.useFakeTimers instead
  });
});
```

The timeout test needs fake timers. Use:

```typescript
import { vi } from 'vitest';

// In tests that need timeout:
it('auto-denies after timeout', async () => {
  vi.useFakeTimers();
  const promise = service.requestApproval('id3', 'run_command', { cmd: 'rm' }, 1);
  vi.advanceTimersByTime(30_000);
  const result = await promise;
  expect(result).toBe(false);
  vi.useRealTimers();
});
```

Note: depends on whether the project uses `jest` or `vitest`. The backend uses `jest`. For jest:

```typescript
jest.useFakeTimers();
const promise = service.requestApproval('id4', 'run_command', { cmd: 'rm' }, 1);
jest.advanceTimersByTime(30_000);
const result = await promise;
expect(result).toBe(false);
jest.useRealTimers();
```

- [ ] **Step 3: Update agent.controller.spec.ts**

Add a test for the new `POST /api/agent/approve-tool` endpoint.

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```
git add backend/src/agent/services/permissions.service.spec.ts backend/src/agent/services/approval-manager.service.spec.ts backend/src/agent/agent.controller.spec.ts
git commit -m "test: add tests for approval flow, permission config, approval manager"
```

---

## Verification

After all tasks:

```bash
cd frontend && npm run type-check && npm run build && npm test
cd backend && npx tsc --noEmit && npx jest
```

Expected: all PASS.
