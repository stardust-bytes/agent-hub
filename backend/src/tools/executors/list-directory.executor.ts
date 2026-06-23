import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';

@Injectable()
export class ListDirectoryExecutor implements ToolExecutor {
  readonly name = 'list_directory';

  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const dirPath = (args.path as string) || context?.projectPath;
    if (!dirPath) return 'Error: path is required. Specify a path or set a project path first.';
    if (!this.workspace.isPathAllowed(dirPath)) {
      const allowed = this.workspace.getAllowedPaths().join(', ');
      return `Error: path "${dirPath}" is not allowed. Allowed paths: ${allowed}`;
    }
    try {
      return await this.workspace.listDirectory(dirPath);
    } catch (e) {
      return `Error listing directory: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
