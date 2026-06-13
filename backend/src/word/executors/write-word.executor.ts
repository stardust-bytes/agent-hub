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

    const filename = rawPath.split(/[\\/]/).pop() || 'file.docx';
    let filePath: string;

    if (context?.projectPath) {
      filePath = path.join(context.projectPath, filename);
    } else {
      const sessionDir = path.join(
        this.workspace.getWorkspaceRoot(),
        'agent-output',
        `session_${context?.sessionId ?? 0}`,
      );
      fs.mkdirSync(sessionDir, { recursive: true });
      filePath = path.join(sessionDir, filename);
    }

    try {
      const result = await this.wordService.write(filePath, content);
      if (!context?.projectPath) {
        const agentFile = await this.prisma.agentFile.create({
          data: { filename, path: filePath, sessionId: context?.sessionId ?? 0 },
        });
        return `Done. [Download "${filename}"](api/files/agent/${agentFile.id}/download)`;
      }
      return result;
    } catch (e) {
      return `Error writing file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
