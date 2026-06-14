import { GoogleSheetsListTabsExecutor } from './google-sheets-list-tabs.executor';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

describe('GoogleSheetsListTabsExecutor', () => {
  let executor: GoogleSheetsListTabsExecutor;
  let service: jest.Mocked<GoogleSheetsService>;

  beforeEach(() => {
    service = { resolveSpreadsheetId: jest.fn(), listTabs: jest.fn() } as unknown as jest.Mocked<GoogleSheetsService>;
    executor = new GoogleSheetsListTabsExecutor(service);
  });

  it('has name google_sheets_list_tabs', () => {
    expect(executor.name).toBe('google_sheets_list_tabs');
  });

  it('lists tabs', async () => {
    service.resolveSpreadsheetId.mockResolvedValue('id123456789012345678901234');
    service.listTabs.mockResolvedValue('Tab: "Sheet1" (1000 rows × 26 cols)');
    const result = await executor.execute({ spreadsheet: 'My Sheet' });
    expect(result).toBe('Tab: "Sheet1" (1000 rows × 26 cols)');
  });

  it('returns error string on failure', async () => {
    service.resolveSpreadsheetId.mockRejectedValue(new Error('Spreadsheet not found: X'));
    const result = await executor.execute({ spreadsheet: 'X' });
    expect(result).toBe('Error: Spreadsheet not found: X');
  });
});
