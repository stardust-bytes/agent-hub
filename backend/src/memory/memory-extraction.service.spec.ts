import { Test, TestingModule } from '@nestjs/testing';
import { MemoryExtractionService } from './memory-extraction.service';
import { MemoryService } from './memory.service';
import { PrismaService } from '../prisma/prisma.service';

const mockMemoryService = {
  create: jest.fn(),
};

const mockPrisma = {
  session: {
    findUnique: jest.fn(),
  },
  memory: {
    findFirst: jest.fn(),
  },
};

describe('MemoryExtractionService', () => {
  let service: MemoryExtractionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryExtractionService,
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MemoryExtractionService>(MemoryExtractionService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should skip extraction when no messages exist', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: 1, messages: [] });
    await service.extract({ sessionId: 1, providerType: 'ollama', model: 'test', providerConfig: { baseUrl: 'http://localhost:11434' } });
    expect(mockMemoryService.create).not.toHaveBeenCalled();
  });
});
