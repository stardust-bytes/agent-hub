import { Test } from '@nestjs/testing';
import { PlansService } from './plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrisma = {
  plan: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
  },
  planStep: {
    update: jest.fn(),
  },
};

describe('PlansService', () => {
  let service: PlansService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(PlansService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a plan with ordered steps', async () => {
      const planWithSteps = {
        id: 1, sessionId: 5, title: 'My Plan', status: 'PENDING',
        steps: [
          { id: 1, planId: 1, order: 0, text: 'Step A', status: 'TODO' },
          { id: 2, planId: 1, order: 1, text: 'Step B', status: 'TODO' },
        ],
      };
      mockPrisma.plan.create.mockResolvedValue(planWithSteps);

      const result = await service.create(5, 'My Plan', ['Step A', 'Step B']);

      expect(mockPrisma.plan.create).toHaveBeenCalledWith({
        data: {
          sessionId: 5,
          title: 'My Plan',
          steps: {
            create: [
              { order: 0, text: 'Step A' },
              { order: 1, text: 'Step B' },
            ],
          },
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      expect(result).toEqual(planWithSteps);
    });
  });

  describe('findOne', () => {
    it('returns plan with steps', async () => {
      const plan = { id: 1, title: 'Plan', status: 'PENDING', steps: [] };
      mockPrisma.plan.findUnique.mockResolvedValue(plan);

      const result = await service.findOne(1);

      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      expect(result).toEqual(plan);
    });

    it('throws NotFoundException when plan does not exist', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySession', () => {
    it('returns plans ordered by createdAt desc', async () => {
      const plans = [{ id: 2 }, { id: 1 }];
      mockPrisma.plan.findMany.mockResolvedValue(plans);

      const result = await service.findBySession(5);

      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith({
        where: { sessionId: 5 },
        include: { steps: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(plans);
    });
  });

  describe('approve', () => {
    it('sets plan status to APPROVED when plan is PENDING', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({ id: 1, status: 'PENDING' });
      mockPrisma.plan.update.mockResolvedValue({ id: 1, status: 'APPROVED' });

      const result = await service.approve(1);

      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'APPROVED' },
      });
      expect(result.status).toBe('APPROVED');
    });

    it('throws NotFoundException when plan does not exist', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(service.approve(99)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when plan is not PENDING', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({ id: 1, status: 'APPROVED' });

      await expect(service.approve(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('deletes the plan', async () => {
      mockPrisma.plan.delete.mockResolvedValue({ id: 1 });

      await service.reject(1);

      expect(mockPrisma.plan.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('updateStepStatus', () => {
    it('updates step status', async () => {
      mockPrisma.planStep.update.mockResolvedValue({ id: 3, status: 'DONE' });

      const result = await service.updateStepStatus(3, 'DONE');

      expect(mockPrisma.planStep.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { status: 'DONE' },
      });
      expect(result.status).toBe('DONE');
    });
  });

  describe('updateStatus', () => {
    it('updates plan status', async () => {
      mockPrisma.plan.update.mockResolvedValue({ id: 1, status: 'EXECUTING' });

      const result = await service.updateStatus(1, 'EXECUTING');

      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'EXECUTING' },
      });
      expect(result.status).toBe('EXECUTING');
    });
  });

  describe('findNextActionable', () => {
    it('returns found=false when no plans exist', async () => {
      mockPrisma.plan.findFirst.mockResolvedValue(null);
      const result = await service.findNextActionable(1);
      expect(result).toEqual({ found: false });
      expect(mockPrisma.plan.findFirst).toHaveBeenCalledWith({
        where: { sessionId: 1 },
        include: { steps: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns action=approve for PENDING plan', async () => {
      const plan = { id: 1, sessionId: 1, title: 'Test', status: 'PENDING', steps: [{ id: 1, planId: 1, order: 0, text: 'step 1', status: 'TODO' }] };
      mockPrisma.plan.findFirst.mockResolvedValue(plan);
      const result = await service.findNextActionable(1);
      expect(result).toEqual({ found: true, plan, action: 'approve' });
    });

    it('returns action=resume for EXECUTING plan with incomplete steps', async () => {
      const plan = { id: 1, sessionId: 1, title: 'Test', status: 'EXECUTING', steps: [{ id: 1, planId: 1, order: 0, text: 'step 1', status: 'DOING' }] };
      mockPrisma.plan.findFirst.mockResolvedValue(plan);
      const result = await service.findNextActionable(1);
      expect(result).toEqual({ found: true, plan, action: 'resume' });
    });

    it('returns found=false when plan is DONE', async () => {
      const plan = { id: 1, sessionId: 1, title: 'Test', status: 'DONE', steps: [{ id: 1, planId: 1, order: 0, text: 'step 1', status: 'DONE' }] };
      mockPrisma.plan.findFirst.mockResolvedValue(plan);
      const result = await service.findNextActionable(1);
      expect(result).toEqual({ found: false });
    });

    it('returns action=resume for INTERRUPTED plan', async () => {
      const plan = { id: 1, sessionId: 1, title: 'Test', status: 'INTERRUPTED', steps: [{ id: 1, planId: 1, order: 0, text: 'step 1', status: 'DOING' }] };
      mockPrisma.plan.findFirst.mockResolvedValue(plan);
      const result = await service.findNextActionable(1);
      expect(result).toEqual({ found: true, plan, action: 'resume' });
    });

    it('returns found=false when EXECUTING plan has all steps DONE', async () => {
      const plan = { id: 1, sessionId: 1, title: 'Test', status: 'EXECUTING', steps: [{ id: 1, planId: 1, order: 0, text: 'step 1', status: 'DONE' }] };
      mockPrisma.plan.findFirst.mockResolvedValue(plan);
      const result = await service.findNextActionable(1);
      expect(result).toEqual({ found: false });
    });

    it('returns action=resume for APPROVED plan with incomplete steps', async () => {
      const plan = { id: 1, sessionId: 1, title: 'Test', status: 'APPROVED', steps: [{ id: 1, planId: 1, order: 0, text: 'step 1', status: 'TODO' }] };
      mockPrisma.plan.findFirst.mockResolvedValue(plan);
      const result = await service.findNextActionable(1);
      expect(result).toEqual({ found: true, plan, action: 'resume' });
    });

    it('returns action=resume for FAILED plan with incomplete steps', async () => {
      const plan = { id: 1, sessionId: 1, title: 'Test', status: 'FAILED', steps: [{ id: 1, planId: 1, order: 0, text: 'step 1', status: 'TODO' }] };
      mockPrisma.plan.findFirst.mockResolvedValue(plan);
      const result = await service.findNextActionable(1);
      expect(result).toEqual({ found: true, plan, action: 'resume' });
    });
  });

  describe('setInterrupted', () => {
    it('sets plan status to INTERRUPTED', async () => {
      mockPrisma.plan.update.mockResolvedValue({ id: 1, status: 'INTERRUPTED' });
      const result = await service.setInterrupted(1);
      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: 1 }, data: { status: 'INTERRUPTED' },
      });
      expect(result.status).toBe('INTERRUPTED');
    });
  });
});
