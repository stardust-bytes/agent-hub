import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleDriveService } from '../../connector/providers/google/google-drive.service';

@Injectable()
export class GoogleDriveUploadExecutor implements ToolExecutor {
  readonly name = 'google_drive_upload';
  readonly description = 'Upload a file to Google Drive. Supports any file type via base64 content.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'File name with extension (e.g. report.pdf, image.png)' },
      contentBase64: { type: 'string', description: 'File content as base64-encoded string' },
      mimeType: { type: 'string', description: 'MIME type (e.g. image/png, application/pdf, text/plain). Default: text/plain' },
    },
    required: ['name', 'contentBase64'] as string[],
  };

  constructor(private readonly drive: GoogleDriveService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const file = await this.drive.upload(args.name as string, args.contentBase64 as string, (args.mimeType as string) ?? 'text/plain');
      return `File uploaded: ${file.name} (${file.id})`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
