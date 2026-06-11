import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { ExcelService } from '../excel.service';

@Injectable()
export class ExcelAddSheetExecutor implements ToolExecutor {
  readonly name = 'excel_add_sheet';

  constructor(private readonly excel: ExcelService) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const filePath = String(args.path ?? '');
    const sheet = String(args.sheet ?? '');
    if (!filePath || !sheet) return 'Error: "path" and "sheet" are required';
    try {
      await this.excel.validatePath(filePath);
      return this.excel.addSheet(filePath, sheet);
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
