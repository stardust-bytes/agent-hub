# Resume Plan SSE Fix & Auto-Continue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `/resume-plan` SSE streaming bug in ChatPanel and add auto-continue detection so "tiếp tục" triggers plan resume or approval.

**Architecture:** Fix `resumePlan()` in ChatPanel.vue to properly read SSE stream (extract shared reader from `handleApprove`). Add backend `GET /api/plans/session/:id/next` endpoint to find latest actionable plan. Add `resume_plan` tool for agent discovery. Add frontend auto-continue detection in `submit()`.

**Tech Stack:** NestJS, Prisma, Vue 3, TailwindCSS, SSE streaming via Fetch ReadableStream

---

## File Structure

### Backend — Modify:
- `backend/src/plans/plans.service.ts` — add `findNextActionable(sessionId)`
- `backend/src/plans/plans.controller.ts` — add `GET session/:sessionId/next`
- `backend/src/tools/tools.module.ts` — register `ResumePlanExecutor`
- `backend/src/agent/agent.module.ts` — register `ResumePlanExecutor`
- `backend/src/agent/services/agent-loop.service.ts` — register executor in map

### Backend — Create:
- `backend/src/tools/executors/resume-plan.executor.ts` — tool to validate & describe plan

### Frontend — Modify:
- `frontend/src/components/ChatPanel.vue` — fix `resumePlan()` SSE reader, add auto-continue in `submit()`

---

### Task 1: Add findNextActionable to PlansService

**Files:**
- Modify: `backend/src/plans/plans.service.ts`

- [ ] **Step 1: Write the test**

```ts
// in backend/src/plans/plans.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PlansService } from './plans.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlansService.findNextActionable', () => {
  let service: PlansService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlansService, PrismaService],
    }).compile();
    service = module.get<PlansService>(PlansService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('returns found=false when no plans exist', async () => {
    jest.spyOn(prisma.plan, 'findFirst').mockResolvedValue(null);
    const result = await service.findNextActionable(1);
    expect(result).toEqual({ found: false });
  });

  it('returns action=approve for PENDING plan', async () => {
    const plan = { id: 1, sessionId: 1, title: 'Test', status: 'PENDING', steps: [{ id: 1, planId: 1, order: 0, text: 'step 1', status: 'TODO' }] };
    jest.spyOn(prisma.plan, 'findFirst').mockResolvedValue(plan as any);
    const result = await service.findNextActionable(1);
    expect(result).toEqual({ found: true, plan, action: 'approve' });
  });

  it('returns action=resume for EXECUTING plan with incomplete steps', async () => {
    const plan = { id: 1, sessionId: 1, title: 'Test', status: 'EXECUTING', steps: [{ id: 1, planId: 1, order: 0, text: 'step 1', status: 'DOING' }] };
    jest.spyOn(prisma.plan, 'findFirst').mockResolvedValue(plan as any);
    const result = await service.findNextActionable(1);
    expect(result).toEqual({ found: true, plan, action: 'resume' });
  });

  it('returns found=false when plan is DONE', async () => {
    const plan = { id: 1, sessionId: 1, title: 'Test', status: 'DONE', steps: [{ id: 1, planId: 1, order: 0, text: 'step 1', status: 'DONE' }] };
    jest.spyOn(prisma.plan, 'findFirst').mockResolvedValue(plan as any);
    const result = await service.findNextActionable(1);
    expect(result).toEqual({ found: false });
  });

  it('returns action=resume for INTERRUPTED plan', async () => {
    const plan = { id: 1, sessionId: 1, title: 'Test', status: 'INTERRUPTED', steps: [{ id: 1, planId: 1, order: 0, text: 'step 1', status: 'DOING' }] };
    jest.spyOn(prisma.plan, 'findFirst').mockResolvedValue(plan as any);
    const result = await service.findNextActionable(1);
    expect(result).toEqual({ found: true, plan, action: 'resume' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/plans/plans.service.spec.ts --testNamePattern="findNextActionable" -v`
Expected: 5 failures, "function not found"

- [ ] **Step 3: Add findNextActionable method**

In `backend/src/plans/plans.service.ts`, add:

```ts
async findNextActionable(sessionId: number) {
  const plan = await this.prisma.plan.findFirst({
    where: { sessionId },
    include: { steps: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  if (!plan) return { found: false as const };
  if (plan.status === 'DONE') return { found: false as const };
  if (plan.status === 'PENDING') return { found: true as const, plan, action: 'approve' as const };
  const incompleteSteps = plan.steps.filter(s => s.status !== 'DONE');
  if (incompleteSteps.length === 0) return { found: false as const };
  return { found: true as const, plan, action: 'resume' as const };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/plans/plans.service.spec.ts --testNamePattern="findNextActionable" -v`
