import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { ExcelService } from '../excel.service';

@Injectable()
export class ListExcelSheetsExecutor implements ToolExecutor {
  readonly name = 'list_excel_sheets';

  constructor(private readonly excel: ExcelService) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const filePath = String(args.path ?? '');
    if (!filePath) return 'Error: "path" is required';
    try {
      await this.excel.validatePath(filePath);
      return this.excel.listSheets(filePath);
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
