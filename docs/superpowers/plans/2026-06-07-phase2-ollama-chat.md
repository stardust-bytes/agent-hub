# Phase 2 — Real Ollama Chat (Streaming) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub `AgentService.mockReply()` with real Ollama LLM streaming using `fetch + ReadableStream` over SSE on `POST /api/agent/chat`, and add a `ModelSelector` dropdown to ChatPanel.

**Architecture:** Backend introduces a `LLMProvider` interface (strategy pattern) with `OllamaProvider` as the only implementation in Phase 2. `AgentController` manually sets SSE headers, reads `req.on('close')` for abort, and delegates to `AgentService.streamChat()`. Frontend replaces `fetch().json()` with `fetch() + response.body.getReader()`, streaming tokens into the message in real time.

**Tech Stack:** NestJS 10 (Node 18+ `fetch`, `@Res({ passthrough: false })`), Express `Response`, Vue 3 `<script setup>`, `ReadableStream`, `AbortController`, `TextDecoder`, `vue-i18n` v9.

---

## File Map

**Backend — Create:**
- `src/agent/providers/llm-provider.interface.ts` — `LLMProvider` interface
- `src/agent/providers/ollama.provider.ts` — Ollama NDJSON → SSE proxy
- `src/agent/providers/ollama.provider.spec.ts`
- `src/agent/dto/chat.dto.ts` — `ChatDto` (message + optional model)
- `src/ollama/ollama.service.ts` — `GET /api/tags` proxy, returns `string[]`
- `src/ollama/ollama.service.spec.ts`
- `src/ollama/ollama.controller.ts` — `GET /api/ollama/models`
- `src/ollama/ollama.controller.spec.ts`
- `src/ollama/ollama.module.ts`

**Backend — Modify:**
- `src/agent/agent.service.ts` — replace `mockReply()` with `streamChat()`
- `src/agent/agent.service.spec.ts` — rewrite for `streamChat()`
- `src/agent/agent.controller.ts` — replace JSON response with SSE stream
- `src/agent/agent.controller.spec.ts` — rewrite for SSE controller
- `src/agent/agent.module.ts` — add `OllamaProvider` to providers
- `src/app.module.ts` — add `OllamaModule` to imports
- `.env` — add `OLLAMA_URL`, `ACTIVE_PROVIDER`
- `.env.example` — same

**Frontend — Create:**
- `src/components/ModelSelector.vue`

**Frontend — Modify:**
- `src/locales/vi.json` — add 4 keys
- `src/locales/en.json` — add 4 keys
- `src/components/ChatPanel.vue` — streaming, ModelSelector, stop button

---

## Task 1: LLMProvider interface

**Files:**
- Create: `backend/src/agent/providers/llm-provider.interface.ts`
- Create: `backend/src/agent/dto/chat.dto.ts`

- [ ] **Step 1: Create the LLMProvider interface**

```typescript
// backend/src/agent/providers/llm-provider.interface.ts
import { Response } from 'express';

export interface LLMProvider {
  streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<void>;
}
```

- [ ] **Step 2: Create ChatDto**

```typescript
// backend/src/agent/dto/chat.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class ChatDto {
  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  model?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/providers/llm-provider.interface.ts backend/src/agent/dto/chat.dto.ts
git commit -m "feat: add LLMProvider interface and ChatDto"
```

---

## Task 2: OllamaService TDD

**Files:**
- Create: `backend/src/ollama/ollama.service.spec.ts`
- Create: `backend/src/ollama/ollama.service.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/ollama/ollama.service.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { OllamaService } from './ollama.service';

describe('OllamaService', () => {
  let service: OllamaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OllamaService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:11434') },
        },
      ],
    }).compile();
    service = module.get(OllamaService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('getModels returns model name strings', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2' }, { name: 'codestral' }] }),
    } as unknown as Response);

    const models = await service.getModels();
    expect(models).toEqual(['llama3.2', 'codestral']);
  });

  it('getModels throws ServiceUnavailableException when Ollama offline', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.getModels()).rejects.toThrow(ServiceUnavailableException);
  });

  it('getModels throws ServiceUnavailableException when Ollama returns non-ok', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
    } as unknown as Response);

    await expect(service.getModels()).rejects.toThrow(ServiceUnavailableException);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest src/ollama/ollama.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './ollama.service'`

