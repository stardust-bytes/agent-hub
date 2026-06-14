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
