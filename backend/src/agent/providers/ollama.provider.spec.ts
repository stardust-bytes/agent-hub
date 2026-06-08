import { Test } from '@nestjs/testing';
import { OllamaProvider } from './ollama.provider';
import { LLMCallerService, StreamChunk } from '../services/llm-caller.service';
import { ContextBuilderService } from '../services/context-builder.service';
import { SessionsService } from '../../sessions/sessions.service';
import { OllamaMessage } from './llm-provider.interface';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { CreateTaskExecutor } from '../../tools/executors/create-task.executor';
import { UpdateTaskExecutor } from '../../tools/executors/update-task.executor';
import { ListTasksExecutor } from '../../tools/executors/list-tasks.executor';
import { GetTaskExecutor } from '../../tools/executors/get-task.executor';
import { DeleteTasksExecutor } from '../../tools/executors/delete-tasks.executor';
import { SearchKnowledgeExecutor } from '../../tools/executors/search-knowledge.executor';
import { WebFetchExecutor } from '../../tools/executors/web-fetch.executor';
import { WebSearchExecutor } from '../../tools/executors/web-search.executor';
import { ToolExecutor } from '../../tools/executors/tool-executor.interface';

async function* makeStream(chunks: StreamChunk[]): AsyncGenerator<StreamChunk, void, unknown> {
  for (const c of chunks) {
    yield c;
  }
}

