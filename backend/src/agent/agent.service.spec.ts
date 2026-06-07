import { Test } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { SessionsService } from '../sessions/sessions.service';
import { ContextBuilderService } from './services/context-builder.service';

describe('AgentService', () => {
  let service: AgentService;
  const mockProvider = { streamChat: jest.fn().mockResolvedValue({ finalText: 'Great response' }) };
  const mockSessionsService = {
    getHistory: jest.fn().mockResolvedValue([]),
    saveMessage: jest.fn().mockResolvedValue(undefined),
    autoTitle: jest.fn().mockResolvedValue(undefined),
  };
  const mockContextBuilder = {
    build: jest.fn().mockResolvedValue({
      systemPrompt: 'You are a helpful AI assistant.',
      messages: [],
      tools: [],
    }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: OllamaProvider, useValue: mockProvider },
        { provide: SessionsService, useValue: mockSessionsService },
        { provide: ContextBuilderService, useValue: mockContextBuilder },
      ],
    }).compile();
    service = module.get(AgentService);
    jest.clearAllMocks();
  });

  it('loads history, builds context, calls provider', async () => {
    mockProvider.streamChat.mockResolvedValue({ finalText: 'Hello!' });
    mockSessionsService.getHistory.mockResolvedValue([{ role: 'user', content: 'Hi' }]);
    mockContextBuilder.build.mockResolvedValue({
      systemPrompt: 'Custom system prompt.',
      messages: [],
      tools: [],
    });
    const mockRes = {} as any;
    const signal = new AbortController().signal;

    await service.streamChat('World', 'llama3.2', mockRes, signal, 1);

    expect(mockContextBuilder.build).toHaveBeenCalled();
    expect(mockSessionsService.getHistory).toHaveBeenCalledWith(1);
    expect(mockProvider.streamChat).toHaveBeenCalled();
    const callArgs = mockProvider.streamChat.mock.calls[0];
    expect(callArgs[0]).toEqual(
      expect.arrayContaining([
        { role: 'system', content: 'Custom system prompt.' },
        { role: 'user', content: 'Hi' },
        { role: 'user', content: 'World' },
      ]),
    );
  });

  it('persists user message and assistant response after stream', async () => {
    mockProvider.streamChat.mockResolvedValue({ finalText: 'Hello!' });
    mockSessionsService.getHistory.mockResolvedValue([]);
    const signal = new AbortController().signal;

    await service.streamChat('World', 'llama3.2', {} as any, signal, 1);

    expect(mockSessionsService.saveMessage).toHaveBeenCalledWith(1, 'user', 'World');
    expect(mockSessionsService.saveMessage).toHaveBeenCalledWith(1, 'assistant', 'Hello!');
    expect(mockSessionsService.autoTitle).toHaveBeenCalledWith(1, 'World');
  });

  it('does not persist when signal is aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    mockProvider.streamChat.mockResolvedValue({ finalText: '' });
    mockSessionsService.getHistory.mockResolvedValue([]);

    await service.streamChat('msg', 'llama3.2', {} as any, ctrl.signal, 1);

    expect(mockSessionsService.saveMessage).not.toHaveBeenCalled();
    expect(mockSessionsService.autoTitle).not.toHaveBeenCalled();
  });
});
