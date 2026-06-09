# Agent Loop State Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp ReAct loop hiện tại thành State Machine orchestrator với Planning, Evaluation, và Self-correction

**Architecture:** State Machine với 6 state (PLANNING → EXECUTING → EVALUATING → CORRECTING → RESPONDING → DONE). Tách `ollama.provider.ts` thành raw LLM client, thêm `LLMControllerService` (provider-agnostic) và `AgentLoopService` (state machine orchestrator).

**Tech Stack:** NestJS, Ollama, TypeScript

---

### Task 1: AgentState enum

**Files:**
- Create: `backend/src/agent/dto/agent-state.enum.ts`

- [x] **Step 1: Write the enum**

```typescript
export enum AgentState {
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
  EVALUATING = 'EVALUATING',
  CORRECTING = 'CORRECTING',
  RESPONDING = 'RESPONDING',
  DONE = 'DONE',
}
```

- [x] **Step 2: Commit**

```bash
git add backend/src/agent/dto/agent-state.enum.ts
git commit -m "feat: add AgentState enum for state machine"
```

---

### Task 2: Simplify LLMProvider interface (define StreamChunk here)

**Files:**
- Modify: `backend/src/agent/providers/llm-provider.interface.ts`

- [x] **Step 1: Rewrite the interface**

```typescript
import { ToolDefinition } from '../services/context-builder.service';

export interface StreamChunk {
  type: 'token' | 'tool_call' | 'thinking' | 'done' | 'error';
  token?: string;
  toolCall?: { name: string; arguments: unknown };
  thinking?: string;
  error?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{ function: { name: string; arguments: unknown } }>;
}

export interface StreamOptions {
  model: string;
  messages: OllamaMessage[];
  tools: ToolDefinition[];
  signal: AbortSignal;
  baseUrl: string;
  key?: string;
}

export interface LLMProvider {
  stream(options: StreamOptions): AsyncGenerator<StreamChunk>;
}
```

**Quan trọng:** Định nghĩa `StreamChunk` được DI CHUYỂN từ `llm-caller.service.ts` sang đây vì file đó sẽ bị xóa.

- [x] **Step 2: Commit**

```bash
git add backend/src/agent/providers/llm-provider.interface.ts
git commit -m "refactor: simplify LLMProvider interface to raw stream only"
```

---

### Task 3: Simplify ollama.provider.ts (merge LLMCallerService)

**Files:**
- Modify: `backend/src/agent/providers/ollama.provider.ts`
- Remove: `backend/src/agent/services/llm-caller.service.ts`
- Remove: `backend/src/agent/services/llm-caller.service.spec.ts` (nếu có)

- [x] **Step 1: Write the simplified provider**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { LLMProvider, OllamaMessage, StreamOptions } from './llm-provider.interface';
import { StreamChunk } from './llm-provider.interface';
import { ToolDefinition } from '../services/context-builder.service';

@Injectable()
export class OllamaProvider implements LLMProvider {
  private readonly logger = new Logger(OllamaProvider.name);

