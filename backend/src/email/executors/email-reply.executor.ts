import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { EmailService } from '../email.service';

@Injectable()
export class EmailReplyExecutor implements ToolExecutor {
  readonly name = 'email_reply';

  constructor(private readonly email: EmailService) {}

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const id = String(args.id ?? '');
    const body = String(args.body ?? '');
    const mode = String(args.mode ?? 'reply') as 'reply' | 'reply_all' | 'forward';
    if (!id) return 'Error: "id" is required';
    if (!body) return 'Error: "body" is required';
    try {
      const result = await this.email.reply(id, body, mode);
      return `${mode === 'forward' ? 'Forwarded' : 'Replied'} successfully. ID: ${result.id}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
