import { GoogleSheetsAddTabExecutor } from './google-sheets-add-tab.executor';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

describe('GoogleSheetsAddTabExecutor', () => {
  let executor: GoogleSheetsAddTabExecutor;
  let service: jest.Mocked<GoogleSheetsService>;

  beforeEach(() => {
    service = { resolveSpreadsheetId: jest.fn(), addTab: jest.fn() } as unknown as jest.Mocked<GoogleSheetsService>;
    executor = new GoogleSheetsAddTabExecutor(service);
  });

  it('has name google_sheets_add_tab', () => {
    expect(executor.name).toBe('google_sheets_add_tab');
  });

  it('adds tab and returns success message', async () => {
    service.resolveSpreadsheetId.mockResolvedValue('id123456789012345678901234');
    service.addTab.mockResolvedValue('Added tab "Summary" to spreadsheet.');
    const result = await executor.execute({ spreadsheet: 'My Sheet', tabName: 'Summary' });
    expect(service.addTab).toHaveBeenCalledWith('id123456789012345678901234', 'Summary');
    expect(result).toBe('Added tab "Summary" to spreadsheet.');
  });

  it('returns error on failure', async () => {
    service.resolveSpreadsheetId.mockRejectedValue(new Error('Spreadsheet not found: X'));
    const result = await executor.execute({ spreadsheet: 'X', tabName: 'Tab1' });
    expect(result).toBe('Error: Spreadsheet not found: X');
  });
});