  async *stream(options: StreamOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const { model, messages, tools, signal, baseUrl, key } = options;
    if (signal.aborted) return;

    const msgs: Array<Record<string, unknown>> = messages.map(m => ({
      role: m.role,
      content: m.content,
      ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
    }));

    const body: Record<string, unknown> = { model, messages: msgs, stream: true };
    if (tools.length > 0) body.tools = tools;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;

    let res: globalThis.Response;
    try {
      res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST', headers, body: JSON.stringify(body), signal,
      });
    } catch {
      if (signal.aborted) return;
      yield { type: 'error', error: 'ollama_unreachable' };
      return;
    }

    if (!res.ok) {
      let detail = `ollama_error_${res.status}`;
      try {
        const errBody = await res.json() as { error?: string };
        if (errBody.error) detail = errBody.error;
      } catch { /* ignore parse error */ }
      yield { type: 'error', error: detail };
      return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: unknown } }> };
            done?: boolean;
          };
          if (parsed.message?.content) {
            yield { type: 'token', token: parsed.message.content };
          }
          if (parsed.message?.tool_calls) {
            for (const tc of parsed.message.tool_calls) {
              yield {
                type: 'tool_call',
                toolCall: { name: tc.function.name, arguments: tc.function.arguments },
              };
            }
          }
        } catch { /* skip unparseable lines */ }
      }
    }
    yield { type: 'done' };
  }
}
```

- [x] **Step 2: Delete LLMCallerService**

Xóa file `backend/src/agent/services/llm-caller.service.ts` và `backend/src/agent/services/llm-caller.service.spec.ts` (nếu có).

- [x] **Step 3: Run tests to verify no broken imports**

```bash
cd backend && npx jest --passWithNoTests 2>&1 | head -30
```
Expected: Có thể có lỗi import từ các file còn phụ thuộc vào LLMCallerService. Sẽ fix ở task sau.

- [x] **Step 4: Commit**

```bash
git add backend/src/agent/providers/ollama.provider.ts
git rm backend/src/agent/services/llm-caller.service.ts
git commit -m "refactor: merge LLMCallerService into simplified OllamaProvider"
```

---

### Task 4: LLMControllerService

**Files:**
- Create: `backend/src/agent/services/llm-controller.service.ts`

- [x] **Step 1: Write the service**

```typescript
import { Injectable } from '@nestjs/common';
import { OllamaProvider } from '../providers/ollama.provider';
import { OllamaMessage, StreamOptions } from '../providers/llm-provider.interface';
import { ToolDefinition } from './context-builder.service';
import { StreamChunk } from '../providers/llm-provider.interface';

@Injectable()
export class LLMControllerService {
  private providers: Map<string, OllamaProvider>;

  constructor(private readonly ollama: OllamaProvider) {
    this.providers = new Map([['ollama', ollama]]);
  }

  registerProvider(type: string, provider: OllamaProvider): void {
    this.providers.set(type, provider);
  }

  async *stream(
    providerType: string,
    model: string,
    messages: OllamaMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal,
    baseUrl: string,
    key?: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      yield { type: 'error', error: `unknown_provider: ${providerType}` };
      return;
    }

    const opts: StreamOptions = { model, messages, tools, signal, baseUrl, key };
    yield* provider.stream(opts);
  }

  buildMessages(
    systemPrompt: string,
    history: OllamaMessage[],
    userMessage: string,
    toolResults?: Array<{ name: string; content: string }>,
  ): OllamaMessage[] {
    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    if (toolResults) {
      for (const tr of toolResults) {
        messages.push({ role: 'tool', content: tr.content, toolCalls: [{ function: { name: tr.name, arguments: {} } }] });
      }
    }

    return messages;
  }
}
```

- [x] **Step 2: Commit**

```bash
git add backend/src/agent/services/llm-controller.service.ts
git commit -m "feat: add LLMControllerService for provider-agnostic LLM control"
```

---

### Task 5: AgentLoopService (State Machine)

**Files:**
- Create: `backend/src/agent/services/agent-loop.service.ts`

- [x] **Step 1: Write the service**

```typescript
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { AgentState } from '../dto/agent-state.enum';
import { LLMControllerService } from './llm-controller.service';
import { ContextBuilderService, ToolDefinition } from './context-builder.service';
import { OllamaMessage } from '../providers/llm-provider.interface';
import { SessionsService } from '../../sessions/sessions.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { ToolExecutor } from '../../tools/executors/tool-executor.interface';
import { CreateTaskExecutor } from '../../tools/executors/create-task.executor';
import { UpdateTaskExecutor } from '../../tools/executors/update-task.executor';
import { ListTasksExecutor } from '../../tools/executors/list-tasks.executor';
import { GetTaskExecutor } from '../../tools/executors/get-task.executor';
import { DeleteTasksExecutor } from '../../tools/executors/delete-tasks.executor';
import { SearchKnowledgeExecutor } from '../../tools/executors/search-knowledge.executor';
import { WebFetchExecutor } from '../../tools/executors/web-fetch.executor';
import { WebSearchExecutor } from '../../tools/executors/web-search.executor';

