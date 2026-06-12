import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleDriveService } from '../../connector/providers/google/google-drive.service';

@Injectable()
export class GoogleDriveSearchExecutor implements ToolExecutor {
  readonly name = 'google_drive_search';
  readonly description = 'Search files in Google Drive by name.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'File name search query' },
      pageSize: { type: 'number', description: 'Max results (default: 20)' },
    },
    required: ['query'] as string[],
  };

  constructor(private readonly drive: GoogleDriveService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const files = await this.drive.search(args.query as string, (args.pageSize as number) ?? 20);
      if (files.length === 0) return 'No files found.';
      return files.map(f => `[${f.mimeType}] ${f.name} (${f.id})${f.modifiedTime ? ` - ${f.modifiedTime}` : ''}`).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