Expected: 5 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/plans/plans.service.ts backend/src/plans/plans.service.spec.ts
git commit -m "feat: add findNextActionable to PlansService"
```

---

### Task 2: Add GET /api/plans/session/:id/next endpoint

**Files:**
- Modify: `backend/src/plans/plans.controller.ts`

- [ ] **Step 1: Write test**

In `backend/src/plans/plans.controller.spec.ts`:

```ts
it('GET /plans/session/:id/next returns next actionable plan', async () => {
  const plan = { id: 1, sessionId: 1, title: 'Test', status: 'EXECUTING', steps: [], createdAt: new Date(), updatedAt: new Date() };
  jest.spyOn(service, 'findNextActionable').mockResolvedValue({ found: true, plan, action: 'resume' });
  const res = await controller.getNextActionable(1);
  expect(res).toEqual({ found: true, plan, action: 'resume' });
});
```

- [ ] **Step 2: Run test**

Run: `npx jest src/plans/plans.controller.spec.ts --testNamePattern="next" -v`
Expected: FAIL

- [ ] **Step 3: Add controller method**

In `backend/src/plans/plans.controller.ts`:

```ts
@Get('session/:sessionId/next')
getNextActionable(@Param('sessionId', ParseIntPipe) sessionId: number) {
  return this.plansService.findNextActionable(sessionId);
}
```

- [ ] **Step 4: Run test**

Run: `npx jest src/plans/plans.controller.spec.ts --testNamePattern="next" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/plans/plans.controller.ts backend/src/plans/plans.controller.spec.ts
git commit -m "feat: add GET /api/plans/session/:id/next endpoint"
```

---

### Task 3: Create ResumePlanExecutor tool

**Files:**
- Create: `backend/src/tools/executors/resume-plan.executor.ts`
- Modify: `backend/src/tools/tools.module.ts`
- Modify: `backend/src/agent/agent.module.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Create executor**

Create `backend/src/tools/executors/resume-plan.executor.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { PlansService } from '../../plans/plans.service';

@Injectable()
export class ResumePlanExecutor implements ToolExecutor {
  readonly name = 'resume_plan';

  constructor(private readonly plansService: PlansService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const planId = Number(args.planId);
    if (!planId || isNaN(planId)) return 'Error: planId is required (number)';

    try {
      const plan = await this.plansService.findOne(planId);
      const doneSteps = plan.steps.filter(s => s.status === 'DONE').length;
      const totalSteps = plan.steps.length;
      const pendingSteps = totalSteps - doneSteps;

      const lines: string[] = [
        `Plan #${plan.id}: "${plan.title}"`,
        `Status: ${plan.status}`,
        `Steps: ${doneSteps}/${totalSteps} completed`,
      ];

      if (plan.status === 'PENDING') {
        lines.push('Action required: User must approve this plan before execution.');
      } else if (pendingSteps > 0) {
        lines.push(`${pendingSteps} step(s) remaining. Ready to resume.`);
      } else {
        lines.push('All steps completed.');
      }

      return lines.join('\n');
    } catch {
      return `Error: Plan #${planId} not found.`;
    }
  }
}
```

- [ ] **Step 2: Register in ToolsModule**

In `backend/src/tools/tools.module.ts`, add import and add to EXECUTORS array:

```ts
import { ResumePlanExecutor } from './executors/resume-plan.executor';
```

Add `ResumePlanExecutor` to `EXECUTORS` array.

- [ ] **Step 3: Register in AgentModule**

In `backend/src/agent/agent.module.ts`, add import and add to `providers` array:

```ts
import { ResumePlanExecutor } from '../tools/executors/resume-plan.executor';
```

Add `ResumePlanExecutor` to `providers` array.

- [ ] **Step 4: Register in AgentLoopService executorMap**

In `backend/src/agent/services/agent-loop.service.ts`:

Add to constructor:

```ts
private readonly resumePlan: ResumePlanExecutor,
```

Add to `executorMap`:

```ts
[resumePlan.name, resumePlan],
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/executors/resume-plan.executor.ts backend/src/tools/tools.module.ts backend/src/agent/agent.module.ts backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: add resume_plan tool executor"
```

---

### Task 4: Fix resumePlan SSE streaming in ChatPanel

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Extract shared SSE reader function**

In `ChatPanel.vue` `<script setup>`, add a shared interface and function before the existing functions:

```ts
interface PlanExecCallbacks {
  onStepUpdate: (planId: number, stepId: number, status: string) => void
  onToken: (token: string) => void
  onToolCall: (name: string, args: Record<string, unknown>) => void
  onToolResult: (name: string, result: string) => void
  onDone: () => void
  onError: (error: string) => void
}