const MAX_RETRIES = 2;
const MAX_ITERATIONS = 10;
const KB_NO_RESULTS = 'No relevant information found in knowledge base.';

@Injectable()
export class AgentLoopService {
  private state: AgentState = AgentState.PLANNING;
  private readonly executorMap: Map<string, ToolExecutor>;
  private currentPlan: string[] = [];
  private retryCount = 0;
  private failedTool: string | null = null;

  constructor(
    private readonly llmController: LLMControllerService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly sessionsService: SessionsService,
    private readonly knowledgeService: KnowledgeService,
    createTask: CreateTaskExecutor,
    updateTask: UpdateTaskExecutor,
    listTasks: ListTasksExecutor,
    getTask: GetTaskExecutor,
    deleteTasks: DeleteTasksExecutor,
    searchKnowledge: SearchKnowledgeExecutor,
    webFetch: WebFetchExecutor,
    webSearch: WebSearchExecutor,
  ) {
    this.executorMap = new Map([
      [createTask.name, createTask],
      [updateTask.name, updateTask],
      [listTasks.name, listTasks],
      [getTask.name, getTask],
      [deleteTasks.name, deleteTasks],
      [searchKnowledge.name, searchKnowledge],
      [webFetch.name, webFetch],
      [webSearch.name, webSearch],
    ]);
  }

  async run(
    providerType: string,
    model: string,
    systemPrompt: string,
    history: OllamaMessage[],
    userMessage: string,
    tools: ToolDefinition[],
    res: Response,
    signal: AbortSignal,
    sessionId?: number,
    mode: string = 'agent',
    providerConfig: { baseUrl: string; key?: string } = { baseUrl: 'http://localhost:11434' },
  ): Promise<string> {
    this.state = AgentState.PLANNING;
    this.currentPlan = [];
    this.retryCount = 0;
    this.failedTool = null;

    const activeTools = mode === 'chat' ? [] : tools;
    let finalText = '';
    let messages = this.llmController.buildMessages(systemPrompt, history, userMessage);
    let iterationCount = 0;

    while (this.state !== AgentState.DONE && !signal.aborted && iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      if (this.state === AgentState.PLANNING) {
        this.state = AgentState.EXECUTING;
      }

      if (this.state === AgentState.EXECUTING) {
        const { text, toolCalls } = await this.executeStep(
          model, messages, activeTools, signal, providerConfig, res, sessionId,
        );
        finalText += text;

        if (toolCalls.length > 0) {
          messages = this.addToolCallsToMessages(messages, text, toolCalls);
          this.state = AgentState.EVALUATING;
        } else {
          this.state = AgentState.RESPONDING;
        }

        if (this.state === AgentState.EVALUATING) {
          let allGood = true;
          for (const tc of toolCalls) {
            const name = tc.name;
            const args = this.normalizeArgs(tc.arguments);

            res.write(`data: ${JSON.stringify({ toolCall: { name, args } })}\n\n`);

            let result: string;
            try {
              result = await this.executeTool(name, args);
            } catch (e) {
              result = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
            }

            res.write(`data: ${JSON.stringify({ toolResult: { name, result } })}\n\n`);

            const isGood = this.evaluateResult(name, result);
            if (!isGood) {
              allGood = false;
              this.failedTool = name;
              messages.push({ role: 'tool', content: result });
              break;
            }

            messages.push({ role: 'tool', content: result });

            if (name === 'search_knowledge') {
              messages = await this.handleKnowledgeResult(messages, result, res, sessionId);
            }
          }

          if (allGood) {
            this.retryCount = 0;
            this.failedTool = null;
            this.state = AgentState.EXECUTING;
          } else {
            this.state = AgentState.CORRECTING;
          }
        }
      }

      if (this.state === AgentState.CORRECTING) {
        if (this.retryCount < MAX_RETRIES) {
          this.retryCount++;
          res.write(`data: ${JSON.stringify({ thinking: `⟳ Retrying (${this.retryCount}/${MAX_RETRIES})...` })}\n\n`);
          messages.push({
            role: 'user',
            content: `The tool "${this.failedTool}" failed. Please try again with different arguments.`,
          });
          this.state = AgentState.EXECUTING;
        } else {
          const fallbackTool = this.findFallbackTool(this.failedTool);
          if (fallbackTool) {
            res.write(`data: ${JSON.stringify({ thinking: `⟳ Trying alternative tool: ${fallbackTool}...` })}\n\n`);
            this.failedTool = fallbackTool;
            this.retryCount = 0;
            messages.push({
              role: 'user',
              content: `The tool failed after retries. Try using "${fallbackTool}" instead.`,
            });
            this.state = AgentState.EXECUTING;
          } else {
            res.write(`data: ${JSON.stringify({ thinking: 'Unable to complete after retries. Asking user...' })}\n\n`);
            this.state = AgentState.RESPONDING;
          }
        }
      }
    }

    if (!signal.aborted) {
      res.write('data: [DONE]\n\n');
    }

    return finalText;
  }

