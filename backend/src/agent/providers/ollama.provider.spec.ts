import { Test } from '@nestjs/testing';
import { OllamaProvider } from './ollama.provider';
import { LLMCallerService, StreamChunk } from '../services/llm-caller.service';
import { ContextBuilderService } from '../services/context-builder.service';
import { TasksService } from '../../tasks/tasks.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { OllamaMessage } from './llm-provider.interface';

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

  const mockTasksService = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
  };

  const mockKnowledgeService = {
    search: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OllamaProvider,
        { provide: LLMCallerService, useValue: mockLLMCaller },
        { provide: ContextBuilderService, useValue: mockContextBuilder },
        { provide: TasksService, useValue: mockTasksService },
        { provide: KnowledgeService, useValue: mockKnowledgeService },
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
    const task = { id: 42, title: 'Test task', status: 'TODO', priority: 1 };
    mockTasksService.create.mockResolvedValue(task);

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
    const tasks = [
      { id: 1, title: 'Task A', status: 'TODO', priority: 0 },
      { id: 2, title: 'Task B', status: 'DONE', priority: 1 },
    ];
    mockTasksService.findAll.mockResolvedValue(tasks);

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

  it('handles search_knowledge results', async () => {
    const chunks = [{ filename: 'doc.md', chunkIndex: 0, text: 'relevant content' }];
    mockKnowledgeService.search.mockResolvedValue(chunks);

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
    mockKnowledgeService.search.mockResolvedValue([]);
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
    mockKnowledgeService.search.mockResolvedValue([]);
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
    mockKnowledgeService.search.mockResolvedValue([
      { filename: 'guide.pdf', chunkIndex: 1, text: 'some content' },
    ]);

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
    mockKnowledgeService.search.mockResolvedValue([]);
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
