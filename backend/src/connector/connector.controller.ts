import { Controller, Get, Post, Patch, Delete, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { ConnectorService } from './connector.service';
import { UpsertConnectorDto } from './dto/upsert-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import { OAuthConfirmDto } from './dto/oauth-confirm.dto';
import { GoogleOAuthService, GoogleTokens } from './providers/google/google-oauth.service';

const GOOGLE_TYPES = ['google_gmail', 'google_calendar', 'google_drive', 'google_sheets'] as const;

@Controller('connectors')
export class ConnectorController {
  constructor(
    private readonly connector: ConnectorService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  private getRedirectUri() {
    return `${process.env.APP_URL ?? 'http://localhost:17135'}/oauth/callback`;
  }

  private async getCreds(type: string): Promise<{ clientId: string; clientSecret: string } | null> {
    const connector = await this.connector.findByType(type);
    if (connector) {
      const config = JSON.parse(connector.config);
      if (config.clientId && config.clientSecret) {
        return { clientId: config.clientId, clientSecret: config.clientSecret };
      }
    }
    const envMap: Record<string, { clientId: string; clientSecret: string }> = {
      google_gmail: {
        clientId: process.env.GOOGLE_GMAIL_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_GMAIL_CLIENT_SECRET ?? '',
      },
      google_calendar: {
        clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? '',
      },
      google_drive: {
        clientId: process.env.GOOGLE_DRIVE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? '',
      },
      google_sheets: {
        clientId: process.env.GOOGLE_SHEETS_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_SHEETS_CLIENT_SECRET ?? '',
      },
    };
    const envCreds = envMap[type];
    if (envCreds && envCreds.clientId && envCreds.clientSecret) {
      return envCreds;
    }
    return null;
  }

  @Get()
  async findAll() {
    return this.connector.findAll();
  }

  @Post()
  async upsert(@Body() body: UpsertConnectorDto) {
    return this.connector.upsert(body.type, body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateConnectorDto) {
    return this.connector.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.connector.remove(id);
    return { ok: true };
  }

  @Get('oauth/auth-url')
  async oauthAuthUrl(@Query('type') type: string) {
    const creds = await this.getCreds(type);
    if (!creds) return { error: 'missing_credentials', type };
    return { url: this.googleOAuth.getAuthUrl(type, { ...creds, redirectUri: this.getRedirectUri() }) };
  }

  @Post('oauth/confirm')
  async oauthConfirm(@Body() body: OAuthConfirmDto) {
    const { state, code } = body;
    const type = state;
    const existing = await this.connector.findByType(type);
    if (!existing) return { error: 'missing_credentials', type };
    const existingConfig = JSON.parse(existing.config);
    if (!existingConfig.clientId || !existingConfig.clientSecret) {
      return { error: 'missing_credentials', type };
    }
    const redirectUri = this.getRedirectUri();
    let tokens: GoogleTokens;
    try {
      tokens = await this.googleOAuth.handleCallback(code, { clientId: existingConfig.clientId, clientSecret: existingConfig.clientSecret, redirectUri });
    } catch {
      throw new BadRequestException('oauth_failed');
    }
    await this.connector.update(existing.id, {
      config: { ...existingConfig, redirectUri, tokens },
      enabled: true,
    });
    return { ok: true };
  }

  @Get('google-types')
  async getGoogleTypes() {
    return GOOGLE_TYPES;
  }
}
