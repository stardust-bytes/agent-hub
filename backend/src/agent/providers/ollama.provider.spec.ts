import { Test } from '@nestjs/testing';
import { OllamaProvider } from './ollama.provider';
import { StreamChunk, OllamaMessage } from './llm-provider.interface';

function mockFetch(bodyLines: string[]): void {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const line of bodyLines) {
        controller.enqueue(encoder.encode(line + '\n'));
      }
      controller.close();
    },
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: stream,
  } as unknown as Response);
}

function mockFetchError(status: number, body?: string): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: jest.fn().mockResolvedValue(body ? JSON.parse(body) : {}),
  } as unknown as Response);
}

function mockFetchNetworkError(): void {
  global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
}

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  const messages: OllamaMessage[] = [{ role: 'user', content: 'hi' }];

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [OllamaProvider],
    }).compile();
    provider = module.get(OllamaProvider);
    jest.clearAllMocks();
  });

  it('yields token chunks for each SSE line', async () => {
    mockFetch([
      JSON.stringify({ message: { content: 'Hello' } }),
      JSON.stringify({ message: { content: ' world' } }),
      JSON.stringify({ done: true }),
    ]);

    const gen = provider.stream({
      model: 'llama3.2',
      messages,
      tools: [],
      signal: new AbortController().signal,
      baseUrl: 'http://localhost:11434',
    });

    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({ type: 'token', token: 'Hello' });
    expect(chunks[1]).toEqual({ type: 'token', token: ' world' });
    expect(chunks[2]).toEqual({ type: 'done' });
  });

  it('yields tool_call chunks when present', async () => {
    mockFetch([
      JSON.stringify({
        message: {
          tool_calls: [
            { function: { name: 'create_task', arguments: { title: 'Test' } } },
          ],
        },
      }),
      JSON.stringify({ done: true }),
    ]);

    const gen = provider.stream({
      model: 'llama3.2',
      messages,
      tools: [],
      signal: new AbortController().signal,
      baseUrl: 'http://localhost:11434',
    });

    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);

    expect(chunks[0]).toEqual({
      type: 'tool_call',
      toolCall: { name: 'create_task', arguments: { title: 'Test' } },
    });
    expect(chunks[1]).toEqual({ type: 'done' });
  });

  it('yields error chunk when fetch fails with network error', async () => {
    mockFetchNetworkError();

    const gen = provider.stream({
      model: 'llama3.2',
      messages,
      tools: [],
      signal: new AbortController().signal,
      baseUrl: 'http://localhost:11434',
    });

    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);

    expect(chunks[0]).toEqual({ type: 'error', error: 'ollama_unreachable' });
  });

  it('yields error chunk on non-ok response', async () => {
    mockFetchError(404);

    const gen = provider.stream({
      model: 'llama3.2',
      messages,
      tools: [],
      signal: new AbortController().signal,
      baseUrl: 'http://localhost:11434',
    });

    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);

    expect(chunks[0]).toEqual({ type: 'error', error: 'ollama_error_404' });
  });

  it('aborts early and yields nothing when signal is pre-aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();

    const gen = provider.stream({
      model: 'llama3.2',
      messages,
      tools: [],
      signal: ctrl.signal,
      baseUrl: 'http://localhost:11434',
    });

    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);

    expect(chunks).toHaveLength(0);
  });

  it('includes tools in request body when provided', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + '\n'));
        controller.close();
      },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: stream,
    } as unknown as Response);

    const tools = [{ type: 'function' as const, function: { name: 'create_task', description: 'Create a task', parameters: {} } }];
    await provider.stream({
      model: 'llama3.2',
      messages,
      tools,
      signal: new AbortController().signal,
      baseUrl: 'http://localhost:11434',
    }).next();

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.tools).toEqual(tools);
  });
});
