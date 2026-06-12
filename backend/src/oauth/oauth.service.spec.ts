import { Test, TestingModule } from '@nestjs/testing';
import { OAuthService } from './oauth.service';
import { SettingsService } from '../settings/settings.service';

describe('OAuthService', () => {
  let service: OAuthService;
  let settings: jest.Mocked<SettingsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        { provide: SettingsService, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();
    service = module.get<OAuthService>(OAuthService);
    settings = module.get(SettingsService) as jest.Mocked<SettingsService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return null when no config set', async () => {
    settings.get.mockResolvedValue('');
    const config = await service.getConfig();
    expect(config).toBeNull();
  });

  it('should save and retrieve config', async () => {
    const testConfig = { clientId: 'test-id', clientSecret: 'test-secret', redirectUri: 'http://localhost:17135/api/oauth/callback' };
    settings.set.mockResolvedValue(undefined);
    settings.get.mockResolvedValue(JSON.stringify(testConfig));
    await service.saveConfig(testConfig);
    const retrieved = await service.getConfig();
    expect(retrieved?.clientId).toBe('test-id');
  });

  it('should return null when clientId or clientSecret missing', async () => {
    settings.get.mockResolvedValue(JSON.stringify({ redirectUri: 'http://localhost:17135/api/oauth/callback' }));
    const result = await service.getClient();
    expect(result).toBeNull();
  });
});
