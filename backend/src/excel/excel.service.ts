import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as path from 'path';

export interface ReadExcelOptions {
  sheet?: string;
  range?: string;
}

@Injectable()
export class ExcelService {
  async readSheet(filePath: string, options?: ReadExcelOptions): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheetName = options?.sheet ?? workbook.worksheets[0]?.name;
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      const available = workbook.worksheets.map(s => s.name).join(', ');
      throw new Error(`Sheet "${sheetName}" not found. Available: ${available}`);
    }

    const range = options?.range;
    let rows = sheet.getRows(1, sheet.rowCount) ?? [];

    if (range) {
      const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (match) {
        const startRow = parseInt(match[2], 10);
        const endRow = parseInt(match[4], 10);
        rows = [];
        for (let r = startRow; r <= endRow; r++) {
          const row = sheet.getRow(r);
          if (row.values) rows.push(row);
        }
      }
    }

    const result: string[][] = [];
    for (const row of rows) {
      const values = (row.values as Array<unknown>)?.slice(1) ?? [];
      result.push(values.map(v => String(v ?? '')));
    }

    const markdownRows = result.map(r => `| ${r.join(' | ')} |`);
    return `Sheet "${sheetName}" (${result.length} rows):\n${markdownRows.join('\n')}`;
  }

  async listSheets(filePath: string): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const names = workbook.worksheets.map(s => s.name);
    return `Sheets: ${names.join(', ')}`;
  }

  async addSheet(filePath: string, sheetName: string): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    workbook.addWorksheet(sheetName);
    await workbook.xlsx.writeFile(filePath);
    return `Added sheet "${sheetName}"`;
  }

  async validatePath(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.xlsx') throw new Error(`Invalid extension: ${ext}. Only .xlsx files are supported.`);
  }
}
