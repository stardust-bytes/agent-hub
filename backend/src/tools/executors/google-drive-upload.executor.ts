import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleDriveService } from '../../connector/providers/google/google-drive.service';

@Injectable()
export class GoogleDriveUploadExecutor implements ToolExecutor {
  readonly name = 'google_drive_upload';
  readonly description = 'Upload a text file to Google Drive.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'File name' },
      content: { type: 'string', description: 'File content' },
    },
    required: ['name', 'content'] as string[],
  };

  constructor(private readonly drive: GoogleDriveService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const file = await this.drive.upload(args.name as string, args.content as string);
      return `File uploaded: ${file.name} (${file.id})`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
