import { GoogleSheetsUpdateExecutor } from './google-sheets-update.executor';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

describe('GoogleSheetsUpdateExecutor', () => {
  let executor: GoogleSheetsUpdateExecutor;
  let service: jest.Mocked<GoogleSheetsService>;

  beforeEach(() => {
    service = { resolveSpreadsheetId: jest.fn(), update: jest.fn() } as unknown as jest.Mocked<GoogleSheetsService>;
    executor = new GoogleSheetsUpdateExecutor(service);
  });

  it('has name google_sheets_update', () => {
    expect(executor.name).toBe('google_sheets_update');
  });

  it('updates cells and returns count', async () => {
    service.resolveSpreadsheetId.mockResolvedValue('id123456789012345678901234');
    service.update.mockResolvedValue('Updated 4 cells.');
    const result = await executor.execute({
      spreadsheet: 'My Sheet', range: 'A1:B2', values: [['a', 'b'], ['c', 'd']], tab: 'Sheet1',
    });
    expect(service.update).toHaveBeenCalledWith('id123456789012345678901234', 'Sheet1', 'A1:B2', [['a', 'b'], ['c', 'd']]);
    expect(result).toBe('Updated 4 cells.');
  });

  it('defaults tab to Sheet1', async () => {
    service.resolveSpreadsheetId.mockResolvedValue('id123456789012345678901234');
    service.update.mockResolvedValue('Updated 1 cells.');
    await executor.execute({ spreadsheet: 'id123456789012345678901234', range: 'A1', values: [['x']] });
    expect(service.update).toHaveBeenCalledWith('id123456789012345678901234', 'Sheet1', 'A1', [['x']]);
  });

  it('returns error on failure', async () => {
    service.resolveSpreadsheetId.mockRejectedValue(new Error('Google Sheets not connected'));
    const result = await executor.execute({ spreadsheet: 'X', range: 'A1', values: [] });
    expect(result).toBe('Error: Google Sheets not connected');
  });
});