- [ ] **Step 3: Implement OllamaService**

```typescript
// backend/src/ollama/ollama.service.ts
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OllamaService {
  private readonly ollamaUrl: string;

  constructor(private readonly config: ConfigService) {
    this.ollamaUrl = this.config.get<string>('OLLAMA_URL', 'http://localhost:11434');
  }

  async getModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { models: Array<{ name: string }> };
      return data.models.map((m) => m.name);
    } catch {
      throw new ServiceUnavailableException('ollama_unreachable');
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/ollama/ollama.service.spec.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/ollama/ollama.service.ts backend/src/ollama/ollama.service.spec.ts
git commit -m "feat: add OllamaService with getModels TDD"
```

---

## Task 3: OllamaController, OllamaModule, register in AppModule

**Files:**
- Create: `backend/src/ollama/ollama.controller.spec.ts`
- Create: `backend/src/ollama/ollama.controller.ts`
- Create: `backend/src/ollama/ollama.module.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/.env`
- Modify: `backend/.env.example`

- [ ] **Step 1: Write failing controller test**

```typescript
// backend/src/ollama/ollama.controller.spec.ts
import { Test } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { OllamaController } from './ollama.controller';
import { OllamaService } from './ollama.service';

describe('OllamaController', () => {
  let controller: OllamaController;
  const mockService = { getModels: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OllamaController],
      providers: [{ provide: OllamaService, useValue: mockService }],
    }).compile();
    controller = module.get(OllamaController);
    jest.clearAllMocks();
  });

  it('getModels returns string array from service', async () => {
    mockService.getModels.mockResolvedValue(['llama3.2', 'codestral']);
    const result = await controller.getModels();
    expect(result).toEqual(['llama3.2', 'codestral']);
  });

  it('getModels propagates ServiceUnavailableException', async () => {
    mockService.getModels.mockRejectedValue(new ServiceUnavailableException());
    await expect(controller.getModels()).rejects.toThrow(ServiceUnavailableException);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest src/ollama/ollama.controller.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './ollama.controller'`

- [ ] **Step 3: Create OllamaController**

```typescript
// backend/src/ollama/ollama.controller.ts
import { Controller, Get } from '@nestjs/common';
import { OllamaService } from './ollama.service';

@Controller('ollama')
export class OllamaController {
  constructor(private readonly ollamaService: OllamaService) {}

  @Get('models')
  async getModels(): Promise<string[]> {
    return this.ollamaService.getModels();
  }
}
```

- [ ] **Step 4: Create OllamaModule**

```typescript
// backend/src/ollama/ollama.module.ts
import { Module } from '@nestjs/common';
import { OllamaController } from './ollama.controller';
import { OllamaService } from './ollama.service';

@Module({
  controllers: [OllamaController],
  providers: [OllamaService],
})
export class OllamaModule {}
```

- [ ] **Step 5: Register OllamaModule in AppModule**

Replace the entire content of `backend/src/app.module.ts`:

```typescript
// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';
import { AgentModule } from './agent/agent.module';
import { OllamaModule } from './ollama/ollama.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TasksModule,
    AgentModule,
    OllamaModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
```

- [ ] **Step 6: Add env vars to .env and .env.example**

Append to `backend/.env`:
```
OLLAMA_URL=http://host.docker.internal:11434
ACTIVE_PROVIDER=ollama
```

Replace entire `backend/.env.example`:
```
DATABASE_URL=file:/app/data/dev.db
PORT=3001
OLLAMA_URL=http://host.docker.internal:11434
ACTIVE_PROVIDER=ollama
```

