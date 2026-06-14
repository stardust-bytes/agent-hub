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
