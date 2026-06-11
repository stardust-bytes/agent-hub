import { Test, TestingModule } from '@nestjs/testing';
import { MemoryService } from './memory.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryGateway } from './memory.gateway';

const mockPrisma = {
  memory: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
  },
};

const mockGateway = {
  emitCreated: jest.fn(),
  emitUpdated: jest.fn(),
  emitDeleted: jest.fn(),
};

describe('MemoryService', () => {
  let service: MemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MemoryGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll should return memories', async () => {
    const memories = [{ id: '1', type: 'USER', title: 'Test', content: 'Hello' }];
    mockPrisma.memory.findMany.mockResolvedValue(memories);
    const result = await service.findAll({});
    expect(result).toEqual(memories);
    expect(mockPrisma.memory.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findAll with type filter should pass type in where', async () => {
    mockPrisma.memory.findMany.mockResolvedValue([]);
    await service.findAll({ type: 'FEEDBACK' });
    expect(mockPrisma.memory.findMany).toHaveBeenCalledWith({
      where: { type: 'FEEDBACK' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('create should emit created event', async () => {
    const dto = { type: 'USER' as const, title: 'Test', content: 'Hello' };
    const created = { id: '1', type: 'USER', title: 'Test', content: 'Hello', metadata: expect.any(String), sessionId: null, agentId: null, createdAt: expect.any(Date), updatedAt: expect.any(Date) };
    mockPrisma.memory.findFirst.mockResolvedValue(null);
    mockPrisma.memory.create.mockResolvedValue(created);
    const result = await service.create(dto);
    expect(result).toBeDefined();
    expect(mockGateway.emitCreated).toHaveBeenCalledWith(created);
    expect(mockPrisma.memory.create).toHaveBeenCalledWith({
      data: {
        type: 'USER',
        title: 'Test',
        content: 'Hello',
        metadata: expect.any(String),
      },
    });
  });

  it('update should throw on missing id', async () => {
    mockPrisma.memory.findUnique.mockResolvedValue(null);
    await expect(service.update('nonexistent', {})).rejects.toThrow('Memory nonexistent not found');
  });

  it('update should emit updated event', async () => {
    const existing = { id: '1', type: 'USER', title: 'Test', content: 'Hello', metadata: null, sessionId: null, agentId: null, createdAt: new Date(), updatedAt: new Date() };
    const updated = { ...existing, title: 'Updated' };
    mockPrisma.memory.findUnique.mockResolvedValue(existing);
    mockPrisma.memory.update.mockResolvedValue(updated);
    const result = await service.update('1', { title: 'Updated' });
    expect(result.title).toBe('Updated');
    expect(mockGateway.emitUpdated).toHaveBeenCalledWith(updated);
  });

  it('remove should emit deleted event', async () => {
    const existing = { id: '1', type: 'USER', title: 'Test', content: 'Hello', metadata: null, sessionId: null, agentId: null, createdAt: new Date(), updatedAt: new Date() };
    mockPrisma.memory.findUnique.mockResolvedValue(existing);
    mockPrisma.memory.delete.mockResolvedValue(existing);
    await service.remove('1');
    expect(mockGateway.emitDeleted).toHaveBeenCalledWith('1');
  });
});
