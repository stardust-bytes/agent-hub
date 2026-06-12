import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleDriveService } from '../../connector/providers/google/google-drive.service';

@Injectable()
export class GoogleDriveListExecutor implements ToolExecutor {
  readonly name = 'google_drive_list';
  readonly description = 'List files and folders in a Google Drive directory. Omit folderId to list root.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      folderId: { type: 'string', description: 'Folder ID to list (omit for root)' },
    },
  };

  constructor(private readonly drive: GoogleDriveService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const files = await this.drive.listFiles(args.folderId as string);
      if (files.length === 0) return 'Folder is empty.';
      return files.map(f => `${f.mimeType.includes('folder') ? '📁' : '📄'} ${f.name}`).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
