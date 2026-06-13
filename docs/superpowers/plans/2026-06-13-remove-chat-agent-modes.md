# Remove Chat & Agent Modes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove ChatPanel.vue, /chat route, and chat/agent mode entries from all configs. Add projectPath to ToolContext so file-saving executors write directly to the project folder when connected.

**Architecture:** Phase 1 strips mode from backend configs and DTOs. Phase 2 threads projectPath through the agent loop into ToolContext, then rewrites 6 executors to use `projectPath` instead of `mode === 'agent'`. Phase 3 cleans up sessions. Phase 4 removes the frontend ChatPanel, renames `chat/` → `cowork/`, and strips mode toggles from ChatInputBar and SessionModal. Phase 5 updates tests.

**Tech Stack:** Vue 3 (`<script setup>`), TypeScript strict, NestJS, Prisma, Vitest, Jest.

---

## Task 1: Backend — ToolContext, ChatDto, mode-policy, permissions

**Files:**
- Modify: `backend/src/tools/executors/tool-executor.interface.ts`
- Modify: `backend/src/agent/dto/chat.dto.ts`
- Modify: `backend/src/mode-policy/mode-policy.config.ts`
- Modify: `backend/src/mode-policy/mode-policy.service.ts`
- Modify: `backend/src/agent/services/permissions.service.ts`

- [ ] **Step 1: Update ToolContext interface**

Edit `backend/src/tools/executors/tool-executor.interface.ts`:
```ts
export interface ToolContext {
  sessionId: number;
  projectPath?: string;
}
```

- [ ] **Step 2: Update ChatDto validation**

Edit `backend/src/agent/dto/chat.dto.ts`. Change the `@IsIn` decorator on the `mode` field from `['agent', 'chat', 'cowork']` to `['cowork']`. Keep the field optional.

- [ ] **Step 3: Remove chat/agent entries from mode-policy config**

Edit `backend/src/mode-policy/mode-policy.config.ts`. Remove the `chat` entry (lines 25-32) and `agent` entry (lines 33-58). Keep only the `cowork` entry. The file still exports `MODE_POLICY` as a `Record<string, ModePolicy>`.

- [ ] **Step 4: Update mode-policy service fallback**

Edit `backend/src/mode-policy/mode-policy.service.ts`. Change all fallbacks from `MODE_POLICY.agent` to `MODE_POLICY.cowork`:
- `getEnabledTools` line 20: `MODE_POLICY[mode] ?? MODE_POLICY.cowork`
- `isToolAllowed` line 35: same
- `resolveAllowedPaths` line 43: same
- `getSystemPromptStyle` line 51: same
- `getPermissionMode` line 59: same

- [ ] **Step 5: Simplify permissions service**

Edit `backend/src/agent/services/permissions.service.ts`. In the `decide` method, remove any mode-specific dispatch logic. The `getPermissionMode` method already falls back to `MODE_POLICY.cowork` (which uses `permissionMode: 'acceptEdits'`), so no structural changes needed — just ensure no hardcoded 'chat'/'agent' references remain.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit` (or `cd backend && npx tsc --noEmit`)
Expected: PASS (0 errors).

- [ ] **Step 7: Commit**

```bash
git add backend/src/tools/executors/tool-executor.interface.ts backend/src/agent/dto/chat.dto.ts backend/src/mode-policy backend/src/agent/services/permissions.service.ts
git commit -m "refactor: remove chat/agent mode from ToolContext, ChatDto, mode-policy, permissions"
```

---

## Task 2: Backend — context-builder mode branches

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`

- [ ] **Step 1: Remove chat/agent branches from buildSystemPrompt**

Edit `backend/src/agent/services/context-builder.service.ts`:

1. Remove the `if (mode === 'chat')` early-return block (returns simple "helpful AI assistant" prompt). After removal, the method continues to the full tool+plan prompt.
2. Remove the `if (mode === 'agent')` block that injects agent output path instructions. Cowork mode handles output via projectPath.
3. Remove the `else` block at line 122 (the non-cowork plan guidance) since cowork is now the only mode — cowork's plan guidance (auto-execute, delegates) is the default.
4. Keep the `if (mode === 'cowork' && projectPath)` block at line 183 — simplify to `if (projectPath)` since mode is always cowork.
5. Keep the `if (mode === 'cowork')` MCP tools block at line 247 — remove the mode check so MCP tools are always loaded.
6. Remove `mode` parameter from `build()` and `buildSystemPrompt()` signatures.
7. Remove the mode parameter from the `build()` call in agent.service.ts (next task will clean the call site).

