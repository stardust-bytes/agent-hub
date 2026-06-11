import { Test, TestingModule } from '@nestjs/testing';
import { CreatePlanExecutor } from './create-plan.executor';
import { PlansService } from '../../plans/plans.service';

describe('CreatePlanExecutor', () => {
  let executor: CreatePlanExecutor;
  let plansService: jest.Mocked<PlansService>;

  const mockPlan = {
    id: 1, sessionId: 1, title: 'Test', status: 'PENDING',
    createdAt: new Date(), updatedAt: new Date(),
    steps: [
      { id: 1, planId: 1, order: 0, text: 'Step 1', status: 'TODO', updatedAt: new Date() },
      { id: 2, planId: 1, order: 1, text: 'Step 2', status: 'TODO', updatedAt: new Date() },
    ],
  };

  beforeEach(async () => {
    const mock = {
      create: jest.fn(),
      approve: jest.fn(),
    };
    plansService = mock as unknown as jest.Mocked<PlansService>;
    executor = new CreatePlanExecutor(plansService);
  });

  it('returns marker string with plan metadata', async () => {
    plansService.create.mockResolvedValue(mockPlan);
    const result = await executor.execute(
      { title: 'Test', steps: ['Step 1', 'Step 2'], requireApproval: true },
      { mode: 'cowork', sessionId: 1 },
    );
    expect(result).toMatch(/^\[PLAN_CREATED\] id=1 requireApproval=true title="Test"/);
    expect(plansService.create).toHaveBeenCalledWith(1, 'Test', ['Step 1', 'Step 2']);
  });

  it('approves plan when requireApproval is false', async () => {
    plansService.create.mockResolvedValue(mockPlan);
    plansService.approve.mockResolvedValue({ ...mockPlan, status: 'APPROVED' });
    await executor.execute(
      { title: 'Test', steps: ['Step 1'], requireApproval: false },
      { mode: 'cowork', sessionId: 1 },
    );
    expect(plansService.approve).toHaveBeenCalledWith(1);
  });

  it('defaults requireApproval to false (auto-approve)', async () => {
    plansService.create.mockResolvedValue(mockPlan);
    plansService.approve.mockResolvedValue({ ...mockPlan, status: 'APPROVED' });
    const result = await executor.execute(
      { title: 'Test', steps: ['Step 1'] },
      { mode: 'cowork', sessionId: 1 },
    );
    expect(result).toMatch(/requireApproval=false/);
    expect(plansService.approve).toHaveBeenCalledWith(1);
  });

  it('rejects more than 10 steps', async () => {
    const steps = Array.from({ length: 11 }, (_, i) => `Step ${i + 1}`);
    const result = await executor.execute(
      { title: 'Test', steps },
      { mode: 'cowork', sessionId: 1 },
    );
    expect(result).toBe('Error: Maximum 10 steps allowed.');
  });

  it('returns error when sessionId is missing', async () => {
    const result = await executor.execute(
      { title: 'Test', steps: ['Step 1'] },
      undefined,
    );
    expect(result).toBe('Error: sessionId is required.');
  });

  it('returns name as create_plan', () => {
    expect(executor.name).toBe('create_plan');
  });
});
