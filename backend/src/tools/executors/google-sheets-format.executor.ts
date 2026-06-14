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
