import { Test } from '@nestjs/testing';
import { ConnectorController } from './connector.controller';
import { ConnectorService } from './connector.service';
import { GoogleOAuthService } from './providers/google/google-oauth.service';

let controller: ConnectorController;

const mockConnectorService = {
  upsert: jest.fn().mockResolvedValue({ id: '1', type: 'google_sheets', enabled: true }),
  findByType: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue({ id: '1', type: 'google_sheets', enabled: true }),
  findAll: jest.fn().mockResolvedValue([]),
  findById: jest.fn(),
  remove: jest.fn(),
};

const mockGoogleOAuthService = {
  getAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?state=google_sheets&...'),
  handleCallback: jest.fn().mockResolvedValue({ access_token: 'abc', refresh_token: 'def', expiry_date: 999 }),
};

describe('ConnectorController', () => {
  beforeAll(() => {
    process.env.GOOGLE_SHEETS_CLIENT_ID = 'test-id';
    process.env.GOOGLE_SHEETS_CLIENT_SECRET = 'test-secret';
  });

  afterAll(() => {
    delete process.env.GOOGLE_SHEETS_CLIENT_ID;
    delete process.env.GOOGLE_SHEETS_CLIENT_SECRET;
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ConnectorController],
      providers: [
        { provide: ConnectorService, useValue: mockConnectorService },
        { provide: GoogleOAuthService, useValue: mockGoogleOAuthService },
      ],
    }).compile();
    controller = module.get<ConnectorController>(ConnectorController);
    jest.clearAllMocks();
  });

  it('oauthConfirm returns ok when connector exists with stored creds', async () => {
    mockConnectorService.findByType.mockResolvedValueOnce({
      id: '1', type: 'google_sheets',
      config: JSON.stringify({ clientId: 'stored-id', clientSecret: 'stored-secret' }),
      enabled: false,
    });
    const result = await controller.oauthConfirm({ state: 'google_sheets', code: 'auth-code-123' });
    expect(result).toEqual({ ok: true });
    expect(mockGoogleOAuthService.handleCallback).toHaveBeenCalledWith('auth-code-123', {
      clientId: 'stored-id',
      clientSecret: 'stored-secret',
      redirectUri: 'http://localhost:17135/oauth/callback',
    });
    expect(mockConnectorService.update).toHaveBeenCalledWith('1', {
      config: expect.objectContaining({ clientId: 'stored-id', clientSecret: 'stored-secret', tokens: { access_token: 'abc', refresh_token: 'def', expiry_date: 999 } }),
      enabled: true,
    });
  });

  it('oauthConfirm returns error when connector does not exist in DB', async () => {
    mockConnectorService.findByType.mockResolvedValue(null);
    const result = await controller.oauthConfirm({ state: 'unknown_type', code: 'code' });
    expect(result).toEqual({ error: 'missing_credentials', type: 'unknown_type' });
    expect(mockGoogleOAuthService.handleCallback).not.toHaveBeenCalled();
  });

  it('oauthConfirm returns error when stored config lacks clientId/clientSecret', async () => {
    mockConnectorService.findByType.mockResolvedValueOnce({
      id: '2', type: 'google_sheets',
      config: '{}',
      enabled: false,
    });
    const result = await controller.oauthConfirm({ state: 'google_sheets', code: 'code' });
    expect(result).toEqual({ error: 'missing_credentials', type: 'google_sheets' });
    expect(mockGoogleOAuthService.handleCallback).not.toHaveBeenCalled();
  });

  it('oauthAuthUrl falls back to env vars when no DB connector exists', async () => {
    mockConnectorService.findByType.mockResolvedValue(null);
    const result = await controller.oauthAuthUrl('google_sheets');
    expect(result).toEqual({ url: expect.stringContaining('accounts.google.com') });
    expect(mockGoogleOAuthService.getAuthUrl).toHaveBeenCalledWith('google_sheets', {
      clientId: 'test-id',
      clientSecret: 'test-secret',
      redirectUri: 'http://localhost:17135/oauth/callback',
    });
  });

  it('oauthAuthUrl uses DB stored creds when available', async () => {
    mockConnectorService.findByType.mockResolvedValueOnce({
      id: '1', type: 'google_sheets',
      config: JSON.stringify({ clientId: 'db-id', clientSecret: 'db-secret' }),
      enabled: false,
    });
    const result = await controller.oauthAuthUrl('google_sheets');
    expect(result).toEqual({ url: expect.stringContaining('accounts.google.com') });
    expect(mockGoogleOAuthService.getAuthUrl).toHaveBeenCalledWith('google_sheets', {
      clientId: 'db-id',
      clientSecret: 'db-secret',
      redirectUri: 'http://localhost:17135/oauth/callback',
    });
  });
});
