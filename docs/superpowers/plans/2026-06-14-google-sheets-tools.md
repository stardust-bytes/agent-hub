# Google Sheets Tools Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8 Google Sheets agent tools (read, list_tabs, update, append, create, add_tab, format, chart) following the existing Gmail/Drive connector pattern.

**Architecture:** New `GoogleSheetsService` in `connector/providers/google/` handles all Sheets API v4 calls and spreadsheet-by-name resolution via Drive search. Eight executor classes in `tools/executors/` wrap the service. Three wiring points: `SCOPE_MAP` in oauth service, `EXECUTORS` arrays in tools.module + agent-loop, and `DEFAULT_TOOLS` in seed.

**Tech Stack:** `googleapis` (already installed), NestJS `@Injectable`, Jest for unit tests.

---

## File Map

**Create:**
- `backend/src/connector/providers/google/google-sheets.service.ts`
- `backend/src/connector/providers/google/google-sheets.service.spec.ts`
- `backend/src/tools/executors/google-sheets-read.executor.ts`
- `backend/src/tools/executors/google-sheets-read.executor.spec.ts`
- `backend/src/tools/executors/google-sheets-list-tabs.executor.ts`
- `backend/src/tools/executors/google-sheets-list-tabs.executor.spec.ts`
- `backend/src/tools/executors/google-sheets-update.executor.ts`
- `backend/src/tools/executors/google-sheets-update.executor.spec.ts`
- `backend/src/tools/executors/google-sheets-append.executor.ts`
- `backend/src/tools/executors/google-sheets-append.executor.spec.ts`
- `backend/src/tools/executors/google-sheets-create.executor.ts`
- `backend/src/tools/executors/google-sheets-create.executor.spec.ts`
- `backend/src/tools/executors/google-sheets-add-tab.executor.ts`
- `backend/src/tools/executors/google-sheets-add-tab.executor.spec.ts`
- `backend/src/tools/executors/google-sheets-format.executor.ts`
- `backend/src/tools/executors/google-sheets-format.executor.spec.ts`
- `backend/src/tools/executors/google-sheets-chart.executor.ts`
- `backend/src/tools/executors/google-sheets-chart.executor.spec.ts`

**Modify:**
- `backend/src/connector/providers/google/google-oauth.service.ts` — add `google_sheets` to `SCOPE_MAP`
- `backend/src/tools/tools.module.ts` — import + register 8 executors
- `backend/src/agent/services/agent-loop.service.ts` — import + inject + map 8 executors
- `backend/prisma/seed.ts` — add 8 tool entries to `DEFAULT_TOOLS`
- `backend/src/connector/AGENTS.md` — update docs
- `backend/src/tools/AGENTS.md` — update docs

---

### Task 1: Add `google_sheets` OAuth scope

**Files:**
- Modify: `backend/src/connector/providers/google/google-oauth.service.ts`

- [ ] **Step 1: Open the file and locate `SCOPE_MAP`**

The file is at `backend/src/connector/providers/google/google-oauth.service.ts`. `SCOPE_MAP` starts around line 11. Currently has entries for `google_gmail`, `google_calendar`, `google_drive`.

- [ ] **Step 2: Add the `google_sheets` entry**

Add after `google_drive` entry:

```ts
const SCOPE_MAP: Record<string, string[]> = {
  google_gmail: ['https://mail.google.com/'],
  google_calendar: ['https://www.googleapis.com/auth/calendar'],
  google_drive: ['https://www.googleapis.com/auth/drive'],
  google_sheets: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/connector/providers/google/google-oauth.service.ts
git commit -m "feat: add google_sheets OAuth scope"
```

---

### Task 2: Implement `GoogleSheetsService` (TDD)

**Files:**
- Create: `backend/src/connector/providers/google/google-sheets.service.spec.ts`
- Create: `backend/src/connector/providers/google/google-sheets.service.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/connector/providers/google/google-sheets.service.spec.ts`:

```ts
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
  files: { list: jest.fn() },
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest src/connector/providers/google/google-sheets.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './google-sheets.service'`

- [ ] **Step 3: Implement `GoogleSheetsService`**

