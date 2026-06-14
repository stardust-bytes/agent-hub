import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { ConnectorService } from '../../connector.service';

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

const SCOPE_MAP: Record<string, string[]> = {
  google_gmail: ['https://mail.google.com/'],
  google_calendar: ['https://www.googleapis.com/auth/calendar'],
  google_drive: ['https://www.googleapis.com/auth/drive'],
  google_sheets: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
};

@Injectable()
export class GoogleOAuthService {
  constructor(private readonly connector: ConnectorService) {}

  private getClient(config: { clientId: string; clientSecret: string; redirectUri: string }) {
    return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  }

  getScopes(type: string): string[] {
    return SCOPE_MAP[type] ?? [];
  }

  getAuthUrl(type: string, config: { clientId: string; clientSecret: string; redirectUri: string }): string {
    const client = this.getClient(config);
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: this.getScopes(type),
      prompt: 'consent',
      state: type,
    });
  }

  async handleCallback(code: string, config: { clientId: string; clientSecret: string; redirectUri: string }): Promise<GoogleTokens> {
    const client = this.getClient(config);
    const { tokens } = await client.getToken(code);
    return tokens as GoogleTokens;
  }

  async getAuthenticatedClient(type: string) {
    const connector = await this.connector.findByType(type);
    if (!connector) return null;
    const parsed = JSON.parse(connector.config);
    const tokens: GoogleTokens = parsed.tokens;
    if (!tokens?.access_token) return null;

    const oauth2 = new google.auth.OAuth2(parsed.clientId, parsed.clientSecret, parsed.redirectUri);
    oauth2.setCredentials(tokens);
    oauth2.on('tokens', async (newTokens) => {
      const current = JSON.parse(connector.config);
      if (newTokens.refresh_token) current.tokens.refresh_token = newTokens.refresh_token;
      current.tokens = { ...current.tokens, ...newTokens };
      await this.connector.update(connector.id, { config: current });
    });

    return oauth2;
  }
}
