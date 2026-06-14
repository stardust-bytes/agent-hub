import { Test } from '@nestjs/testing';
import { ConnectorController } from './connector.controller';
import { ConnectorService } from './connector.service';
import { GoogleOAuthService } from './providers/google/google-oauth.service';

let controller: ConnectorController;

const mockConnectorService = {
  upsert: jest.fn().mockResolvedValue({ id: '1', type: 'google_sheets', enabled: true }),
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

  it('oauthConfirm returns ok for valid state and code', async () => {
    const result = await controller.oauthConfirm({ state: 'google_sheets', code: 'auth-code-123' });
    expect(result).toEqual({ ok: true });
    expect(mockGoogleOAuthService.handleCallback).toHaveBeenCalledWith('auth-code-123', {
      clientId: 'test-id',
      clientSecret: 'test-secret',
      redirectUri: 'http://localhost:17135/oauth/callback',
    });
    expect(mockConnectorService.upsert).toHaveBeenCalledWith('google_sheets', {
      type: 'google_sheets',
      name: 'Google Sheets',
      config: expect.objectContaining({ tokens: { access_token: 'abc', refresh_token: 'def', expiry_date: 999 } }),
      enabled: true,
    });
  });

  it('oauthConfirm returns error for unknown type', async () => {
    const result = await controller.oauthConfirm({ state: 'unknown_type', code: 'code' });
    expect(result).toEqual({ error: 'unknown_type', state: 'unknown_type' });
    expect(mockGoogleOAuthService.handleCallback).not.toHaveBeenCalled();
  });

  it('oauthConfirm returns error for missing client credentials', async () => {
    delete process.env.GOOGLE_SHEETS_CLIENT_ID;
    delete process.env.GOOGLE_SHEETS_CLIENT_SECRET;
    const result = await controller.oauthConfirm({ state: 'google_sheets', code: 'code' });
    expect(result).toEqual({ error: 'missing_credentials', type: 'google_sheets' });
    expect(mockGoogleOAuthService.handleCallback).not.toHaveBeenCalled();
    process.env.GOOGLE_SHEETS_CLIENT_ID = 'test-id';
    process.env.GOOGLE_SHEETS_CLIENT_SECRET = 'test-secret';
  });
});
