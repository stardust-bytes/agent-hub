import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from './tool-executor.interface';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs/promises';

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

    let filePath: string;

    if (context?.mode === 'agent') {
      const rawPath = (args.path as string) || 'output.txt';
      const filename = rawPath.split(/[\\/]/).pop() || 'output.txt';
      const sessionDir = path.join(
        this.workspace.getWorkspaceRoot(),
        'agent-output',
        `session_${context.sessionId}`,
      );
      filePath = path.join(sessionDir, filename);
      await fs.mkdir(sessionDir, { recursive: true });
    } else {
      filePath = args.path as string;
      if (!filePath) return 'Error: path is required.';
      if (!this.workspace.isPathAllowed(filePath)) return `Error: path "${filePath}" is not allowed.`;
    }

    try {
      const { bytesWritten, resolved } = await this.workspace.writeFile(filePath, content);
      const filename = resolved.split(/[\\/]/).pop() || 'file';
      const workspaceRoot = this.workspace.getWorkspaceRoot();
      if (resolved.startsWith(workspaceRoot)) {
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
