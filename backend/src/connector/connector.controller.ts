import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ConnectorService } from './connector.service';
import { UpsertConnectorDto } from './dto/upsert-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import { OAuthConfirmDto } from './dto/oauth-confirm.dto';
import { GoogleOAuthService } from './providers/google/google-oauth.service';

@Controller('connectors')
export class ConnectorController {
  constructor(
    private readonly connector: ConnectorService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  private getCreds(type: string) {
    const map: Record<string, { clientId: string; clientSecret: string }> = {
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
    return map[type] ?? null;
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
    const creds = this.getCreds(type);
    if (!creds) return { error: 'unknown_type', type };
    const redirectUri = `${process.env.APP_URL ?? 'http://localhost:17135'}/oauth/callback`;
    return { url: this.googleOAuth.getAuthUrl(type, { ...creds, redirectUri }) };
  }

  @Post('oauth/confirm')
  async oauthConfirm(@Body() body: OAuthConfirmDto) {
    const { state, code } = body;
    const type = state;
    const creds = this.getCreds(type);
    if (!creds) return { error: 'unknown_type', state };
    if (!creds.clientId || !creds.clientSecret) {
      return { error: 'missing_credentials', type };
    }
    const redirectUri = `${process.env.APP_URL ?? 'http://localhost:17135'}/oauth/callback`;
    const tokens = await this.googleOAuth.handleCallback(code, { ...creds, redirectUri });
    const names: Record<string, string> = {
      google_gmail: 'Gmail',
      google_calendar: 'Google Calendar',
      google_drive: 'Google Drive',
      google_sheets: 'Google Sheets',
    };
    await this.connector.upsert(type, {
      type,
      name: names[type] ?? type,
      config: { ...creds, redirectUri, tokens },
      enabled: true,
    });
    return { ok: true };
  }
}
