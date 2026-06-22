import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { SlackService } from '../../connector/providers/slack/slack.service';

@Injectable()
export class SlackGetHistoryExecutor implements ToolExecutor {
  readonly name = 'slack_get_history';
  readonly description = 'Get recent messages from a Slack channel. Returns messages with user, text, and timestamp.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      channel: { type: 'string', description: 'Channel ID to read history from' },
      limit: { type: 'number', description: 'Max messages (default: 20)' },
    },
    required: ['channel'] as string[],
  };

  constructor(private readonly slack: SlackService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.slack.getConversationHistory(args.channel as string, (args.limit as number) ?? 20);
      if (result.messages.length === 0) return 'No messages found.';
      return result.messages.map(m =>
        `[${new Date(Number(m.ts) * 1000).toLocaleString('vi-VN')}] <@${m.user ?? 'unknown'}>: ${m.text}`
      ).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
