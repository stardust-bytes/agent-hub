import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { ExcelService, WriteOperation } from '../excel.service';

@Injectable()
export class WriteExcelExecutor implements ToolExecutor {
  readonly name = 'write_excel';

  constructor(private readonly excel: ExcelService) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const filePath = String(args.path ?? '');
    if (!filePath) return 'Error: "path" is required';
    const ops = args.operations;
    if (!Array.isArray(ops) || ops.length === 0) return 'Error: "operations" must be a non-empty array';
    try {
      await this.excel.validatePath(filePath);
      return this.excel.write(filePath, ops as WriteOperation[]);
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
