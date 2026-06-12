import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { OAuthService, GoogleOAuthConfig } from './oauth.service';
import { SettingsService } from '../settings/settings.service';

@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly settings: SettingsService,
  ) {}

  @Get('config')
  async getConfig() {
    return this.oauth.getConfig();
  }

  @Post('config')
  async saveConfig(@Body() body: GoogleOAuthConfig) {
    await this.oauth.saveConfig(body);
    return { ok: true };
  }

  @Get('auth-url')
  async authUrl() {
    const config = await this.oauth.getConfig();
    if (!config) return { error: 'no_config' };
    return { url: this.oauth.getAuthUrl(config) };
  }

  @Get('callback')
  async callback(@Query('code') code: string) {
    const config = await this.oauth.getConfig();
    if (!config || !code) return { error: 'invalid_request' };
    await this.oauth.handleCallback(code, config);
    return { ok: true };
  }
}
