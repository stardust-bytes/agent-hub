import { Test } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { AgentLoopService } from './services/agent-loop.service';
import { SessionsService } from '../sessions/sessions.service';
import { ContextBuilderService } from './services/context-builder.service';
import { ProvidersService } from '../providers/providers.service';

describe('AgentService', () => {
  let service: AgentService;
  const mockAgentLoop = {
    run: jest.fn().mockResolvedValue('Great response'),
  };
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
  const mockProvidersService = {
    findModelWithProvider: jest.fn().mockResolvedValue({
      id: 5,
      name: 'llama3.2',
      providerId: 1,
      provider: { id: 1, name: 'Local', type: 'ollama', baseUrl: 'http://localhost:11434', key: null },
    }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: AgentLoopService, useValue: mockAgentLoop },
        { provide: SessionsService, useValue: mockSessionsService },
        { provide: ContextBuilderService, useValue: mockContextBuilder },
        { provide: ProvidersService, useValue: mockProvidersService },
      ],
    }).compile();
    service = module.get(AgentService);
    jest.clearAllMocks();
  });

  it('resolves provider model and calls AgentLoopService with correct config', async () => {
    mockAgentLoop.run.mockResolvedValue('Hello!');
    mockSessionsService.getHistory.mockResolvedValue([{ role: 'user', content: 'Hi' }]);
    mockContextBuilder.build.mockResolvedValue({
      systemPrompt: 'Custom system prompt.',
      messages: [],
      tools: [],
    });
    mockProvidersService.findModelWithProvider.mockResolvedValue({
      id: 5, name: 'llama3.2', providerId: 1,
      provider: { id: 1, baseUrl: 'http://localhost:11434', key: null },
    });
    const mockRes = {} as any;
    const signal = new AbortController().signal;

    await service.streamChat('World', 5, mockRes, signal, 1);

    expect(mockProvidersService.findModelWithProvider).toHaveBeenCalledWith(5);
    expect(mockAgentLoop.run).toHaveBeenCalled();
    const callArgs = mockAgentLoop.run.mock.calls[0];
    expect(callArgs[1]).toBe('llama3.2');
    expect(callArgs[10]).toEqual({ baseUrl: 'http://localhost:11434', key: undefined });
  });

  it('writes provider_not_found error when providerModelId does not exist', async () => {
    mockProvidersService.findModelWithProvider.mockResolvedValueOnce(null);
    const mockRes = { write: jest.fn() } as any;
    const signal = new AbortController().signal;

    await service.streamChat('World', 999, mockRes, signal, 1);

    expect(mockRes.write).toHaveBeenCalledWith('data: {"error":"provider_not_found"}\n\n');
    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(mockAgentLoop.run).not.toHaveBeenCalled();
  });

  it('persists user message and assistant response after stream', async () => {
    mockAgentLoop.run.mockResolvedValue('Hello!');
    const signal = new AbortController().signal;

    await service.streamChat('World', 5, { write: jest.fn() } as any, signal, 1);

    expect(mockSessionsService.saveMessage).toHaveBeenCalledWith(1, 'user', 'World');
    expect(mockSessionsService.saveMessage).toHaveBeenCalledWith(1, 'assistant', 'Hello!');
    expect(mockSessionsService.autoTitle).toHaveBeenCalledWith(1, 'World');
  });

  it('does not persist when signal is aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    mockAgentLoop.run.mockResolvedValue('');

    await service.streamChat('msg', 5, { write: jest.fn() } as any, ctrl.signal, 1);

    expect(mockSessionsService.saveMessage).not.toHaveBeenCalled();
    expect(mockSessionsService.autoTitle).not.toHaveBeenCalled();
  });
});
