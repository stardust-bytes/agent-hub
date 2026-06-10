# Chat Mode Trifecta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 2-mode chat (chat/agent) with 3-mode chat (chat/agent/cowork) with different tool sets and system prompts per mode.

**Architecture:** Extend ChatDto mode enum, add mode-aware system prompt building in ContextBuilderService, filter tools per mode in AgentLoopService, add 3-way toggle in ChatPanel.

**Tech Stack:** NestJS, Vue 3, TailwindCSS

---

## File Structure

- Modify: `backend/src/agent/dto/chat.dto.ts` — extend mode enum
- Modify: `backend/src/agent/services/context-builder.service.ts` — mode-aware system prompts
- Modify: `backend/src/agent/services/agent-loop.service.ts` — tool filtering per mode
- Modify: `backend/src/agent/agent.service.ts` — pass mode to contextBuilder
- Modify: `frontend/src/components/ChatPanel.vue` — 3-way toggle
- Modify: `frontend/src/locales/vi.json` — add `chat.mode.cowork`
- Modify: `frontend/src/locales/en.json` — add `chat.mode.cowork`

---

### Task 1: Extend ChatDto mode enum

**Files:**
- Modify: `backend/src/agent/dto/chat.dto.ts`

- [ ] **Step 1: Update mode enum**

Change `@IsIn(['agent', 'chat'])` to `@IsIn(['agent', 'chat', 'cowork'])`.

- [ ] **Step 2: Run tests**

Run: `npx jest --passWithNoTests`
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/dto/chat.dto.ts
git commit -m "feat: add 'cowork' mode to ChatDto"
```

---

### Task 2: Mode-aware system prompts

**Files:**
- Modify: `backend/src/agent/services/context-builder.service.ts`

- [ ] **Step 1: Add mode param to build()**

Change `async build(runState, sessionId, systemPromptOverride?)` to `async build(runState, sessionId, mode = 'agent', systemPromptOverride?)`.

Pass `mode` to `buildSystemPrompt(tools, project, mode)`.

- [ ] **Step 2: Implement mode-specific prompts**

In `buildSystemPrompt`, change the method signature and logic:

```ts
private buildSystemPrompt(tools: ToolDefinition[], projectPath?: string | null, mode: string = 'agent'): string {
  const lines: string[] = [];

  if (mode === 'chat') {
    lines.push(
      'You are a helpful AI assistant.',
      'Answer user questions using the available tools when needed.',
      'Use web_search and web_fetch to find current information.',
      '',
      'Respond in the same language the user writes in.',
    );
    return lines.join('\n');
  }

  // agent or cowork mode
  lines.push('You are a helpful AI assistant with access to the following tools:');
  for (const tool of tools) {
    lines.push(`- ${tool.function.name}: ${tool.function.description}`);
  }
  lines.push('',
    'When handling knowledge base searches (search_knowledge tool):',
    '- If results are found: synthesize into a coherent answer. Cite each fact inline with [Source: "filename", §N].',
    '- If no results AND the question is about internal documents: Acknowledge the gap, ask clarifying questions or suggest uploading.',
    '- If no results AND the question is general knowledge: answer from your own knowledge with a disclaimer.',
    '',
    'To ask the user for structured input, output a form using:',
    '```form',
    '<label>Field name: <input name="field_name" placeholder="Enter..."></label>',
    '<button type="submit">Submit</button>',
    '```',
    '',
    'Respond in the same language the user writes in.',
    '',
    'System Environment:',
    `  Platform: ${process.platform}`,
    '',
  );

  if (mode === 'cowork' && projectPath) {
    lines.push(
      '',
      `Current working project: ${projectPath}`,
      'File operations are available in this directory only.',
    );
  }

  return lines.join('\n');
}
```

- [ ] **Step 3: Update build() caller**

Update `AgentService.streamChat()` to pass mode to `contextBuilder.build()`.

- [ ] **Step 4: Run tests**

Run: `npx jest backend/src/agent/services/context-builder.service.spec.ts --verbose`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/services/context-builder.service.ts
git commit -m "feat: mode-aware system prompts for chat/agent/cowork"
```

