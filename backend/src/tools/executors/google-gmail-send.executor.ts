import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GmailService } from '../../connector/providers/google/gmail.service';

@Injectable()
export class GoogleGmailSendExecutor implements ToolExecutor {
  readonly name = 'google_gmail_send';
  readonly description = 'Send an email via Gmail. Supports To, CC, BCC.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      to: { type: 'array', items: { type: 'string' }, description: 'Recipients' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body text' },
      cc: { type: 'array', items: { type: 'string' }, description: 'CC recipients' },
      bcc: { type: 'array', items: { type: 'string' }, description: 'BCC recipients' },
    },
    required: ['to', 'subject', 'body'] as string[],
  };

  constructor(private readonly gmail: GmailService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.gmail.send(
        args.to as string[],
        args.subject as string,
        args.body as string,
        args.cc as string[] | undefined,
        args.bcc as string[] | undefined,
      );
      return `Email sent. ID: ${result.id}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
