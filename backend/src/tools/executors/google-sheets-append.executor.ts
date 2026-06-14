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
