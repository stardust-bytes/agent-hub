import { Test } from '@nestjs/testing';
import { OllamaProvider } from './ollama.provider';
import { SettingsService } from '../../settings/settings.service';
import { TasksService } from '../../tasks/tasks.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { OllamaMessage } from './llm-provider.interface';

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

const userMsg: OllamaMessage = { role: 'user', content: 'hi' };

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  const mockTasksService = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
  };

  const mockKnowledgeService = {
    search: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OllamaProvider,
        {
          provide: SettingsService,
          useValue: { get: jest.fn().mockResolvedValue('http://localhost:11434') },
        },
        { provide: TasksService, useValue: mockTasksService },
        { provide: KnowledgeService, useValue: mockKnowledgeService },
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

    const result = await provider.streamChat([userMsg], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"token":"Hello"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: {"token":" world"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(result.finalText).toBe('Hello world');
  });

  it('writes error event and [DONE] when fetch throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    const result = await provider.streamChat([userMsg], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"error":"ollama_unreachable"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(result.finalText).toBe('');
  });

  it('writes error event when Ollama returns non-ok status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValue({}),
    } as unknown as Response);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    const result = await provider.streamChat([userMsg], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"error":"ollama_error_404"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(result.finalText).toBe('');
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
    await provider.streamChat([userMsg], 'llama3.2', mockRes as any, ctrl.signal);

    expect(mockRes.write).not.toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('executes tool calls and loops back to Ollama', async () => {
    const task = { id: 42, title: 'Test task', status: 'TODO', priority: 1 };
    mockTasksService.create.mockResolvedValue(task);

    const reader = makeReader([
      JSON.stringify({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ function: { name: 'create_task', arguments: '{"title":"Test task","priority":1}' } }],
        },
        done: false,
      }) + '\n',
    ]);

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    } as unknown as Response);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'create a task' }], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolCall":{"name":"create_task","args":{"title":"Test task","priority":1}}}\n\n',
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolResult":{"name":"create_task","result":"Task #42 created: \\"Test task\\""}}\n\n',
    );
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('handles list_tasks with filtered results', async () => {
    const tasks = [
      { id: 1, title: 'Task A', status: 'TODO', priority: 0 },
      { id: 2, title: 'Task B', status: 'DONE', priority: 1 },
    ];
    mockTasksService.findAll.mockResolvedValue(tasks);

    const reader = makeReader([
      JSON.stringify({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ function: { name: 'list_tasks', arguments: '{"status":"TODO"}' } }],
        },
        done: false,
      }) + '\n',
    ]);

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    } as unknown as Response);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'list tasks' }], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolCall":{"name":"list_tasks","args":{"status":"TODO"}}}\n\n',
    );
    const resultCall = mockRes.write.mock.calls.find(
      (c: string[]) => c[0].includes('"toolResult"'),
    );
    expect(resultCall).toBeDefined();
    const resultPayload = JSON.parse(resultCall[0].replace('data: ', '').trim());
    expect(resultPayload.toolResult.name).toBe('list_tasks');
    expect(resultPayload.toolResult.result).toContain('Task A');
    expect(resultPayload.toolResult.result).not.toContain('Task B');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('handles search_knowledge results', async () => {
    const chunks = [{ filename: 'doc.md', chunkIndex: 0, text: 'relevant content' }];
    mockKnowledgeService.search.mockResolvedValue(chunks);

    const reader = makeReader([
      JSON.stringify({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ function: { name: 'search_knowledge', arguments: '{"query":"test"}' } }],
        },
        done: false,
      }) + '\n',
    ]);

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    } as unknown as Response);

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat([{ role: 'user', content: 'search test' }], 'llama3.2', mockRes as any, signal);

    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolCall":{"name":"search_knowledge","args":{"query":"test"}}}\n\n',
    );
    expect(mockRes.write).toHaveBeenCalledWith(
      'data: {"toolResult":{"name":"search_knowledge","result":"[1] Source: \\"doc.md\\", §0\\nrelevant content"}}\n\n',
    );
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });
});