- [ ] **Step 7: Run controller test to confirm it passes**

```bash
npx jest src/ollama/ --no-coverage
```

Expected: PASS (5 tests total)

- [ ] **Step 8: Commit**

```bash
git add backend/src/ollama/ backend/src/app.module.ts backend/.env backend/.env.example
git commit -m "feat: add OllamaModule with GET /api/ollama/models endpoint"
```

---

## Task 4: OllamaProvider TDD

**Files:**
- Create: `backend/src/agent/providers/ollama.provider.spec.ts`
- Create: `backend/src/agent/providers/ollama.provider.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/agent/providers/ollama.provider.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OllamaProvider } from './ollama.provider';

function makeReader(chunks: string[]) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    read: jest.fn(async () => {
      if (i < chunks.length) return { done: false as const, value: encoder.encode(chunks[i++]) };
      return { done: true as const, value: undefined };
    }),
  };
}

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OllamaProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:11434') },
        },
      ],
    }).compile();
    provider = module.get(OllamaProvider);
  });

  afterEach(() => jest.restoreAllMocks());

  it('writes token events for each NDJSON content chunk', async () => {
    const reader = makeReader([
      '{"message":{"role":"assistant","content":"Hello"},"done":false}\n',
      '{"message":{"role":"assistant","content":" world"},"done":false}\n',
      '{"message":{"role":"assistant","content":""},"done":true}\n',
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    } as unknown as Response);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat('hi', 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"token":"Hello"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: {"token":" world"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('writes error event and [DONE] when fetch throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat('hi', 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"error":"ollama_unreachable"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('writes error event when Ollama returns non-ok status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      body: null,
    } as unknown as Response);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat('hi', 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"error":"ollama_error_404"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('stops writing when signal is aborted', async () => {
    const ctrl = new AbortController();
    const reader = makeReader([
      '{"message":{"role":"assistant","content":"Hi"},"done":false}\n',
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    } as unknown as Response);

    const mockRes = { write: jest.fn() };

    ctrl.abort();
    await provider.streamChat('hi', 'llama3.2', mockRes as any, ctrl.signal);

    expect(mockRes.write).not.toHaveBeenCalledWith('data: [DONE]\n\n');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/agent/providers/ollama.provider.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './ollama.provider'`

- [ ] **Step 3: Implement OllamaProvider**

```typescript
// backend/src/agent/providers/ollama.provider.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { LLMProvider } from './llm-provider.interface';

@Injectable()
export class OllamaProvider implements LLMProvider {
  private readonly ollamaUrl: string;

  constructor(private readonly config: ConfigService) {
    this.ollamaUrl = this.config.get<string>('OLLAMA_URL', 'http://localhost:11434');
  }

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) return;

    let ollamaRes: globalThis.Response;
    try {
      ollamaRes = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: message }],
          stream: true,
        }),
        signal,
      });
    } catch {
      if (signal.aborted) return;
      res.write('data: {"error":"ollama_unreachable"}\n\n');
      res.write('data: [DONE]\n\n');
      return;
    }

    if (!ollamaRes.ok) {
      res.write(`data: {"error":"ollama_error_${ollamaRes.status}"}\n\n`);
      res.write('data: [DONE]\n\n');
      return;
    }

    const reader = ollamaRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
          };
          if (parsed.message?.content) {
            res.write(`data: ${JSON.stringify({ token: parsed.message.content })}\n\n`);
          }
        } catch {
          // skip malformed line
        }
      }
    }

    if (!signal.aborted) {
      res.write('data: [DONE]\n\n');
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/agent/providers/ollama.provider.spec.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/providers/
git commit -m "feat: add OllamaProvider with NDJSON to SSE streaming TDD"
```

---

## Task 5: AgentService TDD

**Files:**
- Modify: `backend/src/agent/agent.service.spec.ts` — full rewrite
- Modify: `backend/src/agent/agent.service.ts` — full rewrite

