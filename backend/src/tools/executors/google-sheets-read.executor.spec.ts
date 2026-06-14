import { GoogleSheetsReadExecutor } from './google-sheets-read.executor';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

describe('GoogleSheetsReadExecutor', () => {
  let executor: GoogleSheetsReadExecutor;
  let service: jest.Mocked<GoogleSheetsService>;

  beforeEach(() => {
    service = { resolveSpreadsheetId: jest.fn(), read: jest.fn() } as unknown as jest.Mocked<GoogleSheetsService>;
    executor = new GoogleSheetsReadExecutor(service);
  });

  it('has name google_sheets_read', () => {
    expect(executor.name).toBe('google_sheets_read');
  });

  it('reads range and returns markdown table', async () => {
    service.resolveSpreadsheetId.mockResolvedValue('spreadsheetId123456789012345');
    service.read.mockResolvedValue('| A | B |\n| --- | --- |\n| 1 | 2 |');
    const result = await executor.execute({ spreadsheet: 'My Sheet', range: 'A1:B2', tab: 'Sheet1' });
    expect(service.resolveSpreadsheetId).toHaveBeenCalledWith('My Sheet');
    expect(service.read).toHaveBeenCalledWith('spreadsheetId123456789012345', 'Sheet1', 'A1:B2');
    expect(result).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
  });

  it('defaults tab to Sheet1 when omitted', async () => {
    service.resolveSpreadsheetId.mockResolvedValue('id123456789012345678901234');
    service.read.mockResolvedValue('No data found.');
    await executor.execute({ spreadsheet: 'id123456789012345678901234', range: 'A1:B2' });
    expect(service.read).toHaveBeenCalledWith('id123456789012345678901234', 'Sheet1', 'A1:B2');
  });

  it('returns error string on failure', async () => {
    service.resolveSpreadsheetId.mockRejectedValue(new Error('Google Sheets not connected'));
    const result = await executor.execute({ spreadsheet: 'X', range: 'A1' });
    expect(result).toBe('Error: Google Sheets not connected');
  });
});
