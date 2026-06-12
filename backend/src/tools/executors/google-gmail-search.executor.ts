import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GmailService } from '../../connector/providers/google/gmail.service';

@Injectable()
export class GoogleGmailSearchExecutor implements ToolExecutor {
  readonly name = 'google_gmail_search';
  readonly description = 'Search Gmail emails by query. Supports Gmail search syntax (from:, subject:, after:, etc.).';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Gmail search query' },
      maxResults: { type: 'number', description: 'Max results (default: 20)' },
    },
    required: ['query'] as string[],
  };

  constructor(private readonly gmail: GmailService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const messages = await this.gmail.search(args.query as string, (args.maxResults as number) ?? 20);
      if (messages.length === 0) return 'No emails found.';
      return messages.map(m => `[${m.date}] ${m.from} - ${m.subject} (${m.snippet.slice(0, 100)})`).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
