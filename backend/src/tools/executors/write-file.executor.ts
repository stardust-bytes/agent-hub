import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WriteFileExecutor implements ToolExecutor {
  readonly name = 'write_file';

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = args.path as string | undefined;
    const content = args.content as string | undefined;
    if (!filePath || content === undefined) return 'Error: path and content are required.';
    if (!this.workspace.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`;
    try {
      const { bytesWritten, resolved } = await this.workspace.writeFile(filePath, content);
      const filename = resolved.split(/[\\/]/).pop() || 'file';
      const workspaceRoot = this.workspace.getWorkspaceRoot();
      if (resolved.startsWith(workspaceRoot)) {
        const agentFile = await this.prisma.agentFile.create({
          data: { filename, path: resolved, sessionId: 0 },
        });
        return `Written ${bytesWritten} bytes. [Download "${filename}"](api/files/agent/${agentFile.id}/download)`;
      }
      return `Written ${bytesWritten} bytes to ${resolved}`;
    } catch (e) {
      return `Error writing file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
