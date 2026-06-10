import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';

@Injectable()
export class ListDirectoryExecutor implements ToolExecutor {
  readonly name = 'list_directory';

  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const dirPath = (args.path as string) || '.';
    if (!this.workspace.isPathAllowed(dirPath)) return `Error: path "${dirPath}" is not allowed.`;
    try {
      return await this.workspace.listDirectory(dirPath);
    } catch (e) {
      return `Error listing directory: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
