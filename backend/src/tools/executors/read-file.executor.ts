import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';

@Injectable()
export class ReadFileExecutor implements ToolExecutor {
  readonly name = 'read_file';

  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = args.path as string | undefined;
    if (!filePath) return 'Error: path is required.';
    if (!this.workspace.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`;
    try {
      const content = await this.workspace.readFile(filePath);
      const maxSize = 100 * 1024;
      if (content.length > maxSize) {
        return content.substring(0, maxSize) + `\n... [truncated ${content.length - maxSize} bytes]`;
      }
      return content;
    } catch (e) {
      return `Error reading file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
