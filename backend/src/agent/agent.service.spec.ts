import { Test } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { Response } from 'express';

describe('AgentService', () => {
  let service: AgentService;
  const mockProvider = { streamChat: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: OllamaProvider, useValue: mockProvider },
      ],
    }).compile();
    service = module.get(AgentService);
    jest.clearAllMocks();
  });

  it('streamChat delegates to provider with correct args', async () => {
    const mockRes = {} as Response;
    const signal = new AbortController().signal;

    await service.streamChat('hello', 'llama3.2', mockRes, signal);

    expect(mockProvider.streamChat).toHaveBeenCalledWith('hello', 'llama3.2', mockRes, signal);
  });

  it('streamChat passes chosen model to provider', async () => {
    const mockRes = {} as Response;
    const signal = new AbortController().signal;

    await service.streamChat('test', 'codestral', mockRes, signal);

    expect(mockProvider.streamChat).toHaveBeenCalledWith('test', 'codestral', mockRes, signal);
  });
});
