import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { EmailService } from '../email.service';

@Injectable()
export class EmailListExecutor implements ToolExecutor {
  readonly name = 'email_list';

  constructor(private readonly email: EmailService) {}

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const folder = String(args.folder ?? 'INBOX');
    const limit = Number(args.limit ?? 20);
    const offset = Number(args.offset ?? 0);
    try {
      const messages = await this.email.list(folder, limit, offset);
      if (messages.length === 0) return 'No emails found.';
      return messages.map(m =>
        `[${m.unread ? 'UNREAD' : '    '}] ${m.date.slice(0, 16)} — ${m.from} — ${m.subject} (id: ${m.id})`
      ).join('\n');
    } catch (e) {
      return `Error listing emails: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
