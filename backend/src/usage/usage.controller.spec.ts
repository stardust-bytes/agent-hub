import { Test, TestingModule } from '@nestjs/testing';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';

describe('UsageController', () => {
  let controller: UsageController;
  let service: UsageService;

  const mockService = {
    getTotal: jest.fn().mockResolvedValue({
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
      requestCount: 10,
    }),
    getPerSession: jest.fn().mockResolvedValue([
      { sessionId: 1, sessionTitle: 'Chat 1', modelName: 'gpt-4', promptTokens: 200, completionTokens: 100, totalTokens: 300 },
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsageController],
      providers: [{ provide: UsageService, useValue: mockService }],
    }).compile();

    controller = module.get<UsageController>(UsageController);
    service = module.get<UsageService>(UsageService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /api/usage', () => {
    it('should return total usage', async () => {
      const result = await controller.getTotal();
      expect(result.promptTokens).toBe(1000);
      expect(service.getTotal).toHaveBeenCalled();
    });
  });

  describe('GET /api/usage/sessions', () => {
    it('should return per-session breakdown', async () => {
      const result = await controller.getPerSession();
      expect(result.length).toBe(1);
      expect(service.getPerSession).toHaveBeenCalled();
    });
  });
});
