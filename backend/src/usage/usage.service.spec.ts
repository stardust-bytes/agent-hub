import { Test, TestingModule } from '@nestjs/testing';
import { UsageService } from './usage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsageDto } from './dto/create-usage.dto';

describe('UsageService', () => {
  let service: UsageService;
  let prisma: PrismaService;

  const mockPrisma = {
    usageRecord: {
      create: jest.fn().mockResolvedValue({
        id: 1,
        sessionId: 1,
        modelName: 'gpt-4',
        providerType: 'openai',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        createdAt: new Date(),
      }),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
        _count: { id: 10 },
      }),
      groupBy: jest.fn().mockResolvedValue([
        { sessionId: 1, modelName: 'gpt-4', _sum: { promptTokens: 200, completionTokens: 100, totalTokens: 300 } },
      ]),
    },
    session: {
      findMany: jest.fn().mockResolvedValue([{ id: 1, title: 'Chat 1' }]),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsageService>(UsageService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('record', () => {
    it('should create a usage record', async () => {
      const dto: CreateUsageDto = {
        sessionId: 1,
        modelName: 'gpt-4',
        providerType: 'openai',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      };
      const result = await service.record(dto);
      expect(result.promptTokens).toBe(100);
      expect(prisma.usageRecord.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('getTotal', () => {
    it('should return aggregated totals', async () => {
      const result = await service.getTotal();
      expect(result.promptTokens).toBe(1000);
      expect(result.completionTokens).toBe(500);
      expect(result.totalTokens).toBe(1500);
      expect(result.requestCount).toBe(10);
    });

    it('should handle empty DB with null aggregates', async () => {
      mockPrisma.usageRecord.aggregate.mockResolvedValueOnce({
        _sum: { promptTokens: null, completionTokens: null, totalTokens: null },
        _count: { id: 0 },
      });
      const result = await service.getTotal();
      expect(result.promptTokens).toBe(0);
      expect(result.completionTokens).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.requestCount).toBe(0);
    });
  });

  describe('getPerSession', () => {
    it('should return per-session breakdown with session titles', async () => {
      const result = await service.getPerSession();
      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('sessionId', 1);
      expect(result[0]).toHaveProperty('sessionTitle', 'Chat 1');
      expect(result[0]).toHaveProperty('promptTokens', 200);
      expect(result[0]).toHaveProperty('completionTokens', 100);
      expect(result[0]).toHaveProperty('totalTokens', 300);
    });
  });
});
