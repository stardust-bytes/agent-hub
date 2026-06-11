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
