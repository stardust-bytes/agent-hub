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
import { CreateNoteExecutor } from '../../tools/executors/create-note.executor';
import { UpdateNoteExecutor } from '../../tools/executors/update-note.executor';
import { ListNotesExecutor } from '../../tools/executors/list-notes.executor';
import { DeleteNoteExecutor } from '../../tools/executors/delete-note.executor';
import { ConvertNoteToTaskExecutor } from '../../tools/executors/convert-note-to-task.executor';
import { WriteFileExecutor } from '../../tools/executors/write-file.executor';
import { ReadFileExecutor } from '../../tools/executors/read-file.executor';
import { ListDirectoryExecutor } from '../../tools/executors/list-directory.executor';
import { RunCommandExecutor } from '../../tools/executors/run-command.executor';
import { PermissionsService } from './permissions.service';
import { PlansService } from '../../plans/plans.service';
import { McpService } from '../mcp/mcp.service';
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
  let sessionsService: SessionsService;
  let webFetch: WebFetchExecutor;
  let webSearch: WebSearchExecutor;
  let createTask: CreateTaskExecutor;
  let permissionsService: { isAllowed: jest.Mock };
  let plansService: typeof mockPlansService;

  const defaultTools = [
    { type: 'function' as const, function: { name: 'web_search', description: 'Search the web', parameters: {} } },
    { type: 'function' as const, function: { name: 'web_fetch', description: 'Fetch a URL', parameters: {} } },
    { type: 'function' as const, function: { name: 'create_task', description: 'Create a task', parameters: {} } },
  ];
  const defaultConfig = { baseUrl: 'http://localhost:11434' };

  const mockPlansService = {
    create: jest.fn(),
    findOne: jest.fn(),
    updateStepStatus: jest.fn(),
    updateStatus: jest.fn(),
  };

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
        { provide: CreateNoteExecutor, useValue: { name: 'create_note', execute: jest.fn() } },
        { provide: UpdateNoteExecutor, useValue: { name: 'update_note', execute: jest.fn() } },
        { provide: ListNotesExecutor, useValue: { name: 'list_notes', execute: jest.fn() } },
        { provide: DeleteNoteExecutor, useValue: { name: 'delete_note', execute: jest.fn() } },
        { provide: ConvertNoteToTaskExecutor, useValue: { name: 'convert_note_to_task', execute: jest.fn() } },
        { provide: WriteFileExecutor, useValue: { name: 'write_file', execute: jest.fn() } },
        { provide: ReadFileExecutor, useValue: { name: 'read_file', execute: jest.fn() } },
        { provide: ListDirectoryExecutor, useValue: { name: 'list_directory', execute: jest.fn() } },
        { provide: RunCommandExecutor, useValue: { name: 'run_command', execute: jest.fn() } },
        { provide: PermissionsService, useValue: { isAllowed: jest.fn().mockResolvedValue(true) } },
        { provide: PlansService, useValue: mockPlansService },
        { provide: McpService, useValue: { tryExecute: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = module.get(AgentLoopService);
    llmController = module.get(LLMControllerService);
    sessionsService = module.get(SessionsService);
    webFetch = module.get(WebFetchExecutor);
    webSearch = module.get(WebSearchExecutor);
    createTask = module.get(CreateTaskExecutor);
    permissionsService = module.get(PermissionsService);
    plansService = module.get(PlansService);
    jest.clearAllMocks();
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
      const closeToken: StreamChunk = {
        type: 'token',
        token: 'I tried searching but could not find the results you wanted. Would you like to try a different approach?',
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [toolCall, DONE],
        [closeToken, DONE],
      );
      (webSearch.execute as jest.Mock).mockResolvedValue('Succeed');

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'loop',
        defaultTools, res, signal, 1, 'agent', defaultConfig,
      );

      // 10 loop iterations + 1 closing LLM call = 11 total
      expect(llmController.stream).toHaveBeenCalledTimes(11);
      // Closing message should be appended to the result
      expect(result).toContain('Would you like to try a different approach');
      // Verify the thinking event changed
      expect(res.write).toHaveBeenCalledWith(
        'data: ' + JSON.stringify({ thinking: 'Reached max iterations. Generating closing message...' }) + '\n\n',
      );
      expect(sessionsService.saveMessage).toHaveBeenCalledWith(
        1, 'assistant', 'I tried searching but could not find the results you wanted. Would you like to try a different approach?',
      );
    });
  });

  describe('Permissions', () => {
    it('skips denied tool and emits denial toolResult', async () => {
      const toolCall: StreamChunk = {
        type: 'tool_call',
        toolCall: { name: 'web_fetch', arguments: { url: 'http://example.com' } },
      };
      llmController.stream = buildStreamMock(
        [toolCall, DONE],
        [{ type: 'token', token: 'I cannot fetch that URL' }, DONE],
      );
      permissionsService.isAllowed.mockImplementation(async (name: string) => name !== 'web_fetch');

      const res = mockRes();
      const signal = new AbortController().signal;
      const result = await service.run(
        'ollama', 'llama3', 'You are helpful', [], 'fetch URL',
        defaultTools, res, signal, undefined, 'agent', defaultConfig,
      );

      expect(webFetch.execute).not.toHaveBeenCalled();
      expect(res.write).toHaveBeenCalledWith(
        'data: ' + JSON.stringify({ toolResult: { name: 'web_fetch', result: 'Tool "web_fetch" is not permitted by workspace policy.' } }) + '\n\n',
      );
      expect(result).toBe('I cannot fetch that URL');
    });
  });

  describe('runPlanMode', () => {
    const planConfig = { baseUrl: 'http://localhost:11434' };

    it('emits thinking event, then plan event, then DONE', async () => {
      const res = mockRes();
      const planJson = JSON.stringify({ title: 'Test Plan', steps: ['Do A', 'Do B'] });
      (llmController.stream as jest.Mock) = buildStreamMock([
        { type: 'token', token: planJson },
        DONE,
      ]);
      const createdPlan = {
        id: 42,
        title: 'Test Plan',
        status: 'PENDING',
        steps: [
          { id: 1, planId: 42, order: 0, text: 'Do A', status: 'TODO' },
          { id: 2, planId: 42, order: 1, text: 'Do B', status: 'TODO' },
        ],
      };
      mockPlansService.create.mockResolvedValue(createdPlan);

      await service.runPlanMode('Do A and B', 'ollama', 'llama3.2', planConfig, 1, res);

      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"thinking"')
      );
      expect(mockPlansService.create).toHaveBeenCalledWith(1, 'Test Plan', ['Do A', 'Do B']);
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"plan"')
      );
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    });

    it('emits error event when LLM returns non-JSON', async () => {
      const res = mockRes();
      (llmController.stream as jest.Mock) = buildStreamMock([
        { type: 'token', token: 'not valid json here' },
        DONE,
      ]);

      await service.runPlanMode('task', 'ollama', 'llama3.2', planConfig, 1, res);

      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"error"')
      );
      expect(mockPlansService.create).not.toHaveBeenCalled();
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    });
  });

  describe('executePlan', () => {
    const planConfig = { baseUrl: 'http://localhost:11434' };
    const tools = [
      { type: 'function' as const, function: { name: 'list_tasks', description: 'List', parameters: {} } },
    ];

    it('executes each step and emits planStepUpdate DOING then DONE', async () => {
      const res = mockRes();
      const plan = {
        id: 7,
        title: 'My Plan',
        status: 'APPROVED',
        steps: [
          { id: 10, planId: 7, order: 0, text: 'Step one', status: 'TODO' },
          { id: 11, planId: 7, order: 1, text: 'Step two', status: 'TODO' },
        ],
      };
      mockPlansService.findOne.mockResolvedValue(plan);
      mockPlansService.updateStatus.mockResolvedValue({ ...plan, status: 'EXECUTING' });
      mockPlansService.updateStepStatus.mockResolvedValue({ id: 10, status: 'DOING' });

      (llmController.stream as jest.Mock) = buildStreamMock(
        [{ type: 'token', token: 'Done step 1' }, DONE],
        [{ type: 'token', token: 'Done step 2' }, DONE],
      );

      await service.executePlan(7, 'ollama', 'llama3.2', 'System prompt', tools, planConfig, res);

      expect(mockPlansService.updateStatus).toHaveBeenCalledWith(7, 'EXECUTING');

      const writeCalls = (res.write as jest.Mock).mock.calls.map(c => c[0] as string);
      const doingCalls = writeCalls.filter(s => s.includes('"DOING"'));
      const doneCalls = writeCalls.filter(s => s.includes('"DONE"'));
      expect(doingCalls.length).toBe(2);
      expect(doneCalls.length).toBe(2);

      expect(writeCalls[writeCalls.length - 1]).toBe('data: [DONE]\n\n');
    });

    it('saves LLM response as assistant message for each step', async () => {
      const res = mockRes();
      const plan = {
        id: 7, title: 'My Plan', status: 'APPROVED',
        steps: [
          { id: 10, planId: 7, order: 0, text: 'Step one', status: 'TODO' },
        ],
      };
      mockPlansService.findOne.mockResolvedValue(plan);
      mockPlansService.updateStatus.mockResolvedValue({ ...plan, status: 'EXECUTING' });
      mockPlansService.updateStepStatus.mockResolvedValue({});

      (llmController.stream as jest.Mock) = buildStreamMock(
        [{ type: 'token', token: 'Response text from LLM' }, DONE],
      );

      await service.executePlan(7, 'ollama', 'llama3.2', 'System prompt', tools, planConfig, res, 1);

      expect(sessionsService.saveMessage).toHaveBeenCalledWith(1, 'assistant', 'Response text from LLM');
    });

    it('marks step FAILED and continues when LLM stream emits error', async () => {
      const res = mockRes();
      const plan = {
        id: 7,
        title: 'Plan',
        status: 'APPROVED',
        steps: [
          { id: 10, planId: 7, order: 0, text: 'Failing step', status: 'TODO' },
          { id: 11, planId: 7, order: 1, text: 'Good step', status: 'TODO' },
        ],
      };
      mockPlansService.findOne.mockResolvedValue(plan);
      mockPlansService.updateStatus.mockResolvedValue({});
      mockPlansService.updateStepStatus.mockResolvedValue({});

      (llmController.stream as jest.Mock) = buildStreamMock(
        [{ type: 'error', error: 'LLM error' }, DONE],
        [{ type: 'token', token: 'Step 2 OK' }, DONE],
      );

      await service.executePlan(7, 'ollama', 'llama3.2', 'System', tools, planConfig, res);

      const writeCalls = (res.write as jest.Mock).mock.calls.map(c => c[0] as string);
      const failedCalls = writeCalls.filter(s => s.includes('"FAILED"'));
      expect(failedCalls.length).toBeGreaterThanOrEqual(1);
      expect(writeCalls[writeCalls.length - 1]).toBe('data: [DONE]\n\n');
    });
  });
});