Create `backend/src/connector/providers/google/google-sheets.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleOAuthService } from './google-oauth.service';

export interface SheetFormat {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  fontColor?: string;
  fillColor?: string;
  numberFormat?: string;
  border?: boolean;
}

@Injectable()
export class GoogleSheetsService {
  constructor(private readonly googleOAuth: GoogleOAuthService) {}

  private async getAuth() {
    const auth = await this.googleOAuth.getAuthenticatedClient('google_sheets');
    if (!auth) throw new Error('Google Sheets not connected');
    return auth;
  }

  private async getSheets() {
    const auth = await this.getAuth();
    return google.sheets({ version: 'v4', auth: auth as any });
  }

  private async getDrive() {
    const auth = await this.getAuth();
    return google.drive({ version: 'v3', auth: auth as any });
  }

  async resolveSpreadsheetId(spreadsheet: string): Promise<string> {
    await this.getAuth();

    const urlMatch = spreadsheet.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{25,})/);
    if (urlMatch) return urlMatch[1];

    if (/^[a-zA-Z0-9_-]{25,}$/.test(spreadsheet)) return spreadsheet;

    const drive = await this.getDrive();
    const escaped = spreadsheet.replace(/'/g, "\\'");
    const res = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.spreadsheet' and name contains '${escaped}'`,
      pageSize: 1,
      fields: 'files(id)',
    });
    const files = res.data.files ?? [];
    if (files.length === 0) throw new Error(`Spreadsheet not found: ${spreadsheet}`);
    return files[0].id!;
  }

  async read(spreadsheetId: string, tab: string, range: string): Promise<string> {
    const sheets = await this.getSheets();
    const fullRange = `${tab}!${range}`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: fullRange });
    const values = res.data.values ?? [];
    if (values.length === 0) return 'No data found.';
    const [headers, ...rows] = values;
    const header = `| ${headers.join(' | ')} |`;
    const separator = `| ${headers.map(() => '---').join(' | ')} |`;
    const body = rows.map(r => `| ${r.join(' | ')} |`).join('\n');
    return [header, separator, body].join('\n');
  }

  async listTabs(spreadsheetId: string): Promise<string> {
    const sheets = await this.getSheets();
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    return (res.data.sheets ?? [])
      .map(s => {
        const p = s.properties!;
        const rows = p.gridProperties?.rowCount ?? 0;
        const cols = p.gridProperties?.columnCount ?? 0;
        return `Tab: "${p.title}" (${rows} rows × ${cols} cols)`;
      })
      .join('\n');
  }

  async update(spreadsheetId: string, tab: string, range: string, values: unknown[][]): Promise<string> {
    const sheets = await this.getSheets();
    const fullRange = `${tab}!${range}`;
    const res = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: fullRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
    return `Updated ${res.data.updatedCells ?? 0} cells.`;
  }

  async append(spreadsheetId: string, tab: string, values: unknown[][]): Promise<string> {
    const sheets = await this.getSheets();
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: tab,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    const rows = res.data.updates?.updatedRows ?? 0;
    return `Appended ${rows} rows.`;
  }

  async create(title: string, initialTab?: string): Promise<string> {
    const sheets = await this.getSheets();
    const requestBody: { properties: { title: string }; sheets?: { properties: { title: string } }[] } = {
      properties: { title },
    };
    if (initialTab) requestBody.sheets = [{ properties: { title: initialTab } }];
    const res = await sheets.spreadsheets.create({ requestBody });
    return `Created spreadsheet: ${res.data.properties!.title} (id: ${res.data.spreadsheetId})`;
  }

  async addTab(spreadsheetId: string, tabName: string): Promise<string> {
    const sheets = await this.getSheets();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
    return `Added tab "${tabName}" to spreadsheet.`;
  }

  private async getSheetId(spreadsheetId: string, tab: string): Promise<number> {
    const sheets = await this.getSheets();
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = (res.data.sheets ?? []).find(s => s.properties?.title === tab);
    return sheet?.properties?.sheetId ?? 0;
  }

  private hexToRgb(hex: string) {
    const clean = hex.replace('#', '');
    return {
      red: parseInt(clean.slice(0, 2), 16) / 255,
      green: parseInt(clean.slice(2, 4), 16) / 255,
      blue: parseInt(clean.slice(4, 6), 16) / 255,
    };
  }

  private parseA1(cell: string): { rowIndex: number; columnIndex: number } {
    const match = cell.match(/^([A-Z]+)(\d+)$/);
    if (!match) return { rowIndex: 0, columnIndex: 0 };
    const col = match[1].split('').reduce((acc, c) => acc * 26 + c.charCodeAt(0) - 64, 0) - 1;
    return { rowIndex: parseInt(match[2]) - 1, columnIndex: col };
  }

  async format(spreadsheetId: string, tab: string, range: string, fmt: SheetFormat): Promise<string> {
    const sheetId = await this.getSheetId(spreadsheetId, tab);
    const [startCell, endCell] = range.split(':');
    const start = this.parseA1(startCell);
    const end = endCell ? this.parseA1(endCell) : start;
    const sheets = await this.getSheets();

    const gridRange = {
      sheetId,
      startRowIndex: start.rowIndex,
      endRowIndex: end.rowIndex + 1,
      startColumnIndex: start.columnIndex,
      endColumnIndex: end.columnIndex + 1,
    };

    const userEnteredFormat: Record<string, unknown> = {};
    const fields: string[] = [];

    if (fmt.bold !== undefined || fmt.italic !== undefined || fmt.fontSize !== undefined || fmt.fontColor !== undefined) {
      userEnteredFormat.textFormat = {
        ...(fmt.bold !== undefined && { bold: fmt.bold }),
        ...(fmt.italic !== undefined && { italic: fmt.italic }),
        ...(fmt.fontSize !== undefined && { fontSize: fmt.fontSize }),
        ...(fmt.fontColor !== undefined && { foregroundColor: this.hexToRgb(fmt.fontColor) }),
      };
      fields.push('userEnteredFormat.textFormat');
    }
    if (fmt.fillColor !== undefined) {
      userEnteredFormat.backgroundColor = this.hexToRgb(fmt.fillColor);
      fields.push('userEnteredFormat.backgroundColor');
    }
    if (fmt.numberFormat !== undefined) {
      userEnteredFormat.numberFormat = { type: 'NUMBER', pattern: fmt.numberFormat };
      fields.push('userEnteredFormat.numberFormat');
    }
    if (fmt.border) {
      const solidBorder = { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } };
      userEnteredFormat.borders = { top: solidBorder, bottom: solidBorder, left: solidBorder, right: solidBorder };
      fields.push('userEnteredFormat.borders');
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: gridRange,
            cell: { userEnteredFormat },
            fields: fields.join(','),
          },
        }],
      },
    });
    return `Formatted range ${range}.`;
  }

  async chart(
    spreadsheetId: string,
    tab: string,
    type: 'BAR' | 'LINE' | 'PIE' | 'COLUMN',
    dataRange: string,
    categoriesRange?: string,
    title?: string,
  ): Promise<string> {
    const sheetId = await this.getSheetId(spreadsheetId, tab);
    const sheets = await this.getSheets();

    const toGridRange = (r: string) => {
      const [start, end] = r.split(':');
      const s = this.parseA1(start);
      const e = end ? this.parseA1(end) : s;
      return { sheetId, startRowIndex: s.rowIndex, endRowIndex: e.rowIndex + 1, startColumnIndex: s.columnIndex, endColumnIndex: e.columnIndex + 1 };
    };

    const series = [{ series: { sourceRange: { sources: [toGridRange(dataRange)] } }, targetAxis: 'LEFT_AXIS' }];
    const domains = categoriesRange
      ? [{ domain: { sourceRange: { sources: [toGridRange(categoriesRange)] } } }]
      : [];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addChart: {
            chart: {
              spec: {
                title: title ?? '',
                basicChart: { chartType: type, legendPosition: 'BOTTOM_LEGEND', domains, series },
              },
              position: { overlayPosition: { anchorCell: { sheetId, rowIndex: 0, columnIndex: 0 } } },
            },
          },
        }],
      },
    });
    return `Chart added to tab "${tab}".`;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest src/connector/providers/google/google-sheets.service.spec.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/connector/providers/google/google-sheets.service.ts \
        backend/src/connector/providers/google/google-sheets.service.spec.ts