async function readPlanExecuteStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: PlanExecCallbacks,
): Promise<void> {
  const decoder = new TextDecoder()
  let buf = ''
  let done = false

  while (!done) {
    const { done: streamDone, value } = await reader.read()
    if (streamDone) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)
      if (payload === '[DONE]') { callbacks.onDone(); done = true; break }
      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>
        if (parsed.planStepUpdate) {
          const upd = parsed.planStepUpdate as { planId: number; stepId: number; status: string }
          callbacks.onStepUpdate(upd.planId, upd.stepId, upd.status)
        } else if (parsed.token) {
          callbacks.onToken(String(parsed.token))
        } else if (parsed.toolCall) {
          const tc = parsed.toolCall as { name: string; args: Record<string, unknown> }
          callbacks.onToolCall(tc.name, tc.args)
        } else if (parsed.toolResult) {
          const tr = parsed.toolResult as { name: string; result: string }
          callbacks.onToolResult(tr.name, tr.result)
        } else if (parsed.error) {
          callbacks.onError(String(parsed.error))
        }
      } catch { /* skip malformed */ }
    }
  }
}
```

- [ ] **Step 2: Refactor handleApprove to use shared reader**

Replace the SSE reading loop in `handleApprove` (from `const reader = execRes.body.getReader()` to end of while loop) with:

```ts
if (!execRes.body) throw new Error('No body')

const reader = execRes.body.getReader()

