import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { IsString } from 'class-validator';
import { SettingsService } from './settings.service';

class UpdateSettingDto {
  @IsString()
  value: string;
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getAll() {
    return this.settingsService.findAll();
  }

  @Patch(':key')
  async updateSettings(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ): Promise<{ ok: boolean; key: string }> {
    await this.settingsService.upsert(key, dto.value);
    return { ok: true, key };
  }
}
