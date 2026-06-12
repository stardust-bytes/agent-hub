import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GmailService } from '../../connector/providers/google/gmail.service';

@Injectable()
export class GoogleGmailLabelsExecutor implements ToolExecutor {
  readonly name = 'google_gmail_labels';
  readonly description = 'List all Gmail labels for the connected account.';
  readonly parameters = { type: 'object' as const, properties: {} };

  constructor(private readonly gmail: GmailService) {}

  async execute(): Promise<string> {
    try {
      const labels = await this.gmail.listLabels();
      if (labels.length === 0) return 'No labels found.';
      return labels.map(l => `${l.name} (${l.id})`).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
