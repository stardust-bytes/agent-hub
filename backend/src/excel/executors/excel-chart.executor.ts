import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { ExcelService } from '../excel.service';

const VALID_CHART_TYPES = ['bar', 'line', 'pie', 'column'];

@Injectable()
export class ExcelChartExecutor implements ToolExecutor {
  readonly name = 'excel_chart';

  constructor(private readonly excel: ExcelService) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const filePath = String(args.path ?? '');
    const sheet = String(args.sheet ?? '');
    const chartType = String(args.type ?? '');
    if (!filePath || !sheet || !chartType) return 'Error: "path", "sheet", and "type" are required';
    if (!VALID_CHART_TYPES.includes(chartType)) return `Error: Invalid chart type "${chartType}". Valid: ${VALID_CHART_TYPES.join(', ')}`;

    const dataRange = String(args.dataRange ?? '');
    if (!dataRange) return 'Error: "dataRange" is required';
    try {
      await this.excel.validatePath(filePath);
      const title = args.title ? String(args.title) : undefined;
      const categoriesRange = args.categoriesRange ? String(args.categoriesRange) : undefined;
      return this.excel.addChart(filePath, sheet, chartType, title, dataRange, categoriesRange);
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
