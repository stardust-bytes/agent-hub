import { Test } from '@nestjs/testing';
import { OllamaProvider } from './ollama.provider';
import { SettingsService } from '../../settings/settings.service';

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
          provide: SettingsService,
          useValue: { get: jest.fn().mockResolvedValue('http://localhost:11434') },
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

    await provider.streamChat('hi', 'llama3.2', mockRes as any, signal, '');

    expect(mockRes.write).toHaveBeenCalledWith('data: {"token":"Hello"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: {"token":" world"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
  });

  it('writes error event and [DONE] when fetch throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const mockRes = { write: jest.fn() };
    const signal = new AbortController().signal;

    await provider.streamChat('hi', 'llama3.2', mockRes as any, signal, '');

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

    await provider.streamChat('hi', 'llama3.2', mockRes as any, signal, '');

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
    await provider.streamChat('hi', 'llama3.2', mockRes as any, ctrl.signal, '');

    expect(mockRes.write).not.toHaveBeenCalledWith('data: [DONE]\n\n');
  });
});
