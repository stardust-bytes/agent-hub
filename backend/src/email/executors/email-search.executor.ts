import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { EmailService } from '../email.service';

@Injectable()
export class EmailSearchExecutor implements ToolExecutor {
  readonly name = 'email_search';

  constructor(private readonly email: EmailService) {}

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const query = String(args.query ?? '');
    if (!query) return 'Error: "query" is required';
    try {
      const messages = await this.email.search(query);
      if (messages.length === 0) return 'No emails found matching query.';
      return messages.map(m =>
        `${m.date.slice(0, 16)} — ${m.from} — ${m.subject} (id: ${m.id})`
      ).join('\n');
    } catch (e) {
      return `Error searching emails: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
