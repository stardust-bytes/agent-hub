export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type SystemPromptStyle = 'chat' | 'agent' | 'cowork';

export interface ModePolicyEntry {
  enabledTools: '*' | string[];
  deniedTools: string[];
  allowedPaths: string[];
  systemPromptStyle: SystemPromptStyle;
  envContext: string[];
}

export const MODE_POLICY: Record<string, ModePolicyEntry> = {
  chat: {
    enabledTools: ['web_search', 'web_fetch'],
    deniedTools: [],
    allowedPaths: [],
    systemPromptStyle: 'chat',
    envContext: [],
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
      'delegate_parallel',
    ],
    allowedPaths: ['{workspaceRoot}/agent-output'],
    systemPromptStyle: 'agent',
    envContext: ['platform'],
  },
  cowork: {
    enabledTools: '*',
    deniedTools: [
      'create_task',
      'update_task',
      'delete_tasks',
      'convert_note_to_task',
      'search_knowledge',
      'delegate_parallel',
    ],
    allowedPaths: ['{projectPath}'],
    systemPromptStyle: 'cowork',
    envContext: ['platform', 'projectPath'],
  },
};
