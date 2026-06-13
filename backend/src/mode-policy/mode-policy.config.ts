export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type SystemPromptStyle = 'chat' | 'agent' | 'cowork';

export const PERMISSION_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'dontAsk', 'auto', 'plan'] as const;
export type PermissionMode = typeof PERMISSION_MODES[number];

export interface ModePolicyEntry {
  enabledTools: '*' | string[];
  deniedTools: string[];
  allowedPaths: string[];
  systemPromptStyle: SystemPromptStyle;
  envContext: string[];
  permissionMode: PermissionMode;
}

export const MODE_POLICY: Record<string, ModePolicyEntry> = {
  cowork: {
    enabledTools: '*',
    deniedTools: [
      'search_knowledge',
    ],
    allowedPaths: ['{projectPath}'],
    systemPromptStyle: 'cowork',
    envContext: ['platform', 'projectPath'],
    permissionMode: 'acceptEdits',
  },
};
