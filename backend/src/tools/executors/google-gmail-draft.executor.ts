import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GmailService } from '../../connector/providers/google/gmail.service';

@Injectable()
export class GoogleGmailDraftExecutor implements ToolExecutor {
  readonly name = 'google_gmail_draft';
  readonly description = 'Create a Gmail email draft (does not send).';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      to: { type: 'array', items: { type: 'string' }, description: 'Recipients' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body text' },
    },
    required: ['to', 'subject', 'body'] as string[],
  };

  constructor(private readonly gmail: GmailService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.gmail.createDraft(args.to as string[], args.subject as string, args.body as string);
      return `Draft created. ID: ${result.id}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
