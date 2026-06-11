import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as path from 'path';

export interface ReadExcelOptions {
  sheet?: string;
  range?: string;
}

export interface WriteOperation {
  type: 'write_cell' | 'write_row' | 'write_column' | 'formula' | 'merge' | 'style' | 'column_width';
  sheet?: string;
  cell?: string;
  value?: unknown;
  values?: unknown[];
  formula?: string;
  range?: string;
  column?: string;
  width?: number;
  style?: CellStyle;
}

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  fontColor?: string;
  fillColor?: string;
  numberFormat?: string;
  border?: boolean;
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

  async write(filePath: string, operations: WriteOperation[]): Promise<string> {
    let workbook: ExcelJS.Workbook;
    let isNew = false;
    try {
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
    } catch {
      workbook = new ExcelJS.Workbook();
      workbook.addWorksheet('Sheet1');
      isNew = true;
    }

    for (const op of operations) {
      const sheetName = op.sheet ?? workbook.worksheets[0]?.name ?? 'Sheet1';
      let sheet = workbook.getWorksheet(sheetName);
      if (!sheet) {
        sheet = workbook.addWorksheet(sheetName);
      }

      const applyStyle = (cell: ExcelJS.Cell, style?: CellStyle) => {
        if (!style) return;
        if (style.bold) cell.font = { ...cell.font, bold: true };
        if (style.italic) cell.font = { ...cell.font, italic: true };
        if (style.fontSize) cell.font = { ...cell.font, size: style.fontSize };
        if (style.fontColor) cell.font = { ...cell.font, color: { argb: style.fontColor } };
        if (style.fillColor) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fillColor } };
        if (style.numberFormat) cell.numFmt = style.numberFormat;
        if (style.border) {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' },
          };
        }
      };

      switch (op.type) {
        case 'write_cell': {
          if (!op.cell) throw new Error('write_cell requires "cell"');
          const cell = sheet.getCell(op.cell);
          cell.value = (op.value ?? null) as ExcelJS.CellValue;
          applyStyle(cell, op.style);
          break;
        }
        case 'write_row': {
          if (!op.cell || !op.values) throw new Error('write_row requires "cell" and "values"');
          const match = op.cell.match(/^([A-Z]+)(\d+)$/);
          if (!match) throw new Error(`Invalid cell: ${op.cell}`);
          const col = match[1].charCodeAt(0) - 65;
          const rowNum = parseInt(match[2], 10);
          const row = sheet.getRow(rowNum);
          (op.values as unknown[]).forEach((val, i) => {
            const cell = row.getCell(col + i + 1);
            cell.value = (val ?? null) as ExcelJS.CellValue;
            applyStyle(cell, op.style);
          });
          break;
        }
        case 'write_column': {
          if (!op.cell || !op.values) throw new Error('write_column requires "cell" and "values"');
          const colMatch = op.cell.match(/^([A-Z]+)(\d+)$/);
          if (!colMatch) throw new Error(`Invalid cell: ${op.cell}`);
          const colLetter = colMatch[1];
          let startRow = parseInt(colMatch[2], 10);
          (op.values as unknown[]).forEach((val, i) => {
            const cell = sheet.getCell(`${colLetter}${startRow + i}`);
            cell.value = (val ?? null) as ExcelJS.CellValue;
            applyStyle(cell, op.style);
          });
          break;
        }
        case 'formula': {
          if (!op.cell || !op.formula) throw new Error('formula requires "cell" and "formula"');
          const fCell = sheet.getCell(op.cell);
          fCell.value = { formula: op.formula };
          applyStyle(fCell, op.style);
          break;
        }
        case 'merge': {
          if (!op.range) throw new Error('merge requires "range"');
          sheet.mergeCells(op.range);
          break;
        }
        case 'style': {
          if (!op.range || !op.style) throw new Error('style requires "range" and "style"');
          const sMatch = op.range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
          if (sMatch) {
            for (let r = parseInt(sMatch[2], 10); r <= parseInt(sMatch[4], 10); r++) {
              const row = sheet.getRow(r);
              const startCol = sMatch[1].charCodeAt(0) - 65;
              const endCol = sMatch[3].charCodeAt(0) - 65;
              for (let c = startCol; c <= endCol; c++) {
                applyStyle(row.getCell(c + 1), op.style);
              }
            }
          }
          break;
        }
        case 'column_width': {
          if (!op.column || !op.width) throw new Error('column_width requires "column" and "width"');
          sheet.getColumn(op.column).width = op.width;
          break;
        }
      }
    }

    await workbook.xlsx.writeFile(filePath);
    return isNew ? `Created ${filePath} with ${operations.length} operation(s)` : `Updated ${filePath} with ${operations.length} operation(s)`;
  }

  async addChart(
    filePath: string, sheetName: string, chartType: string,
    title: string | undefined, dataRange: string, categoriesRange?: string,
  ): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

    const pos = dataRange.split(':')[0] ?? 'A1';
    const cell = sheet.getCell(pos);
    cell.note = {
      texts: [{ text: `Chart: ${chartType}${title ? ` - ${title}` : ''}\nData: ${dataRange}\nCategories: ${categoriesRange ?? 'none'}`, font: { size: 10 } }],
    };

    await workbook.xlsx.writeFile(filePath);
    return `Chart metadata added to "${sheetName}". Chart type: ${chartType}. Note: Full chart rendering requires opening in Excel.`;
  }
}
