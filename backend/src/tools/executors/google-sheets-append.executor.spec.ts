import { GoogleSheetsAppendExecutor } from './google-sheets-append.executor';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

describe('GoogleSheetsAppendExecutor', () => {
  let executor: GoogleSheetsAppendExecutor;
  let service: jest.Mocked<GoogleSheetsService>;

  beforeEach(() => {
    service = { resolveSpreadsheetId: jest.fn(), append: jest.fn() } as unknown as jest.Mocked<GoogleSheetsService>;
    executor = new GoogleSheetsAppendExecutor(service);
  });

  it('has name google_sheets_append', () => {
    expect(executor.name).toBe('google_sheets_append');
  });

  it('appends rows and returns count', async () => {
    service.resolveSpreadsheetId.mockResolvedValue('id123456789012345678901234');
    service.append.mockResolvedValue('Appended 2 rows.');
    const result = await executor.execute({
      spreadsheet: 'My Sheet', values: [['a', 'b'], ['c', 'd']], tab: 'Data',
    });
    expect(service.append).toHaveBeenCalledWith('id123456789012345678901234', 'Data', [['a', 'b'], ['c', 'd']]);
    expect(result).toBe('Appended 2 rows.');
  });

  it('defaults tab to Sheet1', async () => {
    service.resolveSpreadsheetId.mockResolvedValue('id123456789012345678901234');
    service.append.mockResolvedValue('Appended 1 rows.');
    await executor.execute({ spreadsheet: 'id123456789012345678901234', values: [['x']] });
    expect(service.append).toHaveBeenCalledWith('id123456789012345678901234', 'Sheet1', [['x']]);
  });

  it('returns error on failure', async () => {
    service.resolveSpreadsheetId.mockRejectedValue(new Error('Spreadsheet not found: X'));
    const result = await executor.execute({ spreadsheet: 'X', values: [] });
    expect(result).toBe('Error: Spreadsheet not found: X');
  });
});
