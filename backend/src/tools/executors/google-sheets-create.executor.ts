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