await readPlanExecuteStream(reader, {
  onStepUpdate: (planId, stepId, status) => {
    const msg = messages.value.find(m => m.role === 'plan' && m.plan?.id === planId)
    if (msg?.plan) {
      const step = msg.plan.steps.find(s => s.id === stepId)
      if (step) step.status = status
    }
    scrollToBottom()
  },
  onToken: (token) => {
    if (currentAgentIdx < 0) {
      currentAgentIdx = messages.value.length
      messages.value.push({ role: 'agent', content: '', timestamp: now(), typing: true })
    }
    messages.value[currentAgentIdx].content += token
    scrollToBottom()
  },
  onToolCall: (name, args) => {
    currentAgentIdx = -1
    const argsStr = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(', ')
    messages.value.push({ role: 'tool', content: `${name}(${argsStr})`, timestamp: now(), toolName: name, isResult: false })
    scrollToBottom()
  },
  onToolResult: (name, result) => {
    currentAgentIdx = -1
    messages.value.push({ role: 'tool', content: result, timestamp: now(), toolName: name, isResult: true })
    scrollToBottom()
  },
  onDone: () => {
    const msg2 = messages.value.find(m => m.role === 'plan' && m.plan?.id === planId)
    if (msg2?.plan && msg2.plan.status === 'EXECUTING') msg2.plan.status = 'DONE'
    if (currentAgentIdx >= 0) messages.value[currentAgentIdx].typing = false
    scrollToBottom()
  },
  onError: (error) => {
    messages.value.push({ role: 'system', content: `${t('chat.error.unreachable')} (${error})`, timestamp: now() })
    scrollToBottom()
  },
})
```

Remove the old SSE reading loop code from `handleApprove` (the old while loop and buffer logic).

- [ ] **Step 3: Fix resumePlan to use shared reader**

Replace the `resumePlan` function body:

```ts
async function resumePlan(planId: number) {
  showResumeModal.value = false
  const sid = currentSessionId.value
  const mid = selectedModelId.value
  if (!sid || mid === null) return

  messages.value.push({ role: 'system', content: `Resuming plan...`, timestamp: now() })
  await scrollToBottom()

  streaming.value = true
  let currentAgentIdx = -1

  try {
    const execRes = await fetch(`/api/agent/plans/${planId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerModelId: mid, sessionId: sid }),
    })
    if (!execRes.ok || !execRes.body) throw new Error(`HTTP ${execRes.status}`)

    const reader = execRes.body.getReader()
    await readPlanExecuteStream(reader, {
      onStepUpdate: (pid, stepId, status) => {
        const msg = messages.value.find(m => m.role === 'plan' && m.plan?.id === pid)
        if (msg?.plan) {
          const step = msg.plan.steps.find(s => s.id === stepId)
          if (step) step.status = status
        }
        scrollToBottom()
      },
      onToken: (token) => {
        if (currentAgentIdx < 0) {
          currentAgentIdx = messages.value.length
          messages.value.push({ role: 'agent', content: '', timestamp: now(), typing: true })
        }
        messages.value[currentAgentIdx].content += token
        scrollToBottom()
      },
      onToolCall: (name, args) => {
        currentAgentIdx = -1
        const argsStr = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(', ')
        messages.value.push({ role: 'tool', content: `${name}(${argsStr})`, timestamp: now(), toolName: name, isResult: false })
        scrollToBottom()
      },
      onToolResult: (name, result) => {
        currentAgentIdx = -1
        messages.value.push({ role: 'tool', content: result, timestamp: now(), toolName: name, isResult: true })
        scrollToBottom()
      },
      onDone: () => {
        const msg2 = messages.value.find(m => m.role === 'plan' && m.plan?.id === planId)
        if (msg2?.plan && msg2.plan.status === 'EXECUTING') msg2.plan.status = 'DONE'
        if (currentAgentIdx >= 0) messages.value[currentAgentIdx].typing = false
        scrollToBottom()
      },
      onError: (error) => {
        messages.value.push({ role: 'system', content: `${t('chat.error.unreachable')} (${error})`, timestamp: now() })
        scrollToBottom()
      },
    })
  } catch (e) {
    if (currentAgentIdx >= 0) messages.value[currentAgentIdx].typing = false
    if (e instanceof Error && e.name !== 'AbortError') {
      messages.value.push({ role: 'system', content: t('chat.error.unreachable'), timestamp: now() })
    }
  } finally {
    streaming.value = false
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "fix: resumePlan now reads SSE stream, extract shared reader from handleApprove"
```

---

### Task 5: Add auto-continue detection in ChatPanel submit()

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`

- [ ] **Step 1: Add continue detection before agent request**

In `submit()`, right after the session-creation block and before `input.value = ''`, add:

```ts
const continuePattern = /^(tiếp\s*tục|tiếp|continue|resume)\b/i
if (currentSessionId.value !== null && continuePattern.test(text.trim())) {
  input.value = ''
  try {
    const nextRes = await fetch(`/api/plans/session/${currentSessionId.value}/next`)
    if (nextRes.ok) {
      const nextData = await nextRes.json() as { found: boolean; plan?: PlanData; action?: string }
      if (nextData.found && nextData.plan && nextData.action === 'resume') {
        await resumePlan(nextData.plan.id)
        return
      }
      if (nextData.found && nextData.plan && nextData.action === 'approve') {
        messages.value.push({
          role: 'plan',
          content: '',
          timestamp: now(),
          plan: { ...nextData.plan, steps: nextData.plan.steps.map(s => ({ ...s })) },
        })
        await scrollToBottom()
        return
      }
    }
  } catch { /* fall through to normal chat */ }
}
```

Place this code after the session creation block and before `input.value = ''` + the streaming logic. This intercepts "tiếp tục" before it reaches the agent.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: auto-detect 'tiếp tục' and resume or show plan approval"
```

---

### Task 6: Update AGENTS.md files

**Files:**
- Modify: `backend/src/plans/AGENTS.md`
- Modify: `backend/src/tools/AGENTS.md`
- Modify: `backend/src/agent/AGENTS.md`

- [ ] **Step 1: Update plans/AGENTS.md**

Add to API endpoints table:
```
| `GET` | `/api/plans/session/:sessionId/next` | Find next actionable plan for session |
```

Add to Plan Status Flow:
```
PENDING → (via auto-continue or resume_plan tool check)
```

- [ ] **Step 2: Update tools/AGENTS.md**

Add to Available Executors table:
```
| `ResumePlanExecutor` | `resume_plan` | Validate and describe plan status for resumption |
```

- [ ] **Step 3: Update agent/AGENTS.md**

Add to tools available section:
- `resume_plan` — validate and describe plan status

- [ ] **Step 4: Commit**

```bash
git add backend/src/plans/AGENTS.md backend/src/tools/AGENTS.md backend/src/agent/AGENTS.md
git commit -m "docs: update AGENTS.md with resume_plan tool and next endpoint"
```
