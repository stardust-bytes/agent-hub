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
