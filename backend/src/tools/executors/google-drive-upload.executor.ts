import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleDriveService } from '../../connector/providers/google/google-drive.service';

@Injectable()
export class GoogleDriveUploadExecutor implements ToolExecutor {
  readonly name = 'google_drive_upload';
  readonly description = 'Upload a file to Google Drive. Provide either filePath (local file) or name+contentBase64 (inline content).';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      filePath: { type: 'string', description: 'Absolute path to local file (use instead of name+contentBase64)' },
      name: { type: 'string', description: 'File name with extension (e.g. report.pdf). Required if using contentBase64.' },
      contentBase64: { type: 'string', description: 'File content as base64 (use instead of filePath)' },
      mimeType: { type: 'string', description: 'MIME type. Auto-detected from extension if using filePath.' },
    },
  };

  constructor(private readonly drive: GoogleDriveService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      if (args.filePath) {
        const file = await this.drive.uploadFromPath(args.filePath as string, args.name as string);
        return `File uploaded: ${file.name} (${file.id})`;
      }
      const file = await this.drive.upload(args.name as string, args.contentBase64 as string, (args.mimeType as string) ?? 'text/plain');
      return `File uploaded: ${file.name} (${file.id})`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
