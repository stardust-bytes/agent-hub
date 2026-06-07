import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KnowledgeService } from './knowledge.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  knowledgeFile: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('KnowledgeService', () => {
  let service: KnowledgeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('./workspace_data') } },
      ],
    }).compile();
    service = module.get<KnowledgeService>(KnowledgeService);
    jest.clearAllMocks();
  });

  it('findAll returns all knowledge files ordered by createdAt desc', async () => {
    const files = [{ id: 1, filename: 'test.md', size: 100, status: 'ready' }];
    mockPrisma.knowledgeFile.findMany.mockResolvedValue(files);
    const result = await service.findAll();
    expect(result).toEqual(files);
    expect(mockPrisma.knowledgeFile.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
  });

  it('remove deletes file record and returns it', async () => {
    const file = { id: 1, filename: 'test.md', filepath: '/tmp/test.md' };
    mockPrisma.knowledgeFile.findUnique.mockResolvedValue(file);
    mockPrisma.knowledgeFile.delete.mockResolvedValue(file);
    const result = await service.remove(1);
    expect(result.id).toBe(1);
  });

  it('remove throws NotFoundException when file not found', async () => {
    mockPrisma.knowledgeFile.findUnique.mockResolvedValue(null);
    await expect(service.remove(999)).rejects.toThrow('not found');
  });
});
