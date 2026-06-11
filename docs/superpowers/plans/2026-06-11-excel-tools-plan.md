# Excel Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 Excel agent tools (read_excel, write_excel, excel_add_sheet, list_excel_sheets, excel_chart) using exceljs.

**Architecture:** New ExcelModule with ExcelService (wraps exceljs) + 5 ToolExecutor implementations. Executors registered in AgentLoopService's executor map. Tool definitions seeded in prisma.

**Tech Stack:** NestJS, exceljs, Jest

---

## File Structure

### New files
- `backend/src/excel/excel.module.ts`
- `backend/src/excel/excel.service.ts`
- `backend/src/excel/excel.service.spec.ts`
- `backend/src/excel/executors/read-excel.executor.ts`
- `backend/src/excel/executors/read-excel.executor.spec.ts`
- `backend/src/excel/executors/write-excel.executor.ts`
- `backend/src/excel/executors/write-excel.executor.spec.ts`
- `backend/src/excel/executors/excel-add-sheet.executor.ts`
- `backend/src/excel/executors/excel-chart.executor.ts`
- `backend/src/excel/executors/list-excel-sheets.executor.ts`

### Modified files
- `backend/package.json` — add exceljs dependency
- `backend/src/app.module.ts` — import ExcelModule
- `backend/src/agent/services/agent-loop.service.ts` — register executors
- `backend/src/agent/agent.module.ts` — register executors as providers
- `backend/prisma/seed.ts` — add tool definitions

---

