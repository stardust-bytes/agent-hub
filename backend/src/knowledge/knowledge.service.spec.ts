import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KnowledgeService } from './knowledge.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ProvidersService } from '../providers/providers.service';

const mockPrisma = {
  knowledgeFile: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    const env: Record<string, string> = { UPLOAD_DIR: './workspace_data' };
    return env[key] ?? fallback;
  }),
};

const mockSettings = {
  get: jest.fn().mockResolvedValue(''),
};

const mockProviders = {
  findModelWithProvider: jest.fn().mockResolvedValue(null),
};

describe('KnowledgeService', () => {
  let service: KnowledgeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: SettingsService, useValue: mockSettings },
        { provide: ProvidersService, useValue: mockProviders },
      ],
    }).compile();
    service = module.get<KnowledgeService>(KnowledgeService);
    jest.clearAllMocks();
  });

  it('findAll returns all knowledge files', async () => {
    const files = [{ id: 1, filename: 'test.md', size: 100, status: 'ready' }];
    mockPrisma.knowledgeFile.findMany.mockResolvedValue(files);
    const result = await service.findAll();
    expect(result).toEqual(files);
  });

  it('remove deletes file record', async () => {
    const file = { id: 1, filename: 'test.md', filepath: '/tmp/test.md' };
    mockPrisma.knowledgeFile.findUnique.mockResolvedValue(file);
    mockPrisma.knowledgeFile.delete.mockResolvedValue(file);
    const result = await service.remove(1);
    expect(result.id).toBe(1);
  });

  it('remove throws when file not found', async () => {
    mockPrisma.knowledgeFile.findUnique.mockResolvedValue(null);
    await expect(service.remove(999)).rejects.toThrow('not found');
  });

  describe('resolveModelConfig', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('falls back to env vars when settings returns empty', async () => {
      mockSettings.get.mockResolvedValue('');
      const result = await (service as any).resolveModelConfig('embed_model_id', 'EMBED_MODEL');
      expect(mockProviders.findModelWithProvider).not.toHaveBeenCalled();
      expect(result.model).toBe('nomic-embed-text');
      expect(result.baseUrl).toBe('http://localhost:11434');
    });

    it('uses provider model when settings has a valid ID', async () => {
      mockSettings.get.mockResolvedValue('1');
      mockProviders.findModelWithProvider.mockResolvedValue({
        id: 1,
        name: 'custom-embed-model',
        provider: { baseUrl: 'http://custom:11434', key: 'sk-test' },
      });
      const result = await (service as any).resolveModelConfig('embed_model_id', 'EMBED_MODEL');
      expect(mockProviders.findModelWithProvider).toHaveBeenCalledWith(1);
      expect(result.model).toBe('custom-embed-model');
      expect(result.baseUrl).toBe('http://custom:11434');
      expect(result.key).toBe('sk-test');
    });

    it('falls back to env vars when provider model not found', async () => {
      mockSettings.get.mockResolvedValue('999');
      mockProviders.findModelWithProvider.mockResolvedValue(null);
      const result = await (service as any).resolveModelConfig('embed_model_id', 'EMBED_MODEL');
      expect(mockProviders.findModelWithProvider).toHaveBeenCalledWith(999);
      expect(result.model).toBe('nomic-embed-text');
      expect(result.baseUrl).toBe('http://localhost:11434');
    });
  });
});
