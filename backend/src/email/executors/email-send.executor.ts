import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { EmailService } from '../email.service';

@Injectable()
export class EmailSendExecutor implements ToolExecutor {
  readonly name = 'email_send';

  constructor(private readonly email: EmailService) {}

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const to = args.to;
    const subject = String(args.subject ?? '');
    const body = String(args.body ?? '');
    if (!Array.isArray(to) || to.length === 0) return 'Error: "to" must be a non-empty array';
    if (!subject) return 'Error: "subject" is required';
    try {
      const result = await this.email.send({
        to: to.map(String),
        subject,
        body,
        cc: Array.isArray(args.cc) ? args.cc.map(String) : undefined,
        bcc: Array.isArray(args.bcc) ? args.bcc.map(String) : undefined,
      });
      return `Email sent successfully. ID: ${result.id}`;
    } catch (e) {
      return `Error sending email: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
