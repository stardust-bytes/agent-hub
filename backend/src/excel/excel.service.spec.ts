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

  it('should write row and apply style', async () => {
    const sFile = path.join(os.tmpdir(), `style-${Date.now()}.xlsx`);
    try {
      await service.write(sFile, [
        { type: 'write_row', cell: 'A1', values: ['Header1', 'Header2'], style: { bold: true } },
        { type: 'write_row', cell: 'A2', values: [1, 2] },
      ]);
      const result = await service.readSheet(sFile);
      expect(result).toContain('Header1');
      expect(result).toContain('1');
    } finally {
      try { fs.unlinkSync(sFile); } catch { /* ignore */ }
    }
  });
});
