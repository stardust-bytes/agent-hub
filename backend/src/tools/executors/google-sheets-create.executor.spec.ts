import { GoogleSheetsCreateExecutor } from './google-sheets-create.executor';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

describe('GoogleSheetsCreateExecutor', () => {
  let executor: GoogleSheetsCreateExecutor;
  let service: jest.Mocked<GoogleSheetsService>;

  beforeEach(() => {
    service = { create: jest.fn() } as unknown as jest.Mocked<GoogleSheetsService>;
    executor = new GoogleSheetsCreateExecutor(service);
  });

  it('has name google_sheets_create', () => {
    expect(executor.name).toBe('google_sheets_create');
  });

  it('creates spreadsheet and returns info', async () => {
    service.create.mockResolvedValue('Created spreadsheet: My Report (id: newId12345678901234567)');
    const result = await executor.execute({ title: 'My Report', initialTab: 'Data' });
    expect(service.create).toHaveBeenCalledWith('My Report', 'Data', undefined);
    expect(result).toBe('Created spreadsheet: My Report (id: newId12345678901234567)');
  });

  it('creates without initialTab when omitted', async () => {
    service.create.mockResolvedValue('Created spreadsheet: Untitled (id: id12345678901234567890)');
    await executor.execute({ title: 'Untitled' });
    expect(service.create).toHaveBeenCalledWith('Untitled', undefined, undefined);
  });

  it('returns error on failure', async () => {
    service.create.mockRejectedValue(new Error('Google Sheets not connected'));
    const result = await executor.execute({ title: 'X' });
    expect(result).toBe('Error: Google Sheets not connected');
  });

  it('passes parentFolderId to service', async () => {
    service.create.mockResolvedValue('Created spreadsheet: Report (id: newId123456789012345)');
    const result = await executor.execute({ title: 'Report', initialTab: 'Data', parentFolderId: 'folder123' });
    expect(service.create).toHaveBeenCalledWith('Report', 'Data', 'folder123');
    expect(result).toBe('Created spreadsheet: Report (id: newId123456789012345)');
  });
});
