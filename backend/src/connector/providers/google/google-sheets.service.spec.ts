import { GoogleSheetsService } from './google-sheets.service';
import { GoogleOAuthService } from './google-oauth.service';

const mockSheetsClient = {
  spreadsheets: {
    values: {
      get: jest.fn(),
      update: jest.fn(),
      append: jest.fn(),
    },
    get: jest.fn(),
    create: jest.fn(),
    batchUpdate: jest.fn(),
  },
};

const mockDriveClient = {
  files: { list: jest.fn(), create: jest.fn() },
};

jest.mock('googleapis', () => ({
  google: {
    sheets: jest.fn(() => mockSheetsClient),
    drive: jest.fn(() => mockDriveClient),
  },
}));

describe('GoogleSheetsService', () => {
  let service: GoogleSheetsService;
  let oauthService: jest.Mocked<GoogleOAuthService>;

  beforeEach(() => {
    oauthService = { getAuthenticatedClient: jest.fn() } as unknown as jest.Mocked<GoogleOAuthService>;
    service = new GoogleSheetsService(oauthService);
    jest.clearAllMocks();
  });

  describe('resolveSpreadsheetId', () => {
    it('returns bare ID as-is when it matches the ID pattern', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      const id = 'abc123XYZ_-abc123XYZ_-abc';
      const result = await service.resolveSpreadsheetId(id);
      expect(result).toBe(id);
      expect(mockDriveClient.files.list).not.toHaveBeenCalled();
    });

    it('extracts ID from full Google Sheets URL', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      const result = await service.resolveSpreadsheetId(
        'https://docs.google.com/spreadsheets/d/abc123XYZ_-abc123XYZ_-abc/edit',
      );
      expect(result).toBe('abc123XYZ_-abc123XYZ_-abc');
    });

    it('searches Drive by name when given a plain name', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockDriveClient.files.list.mockResolvedValue({
        data: { files: [{ id: 'found-id-123456789012345' }] },
      });
      const result = await service.resolveSpreadsheetId('Báo cáo Q2');
      expect(result).toBe('found-id-123456789012345');
    });

    it('throws when Drive search returns no results', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockDriveClient.files.list.mockResolvedValue({ data: { files: [] } });
      await expect(service.resolveSpreadsheetId('Unknown Sheet')).rejects.toThrow(
        'Spreadsheet not found: Unknown Sheet',
      );
    });

    it('throws Google Sheets not connected when no auth', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue(null);
      await expect(service.resolveSpreadsheetId('anything')).rejects.toThrow(
        'Google Sheets not connected',
      );
    });
  });

  describe('read', () => {
    it('returns markdown table for valid range', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockSheetsClient.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['Name', 'Age'], ['Alice', '30'], ['Bob', '25']] },
      });
      const result = await service.read('spreadsheetId123456789012345', 'Sheet1', 'A1:B3');
      expect(result).toBe('| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |');
    });

    it('returns "No data found." when values is empty', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockSheetsClient.spreadsheets.values.get.mockResolvedValue({ data: { values: [] } });
      const result = await service.read('spreadsheetId123456789012345', 'Sheet1', 'A1:B3');
      expect(result).toBe('No data found.');
    });
  });

  describe('listTabs', () => {
    it('returns tab summary string', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockSheetsClient.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            { properties: { title: 'Sheet1', gridProperties: { rowCount: 1000, columnCount: 26 } } },
            { properties: { title: 'Data', gridProperties: { rowCount: 500, columnCount: 10 } } },
          ],
        },
      });
      const result = await service.listTabs('spreadsheetId123456789012345');
      expect(result).toBe('Tab: "Sheet1" (1000 rows × 26 cols)\nTab: "Data" (500 rows × 10 cols)');
    });
  });

  describe('update', () => {
    it('returns updated cell count', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockSheetsClient.spreadsheets.values.update.mockResolvedValue({
        data: { updatedCells: 6 },
      });
      const result = await service.update('spreadsheetId123456789012345', 'Sheet1', 'A1:B3', [['a', 'b'], ['c', 'd'], ['e', 'f']]);
      expect(result).toBe('Updated 6 cells.');
    });
  });

  describe('append', () => {
    it('returns appended row count', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockSheetsClient.spreadsheets.values.append.mockResolvedValue({
        data: { updates: { updatedRows: 2 } },
      });
      const result = await service.append('spreadsheetId123456789012345', 'Sheet1', [['x', 'y'], ['z', 'w']]);
      expect(result).toBe('Appended 2 rows.');
    });
  });

  describe('create', () => {
    it('returns created spreadsheet info', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockSheetsClient.spreadsheets.create.mockResolvedValue({
        data: { spreadsheetId: 'newId123456789012345', properties: { title: 'My Sheet' } },
      });
      const result = await service.create('My Sheet');
      expect(result).toBe('Created spreadsheet: My Sheet (id: newId123456789012345)');
    });

    it('creates in folder when parentFolderId is provided', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockDriveClient.files.create.mockResolvedValue({
        data: { id: 'newId123456789012345', name: 'My Sheet' },
      });
      const result = await service.create('My Sheet', undefined, 'folderId123');
      expect(mockDriveClient.files.create).toHaveBeenCalledWith({
        requestBody: { name: 'My Sheet', mimeType: 'application/vnd.google-apps.spreadsheet', parents: ['folderId123'] },
        fields: 'id,name',
      });
      expect(result).toBe('Created spreadsheet: My Sheet (id: newId123456789012345)');
    });

    it('creates in folder and renames initial tab', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockDriveClient.files.create.mockResolvedValue({
        data: { id: 'newId123456789012345', name: 'My Sheet' },
      });
      mockSheetsClient.spreadsheets.get.mockResolvedValue({
        data: { sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }] },
      });
      mockSheetsClient.spreadsheets.batchUpdate.mockResolvedValue({});
      const result = await service.create('My Sheet', 'Data', 'folderId123');
      expect(mockDriveClient.files.create).toHaveBeenCalled();
      expect(mockSheetsClient.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'newId123456789012345',
        requestBody: {
          requests: [{ updateSheetProperties: { properties: { sheetId: 0, title: 'Data' }, fields: 'title' } }],
        },
      });
      expect(result).toBe('Created spreadsheet: My Sheet (id: newId123456789012345)');
    });

    it('still works without parentFolderId using sheets API', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockSheetsClient.spreadsheets.create.mockResolvedValue({
        data: { spreadsheetId: 'sheetsId123456789012345', properties: { title: 'Legacy' } },
      });
      const result = await service.create('Legacy');
      expect(mockSheetsClient.spreadsheets.create).toHaveBeenCalled();
      expect(result).toBe('Created spreadsheet: Legacy (id: sheetsId123456789012345)');
    });
  });

  describe('addTab', () => {
    it('returns success message', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockSheetsClient.spreadsheets.batchUpdate.mockResolvedValue({});
      const result = await service.addTab('spreadsheetId123456789012345', 'NewTab');
      expect(result).toBe('Added tab "NewTab" to spreadsheet.');
    });
  });

  describe('format', () => {
    it('returns formatted range message', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockSheetsClient.spreadsheets.batchUpdate.mockResolvedValue({});
      mockSheetsClient.spreadsheets.get.mockResolvedValue({
        data: { sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] },
      });
      const result = await service.format('spreadsheetId123456789012345', 'Sheet1', 'A1:B2', { bold: true });
      expect(result).toBe('Formatted range A1:B2.');
    });
  });

  describe('chart', () => {
    it('returns chart added message', async () => {
      oauthService.getAuthenticatedClient.mockResolvedValue({} as any);
      mockSheetsClient.spreadsheets.batchUpdate.mockResolvedValue({});
      mockSheetsClient.spreadsheets.get.mockResolvedValue({
        data: { sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] },
      });
      const result = await service.chart('spreadsheetId123456789012345', 'Sheet1', 'BAR', 'B2:D5', 'A2:A5', 'Sales Chart');
      expect(result).toBe('Chart added to tab "Sheet1".');
    });
  });
});
