import { Test } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { KnowledgeService } from '../knowledge/knowledge.service';

describe('AgentService', () => {
  let service: AgentService;
  const mockProvider = { streamChat: jest.fn().mockResolvedValue(undefined) };
  const mockKnowledge = { search: jest.fn().mockResolvedValue([]) };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: OllamaProvider, useValue: mockProvider },
        { provide: KnowledgeService, useValue: mockKnowledge },
      ],
    }).compile();
    service = module.get(AgentService);
    jest.clearAllMocks();
  });

  it('streamChat delegates to provider with empty context when no knowledge', async () => {
    const mockRes = {} as any;
    const signal = new AbortController().signal;
    await service.streamChat('hello', 'llama3.2', mockRes, signal);
    expect(mockProvider.streamChat).toHaveBeenCalledWith('hello', 'llama3.2', mockRes, signal, '');
  });

  it('streamChat passes context when knowledge returns chunks', async () => {
    mockKnowledge.search.mockResolvedValue([{ filename: 'test.md', text: 'some content' }]);
    const mockRes = {} as any;
    const signal = new AbortController().signal;
    await service.streamChat('hello', 'llama3.2', mockRes, signal);
    expect(mockProvider.streamChat).toHaveBeenCalledWith(
      'hello', 'llama3.2', mockRes, signal,
      expect.stringContaining('test.md')
    );
  });
});
