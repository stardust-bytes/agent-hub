import { GoogleSheetsFormatExecutor } from './google-sheets-format.executor';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

describe('GoogleSheetsFormatExecutor', () => {
  let executor: GoogleSheetsFormatExecutor;
  let service: jest.Mocked<GoogleSheetsService>;

  beforeEach(() => {
    service = { resolveSpreadsheetId: jest.fn(), format: jest.fn() } as unknown as jest.Mocked<GoogleSheetsService>;
    executor = new GoogleSheetsFormatExecutor(service);
  });

  it('has name google_sheets_format', () => {
    expect(executor.name).toBe('google_sheets_format');
  });

  it('formats range and returns message', async () => {
    service.resolveSpreadsheetId.mockResolvedValue('id123456789012345678901234');
    service.format.mockResolvedValue('Formatted range A1:B2.');
    const result = await executor.execute({
      spreadsheet: 'My Sheet', range: 'A1:B2', tab: 'Sheet1', format: { bold: true },
    });
    expect(service.format).toHaveBeenCalledWith('id123456789012345678901234', 'Sheet1', 'A1:B2', { bold: true });
    expect(result).toBe('Formatted range A1:B2.');
  });

  it('defaults tab to Sheet1', async () => {
    service.resolveSpreadsheetId.mockResolvedValue('id123456789012345678901234');
    service.format.mockResolvedValue('Formatted range A1:A1.');
    await executor.execute({ spreadsheet: 'id123456789012345678901234', range: 'A1', format: { bold: false } });
    expect(service.format).toHaveBeenCalledWith('id123456789012345678901234', 'Sheet1', 'A1', { bold: false });
  });

  it('returns error on failure', async () => {
    service.resolveSpreadsheetId.mockRejectedValue(new Error('Google Sheets not connected'));
    const result = await executor.execute({ spreadsheet: 'X', range: 'A1', format: {} });
    expect(result).toBe('Error: Google Sheets not connected');
  });
});
