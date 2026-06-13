import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';

@Injectable()
export class WriteFileExecutor implements ToolExecutor {
  readonly name = 'write_file';

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const content = args.content as string | undefined;
    if (content === undefined) return 'Error: path and content are required.';

    const rawPath = (args.path as string) || 'output.txt';
    const filename = rawPath.split(/[\\/]/).pop() || 'file';
    let filePath: string;

    if (context?.projectPath) {
      filePath = path.join(context.projectPath, filename);
    } else {
      const sessionDir = path.join(
        this.workspace.getWorkspaceRoot(),
        'agent-output',
        `session_${context?.sessionId ?? 0}`,
      );
      filePath = path.join(sessionDir, filename);
    }

    try {
      const { bytesWritten, resolved } = await this.workspace.writeFile(filePath, content);
      if (!context?.projectPath) {
        const agentFile = await this.prisma.agentFile.create({
          data: { filename, path: resolved, sessionId: context?.sessionId ?? 0 },
        });
        return `Written ${bytesWritten} bytes. [Download "${filename}"](api/files/agent/${agentFile.id}/download)`;
      }
      return `Written ${bytesWritten} bytes to ${resolved}`;
    } catch (e) {
      return `Error writing file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
