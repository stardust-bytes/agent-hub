import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  setting: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
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

  it('findAll returns all settings', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([
      { key: 'embed_model_id', value: '1' },
    ]);
    const result = await service.findAll();
    expect(result).toEqual({ embed_model_id: '1' });
  });

  it('upsert creates or updates a setting', async () => {
    mockPrisma.setting.upsert.mockResolvedValue({ key: 'some.key', value: 'val' });
    await service.upsert('some.key', 'val');
    expect(mockPrisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: 'some.key' },
      update: { value: 'val' },
      create: { key: 'some.key', value: 'val' },
    });
  });
});
