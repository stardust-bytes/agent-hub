import { GoogleSheetsChartExecutor } from './google-sheets-chart.executor';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

describe('GoogleSheetsChartExecutor', () => {
  let executor: GoogleSheetsChartExecutor;
  let service: jest.Mocked<GoogleSheetsService>;

  beforeEach(() => {
    service = { resolveSpreadsheetId: jest.fn(), chart: jest.fn() } as unknown as jest.Mocked<GoogleSheetsService>;
    executor = new GoogleSheetsChartExecutor(service);
  });

  it('has name google_sheets_chart', () => {
    expect(executor.name).toBe('google_sheets_chart');
  });

  it('adds chart and returns message', async () => {
    service.resolveSpreadsheetId.mockResolvedValue('id123456789012345678901234');
    service.chart.mockResolvedValue('Chart added to tab "Sheet1".');
    const result = await executor.execute({
      spreadsheet: 'My Sheet', tab: 'Sheet1', type: 'BAR', dataRange: 'B2:D5', categoriesRange: 'A2:A5', title: 'Sales',
    });
    expect(service.chart).toHaveBeenCalledWith('id123456789012345678901234', 'Sheet1', 'BAR', 'B2:D5', 'A2:A5', 'Sales');
    expect(result).toBe('Chart added to tab "Sheet1".');
  });

  it('works without optional categoriesRange and title', async () => {
    service.resolveSpreadsheetId.mockResolvedValue('id123456789012345678901234');
    service.chart.mockResolvedValue('Chart added to tab "Data".');
    await executor.execute({ spreadsheet: 'id123456789012345678901234', tab: 'Data', type: 'LINE', dataRange: 'A1:B10' });
    expect(service.chart).toHaveBeenCalledWith('id123456789012345678901234', 'Data', 'LINE', 'A1:B10', undefined, undefined);
  });

  it('returns error on failure', async () => {
    service.resolveSpreadsheetId.mockRejectedValue(new Error('Google Sheets not connected'));
    const result = await executor.execute({ spreadsheet: 'X', tab: 'Sheet1', type: 'BAR', dataRange: 'A1:B2' });
    expect(result).toBe('Error: Google Sheets not connected');
  });
});
