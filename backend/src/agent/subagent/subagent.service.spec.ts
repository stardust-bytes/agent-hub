import { Test, TestingModule } from '@nestjs/testing';
import { SubagentService } from './subagent.service';
import { AgentLoopService } from '../services/agent-loop.service';

describe('SubagentService', () => {
  let service: SubagentService;
  let agentLoop: jest.Mocked<AgentLoopService>;

  beforeEach(async () => {
    agentLoop = { run: jest.fn().mockResolvedValue('subagent result') } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubagentService,
        { provide: AgentLoopService, useValue: agentLoop },
      ],
    }).compile();

    service = module.get<SubagentService>(SubagentService);
  });

  it('should call AgentLoopService.run with subagent system prompt', async () => {
    const mockRes = { write: jest.fn() };
    await service.spawn(
      'refactor this function',
      'ollama', 'llama3.2',
      { baseUrl: 'http://localhost:11434' },
      [],
      new AbortController().signal,
      mockRes as any,
      1,
    );

    expect(agentLoop.run).toHaveBeenCalledTimes(1);
    const callArgs = agentLoop.run.mock.calls[0];
    expect(callArgs[0]).toBe('ollama');
    expect(callArgs[2]).toContain('refactor this function');
  });

  it('should return the subagent result', async () => {
    agentLoop.run.mockResolvedValue('done: refactored successfully');

    const result = await service.spawn(
      'refactor this function',
      'ollama', 'llama3.2',
      { baseUrl: 'http://localhost:11434' },
      [],
      new AbortController().signal,
      { write: jest.fn() } as any,
      1,
    );

    expect(result).toBe('done: refactored successfully');
  });

  it('should prefix SSE events with subagent:true marker', async () => {
    const writeFn = jest.fn();
    agentLoop.run.mockImplementation(async (_pt, _m, _sp, _h, _um, _t, res: any) => {
      res.write('data: {"token":"hello"}\n\n');
      return 'done';
    });

    await service.spawn(
      'test task',
      'ollama', 'llama3.2',
      { baseUrl: 'http://localhost:11434' },
      [],
      new AbortController().signal,
      { write: writeFn } as any,
      1,
    );

    expect(writeFn).toHaveBeenCalledWith(
      expect.stringContaining('"subagent":true'),
    );
  });
});
