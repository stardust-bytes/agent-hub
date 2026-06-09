export interface PermissionsConfig {
  defaultPolicy: 'allow' | 'deny';
  allowedTools: string[];
  deniedTools: string[];
}

export const DEFAULT_PERMISSIONS_CONFIG: PermissionsConfig = {
  defaultPolicy: 'allow',
  allowedTools: [],
  deniedTools: [],
};