---

### Task 3: Filter tools per mode in AgentLoopService

**Files:**
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Update activeTools logic**

In the `run()` method, change:

```ts
const activeTools = mode === 'chat' ? [] : tools;
```

To:

```ts
let activeTools: ToolDefinition[];
if (mode === 'chat') {
  activeTools = tools.filter(t => ['web_search', 'web_fetch'].includes(t.function.name));
} else {
  activeTools = tools;
}
```

- [ ] **Step 2: Run tests**

Run: `npx jest backend/src/agent/services/agent-loop.service.spec.ts --verbose`
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: filter tools per mode (chat→web only)"
```

---

### Task 4: Pass mode to context builder in AgentService

**Files:**
- Modify: `backend/src/agent/agent.service.ts`

- [ ] **Step 1: Pass mode to build()**

Find the line `const context = await this.contextBuilder.build(runState, sessionId);` and change to:

```ts
const context = await this.contextBuilder.build(runState, sessionId, mode);
```

- [ ] **Step 2: Run tests**

Run: `npx jest backend/src/agent/agent.service.spec.ts --verbose`
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/agent.service.ts
git commit -m "feat: pass mode to context builder"
```

---

### Task 5: Frontend 3-way mode toggle + i18n

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue`
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Replace 2-button toggle with 3-button toggle**

In `ChatPanel.vue`, replace the current mode toggle section:

OLD:
```html
<button @click="agentMode = true"
  :class="agentMode ? 'bg-cyber-accent/20 text-cyber-accent' : 'text-cyber-muted'"
  class="px-2 py-0.5 text-sm font-mono">{{ t('chat.mode.agent') }}</button>
<button @click="agentMode = false"
  :class="!agentMode ? 'bg-cyber-accent/20 text-cyber-accent' : 'text-cyber-muted'"
  class="px-2 py-0.5 text-sm font-mono">{{ t('chat.mode.chat') }}</button>
```

NEW:
```html
<button @click="currentMode = 'chat'"
  :class="currentMode === 'chat' ? 'bg-cyber-accent/20 text-cyber-accent' : 'text-cyber-muted'"
  class="px-2 py-0.5 text-sm font-mono">{{ t('chat.mode.chat') }}</button>
<button @click="currentMode = 'agent'"
  :class="currentMode === 'agent' ? 'bg-cyber-accent/20 text-cyber-accent' : 'text-cyber-muted'"
  class="px-2 py-0.5 text-sm font-mono">{{ t('chat.mode.agent') }}</button>
<button @click="currentMode = 'cowork'"
  :class="currentMode === 'cowork' ? 'bg-cyber-accent/20 text-cyber-accent' : 'text-cyber-muted'"
  class="px-2 py-0.5 text-sm font-mono">{{ t('chat.mode.cowork') }}</button>
```

Replace the script:
```ts
const agentMode = ref(true)
```
With:
```ts
const currentMode = ref<'chat' | 'agent' | 'cowork'>('chat')
```

Update the POST body where mode is sent:
```ts
body: JSON.stringify({ message: text, providerModelId: selectedModelId.value, sessionId: currentSessionId.value, mode: currentMode.value }),
```

Remove the old `agentMode` reference in submit() guard:
```ts
// old: mode: agentMode.value ? 'agent' : 'chat'
// new: mode: currentMode.value
```

- [ ] **Step 2: Add i18n keys**

In `frontend/src/locales/vi.json` add:
```json
"chat.mode.cowork": "Cowork",
```

In `frontend/src/locales/en.json` add:
```json
"chat.mode.cowork": "Cowork",
```

- [ ] **Step 3: Type-check**

Run: `npx vue-tsc --noEmit` from D:\Git\GitHub\960513\frontend
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatPanel.vue frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add 3-way mode toggle (chat/agent/cowork)"
```