git commit -m "feat: add GoogleSheetsService with resolveSpreadsheetId and Sheets API methods"
```

---

### Task 3: Executor — `google_sheets_read` and `google_sheets_list_tabs`

**Files:**
- Create: `backend/src/tools/executors/google-sheets-read.executor.ts`
- Create: `backend/src/tools/executors/google-sheets-read.executor.spec.ts`
- Create: `backend/src/tools/executors/google-sheets-list-tabs.executor.ts`
- Create: `backend/src/tools/executors/google-sheets-list-tabs.executor.spec.ts`

- [ ] **Step 1: Write failing tests for both executors**

Create `backend/src/tools/executors/google-sheets-read.executor.spec.ts`:

```ts
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
```

Create `backend/src/tools/executors/google-sheets-list-tabs.executor.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest google-sheets-read.executor.spec google-sheets-list-tabs.executor.spec --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `google-sheets-read.executor.ts`**

Create `backend/src/tools/executors/google-sheets-read.executor.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

@Injectable()
export class GoogleSheetsReadExecutor implements ToolExecutor {
  readonly name = 'google_sheets_read';
  readonly description = 'Read data from a Google Sheets range. Returns a markdown table. Accepts spreadsheet ID or name.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      spreadsheet: { type: 'string', description: 'Spreadsheet ID or name (e.g. "Báo cáo Q2")' },
      range: { type: 'string', description: 'Cell range (e.g. "A1:D10")' },
      tab: { type: 'string', description: 'Tab/sheet name (default: "Sheet1")' },
    },
    required: ['spreadsheet', 'range'] as string[],
  };

  constructor(private readonly sheets: GoogleSheetsService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const id = await this.sheets.resolveSpreadsheetId(args.spreadsheet as string);
      return await this.sheets.read(id, (args.tab as string) ?? 'Sheet1', args.range as string);
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 4: Implement `google-sheets-list-tabs.executor.ts`**

Create `backend/src/tools/executors/google-sheets-list-tabs.executor.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

