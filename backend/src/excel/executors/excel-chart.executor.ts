import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { ExcelService } from '../excel.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ExcelChartExecutor implements ToolExecutor {
  readonly name = 'excel_chart';

  constructor(
    private readonly excel: ExcelService,
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const rawPath = String(args.path ?? '');
    const sheetName = String(args.sheet ?? args.sheet_name ?? '');
    const chartType = String(args.type ?? args.chart_type ?? '');
    if (!rawPath || !sheetName || !chartType) return 'Error: "path", "sheet", and "type" are required';

    const filename = rawPath.split(/[\\/]/).pop() || 'file.xlsx';
    let filePath: string;

    if (context?.projectPath) {
      filePath = path.isAbsolute(rawPath) ? rawPath : path.join(context.projectPath, rawPath);
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
      await this.excel.validatePath(filePath);

      const title = args.title ? String(args.title) : undefined;
      const dataRange = String(args.dataRange ?? args.data_range ?? '');
      const categoriesRange = args.categoriesRange ?? args.categories_range ? String(args.categoriesRange ?? args.categories_range ?? '') : undefined;
      const result = await this.excel.addChart(filePath, sheetName, chartType, title, dataRange, categoriesRange);

      if (!context?.projectPath) {
        const agentFile = await this.prisma.agentFile.create({
          data: { filename, path: filePath, sessionId: context?.sessionId ?? 0 },
        });
        return `Done. [Download "${filename}"](api/files/agent/${agentFile.id}/download)`;
      }
      return result;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
