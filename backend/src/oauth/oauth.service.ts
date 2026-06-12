import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { google } from 'googleapis';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokens?: { access_token: string; refresh_token: string; expiry_date: number };
}

@Injectable()
export class OAuthService {
  constructor(private readonly settings: SettingsService) {}

  async getConfig(): Promise<GoogleOAuthConfig | null> {
    const raw = await this.settings.get('google.oauth.config', '');
    return raw ? JSON.parse(raw) : null;
  }

  async saveConfig(config: GoogleOAuthConfig): Promise<void> {
    await this.settings.set('google.oauth.config', JSON.stringify(config));
  }

  getAuthUrl(config: GoogleOAuthConfig): string {
    const oauth2 = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
      prompt: 'consent',
    });
  }

  async getClient(): Promise<{ client: Record<string, any>; config: GoogleOAuthConfig } | null> {
    const config = await this.getConfig();
    if (!config || !config.clientId || !config.clientSecret) return null;
    const oauth2 = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    if (config.tokens) {
      oauth2.setCredentials(config.tokens);
      oauth2.on('tokens', async (tokens) => {
        if (tokens.refresh_token) config.tokens!.refresh_token = tokens.refresh_token;
        config.tokens = { ...config.tokens!, ...tokens };
        await this.saveConfig(config);
      });
    }
    return { client: oauth2, config };
  }

  async handleCallback(code: string, config: GoogleOAuthConfig): Promise<void> {
    const oauth2 = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    const { tokens } = await oauth2.getToken(code);
    config.tokens = tokens as any;
    await this.saveConfig(config);
  }
}