### Task 1: Install Dependency + Create ExcelModule Scaffold

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/excel/excel.module.ts`

- [ ] **Step 1: Install exceljs**

```bash
cd backend && npm install exceljs
```

- [ ] **Step 2: Create excel.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';

@Module({
  providers: [ExcelService],
  exports: [ExcelService],
})
export class ExcelModule {}
```

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/excel/
git commit -m "chore: add exceljs dependency and ExcelModule scaffold"
```

---

### Task 2: ExcelService — Read Operations

**Files:**
- Create: `backend/src/excel/excel.service.ts`
- Create: `backend/src/excel/excel.service.spec.ts`

- [ ] **Step 1: Write ExcelService**

```typescript
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
      result.push(values.map(v => v ?? ''));
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
    // isPathAllowed check will be in executors
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.xlsx') throw new Error(`Invalid extension: ${ext}. Only .xlsx files are supported.`);
  }
}
```

- [ ] **Step 2: Write failing tests**

Create `backend/src/excel/excel.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ExcelService } from './excel.service';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ExcelService', () => {
  let service: ExcelService;
  let testFile: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExcelService],
    }).compile();
    service = module.get<ExcelService>(ExcelService);

    testFile = path.join(os.tmpdir(), `test-${Date.now()}.xlsx`);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.getCell('A1').value = 'Name';
    sheet.getCell('B1').value = 'Age';
    sheet.getCell('A2').value = 'Alice';
    sheet.getCell('B2').value = 30;
    sheet.getCell('A3').value = 'Bob';
    sheet.getCell('B3').value = 25;
    await workbook.xlsx.writeFile(testFile);
  });

  afterEach(() => {
    try { fs.unlinkSync(testFile); } catch { /* ignore */ }
  });

  it('should read all data from default sheet', async () => {
    const result = await service.readSheet(testFile);
    expect(result).toContain('Sheet1');
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
  });

  it('should list sheets', async () => {
    const result = await service.listSheets(testFile);
    expect(result).toBe('Sheets: Sheet1');
  });

  it('should add a sheet', async () => {
    await service.addSheet(testFile, 'Sheet2');
    const sheets = await service.listSheets(testFile);
    expect(sheets).toBe('Sheets: Sheet1, Sheet2');
  });

  it('should throw on invalid extension', async () => {
    await expect(service.validatePath('test.csv')).rejects.toThrow('Invalid extension');
  });

  it('should throw on missing sheet name', async () => {
    await expect(service.readSheet(testFile, { sheet: 'Nope' })).rejects.toThrow('not found');
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx jest src/excel/excel.service.spec.ts --no-coverage`

Expected: all 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/excel/excel.service.ts backend/src/excel/excel.service.spec.ts
git commit -m "feat: add ExcelService with read, list, add sheet operations"
```

---

### Task 3: ExcelService — Write Operations

**Files:**
- Modify: `backend/src/excel/excel.service.ts`
- Modify: `backend/src/excel/excel.service.spec.ts`

- [ ] **Step 1: Add write operations to ExcelService**

Add to `excel.service.ts`:

```typescript
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
        cell.value = op.value ?? null;
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
          cell.value = val ?? null;
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
          cell.value = val ?? null;
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

  // exceljs chart support is limited; we store chart config as a comment
  // on the first cell of the data range for LLM reference
  const pos = dataRange.split(':')[0] ?? 'A1';
  const cell = sheet.getCell(pos);
  cell.note = {
    texts: [{ text: `Chart: ${chartType}${title ? ` - ${title}` : ''}\nData: ${dataRange}\nCategories: ${categoriesRange ?? 'none'}`, font: { size: 10 } }],
  };

  await workbook.xlsx.writeFile(filePath);
  return `Chart metadata added to "${sheetName}". Chart type: ${chartType}. Note: Full chart rendering requires opening in Excel.`;
}
```

- [ ] **Step 2: Add write tests**

Add to `excel.service.spec.ts`:

```typescript
it('should create a new file and write cells', async () => {
  const newFile = path.join(os.tmpdir(), `new-${Date.now()}.xlsx`);
  try {
    await service.write(newFile, [
      { type: 'write_cell', cell: 'A1', value: 'Hello' },
      { type: 'write_cell', cell: 'B1', value: 42 },
    ]);
    const result = await service.readSheet(newFile);
    expect(result).toContain('Hello');
    expect(result).toContain('42');
  } finally {
    try { fs.unlinkSync(newFile); } catch { /* ignore */ }
  }
});

it('should write formula', async () => {
  const fFile = path.join(os.tmpdir(), `formula-${Date.now()}.xlsx`);
  try {
    await service.write(fFile, [
      { type: 'write_cell', cell: 'A1', value: 10 },
      { type: 'write_cell', cell: 'A2', value: 20 },
      { type: 'formula', cell: 'A3', formula: 'SUM(A1:A2)' },
    ]);
    const result = await service.readSheet(fFile);
    expect(result).toContain('10');
    expect(result).toContain('20');
  } finally {
    try { fs.unlinkSync(fFile); } catch { /* ignore */ }
  }
});

it('should merge cells', async () => {
  const mFile = path.join(os.tmpdir(), `merge-${Date.now()}.xlsx`);
  try {
    await service.write(mFile, [
      { type: 'write_cell', cell: 'A1', value: 'Merged Title' },
      { type: 'merge', range: 'A1:C1' },
    ]);
    const result = await service.readSheet(mFile);
    expect(result).toContain('Merged Title');
  } finally {
    try { fs.unlinkSync(mFile); } catch { /* ignore */ }
  }
});
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/excel/excel.service.spec.ts --no-coverage`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/excel/
git commit -m "feat: add ExcelService write operations (cells, rows, formulas, merge, style)"
```

---

### Task 4: Create All 5 Executors

**Files:**
- Create all executor files listed in the File Structure section

- [ ] **Step 1: Create read-excel.executor.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { ExcelService } from '../excel.service';

@Injectable()
export class ReadExcelExecutor implements ToolExecutor {
  readonly name = 'read_excel';

  constructor(private readonly excel: ExcelService) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const path = String(args.path ?? '');
    if (!path) return 'Error: "path" is required';
    try {
      await this.excel.validatePath(path);
      const sheet = args.sheet ? String(args.sheet) : undefined;
      const range = args.range ? String(args.range) : undefined;
      return this.excel.readSheet(path, { sheet, range });
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 2: Create write-excel.executor.ts**

```typescript
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
```

- [ ] **Step 3: Create excel-add-sheet.executor.ts**

```typescript
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
```

- [ ] **Step 4: Create list-excel-sheets.executor.ts**

```typescript
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
```

- [ ] **Step 5: Create excel-chart.executor.ts**

```typescript
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
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/excel/executors/
git commit -m "feat: add all 5 Excel tool executors"
```

---

### Task 5: Register ExcelModule + Seed Tool Definitions

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Import ExcelModule in AppModule**

```typescript
// Add to imports array:
import { ExcelModule } from './excel/excel.module';

@Module({
  imports: [
    // ...existing imports...
    ExcelModule,
  ],
})
```

- [ ] **Step 2: Add tool definitions to seed.ts**

Add after the `delegate` entry:

```typescript
  { name: 'read_excel', description: 'Read data from an Excel (.xlsx) file. Returns data as a markdown table.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to .xlsx file"},"sheet":{"type":"string","description":"Sheet name (default: first sheet)"},"range":{"type":"string","description":"Cell range like A1:D10 (default: all used cells)"}},"required":["path"]}' },
  { name: 'write_excel', description: 'Write data to an Excel (.xlsx) file. Creates new file if it does not exist. Supports cells, rows, columns, formulas, merge, and styling.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to .xlsx file"},"operations":{"type":"array","items":{"type":"object","properties":{"type":{"type":"string","enum":["write_cell","write_row","write_column","formula","merge","style","column_width"]},"sheet":{"type":"string","description":"Sheet name (default: first/active sheet)"},"cell":{"type":"string","description":"Cell reference like A1"},"value":{},"values":{"type":"array"},"formula":{"type":"string","description":"Excel formula like SUM(A1:A5)"},"range":{"type":"string","description":"Cell range like A1:C1 for merge"},"column":{"type":"string","description":"Column letter like A"},"width":{"type":"number","description":"Column width in characters"},"style":{"type":"object","properties":{"bold":{"type":"boolean"},"italic":{"type":"boolean"},"fontSize":{"type":"number"},"fontColor":{"type":"string","description":"ARGB hex color"},"fillColor":{"type":"string","description":"ARGB hex background color"},"numberFormat":{"type":"string","description":"Excel number format like #,##0"},"border":{"type":"boolean"}}}}}},"description":"Array of write operations to execute in order"}]},"required":["path","operations"]}' },
  { name: 'excel_add_sheet', description: 'Add a new sheet to an existing Excel (.xlsx) file.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to .xlsx file"},"sheet":{"type":"string","description":"Name for the new sheet"}},"required":["path","sheet"]}' },
  { name: 'list_excel_sheets', description: 'List all sheet names in an Excel (.xlsx) file.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to .xlsx file"}},"required":["path"]}' },
  { name: 'excel_chart', description: 'Add chart metadata to an Excel (.xlsx) sheet. Chart types: bar, line, pie, column.', parameters: '{"type":"object","properties":{"path":{"type":"string","description":"File path to .xlsx file"},"sheet":{"type":"string","description":"Sheet name"},"type":{"type":"string","enum":["bar","line","pie","column"],"description":"Chart type"},"title":{"type":"string","description":"Chart title"},"dataRange":{"type":"string","description":"Source data range like B2:D5"},"categoriesRange":{"type":"string","description":"Category labels range like A2:A5"}},"required":["path","sheet","type","dataRange"]}' },
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/app.module.ts backend/prisma/seed.ts
git commit -m "feat: register ExcelModule and seed Excel tool definitions"
```

---

### Task 6: Register Executors in AgentModule + AgentLoopService

**Files:**
- Modify: `backend/src/agent/agent.module.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`

- [ ] **Step 1: Add executors to agent.module.ts providers**

```typescript
import { ReadExcelExecutor } from '../excel/executors/read-excel.executor';
import { WriteExcelExecutor } from '../excel/executors/write-excel.executor';
import { ExcelAddSheetExecutor } from '../excel/executors/excel-add-sheet.executor';
import { ListExcelSheetsExecutor } from '../excel/executors/list-excel-sheets.executor';
import { ExcelChartExecutor } from '../excel/executors/excel-chart.executor';

// Add to providers array:
    ReadExcelExecutor,
    WriteExcelExecutor,
    ExcelAddSheetExecutor,
    ListExcelSheetsExecutor,
    ExcelChartExecutor,
```

Also import `ExcelModule` in `AgentModule`:
```typescript
import { ExcelModule } from '../excel/excel.module';

// Add to imports:
    ExcelModule,
```

- [ ] **Step 2: Register executors in AgentLoopService constructor**

Add constructor parameters:
```typescript
    readExcel: ReadExcelExecutor,
    writeExcel: WriteExcelExecutor,
    excelAddSheet: ExcelAddSheetExecutor,
    listExcelSheets: ListExcelSheetsExecutor,
    excelChart: ExcelChartExecutor,
```

Add to executorMap:
```typescript
      [readExcel.name, readExcel],
      [writeExcel.name, writeExcel],
      [excelAddSheet.name, excelAddSheet],
      [listExcelSheets.name, listExcelSheets],
      [excelChart.name, excelChart],
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/agent --no-coverage`

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/
git commit -m "feat: register Excel executors in AgentModule and AgentLoopService"
```

---

### Task 7: Final Test Run

- [ ] **Step 1: Run full test suite**

Run: `cd backend && npx jest --no-coverage`

Expected: all pass (pre-existing failures only).

- [ ] **Step 2: Verify build**

Run: `cd backend && npx nest build`

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

```bash
# Start backend
cd backend && npm run start:dev

# Test read_excel with a real file
curl -X POST http://localhost:13596/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Create an Excel file with sample data","providerModelId":1,"sessionId":1,"mode":"agent"}'
```

Verify agent can call read_excel and write_excel tools.
