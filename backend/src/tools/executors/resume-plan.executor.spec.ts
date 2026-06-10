import { Test, TestingModule } from '@nestjs/testing';
import { ResumePlanExecutor } from './resume-plan.executor';
import { PlansService } from '../../plans/plans.service';

const mockPlansService = {
  findOne: jest.fn(),
};

describe('ResumePlanExecutor', () => {
  let executor: ResumePlanExecutor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumePlanExecutor,
        { provide: PlansService, useValue: mockPlansService },
      ],
    }).compile();
    executor = module.get<ResumePlanExecutor>(ResumePlanExecutor);
  });

  it('returns error when planId is missing', async () => {
    const result = await executor.execute({});
    expect(result).toBe('Error: planId is required (number)');
  });

  it('returns error for non-existent plan', async () => {
    mockPlansService.findOne.mockRejectedValue(new Error('Not found'));
    const result = await executor.execute({ planId: 999 });
    expect(result).toBe('Error: Plan #999 not found.');
  });

  it('returns status for PENDING plan', async () => {
    mockPlansService.findOne.mockResolvedValue({
      id: 1, title: 'Test Plan', status: 'PENDING',
      steps: [
        { id: 1, status: 'TODO' },
        { id: 2, status: 'TODO' },
      ],
    });
    const result = await executor.execute({ planId: 1 });
    expect(result).toContain('Test Plan');
    expect(result).toContain('PENDING');
    expect(result).toContain('0/2 completed');
    expect(result).toContain('User must approve');
  });

  it('returns status for APPROVED plan', async () => {
    mockPlansService.findOne.mockResolvedValue({
      id: 7, title: 'Approved Plan', status: 'APPROVED',
      steps: [
        { id: 8, status: 'TODO' },
        { id: 9, status: 'TODO' },
      ],
    });
    const result = await executor.execute({ planId: 7 });
    expect(result).toContain('Approved');
    expect(result).toContain('Approved — ready to execute');
  });

  it('returns status for EXECUTING plan with remaining steps', async () => {
    mockPlansService.findOne.mockResolvedValue({
      id: 2, title: 'Running Plan', status: 'EXECUTING',
      steps: [
        { id: 3, status: 'DONE' },
        { id: 4, status: 'DOING' },
      ],
    });
    const result = await executor.execute({ planId: 2 });
    expect(result).toContain('Running Plan');
    expect(result).toContain('1/2 completed');
    expect(result).toContain('1 step(s) remaining');
  });

  it('returns status for DONE plan', async () => {
    mockPlansService.findOne.mockResolvedValue({
      id: 3, title: 'Done Plan', status: 'DONE',
      steps: [
        { id: 5, status: 'DONE' },
        { id: 6, status: 'DONE' },
      ],
    });
    const result = await executor.execute({ planId: 3 });
    expect(result).toContain('Done Plan');
    expect(result).toContain('2/2 completed');
    expect(result).toContain('All steps completed');
  });
});
