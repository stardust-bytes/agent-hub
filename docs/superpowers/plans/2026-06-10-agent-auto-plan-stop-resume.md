# Agent Auto-Plan with Stop/Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable LLM to autonomously create and execute plans (via `create_plan` tool) with user-configurable approval; add stop/resume lifecycle with state preservation.

**Architecture:** New `CreatePlanExecutor` tool lets the LLM create plans. Agent loop detects the tool's return marker and either emits a plan SSE event (waiting for user approval) or auto-executes immediately. A `planInterrupted` SSE event signals the frontend on abort. `runForStep()` receives the parent abort signal so the stop button works during step execution too.

**Tech Stack:** NestJS (backend), Vue 3 + TailwindCSS (frontend), Prisma/SQLite, SSE streaming.

---

### Task 1: CreatePlanExecutor tool + spec + registration

**Files:**
- Create: `backend/src/tools/executors/create-plan.executor.ts`
- Create: `backend/src/tools/executors/create-plan.executor.spec.ts`
- Modify: `backend/src/tools/tools.module.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/tools/executors/create-plan.executor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePlanExecutor } from './create-plan.executor';
import { PlansService } from '../../plans/plans.service';

describe('CreatePlanExecutor', () => {
  let executor: CreatePlanExecutor;
  let plansService: jest.Mocked<PlansService>;

  const mockPlan = {
    id: 1, sessionId: 1, title: 'Test', status: 'PENDING',
    createdAt: new Date(), updatedAt: new Date(),
    steps: [
      { id: 1, planId: 1, order: 0, text: 'Step 1', status: 'TODO', updatedAt: new Date() },
      { id: 2, planId: 1, order: 1, text: 'Step 2', status: 'TODO', updatedAt: new Date() },
    ],
  };

  beforeEach(async () => {
    plansService = {
      create: jest.fn(),
      approve: jest.fn(),
    } as any;
    executor = new CreatePlanExecutor(plansService);
  });

  it('returns marker string with plan metadata', async () => {
    plansService.create.mockResolvedValue(mockPlan);
    const result = await executor.execute(
      { title: 'Test', steps: ['Step 1', 'Step 2'], requireApproval: true },
      { mode: 'cowork', sessionId: 1 },
    );
    expect(result).toMatch(/^\[PLAN_CREATED\] id=1 requireApproval=true title="Test"/);
    expect(plansService.create).toHaveBeenCalledWith(1, 'Test', ['Step 1', 'Step 2']);
  });

  it('approves plan when requireApproval is false', async () => {
    plansService.create.mockResolvedValue(mockPlan);
    plansService.approve.mockResolvedValue({ ...mockPlan, status: 'APPROVED' });
    await executor.execute(
      { title: 'Test', steps: ['Step 1'], requireApproval: false },
      { mode: 'cowork', sessionId: 1 },
    );
    expect(plansService.approve).toHaveBeenCalledWith(1);
  });

  it('defaults requireApproval to true', async () => {
    plansService.create.mockResolvedValue(mockPlan);
    const result = await executor.execute(
      { title: 'Test', steps: ['Step 1'] },
      { mode: 'cowork', sessionId: 1 },
    );
    expect(result).toMatch(/requireApproval=true/);
    expect(plansService.approve).not.toHaveBeenCalled();
  });

  it('rejects more than 10 steps', async () => {
    const steps = Array.from({ length: 11 }, (_, i) => `Step ${i + 1}`);
    const result = await executor.execute(
      { title: 'Test', steps },
      { mode: 'cowork', sessionId: 1 },
    );
    expect(result).toBe('Error: Maximum 10 steps allowed.');
  });

  it('returns name as create_plan', () => {
    expect(executor.name).toBe('create_plan');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tools/executors/create-plan.executor.spec.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/tools/executors/create-plan.executor.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { PlansService } from '../../plans/plans.service';

@Injectable()
export class CreatePlanExecutor implements ToolExecutor {
  readonly name = 'create_plan';

  constructor(private readonly plansService: PlansService) {}

  async execute(args: Record<string, unknown>, context?: { mode: string; sessionId: number }): Promise<string> {
    const title = String(args.title ?? '');
    const steps = args.steps as string[] | undefined;
    const requireApproval = args.requireApproval !== false;

    if (!title || !steps || !Array.isArray(steps) || steps.length === 0) {
      return 'Error: title (string) and steps (string[]) are required.';
    }
    if (steps.length > 10) {
      return 'Error: Maximum 10 steps allowed.';
    }
    if (!context?.sessionId) {
      return 'Error: sessionId is required.';
    }

    const plan = await this.plansService.create(context.sessionId, title, steps);

    if (!requireApproval) {
      await this.plansService.approve(plan.id);
    }

    return `[PLAN_CREATED] id=${plan.id} requireApproval=${requireApproval} title="${title}"`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/tools/executors/create-plan.executor.spec.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Register executor in tools.module.ts**

In `backend/src/tools/tools.module.ts`:

Add import: `import { CreatePlanExecutor } from './executors/create-plan.executor';`

Add to `EXECUTORS` array:
```typescript
const EXECUTORS = [
  // ... existing ...
  CreatePlanExecutor,
];
```

- [ ] **Step 6: Register executor in agent-loop.service.ts**

In `backend/src/agent/services/agent-loop.service.ts`:

Add import:
```typescript
import { CreatePlanExecutor } from '../../tools/executors/create-plan.executor';
```

Add constructor parameter:
```typescript
constructor(
  // ... existing ...
  private readonly createPlan: CreatePlanExecutor,
)
```

Add to `executorMap`:
```typescript
[createPlan.name, createPlan],
```

- [ ] **Step 7: Run tests to verify registration**

Run: `npx jest src/agent/services/agent-loop.service.spec.ts --no-coverage`
Expected: PASS (no regressions)

- [ ] **Step 8: Commit**

```bash
git add backend/src/tools/executors/create-plan.executor.ts backend/src/tools/executors/create-plan.executor.spec.ts backend/src/tools/tools.module.ts backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: add create_plan tool executor"
```

---

### Task 2: Agent loop [PLAN_CREATED] detection + routing

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`
- Modify: `backend/src/agent/services/agent-loop.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to `agent-loop.service.spec.ts`. After `executeTool` mock returns a marker string, verify:
- When requireApproval=true: plan SSE event is emitted, state transitions to RESPONDING
- When requireApproval=false: executePlan is called

```typescript
describe('run() with create_plan tool result', () => {
  it('emits plan SSE and stops loop when requireApproval is true', async () => {
    const res = mockRes();
    const signal = new AbortController().signal;

    const mockToolResult = '[PLAN_CREATED] id=1 requireApproval=true title="Test"';
    jest.spyOn(service as any, 'executeTool').mockResolvedValue(mockToolResult);

    const llmStream = buildStreamMock(
      [{ type: 'token' as const, token: '' }],
    );
    (llmController.stream as jest.Mock).mockReturnValue(llmStream());

    const result = await service.run(
      'ollama', 'llama3', 'system prompt', [], 'do something',
      [], res, signal, 1, 'cowork',
    );

    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"plan"'),
    );
    expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/agent/services/agent-loop.service.spec.ts --no-coverage`
Expected: FAIL — plan detection not implemented

- [ ] **Step 3: Implement [PLAN_CREATED] detection in run()**

In `backend/src/agent/services/agent-loop.service.ts`, inside the `run()` method, modify the tool execution loop in the `EVALUATING` state. After `executeTool()` returns (line 171), add detection:

```typescript
let result: string;
try {
  result = await this.executeTool(name, args, { mode: mode as 'chat' | 'agent' | 'cowork', sessionId: sessionId ?? 0 });
} catch (e) {
  result = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
}

// --- NEW: detect [PLAN_CREATED] marker ---
if (result.startsWith('[PLAN_CREATED]')) {
  const idMatch = result.match(/id=(\d+)/);
  const approvalMatch = result.match(/requireApproval=(\w+)/);
  const titleMatch = result.match(/title="([^"]+)"/);
  const planId = idMatch ? parseInt(idMatch[1], 10) : 0;
  const requireApproval = approvalMatch?.[1] === 'true';
  const planTitle = titleMatch?.[1] ?? '';

  if (planId > 0) {
    const savedPlan = await this.plansService.findOne(planId);
    res.write(
      `data: ${JSON.stringify({
        plan: {
          id: savedPlan.id,
          title: savedPlan.title,
          status: savedPlan.status,
          steps: savedPlan.steps.map(s => ({ id: s.id, order: s.order, text: s.text, status: s.status })),
        },
      })}\n\n`,
    );

    if (!requireApproval) {
      savePlanExecutionMessage(sessionId, savedPlan);
      await this.executePlan(
        planId, providerType, model, systemPrompt, tools,
        providerConfig, signal, res, sessionId,
      );
      return finalText;
    } else {
      savePlanExecutionMessage(sessionId, savedPlan);
      res.write('data: [DONE]\n\n');
      return finalText;
    }
  }
}
// --- END NEW ---

res.write(`data: ${JSON.stringify({ toolResult: { name, result } })}\n\n`);
```

Then add a helper method:
```typescript
private async savePlanExecutionMessage(sessionId: number | undefined, plan: { id: number; title: string; status: string; steps: Array<{ id: number; order: number; text: string; status: string }> }) {
  if (sessionId) {
    await this.sessionsService.saveMessage(
      sessionId, 'plan',
      JSON.stringify({
        id: plan.id, title: plan.title, status: plan.status,
        steps: plan.steps.map(s => ({ id: s.id, order: s.order, text: s.text, status: s.status })),
      }),
    );
    await this.sessionsService.saveMessage(
      sessionId, 'system',
      `[Plan] ${plan.title} — ${plan.steps.length} steps created`,
    );
  }
}
```

**Note:** This code goes AFTER the tool execution but BEFORE the `res.write()` and `messages.push()` for the tool result. Add `continue` (or early return as shown) to skip normal tool result handling for plan creation.

- [ ] **Step 4: Run tests**

Run: `npx jest src/agent --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts backend/src/agent/services/agent-loop.service.spec.ts
git commit -m "feat: detect create_plan tool result and handle approval routing"
```

---

### Task 3: planInterrupted SSE event + runForStep abort fix

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Emit planInterrupted event in executePlan()**

In `executePlan()`, when `signal.aborted` is detected, emit an interrupt event before setting the plan status:

```typescript
if (signal.aborted) {
  const currentStep = sortedSteps.find(s => s.status === 'DOING');
  if (!signal.aborted) {
    res.write(`data: ${JSON.stringify({ planInterrupted: { planId, stepId: currentStep?.id ?? null, reason: 'user_stopped' } })}\n\n`);
  }
  await this.plansService.setInterrupted(planId);
}
```

- [ ] **Step 2: Fix runForStep() to accept parent abort signal**

Change `executePlan()` call to `runForStep()` to pass the signal:

```typescript
await this.runForStep(model, messages, tools, providerConfig, res, sessionId, signal);
```

Update `runForStep()` signature:

```typescript
private async runForStep(
  model: string,
  messages: OllamaMessage[],
  tools: ToolDefinition[],
  providerConfig: { baseUrl: string; key?: string },
  res: Response,
  sessionId?: number,
  parentSignal?: AbortSignal,
): Promise<void> {
  const signal = parentSignal ?? new AbortController().signal;
  // ... rest of method unchanged, uses `signal` instead of the old local signal
```

Remove the old `const signal = new AbortController().signal;` line that was at the start of `runForStep()`.

- [ ] **Step 3: Run tests**

Run: `npx jest src/agent --no-coverage`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: emit planInterrupted SSE event on abort, pass parent signal to runForStep"
```

---

### Task 4: System prompt update for create_plan

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`
- Modify: `backend/src/agent/services/context-builder.service.spec.ts` (if exists)

- [ ] **Step 1: Add create_plan usage guidelines**

In `backend/src/agent/services/context-builder.service.ts`, in `buildSystemPrompt()`, add after the tool description section (after line 81):

```typescript
lines.push('',
  '',
  'When to use create_plan:',
  '- Call create_plan for complex multi-step tasks that need sequential coordination.',
  '- Set requireApproval=true for risky operations (destructive file ops, architecture changes, operations needing user decisions).',
  '- Set requireApproval=false for safe multi-step work (refactoring, building components, data processing).',
  '- Do NOT use create_plan for single-step tasks — use the appropriate tool directly.',
);
```

Insert before line 83 `'When handling knowledge base searches...'`.

- [ ] **Step 2: Run tests**

Run: `npx jest src/agent --no-coverage`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts
git commit -m "feat: add create_plan usage guidelines to system prompt"
```

---

### Task 5: Frontend — PlanBubble INTERRUPTED status + Tiếp tục button

**Files:**
- Modify: `frontend/src/components/PlanBubble.vue`

- [ ] **Step 1: Add INTERRUPTED display and Tiếp tục button**

In `frontend/src/components/PlanBubble.vue`, the status bar section (lines 31-33):

```vue
<div v-if="plan.status !== 'PENDING'" class="px-3 py-2 border-t border-cyber-accent/20">
  <div class="flex items-center justify-between">
    <span :class="statusClass(plan.status)" class="text-xs">
      {{ plan.status === 'INTERRUPTED' ? '⏸ ' + t('plans.status.interrupted') : t('plans.status.' + plan.status.toLowerCase()) }}
    </span>
    <button
      v-if="plan.status === 'INTERRUPTED' || plan.status === 'DONE'"
      @click="emit('resume', plan.id)"
      class="text-cyber-cyan text-xs font-bold px-2 py-0.5 border border-cyber-cyan/40 transition-colors duration-150 hover:bg-cyber-cyan/20"
    >&#9654; {{ t('plans.resume') }}</button>
  </div>
</div>
```

- [ ] **Step 2: Add resume emit to script**

Add to the emit definition:
```typescript
const emit = defineEmits<{
  approve: [planId: number]
  reject: [planId: number]
  resume: [planId: number]
}>()
```

Add `INTERRUPTED` to `statusClass`:
```typescript
function statusClass(status: string): string {
  if (status === 'EXECUTING') return 'text-cyber-orange'
  if (status === 'DONE') return 'text-cyber-green'
  if (status === 'FAILED') return 'text-red-400'
  if (status === 'INTERRUPTED') return 'text-cyber-cyan'
  return 'text-cyber-muted'
}
```

- [ ] **Step 3: Add i18n keys**

In `frontend/src/locales/vi.json`:
```json
{
  "plans": {
    "status": {
      "interrupted": "Đã dừng"
    },
    "resume": "Tiếp tục"
  }
}
```

In `frontend/src/locales/en.json`:
```json
{
  "plans": {
    "status": {
      "interrupted": "Interrupted"
    },
    "resume": "Resume"
  }
}
```

- [ ] **Step 4: Add resume handler in ChatPanel.vue**

In `ChatPanel.vue` template, add `@resume` event listener to `<PlanBubble>`:

```vue
<PlanBubble
  :plan="msg.plan"
  :streaming="streaming"
  @approve="handleApprove"
  @reject="handleReject"
  @resume="handleResumeFromBubble"
/>
```

Add handler function:
```typescript
async function handleResumeFromBubble(planId: number) {
  input.value = `/plan resume ${planId}`
  await submit()
}
```

- [ ] **Step 5: Run type check**

Run: `npm run type-check` (in `frontend/` directory)
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PlanBubble.vue frontend/src/components/ChatPanel.vue frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add INTERRUPTED status display and resume button to PlanBubble"
```

---

### Task 6: Frontend — planStepUpdate and planInterrupted SSE handlers

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Add planStepUpdate handler to submit() SSE reader**

In `frontend/src/components/ChatPanel.vue`, in the `submit()` function's SSE reader (around line 780), add handler for `planStepUpdate`:

```typescript
} else if (parsed.planStepUpdate) {
  const upd = parsed.planStepUpdate as { planId: number; stepId: number; status: string }
  // Find the plan message and update step status
  for (const msg of messages.value) {
    if (msg.role === 'plan' && msg.plan && msg.plan.id === upd.planId) {
      const step = msg.plan.steps.find(s => s.id === upd.stepId)
      if (step) {
        step.status = upd.status
        // Force reactivity by replacing the object
        msg.plan = { ...msg.plan, steps: [...msg.plan.steps] }
      }
      break
    }
  }
```

- [ ] **Step 2: Add planInterrupted handler**

Add after the planStepUpdate handler:

```typescript
} else if (parsed.planInterrupted) {
  const interrupt = parsed.planInterrupted as { planId: number; reason: string }
  messages.value.push({
    role: 'system',
    content: '[⏹ Plan execution interrupted. Send "tiếp tục" to resume.]',
    timestamp: now(),
  })
```

- [ ] **Step 3: Run type check**

Run: `npm run type-check` (in `frontend/`)
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: handle planStepUpdate and planInterrupted SSE events in ChatPanel"
```

---

### Task 7: Update AGENTS.md files

**Files:**
- Modify: `backend/src/tools/AGENTS.md`
- Modify: `backend/src/agent/AGENTS.md`
- Modify: `frontend/src/components/AGENTS.md`

- [ ] **Step 1: Update tools/AGENTS.md**

Add `CreatePlanExecutor` to the Available Executors table:
```
| `CreatePlanExecutor` | `create_plan` | Create a multi-step plan with optional approval gate |
```

- [ ] **Step 2: Update agent/AGENTS.md**

Add `create_plan` to the tools list and document the `[PLAN_CREATED]` detection behavior. Add SSE event `planInterrupted` to the SSE Events table.

- [ ] **Step 3: Update frontend/components/AGENTS.md**

Add `planStepUpdate` and `planInterrupted` to the SSE event handling table in ChatPanel.vue description.

- [ ] **Step 4: Commit**

```bash
git add backend/src/tools/AGENTS.md backend/src/agent/AGENTS.md frontend/src/components/AGENTS.md
git commit -m "docs: update AGENTS.md for create_plan tool and planInterrupted event"
```

---

### Task 8: Integration test — full flow verification

- [ ] **Step 1: Verify create_plan tool works end-to-end**

Run: `npx jest src/tools/executors/create-plan.executor.spec.ts --no-coverage`
Expected: PASS

- [ ] **Step 2: Verify agent loop integration**

Run: `npx jest src/agent --no-coverage`
Expected: PASS

- [ ] **Step 3: Run full backend test suite**

Run: `npx jest --no-coverage`
Expected: PASS (all suites)
