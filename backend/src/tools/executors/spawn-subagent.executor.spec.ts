import { Test, TestingModule } from '@nestjs/testing';
import { SpawnSubagentExecutor } from './spawn-subagent.executor';
import { SubagentService } from '../../agent/subagent/subagent.service';

describe('SpawnSubagentExecutor', () => {
  let executor: SpawnSubagentExecutor;
  let subagentService: jest.Mocked<SubagentService>;

  beforeEach(async () => {
    subagentService = { spawn: jest.fn().mockResolvedValue('result') } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpawnSubagentExecutor,
        { provide: SubagentService, useValue: subagentService },
      ],
    }).compile();

    executor = module.get<SpawnSubagentExecutor>(SpawnSubagentExecutor);
  });

  it('should have name "spawn_subagent"', () => {
    expect(executor.name).toBe('spawn_subagent');
  });

  it('should return error if task is missing', async () => {
    const result = await executor.execute({}, { mode: 'agent', sessionId: 1 });
    expect(result).toContain('Error');
  });
});
