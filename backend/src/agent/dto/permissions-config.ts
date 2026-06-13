export interface PermissionsConfig {
  defaultPolicy: 'allow' | 'deny';
  allowedTools: string[];
  deniedTools: string[];
  permissionMode: string;
  requireApprovalTools: string[];
}

export const DEFAULT_PERMISSIONS_CONFIG: PermissionsConfig = {
  defaultPolicy: 'allow',
  allowedTools: [],
  deniedTools: [],
  permissionMode: 'default',
  requireApprovalTools: ['run_command'],
};