const userMsg: OllamaMessage = { role: 'user', content: 'hi' };

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  const mockLLMCaller = {
    streamChat: jest.fn(),
  };

  const mockContextBuilder = {
    build: jest.fn().mockResolvedValue({
      systemPrompt: 'You are a helpful AI assistant.',
      messages: [],
      tools: [],
    }),
  };

  const mockSessionsService = {
    saveMessage: jest.fn().mockResolvedValue(undefined),
  };

  const mockKnowledgeService = {
    search: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
  };

  const mockExecutors = {
    create_task: { name: 'create_task', execute: jest.fn().mockResolvedValue('') },
    update_task: { name: 'update_task', execute: jest.fn().mockResolvedValue('') },
    list_tasks: { name: 'list_tasks', execute: jest.fn().mockResolvedValue('') },
    get_task: { name: 'get_task', execute: jest.fn().mockResolvedValue('') },
    delete_tasks: { name: 'delete_tasks', execute: jest.fn().mockResolvedValue('') },
    search_knowledge: { name: 'search_knowledge', execute: jest.fn().mockResolvedValue('') },
    web_fetch: { name: 'web_fetch', execute: jest.fn().mockResolvedValue('') },
    web_search: { name: 'web_search', execute: jest.fn().mockResolvedValue('') },
  };

  function mockExecutor(name: string) {
    return mockExecutors[name];
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OllamaProvider,
        { provide: LLMCallerService, useValue: mockLLMCaller },
        { provide: ContextBuilderService, useValue: mockContextBuilder },
        { provide: SessionsService, useValue: mockSessionsService },
        { provide: KnowledgeService, useValue: mockKnowledgeService },
        { provide: CreateTaskExecutor, useValue: mockExecutor('create_task') },
        { provide: UpdateTaskExecutor, useValue: mockExecutor('update_task') },
        { provide: ListTasksExecutor, useValue: mockExecutor('list_tasks') },
        { provide: GetTaskExecutor, useValue: mockExecutor('get_task') },
        { provide: DeleteTasksExecutor, useValue: mockExecutor('delete_tasks') },
        { provide: SearchKnowledgeExecutor, useValue: mockExecutor('search_knowledge') },
        { provide: WebFetchExecutor, useValue: mockExecutor('web_fetch') },
        { provide: WebSearchExecutor, useValue: mockExecutor('web_search') },
      ],
    }).compile();
    provider = module.get(OllamaProvider);
    jest.clearAllMocks();
  });

  it('writes token events for each LLM token chunk', async () => {
    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      { type: 'token', token: 'Hello' },
      { type: 'token', token: ' world' },
      { type: 'done' },
    ]));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    const result = await provider.streamChat([userMsg], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"token":"Hello"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: {"token":" world"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(result.finalText).toBe('Hello world');
  });

  it('writes error event and [DONE] when LLM returns error chunk', async () => {
    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      { type: 'error', error: 'ollama_unreachable' },
    ]));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    const result = await provider.streamChat([userMsg], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"error":"ollama_unreachable"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(result.finalText).toBe('');
  });

  it('writes error event when LLM returns non-ollama error', async () => {
    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      { type: 'error', error: 'ollama_error_404' },
    ]));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([userMsg], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"error":"ollama_error_404"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('stops writing when signal is aborted', async () => {
    const ctrl = new AbortController();
    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      { type: 'token', token: 'Hi' },
    ]));

    const mockRes = { write: jest.fn() };
    ctrl.abort();
    await provider.streamChat([userMsg], 'llama3.2', mockRes as any, ctrl.signal);

    expect(mockRes.write).not.toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('executes tool calls and loops back to LLM', async () => {
    mockExecutors['create_task'].execute.mockResolvedValue('Task #42 created: "Test task"');

    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      {
        type: 'tool_call',
        toolCall: { name: 'create_task', arguments: { title: 'Test task', priority: 1 } },
      },
      { type: 'done' },
    ]));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'create a task' }], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolCall":{"name":"create_task","args":{"title":"Test task","priority":1}}}\n\n',
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('"toolResult"'),
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('Task #42 created'),
    );
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('handles list_tasks with filtered results', async () => {
    mockExecutors['list_tasks'].execute.mockResolvedValue(
      '#1 Task A [TODO] (priority: 0)'
    );

    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      {
        type: 'tool_call',
        toolCall: { name: 'list_tasks', arguments: { status: 'TODO' } },
      },
      { type: 'done' },
    ]));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'list tasks' }], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolCall":{"name":"list_tasks","args":{"status":"TODO"}}}\n\n',
    );
    const resultCalls = mockRes.write.mock.calls
      .map((c: string[]) => c[0])
      .filter((c: string) => c.includes('"toolResult"'));
    expect(resultCalls.length).toBeGreaterThan(0);
    const lastResult = resultCalls[resultCalls.length - 1];
    expect(lastResult).toContain('Task A');
    expect(lastResult).not.toContain('Task B');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('get_task returns task details', async () => {
    mockExecutors['get_task'].execute.mockResolvedValue(
      'Task #5: "My Task" [TODO] priority=1 description="A test task" due='
    );

    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      {
        type: 'tool_call',
        toolCall: { name: 'get_task', arguments: { id: 5 } },
      },
      { type: 'done' },
    ]));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'show task 5' }], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('"toolResult"'),
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('#5'),
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('My Task'),
    );
  });

  it('delete_tasks deletes multiple tasks', async () => {
    mockExecutors['delete_tasks'].execute.mockResolvedValue('Deleted 3 task(s): #1, #2, #3');

    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      {
        type: 'tool_call',
        toolCall: { name: 'delete_tasks', arguments: { ids: [1, 2, 3] } },
      },
      { type: 'done' },
    ]));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'delete tasks 1,2,3' }], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 3'),
    );
  });

  it('saves tool call and result messages during execution', async () => {
    mockExecutors['get_task'].execute.mockResolvedValue(
      'Task #10: "Test" [TODO] priority=0 description="" due='
    );

    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      {
        type: 'tool_call',
        toolCall: { name: 'get_task', arguments: { id: 10 } },
      },
      { type: 'done' },
    ]));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat(
      [{ role: 'user', content: 'show task 10' }],
      'llama3.2',
      mockRes as any,
      signal,
      1,
    );

    expect(mockSessionsService.saveMessage).toHaveBeenCalled();
  });

  it('handles search_knowledge results', async () => {
    mockExecutors['search_knowledge'].execute.mockResolvedValue(
      '[1] Source: "doc.md", §0\nrelevant content'
    );

    mockLLMCaller.streamChat.mockReturnValue(makeStream([
      {
        type: 'tool_call',
        toolCall: { name: 'search_knowledge', arguments: { query: 'test' } },
      },
      { type: 'done' },
    ]));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'search test' }], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolCall":{"name":"search_knowledge","args":{"query":"test"}}}\n\n',
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringMatching(/toolResult.*doc\.md.*§0/),
    );
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('injects thinking event after search_knowledge and continues loop', async () => {
    const chunks = [{ filename: 'guide.pdf', chunkIndex: 2, text: 'important info' }];
    mockKnowledgeService.search.mockResolvedValue(chunks);

    const stream1 = makeStream([
      {
        type: 'tool_call',
        toolCall: { name: 'search_knowledge', arguments: { query: 'guide' } },
      },
      { type: 'done' },
    ]);

    const stream2 = makeStream([
      { type: 'token', token: 'According to [Source: "guide.pdf", §2], important info.' },
      { type: 'done' },
    ]);

    mockLLMCaller.streamChat
      .mockReturnValueOnce(stream1)
      .mockReturnValueOnce(stream2);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    const result = await provider.streamChat(
      [{ role: 'user', content: 'tell me about guide' }],
      'llama3.2',
      mockRes as any,
      signal,
    );

    expect(mockLLMCaller.streamChat).toHaveBeenCalledTimes(2);
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('Synthesizing search results'),
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"token":"According to [Source: \\"guide.pdf\\", §2], important info."}\n\n',
    );
    expect(result.finalText).toBe('According to [Source: "guide.pdf", §2], important info.');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('injects no-results prompt with file list when KB search is empty and files exist', async () => {
    mockExecutors['search_knowledge'].execute.mockResolvedValue('No relevant information found in knowledge base.');
    mockKnowledgeService.findAll.mockResolvedValue([
      { id: 1, filename: 'report.pdf' },
      { id: 2, filename: 'handbook.docx' },
    ]);

    const stream1 = makeStream([
      { type: 'tool_call', toolCall: { name: 'search_knowledge', arguments: { query: 'annual report' } } },
      { type: 'done' },
    ]);
    const stream2 = makeStream([
      { type: 'token', token: 'I could not find that in your KB.' },
      { type: 'done' },
    ]);
    mockLLMCaller.streamChat.mockReturnValueOnce(stream1).mockReturnValueOnce(stream2);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;
    await provider.streamChat(
      [{ role: 'user', content: 'annual report?' }],
      'llama3.2',
      mockRes as any,
      signal,
    );

    expect(mockLLMCaller.streamChat).toHaveBeenCalledTimes(2);
    const secondCallMessages = mockLLMCaller.streamChat.mock.calls[1][1] as Array<{ role: string; content: string }>;
    const injected = secondCallMessages.find(m => m.content.includes('no results'));
    expect(injected).toBeDefined();
    expect(injected!.content).toContain('"report.pdf"');
    expect(injected!.content).toContain('"handbook.docx"');
  });

  it('injects "none indexed yet" when KB is empty and no files are indexed', async () => {
    mockExecutors['search_knowledge'].execute.mockResolvedValue('No relevant information found in knowledge base.');
    mockKnowledgeService.findAll.mockResolvedValue([]);

    const stream1 = makeStream([
      { type: 'tool_call', toolCall: { name: 'search_knowledge', arguments: { query: 'anything' } } },
      { type: 'done' },
    ]);
    const stream2 = makeStream([
      { type: 'token', token: 'No documents found.' },
      { type: 'done' },
    ]);
    mockLLMCaller.streamChat.mockReturnValueOnce(stream1).mockReturnValueOnce(stream2);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;
    await provider.streamChat(
      [{ role: 'user', content: 'test' }],
      'llama3.2',
      mockRes as any,
      signal,
    );

    const secondCallMessages = mockLLMCaller.streamChat.mock.calls[1][1] as Array<{ role: string; content: string }>;
    const injected = secondCallMessages.find(m => m.content.includes('no results'));
    expect(injected).toBeDefined();
    expect(injected!.content).toContain('none indexed yet');
  });

  it('uses synthesis prompt when KB search returns results (no regression)', async () => {
    mockExecutors['search_knowledge'].execute.mockResolvedValue(
      '[1] Source: "guide.pdf", §1\nsome content'
    );

    const stream1 = makeStream([
      { type: 'tool_call', toolCall: { name: 'search_knowledge', arguments: { query: 'guide' } } },
      { type: 'done' },
    ]);
    const stream2 = makeStream([
      { type: 'token', token: 'Based on guide.pdf...' },
      { type: 'done' },
    ]);
    mockLLMCaller.streamChat.mockReturnValueOnce(stream1).mockReturnValueOnce(stream2);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;
    await provider.streamChat(
      [{ role: 'user', content: 'guide?' }],
      'llama3.2',
      mockRes as any,
      signal,
    );

    const secondCallMessages = mockLLMCaller.streamChat.mock.calls[1][1] as Array<{ role: string; content: string }>;
    const injected = secondCallMessages.find(m => m.content.includes('inline citations'));
    expect(injected).toBeDefined();
    expect(mockKnowledgeService.findAll).not.toHaveBeenCalled();
  });

  it('falls back gracefully when findAll throws during KB empty handling', async () => {
    mockExecutors['search_knowledge'].execute.mockResolvedValue('No relevant information found in knowledge base.');
    mockKnowledgeService.findAll.mockRejectedValue(new Error('DB error'));

    const stream1 = makeStream([
      { type: 'tool_call', toolCall: { name: 'search_knowledge', arguments: { query: 'x' } } },
      { type: 'done' },
    ]);
    const stream2 = makeStream([
      { type: 'token', token: 'Sorry, I cannot find that.' },
      { type: 'done' },
    ]);
    mockLLMCaller.streamChat.mockReturnValueOnce(stream1).mockReturnValueOnce(stream2);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await expect(
      provider.streamChat([{ role: 'user', content: 'x' }], 'llama3.2', mockRes as any, signal),
    ).resolves.not.toThrow();

    const secondCallMessages = mockLLMCaller.streamChat.mock.calls[1][1] as Array<{ role: string; content: string }>;
    const injected = secondCallMessages.find(m => m.content.includes('no results'));
    expect(injected).toBeDefined();
  });
});
