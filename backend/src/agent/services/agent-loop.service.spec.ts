import { Test, TestingModule } from '@nestjs/testing';
import { AgentLoopService } from './agent-loop.service';
import { LLMControllerService } from './llm-controller.service';
import { SessionsService } from '../../sessions/sessions.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { CreateTaskExecutor } from '../../tools/executors/create-task.executor';
import { UpdateTaskExecutor } from '../../tools/executors/update-task.executor';
import { ListTasksExecutor } from '../../tools/executors/list-tasks.executor';
import { GetTaskExecutor } from '../../tools/executors/get-task.executor';
import { DeleteTasksExecutor } from '../../tools/executors/delete-tasks.executor';
import { SearchKnowledgeExecutor } from '../../tools/executors/search-knowledge.executor';
import { WebFetchExecutor } from '../../tools/executors/web-fetch.executor';
import { WebSearchExecutor } from '../../tools/executors/web-search.executor';
import { StreamChunk } from '../providers/llm-provider.interface';
import { Response } from 'express';

function mockRes(): Response {
  return {
    write: jest.fn(() => true),
    end: jest.fn(),
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
  } as any;
}

async function* asyncGen<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

function buildStreamMock(...responses: StreamChunk[][]) {
  const genFns = responses.map((items) => () => asyncGen(items));
  let idx = 0;
  return jest.fn().mockImplementation(() => {
    const fn = genFns[Math.min(idx++, genFns.length - 1)];
    return fn();
  });
}

const DONE: StreamChunk = { type: 'done' };

