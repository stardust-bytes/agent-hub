import { Injectable } from '@nestjs/common';
import { WebClient } from '@slack/web-api';
import { ConnectorService } from '../../connector.service';

@Injectable()
export class SlackService {
  constructor(private readonly connector: ConnectorService) {}

  async getClient(type: string = 'slack'): Promise<WebClient | null> {
    const conn = await this.connector.findByType(type);
    if (!conn?.enabled) return null;
    const config = JSON.parse(conn.config);
    if (!config.token) return null;
    return new WebClient(config.token);
  }

  async sendMessage(channel: string, text: string) {
    const client = await this.getClient();
    if (!client) throw new Error('Slack connector not configured');
    const result = await client.chat.postMessage({ channel, text });
    return { ok: result.ok, channel: result.channel, ts: result.ts };
  }

  async listConversations(types = 'public_channel', limit = 100, cursor?: string) {
    const client = await this.getClient();
    if (!client) throw new Error('Slack connector not configured');
    const result = await client.conversations.list({ types, limit, cursor });
    return {
      channels: (result.channels ?? []).map(c => ({
        id: c.id, name: c.name, topic: c.topic?.value, purpose: c.purpose?.value,
        memberCount: c.num_members, isArchived: c.is_archived,
      })),
      nextCursor: result.response_metadata?.next_cursor,
    };
  }

  async getConversationHistory(channel: string, limit = 20, cursor?: string) {
    const client = await this.getClient();
    if (!client) throw new Error('Slack connector not configured');
    const result = await client.conversations.history({ channel, limit, cursor });
    return {
      messages: (result.messages ?? []).map(m => ({
        ts: m.ts, user: m.user, text: m.text, type: m.type, subtype: m.subtype,
        threadTs: m.thread_ts,
      })),
      hasMore: result.has_more,
      nextCursor: result.response_metadata?.next_cursor,
    };
  }

  async searchMessages(query: string, count = 20) {
    const client = await this.getClient();
    if (!client) throw new Error('Slack connector not configured');
    const result = await client.search.messages({ query, count });
    return (result.messages?.matches ?? []).map(m => ({
      channel: m.channel?.name, user: m.username, text: m.text,
      ts: m.ts, permalink: m.permalink,
    }));
  }
}
