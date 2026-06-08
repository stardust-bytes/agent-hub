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

  it('findAll returns empty object', async () => {
    const result = await service.findAll();
    expect(result).toEqual({});
    expect(mockPrisma.setting.findUnique).not.toHaveBeenCalled();
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
