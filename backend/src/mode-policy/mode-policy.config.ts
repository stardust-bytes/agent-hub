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
  chat: {
    enabledTools: ['web_search', 'web_fetch'],
    deniedTools: [],
    allowedPaths: [],
    systemPromptStyle: 'chat',
    envContext: [],
    permissionMode: 'default',
  },
  agent: {
    enabledTools: '*',
    deniedTools: [
      'run_command',
      'read_file',
      'list_directory',
      'grep',
      'glob',
      'resume_plan',
      'create_plan',
      'spawn_subagent', // Only allow in cowork mode where it can be used for delegation, not direct execution
      'delegate',
    ],
    allowedPaths: ['{workspaceRoot}/agent-output'],
    systemPromptStyle: 'agent',
    envContext: ['platform'],
    permissionMode: 'default',
  },
  cowork: {
    enabledTools: '*',
    deniedTools: [
      'create_task',
      'update_task',
      'delete_tasks',
      'convert_note_to_task',
      'search_knowledge',
    ],
    allowedPaths: ['{projectPath}'],
    systemPromptStyle: 'cowork',
    envContext: ['platform', 'projectPath'],
    permissionMode: 'acceptEdits',
  },
};
