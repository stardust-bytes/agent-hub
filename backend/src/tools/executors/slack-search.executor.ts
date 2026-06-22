import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { SlackService } from '../../connector/providers/slack/slack.service';

@Injectable()
export class SlackSearchExecutor implements ToolExecutor {
  readonly name = 'slack_search';
  readonly description = 'Search Slack messages across all channels. Supports Slack search syntax (from:, in:, after:).';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query with Slack qualifiers' },
      count: { type: 'number', description: 'Max results (default: 20)' },
    },
    required: ['query'] as string[],
  };

  constructor(private readonly slack: SlackService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const messages = await this.slack.searchMessages(args.query as string, (args.count as number) ?? 20);
      if (messages.length === 0) return 'No messages found.';
      return messages.map(m =>
        `#${m.channel ?? 'unknown'} — <@${m.user ?? 'unknown'}>: ${m.text?.slice(0, 200) ?? ''}`
      ).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
