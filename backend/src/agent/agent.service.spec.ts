import { Test } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { SessionsService } from '../sessions/sessions.service';

describe('AgentService', () => {
  let service: AgentService;
  const mockProvider = { streamChat: jest.fn().mockResolvedValue({ finalText: 'Great response' }) };
  const mockSessionsService = {
    getHistory: jest.fn().mockResolvedValue([]),
    saveMessage: jest.fn().mockResolvedValue(undefined),
    autoTitle: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: OllamaProvider, useValue: mockProvider },
        { provide: SessionsService, useValue: mockSessionsService },
      ],
    }).compile();
    service = module.get(AgentService);
    jest.clearAllMocks();
  });

  it('loads history, builds messages array, calls provider', async () => {
    mockProvider.streamChat.mockResolvedValue({ finalText: 'Hello!' });
    mockSessionsService.getHistory.mockResolvedValue([{ role: 'user', content: 'Hi' }]);
    const mockRes = {} as any;
    const signal = new AbortController().signal;

    await service.streamChat('World', 'llama3.2', mockRes, signal, 1);

    expect(mockSessionsService.getHistory).toHaveBeenCalledWith(1);
    expect(mockProvider.streamChat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Hi' }, { role: 'user', content: 'World' }],
      'llama3.2',
      mockRes,
      signal,
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
