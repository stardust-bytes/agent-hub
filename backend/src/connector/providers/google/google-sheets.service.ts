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
