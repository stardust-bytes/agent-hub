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
