import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleDriveService } from '../../connector/providers/google/google-drive.service';

@Injectable()
export class GoogleDriveCreateFolderExecutor implements ToolExecutor {
  readonly name = 'google_drive_create_folder';
  readonly description = 'Create a new folder in Google Drive. Optionally specify a parent folder ID to create the folder inside.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Folder name' },
      parentFolderId: { type: 'string', description: 'Parent folder ID (omit to create in root)' },
    },
    required: ['name'] as string[],
  };

  constructor(private readonly drive: GoogleDriveService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const file = await this.drive.createFolder(args.name as string, args.parentFolderId as string);
      return `Folder created: "${file.name}" (${file.id})${file.webViewLink ? `\n${file.webViewLink}` : ''}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
