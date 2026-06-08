import { Test, TestingModule } from '@nestjs/testing';
import { ProvidersService } from './providers.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  provider: {
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  providerModel: {
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('ProvidersService', () => {
  let service: ProvidersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvidersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ProvidersService>(ProvidersService);
    jest.clearAllMocks();
  });

  it('findAll returns providers with models', async () => {
    const providers = [{ id: 1, name: 'Local', type: 'ollama', baseUrl: null, key: null, models: [] }];
    mockPrisma.provider.findMany.mockResolvedValue(providers);
    const result = await service.findAll();
    expect(mockPrisma.provider.findMany).toHaveBeenCalledWith({ include: { models: true } });
    expect(result).toEqual(providers);
  });

  it('create stores provider and returns it', async () => {
    const created = { id: 1, name: 'Local', type: 'ollama', baseUrl: null, key: null };
    mockPrisma.provider.create.mockResolvedValue(created);
    const result = await service.create({ name: 'Local', type: 'ollama' });
    expect(mockPrisma.provider.create).toHaveBeenCalledWith({
      data: { name: 'Local', type: 'ollama', baseUrl: undefined, key: undefined },
    });
    expect(result).toEqual(created);
  });

  it('update patches provider and returns it', async () => {
    const updated = { id: 1, name: 'Updated', type: 'ollama', baseUrl: null, key: null };
    mockPrisma.provider.update.mockResolvedValue(updated);
    const result = await service.update(1, { name: 'Updated' });
    expect(mockPrisma.provider.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Updated' },
    });
    expect(result).toEqual(updated);
  });

  it('remove deletes provider', async () => {
    mockPrisma.provider.delete.mockResolvedValue({});
    await service.remove(1);
    expect(mockPrisma.provider.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('addModel creates model linked to provider', async () => {
    const model = { id: 10, providerId: 1, name: 'llama3.2' };
    mockPrisma.providerModel.create.mockResolvedValue(model);
    const result = await service.addModel(1, { name: 'llama3.2' });
    expect(mockPrisma.providerModel.create).toHaveBeenCalledWith({
      data: { providerId: 1, name: 'llama3.2' },
    });
    expect(result).toEqual(model);
  });

  it('removeModel deletes model', async () => {
    mockPrisma.providerModel.delete.mockResolvedValue({});
    await service.removeModel(1, 10);
    expect(mockPrisma.providerModel.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  it('findAllModels returns flat list with providerName', async () => {
    const models = [
      { id: 1, name: 'llama3.2', providerId: 1, provider: { id: 1, name: 'Local' } },
      { id: 2, name: 'gemma2',   providerId: 1, provider: { id: 1, name: 'Local' } },
    ];
    mockPrisma.providerModel.findMany.mockResolvedValue(models);
    const result = await service.findAllModels();
    expect(result).toEqual([
      { id: 1, name: 'llama3.2', providerId: 1, providerName: 'Local' },
      { id: 2, name: 'gemma2',   providerId: 1, providerName: 'Local' },
    ]);
  });

  it('findModelWithProvider returns model with provider or null', async () => {
    const model = { id: 1, name: 'llama3.2', providerId: 1, provider: { id: 1, baseUrl: null, key: null } };
    mockPrisma.providerModel.findUnique.mockResolvedValue(model);
    const result = await service.findModelWithProvider(1);
    expect(mockPrisma.providerModel.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: { provider: true },
    });
    expect(result).toEqual(model);
  });

  it('findModelWithProvider returns null when not found', async () => {
    mockPrisma.providerModel.findUnique.mockResolvedValue(null);
    const result = await service.findModelWithProvider(999);
    expect(result).toBeNull();
  });
});
