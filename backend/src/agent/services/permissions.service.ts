import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { PermissionsConfig, DEFAULT_PERMISSIONS_CONFIG } from '../dto/permissions-config';
import { YoloClassifierService } from './yolo-classifier.service';

export type PermissionDecision =
  | { action: 'allow' }
  | { action: 'deny'; reason: string }
  | { action: 'ask' };

@Injectable()
export class PermissionsService {
  private static readonly SETTING_KEY = 'agent.permissions';

  constructor(
    private readonly settingsService: SettingsService,
    private readonly yoloClassifier: YoloClassifierService,
  ) {}

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

  async decide(
    toolName: string,
    toolInput: string,
    transcript: string,
    sessionId?: number,
  ): Promise<PermissionDecision> {
    const config = await this.getConfig();
    if (config.deniedTools.includes(toolName)) {
      return { action: 'deny', reason: 'Tool denied by configuration' };
    }

    const permissionMode = await this.decidePermissionMode(toolName, toolInput);

    switch (permissionMode) {
      case 'bypassPermissions':
        return { action: 'allow' };

      case 'dontAsk':
        return { action: 'deny', reason: 'Blocked by dontAsk mode' };

      case 'acceptEdits':
        return { action: 'allow' };

      case 'auto':
        return this.handleAutoMode(toolName, toolInput, transcript, sessionId);

      case 'plan':
        if (['create_plan', 'resume_plan'].includes(toolName)) {
          const result = await this.yoloClassifier.evaluate(toolName, toolInput, transcript, sessionId);
          return result.allowed
            ? { action: 'allow' }
            : { action: 'deny', reason: result.reason ?? 'Blocked by classifier' };
        }
        return { action: 'ask' };

      case 'requireApproval':
        return { action: 'ask' };

      default:
        return { action: 'ask' };
    }
  }

  private async handleAutoMode(
    toolName: string,
    toolInput: string,
    transcript: string,
    sessionId?: number,
  ): Promise<PermissionDecision> {
    const result = await this.yoloClassifier.evaluate(toolName, toolInput, transcript, sessionId);
    if (result.allowed) return { action: 'allow' };
    return {
      action: 'deny',
      reason: result.reason ? `YOLO: ${result.reason}` : 'Blocked by YOLO classifier',
    };
  }

  private hasDestructivePatterns(name: string, input: string): boolean {
    const patterns = ['delete', 'remove', 'drop', 'truncate', 'rm ', 'rmdir', 'del '];
    return patterns.some(p => input.toLowerCase().includes(p));
  }

  private async decidePermissionMode(toolName: string, toolInput: string): Promise<string> {
    const config = await this.getConfig();
    if (config.requireApprovalTools.includes(toolName)) return 'requireApproval';
    if (this.hasDestructivePatterns(toolName, toolInput)) return 'requireApproval';
    return config.permissionMode;
  }
}