@Injectable()
export class GoogleSheetsListTabsExecutor implements ToolExecutor {
  readonly name = 'google_sheets_list_tabs';
  readonly description = 'List all tabs/sheets in a Google Sheets spreadsheet with their sizes.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      spreadsheet: { type: 'string', description: 'Spreadsheet ID or name' },
    },
    required: ['spreadsheet'] as string[],
  };

  constructor(private readonly sheets: GoogleSheetsService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const id = await this.sheets.resolveSpreadsheetId(args.spreadsheet as string);
      return await this.sheets.listTabs(id);
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npx jest google-sheets-read.executor.spec google-sheets-list-tabs.executor.spec --no-coverage
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/tools/executors/google-sheets-read.executor.ts \
        backend/src/tools/executors/google-sheets-read.executor.spec.ts \
        backend/src/tools/executors/google-sheets-list-tabs.executor.ts \
        backend/src/tools/executors/google-sheets-list-tabs.executor.spec.ts
git commit -m "feat: add google_sheets_read and google_sheets_list_tabs executors"
```

---

### Task 4: Executors — `google_sheets_update` and `google_sheets_append`

**Files:**
- Create: `backend/src/tools/executors/google-sheets-update.executor.ts`
- Create: `backend/src/tools/executors/google-sheets-update.executor.spec.ts`
- Create: `backend/src/tools/executors/google-sheets-append.executor.ts`
- Create: `backend/src/tools/executors/google-sheets-append.executor.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/tools/executors/google-sheets-update.executor.spec.ts`:

```ts
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
```

Create `backend/src/tools/executors/google-sheets-append.executor.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest google-sheets-update.executor.spec google-sheets-append.executor.spec --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `google-sheets-update.executor.ts`**

Create `backend/src/tools/executors/google-sheets-update.executor.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

@Injectable()
export class GoogleSheetsUpdateExecutor implements ToolExecutor {
  readonly name = 'google_sheets_update';
  readonly description = 'Write/overwrite values into a Google Sheets cell range. values is a 2D array of rows. Accepts spreadsheet ID or name.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      spreadsheet: { type: 'string', description: 'Spreadsheet ID or name' },
      range: { type: 'string', description: 'Target range (e.g. "A1:C3")' },
      values: { type: 'array', items: { type: 'array' }, description: '2D array of values to write' },
      tab: { type: 'string', description: 'Tab/sheet name (default: "Sheet1")' },
    },
    required: ['spreadsheet', 'range', 'values'] as string[],
  };

  constructor(private readonly sheets: GoogleSheetsService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const id = await this.sheets.resolveSpreadsheetId(args.spreadsheet as string);
      return await this.sheets.update(id, (args.tab as string) ?? 'Sheet1', args.range as string, args.values as unknown[][]);
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 4: Implement `google-sheets-append.executor.ts`**

Create `backend/src/tools/executors/google-sheets-append.executor.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

@Injectable()
export class GoogleSheetsAppendExecutor implements ToolExecutor {
  readonly name = 'google_sheets_append';
  readonly description = 'Append rows to the end of a Google Sheets tab. values is a 2D array of rows. Accepts spreadsheet ID or name.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      spreadsheet: { type: 'string', description: 'Spreadsheet ID or name' },
      values: { type: 'array', items: { type: 'array' }, description: '2D array of rows to append' },
      tab: { type: 'string', description: 'Tab/sheet name (default: "Sheet1")' },
    },
    required: ['spreadsheet', 'values'] as string[],
  };

  constructor(private readonly sheets: GoogleSheetsService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const id = await this.sheets.resolveSpreadsheetId(args.spreadsheet as string);
      return await this.sheets.append(id, (args.tab as string) ?? 'Sheet1', args.values as unknown[][]);
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npx jest google-sheets-update.executor.spec google-sheets-append.executor.spec --no-coverage
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/tools/executors/google-sheets-update.executor.ts \
        backend/src/tools/executors/google-sheets-update.executor.spec.ts \
        backend/src/tools/executors/google-sheets-append.executor.ts \
        backend/src/tools/executors/google-sheets-append.executor.spec.ts
git commit -m "feat: add google_sheets_update and google_sheets_append executors"
```

---

### Task 5: Executors — `google_sheets_create` and `google_sheets_add_tab`

**Files:**
- Create: `backend/src/tools/executors/google-sheets-create.executor.ts`
- Create: `backend/src/tools/executors/google-sheets-create.executor.spec.ts`
- Create: `backend/src/tools/executors/google-sheets-add-tab.executor.ts`
- Create: `backend/src/tools/executors/google-sheets-add-tab.executor.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/tools/executors/google-sheets-create.executor.spec.ts`:

```ts
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
    expect(service.create).toHaveBeenCalledWith('My Report', 'Data');
    expect(result).toBe('Created spreadsheet: My Report (id: newId12345678901234567)');
  });

  it('creates without initialTab when omitted', async () => {
    service.create.mockResolvedValue('Created spreadsheet: Untitled (id: id12345678901234567890)');
    await executor.execute({ title: 'Untitled' });
    expect(service.create).toHaveBeenCalledWith('Untitled', undefined);
  });

  it('returns error on failure', async () => {
    service.create.mockRejectedValue(new Error('Google Sheets not connected'));
    const result = await executor.execute({ title: 'X' });
    expect(result).toBe('Error: Google Sheets not connected');
  });
});
```

Create `backend/src/tools/executors/google-sheets-add-tab.executor.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest google-sheets-create.executor.spec google-sheets-add-tab.executor.spec --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement both executors**