describe('AgentLoopService', () => {
  let service: AgentLoopService;
  let llmController: LLMControllerService;
  let webFetch: WebFetchExecutor;
  let webSearch: WebSearchExecutor;
  let createTask: CreateTaskExecutor;

  const defaultTools = [
    { type: 'function' as const, function: { name: 'web_search', description: 'Search the web', parameters: {} } },
    { type: 'function' as const, function: { name: 'web_fetch', description: 'Fetch a URL', parameters: {} } },
    { type: 'function' as const, function: { name: 'create_task', description: 'Create a task', parameters: {} } },
  ];
  const defaultConfig = { baseUrl: 'http://localhost:11434' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentLoopService,
        {
          provide: LLMControllerService,
          useValue: {
            stream: jest.fn(),
            buildMessages: jest.fn().mockImplementation(
              (prompt: string, history: any[], msg: string) => [
                { role: 'system', content: prompt },
                ...history,
                { role: 'user', content: msg },
              ],
            ),
          },
        },
        { provide: SessionsService, useValue: { saveMessage: jest.fn().mockResolvedValue(undefined) } },
        { provide: KnowledgeService, useValue: { findAll: jest.fn().mockResolvedValue([]) } },
        { provide: CreateTaskExecutor, useValue: { name: 'create_task', execute: jest.fn() } },
        { provide: UpdateTaskExecutor, useValue: { name: 'update_task', execute: jest.fn() } },
        { provide: ListTasksExecutor, useValue: { name: 'list_tasks', execute: jest.fn() } },
        { provide: GetTaskExecutor, useValue: { name: 'get_task', execute: jest.fn() } },
        { provide: DeleteTasksExecutor, useValue: { name: 'delete_tasks', execute: jest.fn() } },
        { provide: SearchKnowledgeExecutor, useValue: { name: 'search_knowledge', execute: jest.fn() } },
        { provide: WebFetchExecutor, useValue: { name: 'web_fetch', execute: jest.fn() } },
        { provide: WebSearchExecutor, useValue: { name: 'web_search', execute: jest.fn() } },
      ],
    }).compile();

    service = module.get(AgentLoopService);
    llmController = module.get(LLMControllerService);
    webFetch = module.get(WebFetchExecutor);
    webSearch = module.get(WebSearchExecutor);
    createTask = module.get(CreateTaskExecutor);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Basic flow', () => {
    it('Planning → Executing (no tool calls) → Responding → Done', async () => {
      llmController.stream = buildStreamMock(
        [{ type: 'token', token: 'Hello from AI' }, DONE],
      );

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'hi',
        defaultTools, res, signal, undefined, 'agent', defaultConfig,
      );

      expect(result).toBe('Hello from AI');
      expect(llmController.stream).toHaveBeenCalledTimes(1);
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    });
  });

  describe('Tool call flow', () => {
    it('Planning → Executing (tool call) → Evaluating → Executing (next step)', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'web_search', arguments: { q: 'test query' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [{ type: 'token', token: 'Here are the search results' }, DONE],
      );
      (webSearch.execute as jest.Mock).mockResolvedValue('Found relevant results');

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'search for X',
        defaultTools, res, signal, undefined, 'agent', defaultConfig,
      );

      expect(result).toBe('Here are the search results');
      expect(webSearch.execute).toHaveBeenCalledWith({ q: 'test query' });
      expect(res.write).toHaveBeenCalledWith(
        'data: ' + JSON.stringify({ toolCall: { name: 'web_search', args: { q: 'test query' } } }) + '\n\n',
      );
      expect(res.write).toHaveBeenCalledWith(
        'data: ' + JSON.stringify({ toolResult: { name: 'web_search', result: 'Found relevant results' } }) + '\n\n',
      );
      expect(llmController.stream).toHaveBeenCalledTimes(2);
    });
  });

  describe('Self-correction: retry', () => {
    it('retries failed tool and succeeds on second attempt', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'web_fetch', arguments: { url: 'http://example.com' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [toolCall, DONE],
        [{ type: 'token', token: 'Fetched successfully' }, DONE],
      );
      (webFetch.execute as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('Page content');

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'fetch URL',
        defaultTools, res, signal, undefined, 'agent', defaultConfig,
      );

      expect(result).toBe('Fetched successfully');
      expect(webFetch.execute).toHaveBeenCalledTimes(2);
      expect(res.write).toHaveBeenCalledWith(
        'data: ' + JSON.stringify({ thinking: '\u27f3 Retrying (1/2)...' }) + '\n\n',
      );
      expect(llmController.stream).toHaveBeenCalledTimes(3);
    });
  });

  describe('Self-correction: fallback tool', () => {
    it('uses fallback tool when retries exhausted', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'web_fetch', arguments: { url: 'http://example.com' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [{ type: 'token', token: 'Fallback result' }, DONE],
      );
      (webFetch.execute as jest.Mock).mockRejectedValue(new Error('Always fails'));
      (webSearch.execute as jest.Mock).mockResolvedValue('Search fallback');

      const res = mockRes();
      const signal = new AbortController().signal;
      await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'fetch URL',
        defaultTools, res, signal, undefined, 'agent', defaultConfig,
      );

      expect(webFetch.execute).toHaveBeenCalledTimes(3);
      expect(res.write).toHaveBeenCalledWith(
        'data: ' + JSON.stringify({ thinking: '\u27f3 Trying alternative tool: web_search...' }) + '\n\n',
      );
    });
  });

  describe('Self-correction: ask user', () => {
    it('asks user when no fallback is available', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'create_task', arguments: { title: 'test' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [{ type: 'token', token: 'Cannot complete' }, DONE],
      );
      (createTask.execute as jest.Mock).mockRejectedValue(new Error('DB error'));

      const res = mockRes();
      const signal = new AbortController().signal;
      await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'create task',
        defaultTools, res, signal, undefined, 'agent', defaultConfig,
      );

      expect(res.write).toHaveBeenCalledWith(
        'data: ' + JSON.stringify({ thinking: 'Unable to complete after retries. Asking user...' }) + '\n\n',
      );
    });
  });

  describe('Max iterations', () => {
    it('generates a closing message via final LLM call when max iterations hit', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'web_search', arguments: { q: 'test' } },
      };
      llmController.stream = buildStreamMock(
        ...Array(10).fill([toolCall, DONE]),
        [{ type: 'token', token: 'closing message from AI' }, DONE],
      );
      (webSearch.execute as jest.Mock).mockResolvedValue('Succeed');

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'loop',
        defaultTools, res, signal, undefined, 'agent', defaultConfig,
      );

      // 10 loop iterations + 1 closing LLM call = 11 total
      expect(llmController.stream).toHaveBeenCalledTimes(11);
      // Closing message should be appended to the result
      expect(result).toContain('closing message');
      // Verify the thinking event changed
      expect(res.write).toHaveBeenCalledWith(
        'data: ' + JSON.stringify({ thinking: 'Reached max iterations. Generating closing message...' }) + '\n\n',
      );
    });
  });
});