The resulting `build()` method:
```typescript
async build(runState: AgentRunState, sessionId: number): Promise<{ messages: MessageIn[]; systemPrompt: string }> {
  const dbTools = await this.toolsService.findAll();
  const tools = await this.getEnabledTools(dbTools);
  const project = await this.cowork.getProject().catch(() => null);
  const memoryContext = await this.memoryService.getContextMemories();
  const systemPrompt = systemPromptOverride || this.buildSystemPrompt(tools, project, memoryContext);
  // ... rest unchanged
}
```

- [ ] **Step 2: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS (context-builder no longer references `'chat'` or `'agent'` modes).

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts
git commit -m "refactor: remove chat/agent mode branches from context-builder"
```

---

## Task 3: Backend — agent controller, service, loop

**Files:**
- Modify: `backend/src/agent/agent.controller.ts`
- Modify: `backend/src/agent/agent.service.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Update agent controller**

Edit `backend/src/agent/agent.controller.ts`. Change `dto.mode ?? 'agent'` to `'cowork'`:
```typescript
await this.agentService.streamChat(dto.message, dto.providerModelId, res, ctrl.signal, dto.sessionId, 'cowork');
```
Or, even simpler: remove the mode parameter from `streamChat` entirely and hardcode `'cowork'` inside the service.

- [ ] **Step 2: Update agent service**

Edit `backend/src/agent/agent.service.ts`:

1. Remove `mode: string = 'agent'` parameter from `streamChat()`
2. Hardcode `mode = 'cowork'` inside `streamChat()` for all internal calls
3. Remove `if (mode === 'cowork' && message.startsWith('/plan '))` → simplify to `if (message.startsWith('/plan '))`
4. Read projectPath from CoworkService: `const project = await this.coworkService.getProject().catch(() => null); const projectPath = project?.projectPath ?? undefined;`
5. Pass `projectPath` to `agentLoopService.run()`

- [ ] **Step 3: Update agent loop service**

Edit `backend/src/agent/services/agent-loop.service.ts`:

1. Add `projectPath?: string` parameter to `run()` signature
2. Remove all `mode as 'chat' | 'agent' | 'cowork'` casts — replace with `context?.projectPath` or hardcoded `'cowork'` where needed
3. When calling `executeTool()`, pass `{ sessionId, projectPath }` instead of `{ mode: ..., sessionId }`
4. Update delegate calls similarly — pass `projectPath` instead of `mode`

