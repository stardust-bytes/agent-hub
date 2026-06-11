import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { ExcelService } from '../excel.service';

@Injectable()
export class ReadExcelExecutor implements ToolExecutor {
  readonly name = 'read_excel';

  constructor(private readonly excel: ExcelService) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const filePath = String(args.path ?? '');
    if (!filePath) return 'Error: "path" is required';
    try {
      await this.excel.validatePath(filePath);
      const sheet = args.sheet ? String(args.sheet) : undefined;
      const range = args.range ? String(args.range) : undefined;
      return this.excel.readSheet(filePath, { sheet, range });
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
