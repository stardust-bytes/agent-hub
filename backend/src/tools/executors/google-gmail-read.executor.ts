import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GmailService } from '../../connector/providers/google/gmail.service';

@Injectable()
export class GoogleGmailReadExecutor implements ToolExecutor {
  readonly name = 'google_gmail_read';
  readonly description = 'Read full content of a specific Gmail email by ID.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      id: { type: 'string', description: 'Email ID to read' },
    },
    required: ['id'] as string[],
  };

  constructor(private readonly gmail: GmailService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const msg = await this.gmail.get(args.id as string);
      return `From: ${msg.from}\nTo: ${msg.to}\nDate: ${msg.date}\nSubject: ${msg.subject}\nLabels: ${msg.labels.join(', ')}\n\n${msg.body || msg.snippet}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
