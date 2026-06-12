import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ConnectorService } from './connector.service';
import { UpsertConnectorDto } from './dto/upsert-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import { GoogleOAuthService } from './providers/google/google-oauth.service';

@Controller('connectors')
export class ConnectorController {
  constructor(
    private readonly connector: ConnectorService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

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

  @Get('google/auth-url')
  async googleAuthUrl(
    @Query('clientId') clientId: string,
    @Query('clientSecret') clientSecret: string,
    @Query('redirectUri') redirectUri: string,
  ) {
    return { url: this.googleOAuth.getAuthUrl({ clientId, clientSecret, redirectUri }) };
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('clientId') clientId: string,
    @Query('clientSecret') clientSecret: string,
    @Query('redirectUri') redirectUri: string,
  ) {
    const tokens = await this.googleOAuth.handleCallback(code, { clientId, clientSecret, redirectUri });
    await this.connector.upsert('google', {
      type: 'google',
      name: 'Google (Gmail, Calendar, Drive)',
      config: { clientId, clientSecret, redirectUri, tokens },
      enabled: true,
    });
    return { ok: true };
  }
}
