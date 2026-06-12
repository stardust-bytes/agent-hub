import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleDriveService } from '../../connector/providers/google/google-drive.service';

@Injectable()
export class GoogleDriveReadExecutor implements ToolExecutor {
  readonly name = 'google_drive_read';
  readonly description = 'Read file content from Google Drive by file ID. Supports text files.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      id: { type: 'string', description: 'File ID to read' },
    },
    required: ['id'] as string[],
  };

  constructor(private readonly drive: GoogleDriveService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const file = await this.drive.get(args.id as string);
      let result = `File: ${file.name}\nType: ${file.mimeType}\n`;
      if (file.content) result += `\n${file.content}`;
      else result += '\n(Content not available for this file type. Open in browser to view.)';
      return result;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
