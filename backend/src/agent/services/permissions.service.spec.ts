import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from './permissions.service';
import { SettingsService } from '../../settings/settings.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let settingsService: { get: jest.Mock; upsert: jest.Mock };

  beforeEach(async () => {
    settingsService = { get: jest.fn(), upsert: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();
    service = module.get<PermissionsService>(PermissionsService);
  });

  describe('getConfig', () => {
    it('returns default config when setting is empty', async () => {
      settingsService.get.mockResolvedValue('');
      const config = await service.getConfig();
      expect(config).toEqual({ defaultPolicy: 'allow', allowedTools: [], deniedTools: [] });
    });

    it('returns stored config when setting exists', async () => {
      const stored = { defaultPolicy: 'deny', allowedTools: ['list_tasks'], deniedTools: [] };
      settingsService.get.mockResolvedValue(JSON.stringify(stored));
      const config = await service.getConfig();
      expect(config).toEqual(stored);
    });

    it('returns default config when stored JSON is invalid', async () => {
      settingsService.get.mockResolvedValue('not-valid-json');
      const config = await service.getConfig();
      expect(config).toEqual({ defaultPolicy: 'allow', allowedTools: [], deniedTools: [] });
    });
  });

  describe('isAllowed', () => {
    it('allows tool when defaultPolicy is allow and tool is not denied', async () => {
      settingsService.get.mockResolvedValue('');
      expect(await service.isAllowed('create_task')).toBe(true);
    });

    it('denies tool when in deniedTools even if also in allowedTools', async () => {
      settingsService.get.mockResolvedValue(JSON.stringify({
        defaultPolicy: 'allow',
        allowedTools: ['web_fetch'],
        deniedTools: ['web_fetch'],
      }));
      expect(await service.isAllowed('web_fetch')).toBe(false);
    });

    it('allows tool in allowedTools when defaultPolicy is deny', async () => {
      settingsService.get.mockResolvedValue(JSON.stringify({
        defaultPolicy: 'deny',
        allowedTools: ['list_tasks'],
        deniedTools: [],
      }));
      expect(await service.isAllowed('list_tasks')).toBe(true);
    });

    it('denies tool when defaultPolicy is deny and tool not in allowedTools', async () => {
      settingsService.get.mockResolvedValue(JSON.stringify({
        defaultPolicy: 'deny',
        allowedTools: ['list_tasks'],
        deniedTools: [],
      }));
      expect(await service.isAllowed('create_task')).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('merges updates with current config and persists', async () => {
      settingsService.get.mockResolvedValue('');
      settingsService.upsert.mockResolvedValue(undefined);
      const result = await service.updateConfig({ defaultPolicy: 'deny' });
      expect(result).toEqual({ defaultPolicy: 'deny', allowedTools: [], deniedTools: [] });
      expect(settingsService.upsert).toHaveBeenCalledWith(
        'agent.permissions',
        JSON.stringify({ defaultPolicy: 'deny', allowedTools: [], deniedTools: [] }),
      );
    });

    it('merges deniedTools with existing config', async () => {
      const existing = { defaultPolicy: 'allow', allowedTools: [], deniedTools: [] };
      settingsService.get.mockResolvedValue(JSON.stringify(existing));
      settingsService.upsert.mockResolvedValue(undefined);
      const result = await service.updateConfig({ deniedTools: ['web_fetch', 'delete_tasks'] });
      expect(result.deniedTools).toEqual(['web_fetch', 'delete_tasks']);
      expect(result.defaultPolicy).toBe('allow');
    });
  });
});
