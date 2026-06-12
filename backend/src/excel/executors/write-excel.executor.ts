import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { ExcelService, WriteOperation } from '../excel.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WriteExcelExecutor implements ToolExecutor {
  readonly name = 'write_excel';

  constructor(
    private readonly excel: ExcelService,
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    let filePath = String(args.path ?? '');
    if (!filePath) return 'Error: "path" is required';
    const ops = args.operations;
    if (!Array.isArray(ops) || ops.length === 0) return 'Error: "operations" must be a non-empty array';

    try {
      await this.excel.validatePath(filePath);

      if (context?.mode === 'agent') {
        const filename = filePath.split(/[\\/]/).pop() || 'output.xlsx';
        const sessionDir = path.join(
          this.workspace.getWorkspaceRoot(),
          'agent-output',
          `session_${context.sessionId}`,
        );
        filePath = path.join(sessionDir, filename);
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      const result = await this.excel.write(filePath, ops as WriteOperation[]);

      if (context?.mode === 'agent') {
        const filename = filePath.split(/[\\/]/).pop() || 'file.xlsx';
        const agentFile = await this.prisma.agentFile.create({
          data: { filename, path: filePath, sessionId: context.sessionId ?? 0 },
        });
        return `${result} [Download "${filename}"](api/files/agent/${agentFile.id}/download)`;
      }

      return result;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