- [ ] **Step 4: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/agent.controller.ts backend/src/agent/agent.service.ts backend/src/agent/services/agent-loop.service.ts
git commit -m "refactor: remove mode param from agent flow, thread projectPath through agent loop"
```

---

## Task 4: Backend — 6 tool executors with projectPath

**Files:**
- Modify: `backend/src/tools/executors/write-file.executor.ts`
- Modify: `backend/src/word/executors/write-word.executor.ts`
- Modify: `backend/src/word/executors/edit-word.executor.ts`
- Modify: `backend/src/excel/executors/write-excel.executor.ts`
- Modify: `backend/src/excel/executors/excel-chart.executor.ts`
- Modify: `backend/src/excel/executors/excel-add-sheet.executor.ts`

- [ ] **Step 1: Rewrite write-file.executor.ts**

Replace the `if (context?.mode === 'agent')` / `else` branching with `if (context?.projectPath)` / `else`:

```typescript
async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
  const content = args.content as string | undefined;
  if (content === undefined) return 'Error: path and content are required.';

  let filePath: string;
  const rawPath = (args.path as string) || 'output.txt';
  const filename = rawPath.split(/[\\/]/).pop() || 'output.txt';

  if (context?.projectPath) {
    filePath = path.join(context.projectPath, filename);
  } else {
    const sessionDir = path.join(
      this.workspace.getWorkspaceRoot(),
      'agent-output',
      `session_${context?.sessionId ?? 0}`,
    );
    filePath = path.join(sessionDir, filename);
  }

  try {
    const { bytesWritten, resolved } = await this.workspace.writeFile(filePath, content);
    if (!context?.projectPath) {
      const agentFile = await this.prisma.agentFile.create({
        data: { filename, path: resolved, sessionId: context?.sessionId ?? 0 },
      });
      return `Written ${bytesWritten} bytes. [Download "${filename}"](api/files/agent/${agentFile.id}/download)`;
    }
    return `Written ${bytesWritten} bytes to ${resolved}`;
  } catch (e) {
    return `Error writing file: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}
```

- [ ] **Step 2: Rewrite write-word.executor.ts**

Same pattern. Replace `if (context?.mode === 'agent')` with `if (context?.projectPath)`:
```typescript
let filePath: string;
const filename = rawPath.split(/[\\/]/).pop() || 'output.docx';

if (context?.projectPath) {
  filePath = path.join(context.projectPath, filename);
} else {
  const sessionDir = path.join(
    this.workspace.getWorkspaceRoot(),
    'agent-output',
    `session_${context?.sessionId ?? 0}`,
  );
  filePath = path.join(sessionDir, filename);
  fs.mkdirSync(sessionDir, { recursive: true });
}
// ... write file ...
if (!context?.projectPath) {
  const agentFile = await this.prisma.agentFile.create({ ... });
  return `${result} [Download "${filename}"](api/files/agent/${agentFile.id}/download)`;
}
return result;
```

- [ ] **Step 3: Rewrite edit-word.executor.ts**

Same pattern as write-word (Step 2).

- [ ] **Step 4: Rewrite write-excel.executor.ts**

Same pattern, but note this calls `this.excel.validatePath(filePath)` before the mode check. Keep that call, but move it AFTER the path resolution:
```typescript
let filePath = String(args.path ?? '');
if (!filePath) return 'Error: "path" is required';
const filename = filePath.split(/[\\/]/).pop() || 'output.xlsx';

if (context?.projectPath) {
  filePath = path.join(context.projectPath, filename);
} else {
  const sessionDir = path.join(
    this.workspace.getWorkspaceRoot(),
    'agent-output',
    `session_${context?.sessionId ?? 0}`,
  );
  filePath = path.join(sessionDir, filename);
  fs.mkdirSync(sessionDir, { recursive: true });
}

try {
  await this.excel.validatePath(filePath);
  const result = await this.excel.write(filePath, ops as WriteOperation[]);
  if (!context?.projectPath) {
    const agentFile = await this.prisma.agentFile.create({ ... });
    return `${result} [Download "${filename}"](api/files/agent/${agentFile.id}/download)`;
  }
  return result;
} catch (e) { ... }
```

- [ ] **Step 5: Rewrite excel-chart.executor.ts and excel-add-sheet.executor.ts**

Same pattern as write-excel (Step 4).

- [ ] **Step 6: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/tools/executors/write-file.executor.ts backend/src/word/executors backend/src/excel/executors
git commit -m "refactor: replace mode===agent with projectPath in 6 tool executors"
```

---

## Task 5: Backend — sessions + prisma schema

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/sessions/sessions.service.ts`
- Modify: `backend/src/sessions/sessions.controller.ts`

- [ ] **Step 1: Update Prisma schema default**

Edit `backend/prisma/schema.prisma`. Change `Session.mode` default from `"chat"` to `"cowork"`:
```prisma
model Session {
  mode       String        @default("cowork")
  // ... rest unchanged
}
```

- [ ] **Step 2: Update sessions service**

Edit `backend/src/sessions/sessions.service.ts`:

1. `create()`: Remove `mode: string = 'chat'` parameter. Hardcode `mode: 'cowork'`.
```typescript
async create(): Promise<{ id: number }> {
  return this.prisma.session.create({
    data: { mode: 'cowork' },
    select: { id: true },
  });
}
```
2. `findAll()`: Remove `mode?: string` parameter. Remove the `where` filter. Return all sessions.

- [ ] **Step 3: Update sessions controller**

Edit `backend/src/sessions/sessions.controller.ts`:

1. `findAll()`: Remove `@Query('mode') mode?: string` parameter. Call `sessionsService.findAll()` without arguments.
2. `create()`: Remove `@Body('mode') mode?: string` parameter. Call `sessionsService.create()` without arguments.

- [ ] **Step 4: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/sessions
git commit -m "refactor: change session mode default to cowork and remove mode param from sessions api"
```

---

## Task 6: Frontend — delete ChatPanel, rename chat/ → cowork/, update CoworkView

**Files:**
- Delete: `frontend/src/components/ChatPanel.vue`
- Rename: `frontend/src/components/chat/` → `frontend/src/components/cowork/`
- Modify: `frontend/src/components/CoworkView.vue`
- Modify: `frontend/src/router/index.ts`

- [ ] **Step 1: Delete ChatPanel.vue**

Delete `frontend/src/components/ChatPanel.vue`.

- [ ] **Step 2: Rename chat/ → cowork/ and update imports in CoworkView.vue**

On the filesystem, rename the `chat/` directory to `cowork/`. Then edit `frontend/src/components/CoworkView.vue`:
- Change `import ... from './chat/MessageList.vue'` → `from './cowork/MessageList.vue'`
- Change `import ... from './chat/ChatInputBar.vue'` → `from './cowork/ChatInputBar.vue'`
- Change `import type { Message } from './chat/types'` → `from './cowork/types'`

- [ ] **Step 3: Remove /chat route from router**

Edit `frontend/src/router/index.ts`:
- Remove `import ChatPanel from '../components/ChatPanel.vue'`
- Remove `{ path: '/chat', name: 'chat', component: ChatPanel }`

- [ ] **Step 4: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatPanel.vue frontend/src/components/cowork frontend/src/components/CoworkView.vue frontend/src/router/index.ts
git commit -m "refactor: delete ChatPanel, rename chat/ to cowork/, update imports and router"
```

---

## Task 7: Frontend — simplify ChatInputBar, SessionModal, i18n

**Files:**
- Modify: `frontend/src/components/cowork/ChatInputBar.vue`
- Modify: `frontend/src/components/SessionModal.vue`
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Remove mode toggle from ChatInputBar**

Edit `frontend/src/components/cowork/ChatInputBar.vue`:

1. Remove `mode` from `defineProps`:
```typescript
defineProps<{
  streaming: boolean
  models: ProviderModelFlat[]
  modelId: number | null
}>()
```
2. Remove `'update:mode'` from `defineEmits`:
```typescript
const emit = defineEmits<{
  (e: 'update:modelId', v: number | null): void
  (e: 'submit', text: string): void
  (e: 'stop'): void
  (e: 'openSessions'): void
}>()
```
3. Remove the mode toggle buttons block from the template (the two `<button>` elements with `@click="emit('update:mode', 'chat')"` and `@click="emit('update:mode', 'agent')"`).
4. Remove unused imports if any.
5. Remove the `type ProviderModelFlat` import if it was only used for mode.

- [ ] **Step 2: Remove mode prop from SessionModal**

Edit `frontend/src/components/SessionModal.vue`:

1. Remove `mode?: string` from `defineProps`:
```typescript
const props = defineProps<{
  modelValue: boolean
  currentSessionId: number | null
}>()
```
2. Change `fetchSessions()`:
```typescript
async function fetchSessions() {
  await sessionsStore.load()
}
```
(The sessions store's `load()` still accepts optional mode, but we don't pass one — backend `findAll()` returns all sessions now.)
3. Change `createSession()`:
```typescript
async function createSession() {
  try {
    const id = await sessionsStore.create('cowork')
    // ...
  }
}
```
Or if we update the sessions store in Task 7, change to just `sessionsStore.create()` without mode param.

- [ ] **Step 3: Remove orphaned i18n keys**

Edit `frontend/src/locales/vi.json`. Remove these keys (they are unreferenced anywhere):
- `nav.chat`
- `chat.mode.chat`
- `chat.mode.agent`
- `chat.mode.stub`
- `chat.mode.ollama`
- `chat.model.offline`

Keep: `chat.mode.cowork`, all other `chat.*` keys (error messages, placeholders, thinking indicator, etc.)

Edit `frontend/src/locales/en.json` with the same changes.

- [ ] **Step 4: Type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/cowork/ChatInputBar.vue frontend/src/components/SessionModal.vue frontend/src/locales
git commit -m "refactor: remove mode toggle from ChatInputBar and SessionModal, clean up i18n"
```

---

## Task 8: Frontend — update AGENTS.md references

**Files:**
- Modify: `frontend/AGENTS.md`
- Modify: `frontend/src/components/AGENTS.md`

- [ ] **Step 1: Update frontend/AGENTS.md**

- Remove ChatPanel from the component hierarchy and file structure
- Change `chat/` references to `cowork/` in the file structure
- Update CoworkView component description

- [ ] **Step 2: Update frontend/src/components/AGENTS.md**

- Remove ChatPanel entry
- Remove `chat/` subsection references, replace with `cowork/`
- Update ChatInputBar props (remove mode/mode-toggle references)
- Update CoworkView description to reflect it's the only coordinator
- Update SessionModal props (remove mode)

- [ ] **Step 3: Commit**

```bash
git add frontend/AGENTS.md frontend/src/components/AGENTS.md
git commit -m "docs: update AGENTS.md for ChatPanel removal and cowork/ rename"
```

---

## Task 9: Tests — update all test files

**Files:**
- Modify: `backend/src/agent/agent.controller.spec.ts`
- Modify: `backend/src/agent/agent.service.spec.ts`
- Modify: `backend/src/agent/services/context-builder.service.spec.ts`
- Modify: `backend/src/agent/services/agent-loop.service.spec.ts`
- Modify: `backend/src/mode-policy/mode-policy.service.spec.ts`
- Modify: `backend/src/sessions/sessions.service.spec.ts`
- Modify: `backend/src/tools/executors/write-file.executor.spec.ts`
- Modify: `backend/src/tools/executors/write-word.executor.spec.ts` (if it exists)
- Modify: `backend/src/tools/executors/spawn-subagent.executor.spec.ts`

- [ ] **Step 1: Update mode-policy.service.spec.ts**

Remove test cases for `chat` and `agent` modes. Keep only `cowork` mode tests. Update fallback test to expect `cowork` behavior:

```typescript
describe('ModePolicyService', () => {
  // Remove: 'should return only web tools for chat mode'
  // Remove: 'should exclude denied tools for agent mode'
  // Keep:   'should return all tools for cowork mode'
  // Update: 'should default to agent policy for unknown modes' → 'should default to cowork policy'
  // Remove/Update path tests for agent and chat modes
  // Remove tool permission tests for agent/chat modes
});
```

- [ ] **Step 2: Update context-builder.service.spec.ts**

Remove test cases that specifically test `chat` mode or `agent` mode behavior. The remaining tests should only verify `cowork` mode behavior (project path injection, tool descriptions, memory context). Add a test for the case where `projectPath` is injected.

- [ ] **Step 3: Update agent controller, service, loop specs**

In each file:
- Replace `mode: 'agent'` or `mode: 'chat'` with no mode param or implicit `'cowork'`
- Update any assertions about ToolContext shape to use `projectPath` instead of `mode`
- Update `streamChat` calls to remove the mode argument

- [ ] **Step 4: Update sessions.service.spec.ts**

Change `expect(mockPrisma.session.create).toHaveBeenCalledWith({ data: { mode: 'chat' } })` to:
```typescript
expect(mockPrisma.session.create).toHaveBeenCalledWith({
  data: { mode: 'cowork' },
  select: { id: true },
});
```

- [ ] **Step 5: Update write-file.executor.spec.ts**

Update ToolContext mocks to use `{ sessionId: 0 }` instead of `{ mode: 'agent', sessionId: 0 }`. Add test cases for `projectPath` scenario:
```typescript
it('writes to project path when projectPath is set', async () => {
  const result = await executor.execute(
    { path: 'output.txt', content: 'data' },
    { sessionId: 0, projectPath: '/home/project' },
  );
  expect(result).toContain('Written to');
  expect(result).not.toContain('Download');
});
```

- [ ] **Step 6: Run all backend tests**

Run: `cd backend && npx jest`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/agent/*.spec.ts backend/src/mode-policy/*.spec.ts backend/src/sessions/*.spec.ts backend/src/tools/executors/*.spec.ts
git commit -m "test: update tests for mode removal and projectPath executors"
```

---

## Verification

After all tasks, run:

```bash
cd frontend && npm run type-check && npm run build && npm test
cd backend && npx jest && npx tsc --noEmit
```
Expected: all PASS, 0 errors.
