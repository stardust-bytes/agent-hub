import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { WordService } from '../word.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WriteWordExecutor implements ToolExecutor {
  readonly name = 'write_word';

  constructor(
    private readonly wordService: WordService,
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const rawPath = String(args.path ?? '');
    const content = String(args.content ?? '');
    if (!rawPath || !content) return 'Error: "path" and "content" are required';

    let filePath: string;

    if (context?.mode === 'agent') {
      const filename = rawPath.split(/[\\/]/).pop() || 'output.docx';
      const sessionDir = path.join(
        this.workspace.getWorkspaceRoot(),
        'agent-output',
        `session_${context.sessionId}`,
      );
      filePath = path.join(sessionDir, filename);
      fs.mkdirSync(sessionDir, { recursive: true });
    } else {
      filePath = rawPath;
      if (!this.workspace.isPathAllowed(filePath)) {
        return `Error: path "${filePath}" is not allowed.`;
      }
    }

    try {
      const result = await this.wordService.write(filePath, content);
      const filename = filePath.split(/[\\/]/).pop() || 'file.docx';
      if (context?.mode === 'agent') {
        const agentFile = await this.prisma.agentFile.create({
          data: { filename, path: filePath, sessionId: context.sessionId ?? 0 },
        });
        return `${result} [Download "${filename}"](api/files/agent/${agentFile.id}/download)`;
      }
      return result;
    } catch (e) {
      return `Error writing file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
