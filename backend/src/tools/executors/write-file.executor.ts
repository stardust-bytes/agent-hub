import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';

@Injectable()
export class WriteFileExecutor implements ToolExecutor {
  readonly name = 'write_file';

  constructor(private readonly workspace: WorkspaceService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = args.path as string | undefined;
    const content = args.content as string | undefined;
    if (!filePath || content === undefined) return 'Error: path and content are required.';
    if (!this.workspace.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`;
    try {
      const { bytesWritten, resolved } = await this.workspace.writeFile(filePath, content);
      return `Written ${bytesWritten} bytes to ${resolved}`;
    } catch (e) {
      return `Error writing file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
