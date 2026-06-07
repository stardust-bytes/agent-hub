import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  setting: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  it('findAll returns merged object with env defaults', async () => {
    mockPrisma.setting.findUnique.mockImplementation(({ where: { key } }: { where: { key: string } }) => {
      if (key === 'ollama.baseUrl') return null;
      if (key === 'ollama.defaultModel') return { key, value: 'codestral' };
      return null;
    });

    const result = await service.findAll();
    expect(result).toEqual({
      ollama: {
        baseUrl: 'http://localhost:11434',
        defaultModel: 'codestral',
      },
    });
  });

  it('upsert creates or updates a setting', async () => {
    mockPrisma.setting.upsert.mockResolvedValue({ key: 'ollama.baseUrl', value: 'http://192.168.1.100:11434' });

    await service.upsert('ollama.baseUrl', 'http://192.168.1.100:11434');

    expect(mockPrisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: 'ollama.baseUrl' },
      update: { value: 'http://192.168.1.100:11434' },
      create: { key: 'ollama.baseUrl', value: 'http://192.168.1.100:11434' },
    });
  });
});