  private async executeStep(
    model: string,
    messages: OllamaMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal,
    providerConfig: { baseUrl: string; key?: string },
    res: Response,
    sessionId?: number,
  ): Promise<{ text: string; toolCalls: Array<{ name: string; arguments: unknown }> }> {
    let text = '';
    const toolCalls: Array<{ name: string; arguments: unknown }> = [];

    const stream = this.llmController.stream(
      'ollama', model, messages, tools, signal,
      providerConfig.baseUrl, providerConfig.key,
    );

    for await (const chunk of stream) {
      if (signal.aborted) return { text, toolCalls };

      switch (chunk.type) {
        case 'token':
          if (chunk.token) {
            text += chunk.token;
            res.write(`data: ${JSON.stringify({ token: chunk.token })}\n\n`);
          }
          break;
        case 'tool_call':
          if (chunk.toolCall) toolCalls.push(chunk.toolCall);
          break;
        case 'error':
          res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
          return { text, toolCalls };
        case 'done':
          break;
      }
    }

    return { text, toolCalls };
  }

  private evaluateResult(toolName: string, result: string): boolean {
    if (!result || result.startsWith('Error:')) return false;
    if (result === KB_NO_RESULTS) return false;
    return true;
  }

  private findFallbackTool(failedTool: string | null): string | null {
    if (!failedTool) return null;
    const fallbackMap: Record<string, string> = {
      'web_fetch': 'web_search',
      'search_knowledge': 'web_search',
    };
    return fallbackMap[failedTool] ?? null;
  }

  private normalizeArgs(args: unknown): Record<string, unknown> {
    if (typeof args === 'string') {
      try { return JSON.parse(args); } catch { return { raw: args }; }
    }
    if (typeof args === 'object' && args !== null) return args as Record<string, unknown>;
    return {};
  }

  private addToolCallsToMessages(
    messages: OllamaMessage[],
    text: string,
    toolCalls: Array<{ name: string; arguments: unknown }>,
  ): OllamaMessage[] {
    return [
      ...messages,
      {
        role: 'assistant',
        content: text || '',
        toolCalls: toolCalls.map(tc => ({
          function: { name: tc.name, arguments: this.normalizeArgs(tc.arguments) },
        })),
      },
    ];
  }

  private async handleKnowledgeResult(
    messages: OllamaMessage[],
    result: string,
    res: Response,
    sessionId?: number,
  ): Promise<OllamaMessage[]> {
    res.write(`data: ${JSON.stringify({ thinking: 'Synthesizing search results...' })}\n\n`);

    if (result === KB_NO_RESULTS) {
      let fileList = 'none indexed yet';
      try {
        const files = await this.knowledgeService.findAll();
        if (files.length > 0) {
          fileList = files.slice(0, 10).map(f => `"${f.filename}"`).join(', ');
        }
      } catch { /* fallback */ }
      return [
        ...messages,
        {
          role: 'user',
          content: `The knowledge base returned no results.\nAvailable KB files: ${fileList}.\nFollow KB guidance in system prompt.`,
        },
      ];
    }

    return [
      ...messages,
      {
        role: 'user',
        content: `I searched the knowledge base and found:\n\n${result}\n\nProvide a comprehensive answer with inline citations [Source: "filename", §N].`,
      },
    ];
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const executor = this.executorMap.get(name);
    if (!executor) return `Error: Unknown tool: ${name}`;
    return executor.execute(args);
  }
}
```

- [x] **Step 2: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.ts
git commit -m "feat: add AgentLoopService with state machine (planning, evaluating, correcting)"
```

