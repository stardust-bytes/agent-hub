import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { SlackService } from '../../connector/providers/slack/slack.service';

@Injectable()
export class SlackListChannelsExecutor implements ToolExecutor {
  readonly name = 'slack_list_channels';
  readonly description = 'List public Slack channels with member count and topic.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      limit: { type: 'number', description: 'Max results (default: 100)' },
    },
    required: [] as string[],
  };

  constructor(private readonly slack: SlackService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.slack.listConversations('public_channel', (args.limit as number) ?? 100);
      if (result.channels.length === 0) return 'No public channels found.';
      return result.channels.map(c =>
        `#${c.name}${c.isArchived ? ' [archived]' : ''} — ${c.memberCount ?? 0} members | topic: ${c.topic ?? 'N/A'}`
      ).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
