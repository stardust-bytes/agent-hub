import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe('SettingsController', () => {
  let controller: SettingsController;
  const mockService = {
    findAll: jest.fn(),
    upsert: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [{ provide: SettingsService, useValue: mockService }],
    }).compile();
    controller = module.get<SettingsController>(SettingsController);
    jest.clearAllMocks();
  });

  it('getAll returns settings from service', async () => {
    const expected = {};
    mockService.findAll.mockResolvedValue(expected);
    const result = await controller.getAll();
    expect(result).toEqual(expected);
  });

  it('updateSettings calls upsert with correct params', async () => {
    await controller.updateSettings('ollama.baseUrl', { value: 'http://192.168.1.100:11434' });
    expect(mockService.upsert).toHaveBeenCalledWith('ollama.baseUrl', 'http://192.168.1.100:11434');
  });

  it('updateSettings returns success object', async () => {
    const result = await controller.updateSettings('ollama.baseUrl', { value: 'http://x:11434' });
    expect(result).toEqual({ ok: true, key: 'ollama.baseUrl' });
  });
});
