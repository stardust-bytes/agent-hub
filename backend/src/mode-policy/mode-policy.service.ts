import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MODE_POLICY, SystemPromptStyle } from './mode-policy.config';
import { ToolDefinition } from '../agent/services/context-builder.service';
import * as path from 'path';

export interface ToolInfo {
  name: string;
  description: string;
  parameters: string;
}

@Injectable()
export class ModePolicyService {
  private readonly workspaceRoot: string;

  constructor(private readonly config: ConfigService) {
    this.workspaceRoot = path.resolve(this.config.get<string>('WORKSPACE_ROOT', './workspace_data'));
  }

  getEnabledTools(mode: string, dbTools: ToolInfo[]): ToolDefinition[] {
    const policy = MODE_POLICY[mode] ?? MODE_POLICY.agent;
    const filtered = policy.enabledTools === '*'
      ? dbTools.filter(t => !policy.deniedTools.includes(t.name))
      : dbTools.filter(t => (policy.enabledTools as string[]).includes(t.name));
    return filtered.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: JSON.parse(t.parameters),
      },
    }));
  }

  isToolAllowed(mode: string, toolName: string): boolean {
    const policy = MODE_POLICY[mode] ?? MODE_POLICY.agent;
    if (policy.enabledTools !== '*' && !(policy.enabledTools as string[]).includes(toolName)) {
      return false;
    }
    return !policy.deniedTools.includes(toolName);
  }

  resolveAllowedPaths(mode: string, projectPath?: string | null): string[] {
    const policy = MODE_POLICY[mode] ?? MODE_POLICY.agent;
    const pp = projectPath ?? '';
    return policy.allowedPaths.map(p =>
      p.replace('{workspaceRoot}', this.workspaceRoot).replace('{projectPath}', pp)
    );
  }

  getSystemPromptStyle(mode: string): SystemPromptStyle {
    return (MODE_POLICY[mode] ?? MODE_POLICY.agent).systemPromptStyle;
  }

  getEnvContext(mode: string): string[] {
    return (MODE_POLICY[mode] ?? MODE_POLICY.agent).envContext;
  }
}