Create `backend/src/tools/executors/google-sheets-create.executor.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

@Injectable()
export class GoogleSheetsCreateExecutor implements ToolExecutor {
  readonly name = 'google_sheets_create';
  readonly description = 'Create a new Google Sheets spreadsheet with a given title and optional first tab name.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Spreadsheet title' },
      initialTab: { type: 'string', description: 'Name for the first tab (optional, defaults to "Sheet1")' },
    },
    required: ['title'] as string[],
  };

  constructor(private readonly sheets: GoogleSheetsService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      return await this.sheets.create(args.title as string, args.initialTab as string | undefined);
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

Create `backend/src/tools/executors/google-sheets-add-tab.executor.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

@Injectable()
export class GoogleSheetsAddTabExecutor implements ToolExecutor {
  readonly name = 'google_sheets_add_tab';
  readonly description = 'Add a new tab/sheet to an existing Google Sheets spreadsheet. Accepts spreadsheet ID or name.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      spreadsheet: { type: 'string', description: 'Spreadsheet ID or name' },
      tabName: { type: 'string', description: 'Name for the new tab' },
    },
    required: ['spreadsheet', 'tabName'] as string[],
  };

  constructor(private readonly sheets: GoogleSheetsService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const id = await this.sheets.resolveSpreadsheetId(args.spreadsheet as string);
      return await this.sheets.addTab(id, args.tabName as string);
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest google-sheets-create.executor.spec google-sheets-add-tab.executor.spec --no-coverage
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/tools/executors/google-sheets-create.executor.ts \
        backend/src/tools/executors/google-sheets-create.executor.spec.ts \
        backend/src/tools/executors/google-sheets-add-tab.executor.ts \
        backend/src/tools/executors/google-sheets-add-tab.executor.spec.ts
git commit -m "feat: add google_sheets_create and google_sheets_add_tab executors"
```

---

### Task 6: Executors — `google_sheets_format` and `google_sheets_chart`

**Files:**
- Create: `backend/src/tools/executors/google-sheets-format.executor.ts`
- Create: `backend/src/tools/executors/google-sheets-format.executor.spec.ts`
- Create: `backend/src/tools/executors/google-sheets-chart.executor.ts`
- Create: `backend/src/tools/executors/google-sheets-chart.executor.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/tools/executors/google-sheets-format.executor.spec.ts`:

```ts
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
```

Create `backend/src/tools/executors/google-sheets-chart.executor.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest google-sheets-format.executor.spec google-sheets-chart.executor.spec --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `google-sheets-format.executor.ts`**

Create `backend/src/tools/executors/google-sheets-format.executor.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleSheetsService, SheetFormat } from '../../connector/providers/google/google-sheets.service';

@Injectable()
export class GoogleSheetsFormatExecutor implements ToolExecutor {
  readonly name = 'google_sheets_format';
  readonly description = 'Apply formatting to a Google Sheets range. Supports bold, italic, fontSize, fontColor (hex), fillColor (hex), numberFormat (pattern), border. Accepts spreadsheet ID or name.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      spreadsheet: { type: 'string', description: 'Spreadsheet ID or name' },
      range: { type: 'string', description: 'Cell range (e.g. "A1:D1")' },
      tab: { type: 'string', description: 'Tab/sheet name (default: "Sheet1")' },
      format: {
        type: 'object',
        description: 'Formatting options',
        properties: {
          bold: { type: 'boolean' },
          italic: { type: 'boolean' },
          fontSize: { type: 'number' },
          fontColor: { type: 'string', description: 'Hex color e.g. "#FF0000"' },
          fillColor: { type: 'string', description: 'Hex background color e.g. "#FFFF00"' },
          numberFormat: { type: 'string', description: 'Number format pattern e.g. "#,##0.00"' },
          border: { type: 'boolean' },
        },
      },
    },
    required: ['spreadsheet', 'range', 'format'] as string[],
  };

  constructor(private readonly sheets: GoogleSheetsService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const id = await this.sheets.resolveSpreadsheetId(args.spreadsheet as string);
      return await this.sheets.format(id, (args.tab as string) ?? 'Sheet1', args.range as string, args.format as SheetFormat);
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 4: Implement `google-sheets-chart.executor.ts`**

Create `backend/src/tools/executors/google-sheets-chart.executor.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleSheetsService } from '../../connector/providers/google/google-sheets.service';

