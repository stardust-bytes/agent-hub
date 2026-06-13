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

      const result = await this.excel.write(filePath, ops as WriteOperation[]);

      return result;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
