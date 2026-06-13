import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { ExcelService } from '../excel.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ExcelAddSheetExecutor implements ToolExecutor {
  readonly name = 'excel_add_sheet';

  constructor(
    private readonly excel: ExcelService,
    private readonly workspace: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    let filePath = String(args.path ?? '');
    const sheetName = String(args.sheet_name ?? '');
    if (!filePath || !sheetName) return 'Error: "path" and "sheet_name" are required';

    try {
      await this.excel.validatePath(filePath);

      const result = await this.excel.addSheet(filePath, sheetName);

      return result;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