@Injectable()
export class GoogleSheetsChartExecutor implements ToolExecutor {
  readonly name = 'google_sheets_chart';
  readonly description = 'Add a chart to a Google Sheets tab. type: BAR, LINE, PIE, COLUMN. dataRange: source data (e.g. "B2:D5"). categoriesRange: labels column (e.g. "A2:A5"). Accepts spreadsheet ID or name.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      spreadsheet: { type: 'string', description: 'Spreadsheet ID or name' },
      tab: { type: 'string', description: 'Tab/sheet name where the chart is added' },
      type: { type: 'string', enum: ['BAR', 'LINE', 'PIE', 'COLUMN'], description: 'Chart type' },
      dataRange: { type: 'string', description: 'Source data range (e.g. "B2:D5")' },
      categoriesRange: { type: 'string', description: 'Categories/labels range (e.g. "A2:A5") — optional' },
      title: { type: 'string', description: 'Chart title — optional' },
    },
    required: ['spreadsheet', 'tab', 'type', 'dataRange'] as string[],
  };

  constructor(private readonly sheets: GoogleSheetsService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const id = await this.sheets.resolveSpreadsheetId(args.spreadsheet as string);
      return await this.sheets.chart(
        id,
        args.tab as string,
        args.type as 'BAR' | 'LINE' | 'PIE' | 'COLUMN',
        args.dataRange as string,
        args.categoriesRange as string | undefined,
        args.title as string | undefined,
      );
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npx jest google-sheets-format.executor.spec google-sheets-chart.executor.spec --no-coverage
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/tools/executors/google-sheets-format.executor.ts \
        backend/src/tools/executors/google-sheets-format.executor.spec.ts \
        backend/src/tools/executors/google-sheets-chart.executor.ts \
        backend/src/tools/executors/google-sheets-chart.executor.spec.ts
git commit -m "feat: add google_sheets_format and google_sheets_chart executors"
```

---

### Task 7: Wire executors into module, agent-loop, and seed

**Files:**
- Modify: `backend/src/tools/tools.module.ts`
- Modify: `backend/src/agent/services/agent-loop.service.ts`
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Update `tools.module.ts`**

Add imports after the last `GoogleDriveCreateFolderExecutor` import line (~line 50):

```ts
import { GoogleSheetsReadExecutor } from './executors/google-sheets-read.executor';
import { GoogleSheetsListTabsExecutor } from './executors/google-sheets-list-tabs.executor';
import { GoogleSheetsUpdateExecutor } from './executors/google-sheets-update.executor';
import { GoogleSheetsAppendExecutor } from './executors/google-sheets-append.executor';
import { GoogleSheetsCreateExecutor } from './executors/google-sheets-create.executor';
import { GoogleSheetsAddTabExecutor } from './executors/google-sheets-add-tab.executor';
import { GoogleSheetsFormatExecutor } from './executors/google-sheets-format.executor';
import { GoogleSheetsChartExecutor } from './executors/google-sheets-chart.executor';
```

Add to the `EXECUTORS` array after `GoogleDriveCreateFolderExecutor`:

```ts
  GoogleSheetsReadExecutor,
  GoogleSheetsListTabsExecutor,
  GoogleSheetsUpdateExecutor,
  GoogleSheetsAppendExecutor,
  GoogleSheetsCreateExecutor,
  GoogleSheetsAddTabExecutor,
  GoogleSheetsFormatExecutor,
  GoogleSheetsChartExecutor,
```

- [ ] **Step 2: Update `agent-loop.service.ts`**

Add imports after the `GoogleDriveCreateFolderExecutor` import (~line 60):

```ts
import { GoogleSheetsReadExecutor } from '../../tools/executors/google-sheets-read.executor';
import { GoogleSheetsListTabsExecutor } from '../../tools/executors/google-sheets-list-tabs.executor';
import { GoogleSheetsUpdateExecutor } from '../../tools/executors/google-sheets-update.executor';
import { GoogleSheetsAppendExecutor } from '../../tools/executors/google-sheets-append.executor';
import { GoogleSheetsCreateExecutor } from '../../tools/executors/google-sheets-create.executor';
import { GoogleSheetsAddTabExecutor } from '../../tools/executors/google-sheets-add-tab.executor';
import { GoogleSheetsFormatExecutor } from '../../tools/executors/google-sheets-format.executor';
import { GoogleSheetsChartExecutor } from '../../tools/executors/google-sheets-chart.executor';
```

Add constructor parameters after `googleDriveCreateFolder`:

```ts
private readonly googleSheetsRead: GoogleSheetsReadExecutor,
private readonly googleSheetsListTabs: GoogleSheetsListTabsExecutor,
private readonly googleSheetsUpdate: GoogleSheetsUpdateExecutor,
private readonly googleSheetsAppend: GoogleSheetsAppendExecutor,
private readonly googleSheetsCreate: GoogleSheetsCreateExecutor,
private readonly googleSheetsAddTab: GoogleSheetsAddTabExecutor,
private readonly googleSheetsFormat: GoogleSheetsFormatExecutor,
private readonly googleSheetsChart: GoogleSheetsChartExecutor,
```

Add to `this.executorMap` after `[googleDriveCreateFolder.name, googleDriveCreateFolder]`:

```ts
[googleSheetsRead.name, googleSheetsRead],
[googleSheetsListTabs.name, googleSheetsListTabs],
[googleSheetsUpdate.name, googleSheetsUpdate],
[googleSheetsAppend.name, googleSheetsAppend],
[googleSheetsCreate.name, googleSheetsCreate],
[googleSheetsAddTab.name, googleSheetsAddTab],
[googleSheetsFormat.name, googleSheetsFormat],
[googleSheetsChart.name, googleSheetsChart],
```

- [ ] **Step 3: Add seed entries**

In `backend/prisma/seed.ts`, add after the last `google_drive_create_folder` entry in `DEFAULT_TOOLS`:

```ts
{ name: 'google_sheets_read', description: 'Read data from a Google Sheets range and return a markdown table. Parameters: spreadsheet (ID or name, required), range (e.g. "A1:D10", required), tab (sheet name, default: "Sheet1").', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string","description":"Spreadsheet ID or name"},"range":{"type":"string","description":"Cell range e.g. A1:D10"},"tab":{"type":"string","description":"Tab/sheet name (default: Sheet1)"}},"required":["spreadsheet","range"]}', enabled: false },
{ name: 'google_sheets_list_tabs', description: 'List all tabs/sheets in a Google Sheets spreadsheet with their row and column counts.', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string","description":"Spreadsheet ID or name"}},"required":["spreadsheet"]}', enabled: false },
{ name: 'google_sheets_update', description: 'Overwrite values in a Google Sheets range. values is a 2D array (array of rows). Parameters: spreadsheet (ID or name), range (e.g. "A1:C3"), values (2D array), tab (default: "Sheet1").', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string"},"range":{"type":"string"},"values":{"type":"array","items":{"type":"array"}},"tab":{"type":"string"}},"required":["spreadsheet","range","values"]}', enabled: false },
{ name: 'google_sheets_append', description: 'Append rows to the end of a Google Sheets tab. values is a 2D array of rows to add. Parameters: spreadsheet (ID or name), values (2D array), tab (default: "Sheet1").', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string"},"values":{"type":"array","items":{"type":"array"}},"tab":{"type":"string"}},"required":["spreadsheet","values"]}', enabled: false },
{ name: 'google_sheets_create', description: 'Create a new Google Sheets spreadsheet. Parameters: title (required), initialTab (optional name for the first tab).', parameters: '{"type":"object","properties":{"title":{"type":"string","description":"Spreadsheet title"},"initialTab":{"type":"string","description":"Name for the first tab (optional)"}},"required":["title"]}', enabled: false },
{ name: 'google_sheets_add_tab', description: 'Add a new tab/sheet to an existing Google Sheets spreadsheet. Parameters: spreadsheet (ID or name), tabName (name of the new tab).', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string"},"tabName":{"type":"string"}},"required":["spreadsheet","tabName"]}', enabled: false },
{ name: 'google_sheets_format', description: 'Apply formatting to a Google Sheets cell range. format object supports: bold, italic, fontSize, fontColor (hex), fillColor (hex), numberFormat (pattern like "#,##0.00"), border. Parameters: spreadsheet, range, format (object), tab (default: "Sheet1").', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string"},"range":{"type":"string"},"tab":{"type":"string"},"format":{"type":"object","properties":{"bold":{"type":"boolean"},"italic":{"type":"boolean"},"fontSize":{"type":"number"},"fontColor":{"type":"string"},"fillColor":{"type":"string"},"numberFormat":{"type":"string"},"border":{"type":"boolean"}}}},"required":["spreadsheet","range","format"]}', enabled: false },
{ name: 'google_sheets_chart', description: 'Add a chart to a Google Sheets tab. type: BAR, LINE, PIE, COLUMN. dataRange: source data (e.g. "B2:D5"). categoriesRange: labels column (e.g. "A2:A5", optional). Parameters: spreadsheet, tab, type, dataRange, categoriesRange (optional), title (optional).', parameters: '{"type":"object","properties":{"spreadsheet":{"type":"string"},"tab":{"type":"string"},"type":{"type":"string","enum":["BAR","LINE","PIE","COLUMN"]},"dataRange":{"type":"string"},"categoriesRange":{"type":"string"},"title":{"type":"string"}},"required":["spreadsheet","tab","type","dataRange"]}', enabled: false },
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run all Google Sheets tests to confirm nothing broke**

```bash
cd backend && npx jest google-sheets --no-coverage
```

Expected: all PASS.

- [ ] **Step 6: Run seed to register tools in DB**

```bash
cd backend && npm run setup
```

Expected: seed completes, prints `google_sheets_read ... upserted` (or similar) for all 8 new tools.

- [ ] **Step 7: Commit**

```bash
git add backend/src/tools/tools.module.ts \
        backend/src/agent/services/agent-loop.service.ts \
        backend/prisma/seed.ts
git commit -m "feat: wire Google Sheets executors into tools module, agent loop, and seed"
```

---

### Task 8: Update AGENTS.md docs

**Files:**
- Modify: `backend/src/connector/AGENTS.md`
- Modify: `backend/src/tools/AGENTS.md`

- [ ] **Step 1: Update `connector/AGENTS.md`**

In the `## Files` section, add `google-sheets.service.ts` under `google/`:

```
└── google/
    ├── google-oauth.service.ts
    ├── gmail.service.ts
    ├── google-calendar.service.ts
    ├── google-drive.service.ts
    └── google-sheets.service.ts     — Sheets API v4: read/listTabs/update/append/create/addTab/format/chart + resolveSpreadsheetId
```

In the `## Tools Registered` table, add 8 new rows:

```
| `google_sheets_read`        | `GoogleSheetsReadExecutor`        | GoogleSheetsService |
| `google_sheets_list_tabs`   | `GoogleSheetsListTabsExecutor`    | GoogleSheetsService |
| `google_sheets_update`      | `GoogleSheetsUpdateExecutor`      | GoogleSheetsService |
| `google_sheets_append`      | `GoogleSheetsAppendExecutor`      | GoogleSheetsService |
| `google_sheets_create`      | `GoogleSheetsCreateExecutor`      | GoogleSheetsService |
| `google_sheets_add_tab`     | `GoogleSheetsAddTabExecutor`      | GoogleSheetsService |
| `google_sheets_format`      | `GoogleSheetsFormatExecutor`      | GoogleSheetsService |
| `google_sheets_chart`       | `GoogleSheetsChartExecutor`       | GoogleSheetsService |
```

In the `## OAuth Scopes` section, add:

```
- Sheets: `https://www.googleapis.com/auth/spreadsheets`
- Sheets (Drive search): `https://www.googleapis.com/auth/drive.readonly`
```

- [ ] **Step 2: Update `tools/AGENTS.md`**

In the `## Available Executors` table, add 8 rows after the last Drive executor row:

```
| `GoogleSheetsReadExecutor`      | `google_sheets_read`        | Read a Sheets range → markdown table |
| `GoogleSheetsListTabsExecutor`  | `google_sheets_list_tabs`   | List tabs in a spreadsheet |
| `GoogleSheetsUpdateExecutor`    | `google_sheets_update`      | Overwrite values in a range |
| `GoogleSheetsAppendExecutor`    | `google_sheets_append`      | Append rows to a tab |
| `GoogleSheetsCreateExecutor`    | `google_sheets_create`      | Create a new spreadsheet |
| `GoogleSheetsAddTabExecutor`    | `google_sheets_add_tab`     | Add a tab to a spreadsheet |
| `GoogleSheetsFormatExecutor`    | `google_sheets_format`      | Format a cell range |
| `GoogleSheetsChartExecutor`     | `google_sheets_chart`       | Add a chart to a tab |
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/connector/AGENTS.md backend/src/tools/AGENTS.md
git commit -m "docs: update AGENTS.md for Google Sheets tools"
```

---

### Task 9: Full test run

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: all existing tests continue to pass. New Google Sheets tests pass. No regressions.

- [ ] **Step 2: TypeScript final check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.
