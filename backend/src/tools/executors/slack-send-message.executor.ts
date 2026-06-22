import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { SlackService } from '../../connector/providers/slack/slack.service';

@Injectable()
export class SlackSendMessageExecutor implements ToolExecutor {
  readonly name = 'slack_send_message';
  readonly description = 'Send a message to a Slack channel by channel name or ID.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      channel: { type: 'string', description: 'Channel name (e.g. #general) or channel ID' },
      text: { type: 'string', description: 'Message text to send' },
    },
    required: ['channel', 'text'] as string[],
  };

  constructor(private readonly slack: SlackService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.slack.sendMessage(args.channel as string, args.text as string);
      return result.ok ? `Message sent to ${args.channel}` : 'Failed to send message.';
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
