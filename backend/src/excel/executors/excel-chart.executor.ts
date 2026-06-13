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
    let filePath = String(args.path ?? '');
    const sheetName = String(args.sheet_name ?? '');
    const chartType = String(args.chart_type ?? '');
    if (!filePath || !sheetName || !chartType) return 'Error: "path", "sheet_name", and "chart_type" are required';

    try {
      await this.excel.validatePath(filePath);

      const title = args.title ? String(args.title) : undefined;
      const dataRange = String(args.data_range ?? '');
      const categoriesRange = args.categories_range ? String(args.categories_range) : undefined;
      const result = await this.excel.addChart(filePath, sheetName, chartType, title, dataRange, categoriesRange);

      return result;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
