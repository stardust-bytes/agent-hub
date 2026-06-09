import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { PermissionsConfig, DEFAULT_PERMISSIONS_CONFIG } from '../dto/permissions-config';

@Injectable()
export class PermissionsService {
  private static readonly SETTING_KEY = 'agent.permissions';

  constructor(private readonly settingsService: SettingsService) {}

  async getConfig(): Promise<PermissionsConfig> {
    const raw = await this.settingsService.get(PermissionsService.SETTING_KEY, '');
    if (!raw) return { ...DEFAULT_PERMISSIONS_CONFIG };
    try {
      return JSON.parse(raw) as PermissionsConfig;
    } catch {
      return { ...DEFAULT_PERMISSIONS_CONFIG };
    }
  }

  async updateConfig(updates: Partial<PermissionsConfig>): Promise<PermissionsConfig> {
    const current = await this.getConfig();
    const updated = { ...current, ...updates };
    await this.settingsService.upsert(PermissionsService.SETTING_KEY, JSON.stringify(updated));
    return updated;
  }

  async isAllowed(toolName: string): Promise<boolean> {
    const config = await this.getConfig();
    if (config.deniedTools.includes(toolName)) return false;
    if (config.allowedTools.includes(toolName)) return true;
    return config.defaultPolicy === 'allow';
  }
}