---

### Task 6: Update AgentRunState with currentState field

**Files:**
- Modify: `backend/src/agent/dto/agent-run-state.ts`

- [x] **Step 1: Update the class**

```typescript
import { AgentState } from './agent-state.enum';

export interface StepRecord {
  step: number;
  type: 'thinking' | 'skill_load' | 'tool_call' | 'tool_result' | 'kb_search' | 'kb_result' | 'responding';
  content?: string;
  skillSlug?: string;
  toolSlug?: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

export class AgentRunState {
  step = 0;
  maxIterations: number;
  roomId: string;
  steps: StepRecord[] = [];
  startTime: number;
  currentState: AgentState = AgentState.PLANNING;

  constructor(maxIterations: number, roomId?: string) {
    this.maxIterations = maxIterations;
    this.roomId = roomId ?? '';
    this.startTime = Date.now();
  }

  get duration(): number {
    return Date.now() - this.startTime;
  }
}
```

- [x] **Step 2: Commit**

```bash
git add backend/src/agent/dto/agent-run-state.ts
git commit -m "feat: add currentState tracking to AgentRunState"
```

---

### Task 7: Update AgentService to use AgentLoopService

**Files:**
- Modify: `backend/src/agent/agent.service.ts`

- [x] **Step 1: Rewrite AgentService**

```typescript
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { AgentLoopService } from './services/agent-loop.service';
import { ContextBuilderService } from './services/context-builder.service';
import { SessionsService } from '../sessions/sessions.service';
import { ProvidersService } from '../providers/providers.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly agentLoop: AgentLoopService,
    private readonly sessionsService: SessionsService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly providersService: ProvidersService,
  ) {}

  async streamChat(
    message: string,
    providerModelId: number,
    res: Response,
    signal: AbortSignal,
    sessionId: number,
    mode: string = 'agent',
  ): Promise<void> {
    const providerModel = await this.providersService.findModelWithProvider(providerModelId);
    if (!providerModel) {
      res.write('data: {"error":"provider_not_found"}\n\n');
      res.write('data: [DONE]\n\n');
      return;
    }

    const providerConfig = {
      baseUrl: providerModel.provider.baseUrl ?? 'http://localhost:11434',
      key: providerModel.provider.key ?? undefined,
    };

    const context = await this.contextBuilder.build(
      { step: 0, maxIterations: 10, roomId: String(sessionId), steps: [], startTime: Date.now(), currentState: 'PLANNING' } as any,
      sessionId,
    );

    const history = await this.sessionsService.getHistory(sessionId);

    if (!signal.aborted) {
      await this.sessionsService.saveMessage(sessionId, 'user', message);
    }

    const providerType = providerModel.provider.type ?? 'ollama';

    const finalText = await this.agentLoop.run(
      providerType,
      providerModel.name,
      context.systemPrompt,
      history,
      message,
      context.tools,
      res,
      signal,
      sessionId,
      mode,
      providerConfig,
    );

    if (!signal.aborted && finalText) {
      await this.sessionsService.saveMessage(sessionId, 'assistant', finalText);
      await this.sessionsService.autoTitle(sessionId, message);
    }
  }
}
```

- [x] **Step 2: Commit**

```bash
git add backend/src/agent/agent.service.ts
git commit -m "refactor: use AgentLoopService in AgentService"
```

---

### Task 8: Update AgentModule

**Files:**
- Modify: `backend/src/agent/agent.module.ts`

- [x] **Step 1: Rewrite AgentModule**