- [ ] **Step 1: Write failing tests (replace entire file)**

```typescript
// backend/src/agent/agent.service.spec.ts
import { Test } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { Response } from 'express';

describe('AgentService', () => {
  let service: AgentService;
  const mockProvider = { streamChat: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: OllamaProvider, useValue: mockProvider },
      ],
    }).compile();
    service = module.get(AgentService);
    jest.clearAllMocks();
  });

  it('streamChat delegates to provider with correct args', async () => {
    const mockRes = {} as Response;
    const signal = new AbortController().signal;

    await service.streamChat('hello', 'llama3.2', mockRes, signal);

    expect(mockProvider.streamChat).toHaveBeenCalledWith('hello', 'llama3.2', mockRes, signal);
  });

  it('streamChat passes chosen model to provider', async () => {
    const mockRes = {} as Response;
    const signal = new AbortController().signal;

    await service.streamChat('test', 'codestral', mockRes, signal);

    expect(mockProvider.streamChat).toHaveBeenCalledWith('test', 'codestral', mockRes, signal);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/agent/agent.service.spec.ts --no-coverage
```

Expected: FAIL — `streamChat is not a function` (old `mockReply` service)

- [ ] **Step 3: Replace AgentService implementation**

```typescript
// backend/src/agent/agent.service.ts
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { OllamaProvider } from './providers/ollama.provider';

@Injectable()
export class AgentService {
  constructor(private readonly provider: OllamaProvider) {}

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<void> {
    await this.provider.streamChat(message, model, res, signal);
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/agent/agent.service.spec.ts --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/agent.service.ts backend/src/agent/agent.service.spec.ts
git commit -m "feat: replace AgentService mockReply with streamChat provider delegation"
```

---

## Task 6: AgentController TDD (SSE)

**Files:**
- Modify: `backend/src/agent/agent.controller.spec.ts` — full rewrite
- Modify: `backend/src/agent/agent.controller.ts` — full rewrite

- [ ] **Step 1: Write failing tests (replace entire file)**

```typescript
// backend/src/agent/agent.controller.spec.ts
import { Test } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { Request, Response } from 'express';

describe('AgentController', () => {
  let controller: AgentController;
  const mockStreamChat = jest.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: { streamChat: mockStreamChat } }],
    }).compile();
    controller = module.get(AgentController);
    jest.clearAllMocks();
  });

  function makeReqRes() {
    const req = { on: jest.fn() } as unknown as Request;
    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;
    return { req, res };
  }

  it('sets SSE headers', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'hi', model: 'llama3.2' }, req, res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
  });

  it('calls agentService.streamChat with message and model', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'hello', model: 'codestral' }, req, res);
    expect(mockStreamChat).toHaveBeenCalledWith(
      'hello',
      'codestral',
      res,
      expect.any(Object),
    );
  });

  it('uses fallback model llama3.2 when model is undefined', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'hi' }, req, res);
    expect(mockStreamChat).toHaveBeenCalledWith('hi', 'llama3.2', res, expect.any(Object));
  });

  it('binds req close event to abort controller', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'test' }, req, res);
    expect(req.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('calls res.end() after streaming completes', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'hi' }, req, res);
    expect(res.end).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/agent/agent.controller.spec.ts --no-coverage
```

Expected: FAIL — `chatStream is not a function` (old `chat()` controller)

- [ ] **Step 3: Replace AgentController implementation**

```typescript
// backend/src/agent/agent.controller.ts
import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AgentService } from './agent.service';
import { ChatDto } from './dto/chat.dto';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  async chatStream(
    @Body() dto: ChatDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const ctrl = new AbortController();
    req.on('close', () => ctrl.abort());

    await this.agentService.streamChat(dto.message, dto.model ?? 'llama3.2', res, ctrl.signal);
    res.end();
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/agent/agent.controller.spec.ts --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/agent/agent.controller.ts backend/src/agent/agent.controller.spec.ts
git commit -m "feat: replace AgentController JSON response with SSE streaming"
```

