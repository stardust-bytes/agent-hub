import { Test } from '@nestjs/testing';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

const mockService = {
  findBySession: jest.fn(),
  findOne: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
};

describe('PlansController', () => {
  let controller: PlansController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [{ provide: PlansService, useValue: mockService }],
    }).compile();
    controller = module.get(PlansController);
    jest.clearAllMocks();
  });

  it('getBySession delegates to plansService.findBySession', async () => {
    mockService.findBySession.mockResolvedValue([{ id: 1 }]);
    const result = await controller.getBySession(5);
    expect(mockService.findBySession).toHaveBeenCalledWith(5);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('getOne delegates to plansService.findOne', async () => {
    mockService.findOne.mockResolvedValue({ id: 1 });
    const result = await controller.getOne(1);
    expect(mockService.findOne).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1 });
  });

  it('approve delegates to plansService.approve', async () => {
    mockService.approve.mockResolvedValue({ id: 1, status: 'APPROVED' });
    const result = await controller.approve(1);
    expect(mockService.approve).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1, status: 'APPROVED' });
  });

  it('reject delegates to plansService.reject', async () => {
    mockService.reject.mockResolvedValue(undefined);
    await controller.reject(1);
    expect(mockService.reject).toHaveBeenCalledWith(1);
  });
});
