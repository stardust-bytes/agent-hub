import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { EmailService } from '../email.service';

@Injectable()
export class EmailReadExecutor implements ToolExecutor {
  readonly name = 'email_read';

  constructor(private readonly email: EmailService) {}

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const id = String(args.id ?? '');
    if (!id) return 'Error: "id" is required';
    try {
      const msg = await this.email.get(id);
      return `From: ${msg.from}\nTo: ${msg.to.join(', ')}\nDate: ${msg.date}\nSubject: ${msg.subject}\n\n${msg.body}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