---

## Task 7: Wire AgentModule + Run All Backend Tests

**Files:**
- Modify: `backend/src/agent/agent.module.ts`

- [ ] **Step 1: Add OllamaProvider to AgentModule**

Replace entire content of `backend/src/agent/agent.module.ts`:

```typescript
// backend/src/agent/agent.module.ts
import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';

@Module({
  controllers: [AgentController],
  providers: [AgentService, OllamaProvider],
})
export class AgentModule {}
```

- [ ] **Step 2: Run all backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS. Should show approximately 14 tests across agent/, ollama/, tasks/, and app.controller.spec.ts.

If `app.controller.spec.ts` fails with module-related errors, check that `AgentModule` compiles cleanly — the likely cause is a missing import.

- [ ] **Step 3: Commit**

```bash
git add backend/src/agent/agent.module.ts
git commit -m "chore: wire OllamaProvider into AgentModule"
```

---

## Task 8: Frontend i18n Keys

**Files:**
- Modify: `frontend/src/locales/vi.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add 4 keys to vi.json**

Replace entire content of `frontend/src/locales/vi.json`:

```json
{
  "nav.chat": "Trò chuyện",
  "nav.tasks": "Nhiệm vụ",
  "nav.files": "Tệp tin",
  "nav.settings": "Cài đặt",
  "nav.lang": "VI",
  "chat.header": "AGENT CHAT",
  "chat.mode.stub": "chế độ stub",
  "chat.mode.ollama": "chế độ ollama",
  "chat.placeholder": "nhập lệnh hoặc câu hỏi_",
  "chat.system.init": "Agent đã khởi động. SQLite đã kết nối. Đang ở chế độ stub.",
  "chat.user.prefix": "$ người dùng",
  "chat.agent.prefix": "agent",
  "chat.system.prefix": "[hệ thống]",
  "chat.error.unreachable": "[lỗi] Không kết nối được agent. Backend đang chạy chưa?",
  "chat.loading": "…",
  "chat.model.offline": "ollama offline",
  "chat.stop": "◼ Dừng",
  "chat.thinking": "⟳ đang nghĩ...",
  "artifacts.header": "KẾT QUẢ",
  "artifacts.empty": "Chưa có kết quả",
  "artifacts.label.lastReply": "phản hồi cuối",
  "health.checking": "Đang kiểm tra...",
  "health.ok": "Backend: hoạt động · DB: đã kết nối",
  "health.error": "Không kết nối được backend"
}
```

- [ ] **Step 2: Add 4 keys to en.json**

Replace entire content of `frontend/src/locales/en.json`:

```json
{
  "nav.chat": "Chat",
  "nav.tasks": "Tasks",
  "nav.files": "Files",
  "nav.settings": "Settings",
  "nav.lang": "EN",
  "chat.header": "AGENT CHAT",
  "chat.mode.stub": "stub mode",
  "chat.mode.ollama": "ollama mode",
  "chat.placeholder": "type a command or question_",
  "chat.system.init": "Agent initialized. SQLite connected. Stub mode active.",
  "chat.user.prefix": "$ user",
  "chat.agent.prefix": "agent",
  "chat.system.prefix": "[system]",
  "chat.error.unreachable": "[error] Could not reach agent. Is the backend running?",
  "chat.loading": "…",
  "chat.model.offline": "ollama offline",
  "chat.stop": "◼ Stop",
  "chat.thinking": "⟳ thinking...",
  "artifacts.header": "ARTIFACTS",
  "artifacts.empty": "No artifacts yet",
  "artifacts.label.lastReply": "last reply",
  "health.checking": "Checking backend...",
  "health.ok": "Backend: ok · DB: connected",
  "health.error": "Backend unreachable"
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/vi.json frontend/src/locales/en.json
git commit -m "feat: add i18n keys for Phase 2 chat streaming UI"
```

---

## Task 9: ModelSelector Component

**Files:**
- Create: `frontend/src/components/ModelSelector.vue`

- [ ] **Step 1: Create ModelSelector.vue**

```vue
<!-- frontend/src/components/ModelSelector.vue -->
<template>
  <select
    :value="modelValue"
    :disabled="disabled || models.length === 0"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    class="bg-cyber-dark border border-cyber-border text-xs font-mono text-slate-100 rounded px-2 py-0.5 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
  >
    <option v-if="models.length === 0" value="" disabled>{{ t('chat.model.offline') }}</option>
    <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
  </select>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  models: string[]
  modelValue: string
  disabled: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
</script>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | head -30
```

Expected: Build succeeds (or only pre-existing warnings, no new errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ModelSelector.vue
git commit -m "feat: add ModelSelector component for Ollama model picker"
```

---

## Task 10: ChatPanel Streaming Update

**Files:**
- Modify: `frontend/src/components/ChatPanel.vue` — full rewrite

- [ ] **Step 1: Replace entire ChatPanel.vue**

```vue
<!-- frontend/src/components/ChatPanel.vue -->
<template>
  <div class="flex flex-col bg-cyber-bg min-w-0">
    <div class="px-3 py-2 border-b border-cyber-border bg-cyber-dark flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-cyber-orange text-xs tracking-widest font-mono">
          <HiTerminal class="w-3 h-3 inline" /> {{ t('chat.header') }}
        </span>
        <ModelSelector
          v-model="selectedModel"
          :models="availableModels"
          :disabled="streaming"
        />
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="streaming"
          @click="stopStream"
          class="text-cyber-orange/80 text-xs font-mono border border-cyber-dim rounded px-2 py-0.5 transition-colors duration-150 hover:border-cyber-accent"
        >{{ t('chat.stop') }}</button>
        <span class="text-cyber-orange/40 text-xs font-mono">
          {{ ollamaOnline ? t('chat.mode.ollama') : t('chat.mode.stub') }}
        </span>
      </div>
    </div>

    <div ref="messagesEl" class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
      <div v-for="(msg, i) in messages" :key="i" class="font-mono">
        <div class="text-xs mb-1" :class="roleColor(msg.role)">
          <HiChevronRight v-if="msg.role === 'agent'" class="w-3 h-3 inline" />
          {{ rolePrefix(msg.role) }} · {{ msg.timestamp }}
        </div>
        <div
          class="text-sm leading-relaxed break-words"
          :class="{
            'text-cyber-orange/50': msg.role === 'system',
            'text-slate-100': msg.role === 'user' || msg.role === 'agent',
          }"
        >
          {{ msg.content }}<span v-if="msg.typing" class="animate-blink text-cyber-orange ml-px">█</span>
        </div>
      </div>
    </div>

    <div class="px-3 py-2 border-t border-cyber-border bg-cyber-dark shrink-0">
      <form @submit.prevent="submit" class="flex items-center gap-2 border border-cyber-dim rounded px-3 py-2">
        <span class="text-cyber-orange text-sm font-mono">$</span>
        <input
          v-model="input"
          class="flex-1 bg-transparent text-slate-100 text-sm outline-none font-mono placeholder-cyber-orange/30"
          :placeholder="t('chat.placeholder')"
          :disabled="streaming"
          autocomplete="off"
          spellcheck="false"
        />
        <span v-if="!streaming" class="animate-blink text-cyber-orange text-sm">█</span>
        <span v-else class="text-cyber-orange/50 text-xs">{{ t('chat.thinking') }}</span>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { HiTerminal, HiChevronRight } from 'vue-icons-plus/hi'
import ModelSelector from './ModelSelector.vue'

interface Message {
  role: 'user' | 'agent' | 'system'
  content: string
  timestamp: string
  typing?: boolean
}

const emit = defineEmits<{ lastMessage: [content: string] }>()
const { t } = useI18n()

const messages = ref<Message[]>([
  { role: 'system', content: t('chat.system.init'), timestamp: now() },
])
const input = ref('')
const streaming = ref(false)
const selectedModel = ref(localStorage.getItem('workspace.model') ?? 'llama3.2')
const availableModels = ref<string[]>([])
const ollamaOnline = ref(true)
const abortController = ref<AbortController | null>(null)
const messagesEl = ref<HTMLElement | null>(null)

function now(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false })
}

function rolePrefix(role: string): string {
  if (role === 'user') return t('chat.user.prefix')
  if (role === 'agent') return t('chat.agent.prefix')
  return t('chat.system.prefix')
}

function roleColor(role: string): string {
  if (role === 'user') return 'text-cyber-orange/60'
  if (role === 'agent') return 'text-cyber-orange'
  return 'text-cyber-orange/40'
}

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

onMounted(async () => {
  try {
    const res = await fetch('/api/ollama/models')
    if (!res.ok) throw new Error('fetch failed')
    availableModels.value = (await res.json()) as string[]
  } catch {
    ollamaOnline.value = false
  }
})

watch(selectedModel, (val) => {
  localStorage.setItem('workspace.model', val)
})

function stopStream() {
  abortController.value?.abort()
}

async function submit() {
  const text = input.value.trim()
  if (!text || streaming.value) return
  input.value = ''
  streaming.value = true

  messages.value.push({ role: 'user', content: text, timestamp: now() })
  await scrollToBottom()

  const ctrl = new AbortController()
  abortController.value = ctrl

  const agentMsg: Message = { role: 'agent', content: '', timestamp: now(), typing: true }
  messages.value.push(agentMsg)
  await scrollToBottom()

  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, model: selectedModel.value }),
      signal: ctrl.signal,
    })

    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let done = false

    while (!done) {
      const { done: streamDone, value } = await reader.read()
      if (streamDone) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') { done = true; break }
        try {
          const parsed = JSON.parse(payload) as { token?: string; error?: string }
          if (parsed.error) {
            done = true
            agentMsg.typing = false
            messages.value.push({
              role: 'system',
              content: `${t('chat.error.unreachable')} (${parsed.error})`,
              timestamp: now(),
            })
            await scrollToBottom()
          } else if (parsed.token) {
            agentMsg.content += parsed.token
            await scrollToBottom()
          }
        } catch { /* skip malformed SSE line */ }
      }
    }

    agentMsg.typing = false
    if (agentMsg.content) emit('lastMessage', agentMsg.content)
  } catch (e) {
    agentMsg.typing = false
    if (e instanceof Error && e.name !== 'AbortError') {
      messages.value.push({
        role: 'system',
        content: `${t('chat.error.unreachable')} (${e.message})`,
        timestamp: now(),
      })
      await scrollToBottom()
    }
  } finally {
    streaming.value = false
    abortController.value = null
  }
}
</script>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | head -40
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatPanel.vue
git commit -m "feat: replace ChatPanel stub fetch with SSE streaming, add ModelSelector and stop button"
```

---

## Verification

After all tasks complete, run the full test suite one final time:

```bash
cd backend && npx jest --no-coverage
```

Expected output summary (approximate):
```
Test Suites: 8 passed, 8 total
Tests:       ~18 passed, ~18 total
```

Suites: `app.controller.spec.ts`, `tasks.controller.spec.ts`, `tasks.service.spec.ts`, `agent.controller.spec.ts`, `agent.service.spec.ts`, `ollama.controller.spec.ts`, `ollama.service.spec.ts`, `ollama.provider.spec.ts`.

To manually test end-to-end (requires Ollama running with at least one model):

```bash
# Terminal 1 — start backend
cd backend && npm run start:dev

# Terminal 2 — test models endpoint
curl http://localhost:3001/api/ollama/models

# Terminal 3 — test SSE stream
curl -N -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, who are you?","model":"llama3.2"}'
```

Expected: SSE events `data: {"token":"..."}` stream to terminal, ending with `data: [DONE]`.