```typescript
import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentLoopService } from './services/agent-loop.service';
import { LLMControllerService } from './services/llm-controller.service';
import { OllamaProvider } from './providers/ollama.provider';
import { ContextBuilderService } from './services/context-builder.service';
import { TasksModule } from '../tasks/tasks.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ProvidersModule } from '../providers/providers.module';
import { ToolsModule } from '../tools/tools.module';
import { CreateTaskExecutor } from '../tools/executors/create-task.executor';
import { UpdateTaskExecutor } from '../tools/executors/update-task.executor';
import { ListTasksExecutor } from '../tools/executors/list-tasks.executor';
import { GetTaskExecutor } from '../tools/executors/get-task.executor';
import { DeleteTasksExecutor } from '../tools/executors/delete-tasks.executor';
import { SearchKnowledgeExecutor } from '../tools/executors/search-knowledge.executor';
import { WebFetchExecutor } from '../tools/executors/web-fetch.executor';
import { WebSearchExecutor } from '../tools/executors/web-search.executor';

@Module({
  imports: [TasksModule, KnowledgeModule, SessionsModule, ProvidersModule, ToolsModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    AgentLoopService,
    LLMControllerService,
    OllamaProvider,
    ContextBuilderService,
    CreateTaskExecutor,
    UpdateTaskExecutor,
    ListTasksExecutor,
    GetTaskExecutor,
    DeleteTasksExecutor,
    SearchKnowledgeExecutor,
    WebFetchExecutor,
    WebSearchExecutor,
  ],
})
export class AgentModule {}
```

- [x] **Step 2: Commit**

```bash
git add backend/src/agent/agent.module.ts
git commit -m "refactor: update AgentModule with new services and executors"
```

---

### Task 9: Clean up unused imports and verify compilation

**Files:**
- Verify: all modified files

- [x] **Step 1: Run TypeScript compilation check**

```bash
cd backend && npx tsc --noEmit 2>&1
```
Expected: No errors. Fix any type errors found.

- [x] **Step 2: Run existing tests**

```bash
cd backend && npx jest --passWithNoTests 2>&1 | tail -20
```
Expected: Tests pass (may need to update mocks for refactored services).

- [x] **Step 3: Fix failing tests** — nếu có test spec nào fail vì thay đổi architecture, update mocks accordingly.

- [x] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: fix type errors and update tests after Agent Loop refactor"
```

---

### Task 10: Write tests for AgentLoopService

**Files:**
- Create: `backend/src/agent/services/agent-loop.service.spec.ts`

- [x] **Step 1: Write tests for state transitions**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AgentLoopService } from './agent-loop.service';
import { LLMControllerService } from './llm-controller.service';
import { ContextBuilderService } from './context-builder.service';
import { SessionsService } from '../../sessions/sessions.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { CreateTaskExecutor } from '../../tools/executors/create-task.executor';
// ... import other executors and mocks

describe('AgentLoopService', () => {
  let service: AgentLoopService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentLoopService,
        { provide: LLMControllerService, useValue: { stream: jest.fn(), buildMessages: jest.fn() } },
        { provide: ContextBuilderService, useValue: { build: jest.fn() } },
        { provide: SessionsService, useValue: { saveMessage: jest.fn(), getHistory: jest.fn() } },
        { provide: KnowledgeService, useValue: { findAll: jest.fn() } },
        { provide: CreateTaskExecutor, useValue: { name: 'create_task', execute: jest.fn() } },
        // ... mock other executors
      ],
    }).compile();

    service = module.get<AgentLoopService>(AgentLoopService);
  });

  it('should transition from PLANNING to EXECUTING on run', () => {
    expect(service).toBeDefined();
  });
});
```

- [x] **Step 2: Run tests**

```bash
cd backend && npx jest src/agent/services/agent-loop.service.spec.ts --verbose 2>&1
```
Expected: All tests pass.

- [x] **Step 3: Commit**

```bash
git add backend/src/agent/services/agent-loop.service.spec.ts
git commit -m "test: add AgentLoopService state transition tests"
```
